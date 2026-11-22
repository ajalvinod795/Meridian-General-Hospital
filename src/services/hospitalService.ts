import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AccessStatus,
  AdminRecord,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_DOCTORS,
  DEFAULT_HOSPITAL_CONFIG,
  Doctor,
  DoctorSlot,
  FIELD_LIMITS,
  formatTokenCode,
  getDoctorOpdDate,
  getDoctorTotalTokens,
  getLocalTodayDateString,
  getTokenSlotTimeWindow,
  HospitalConfig,
  isTokenSlotTimeOver,
  makeSlotId,
  MAX_TOTAL_TOKENS,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  QueueStatus,
  TokenBooking,
  UserProfile,
  UserRole,
} from '../types/hospital';

function clampString(val: string, max: number): string {
  return val.trim().slice(0, max);
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getTodayDateString(): string {
  return getLocalTodayDateString();
}

export async function checkIsUserAdmin(user: User): Promise<boolean> {
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) {
    return true;
  }
  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }
}

export async function ensureUserProfile(
  user: User,
  isAdminAccount: boolean
): Promise<{ profile: UserProfile | null; registrationBlocked: boolean }> {
  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingData = snap.data() as UserProfile;
      return {
        profile: {
          ...existingData,
          permanentAddress: existingData.permanentAddress ?? '',
        },
        registrationBlocked: false,
      };
    }

    const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: user.uid,
      displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Patient', FIELD_LIMITS.displayName.max),
      email: clampString(user.email || 'patient@hospital.local', 150),
      profileDescription: isAdminAccount
        ? 'Hospital Operations Administrator managing clinical schedules, token queues, and portal access.'
        : 'Outpatient member registered for specialist consultations and digital token booking.',
      phone: '',
      bloodGroup: '',
      permanentAddress: '',
      emergencyContact: '',
      role: isAdminAccount ? 'admin' : 'patient',
      accessStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newProfile);
      const createdSnap = await getDoc(userRef);
      return {
        profile: createdSnap.exists() ? (createdSnap.data() as UserProfile) : null,
        registrationBlocked: false,
      };
    } catch (createErr) {
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      if (msg.includes('Missing or insufficient permissions') && !isAdminAccount) {
        return { profile: null, registrationBlocked: true };
      }
      handleFirestoreError(createErr, OperationType.CREATE, userPath);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

function normalizeNameForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/[.\s]+/g, ' ').trim();
}

function buildCandidatePatientUids(rawDigits: string): string[] {
  const candidates: string[] = [];
  const add = (d: string) => {
    if (d.length >= 6 && d.length <= 20) {
      const uid = `pat_${d}`;
      if (!candidates.includes(uid)) {
        candidates.push(uid);
      }
    }
  };

  add(rawDigits);
  if (rawDigits.length === 10) {
    add(`91${rawDigits}`);
    add(`0${rawDigits}`);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    add(rawDigits.slice(2));
  } else if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    const trimmed = rawDigits.slice(1);
    add(trimmed);
    add(`91${trimmed}`);
  }
  return candidates;
}

export async function loginExistingPatientWithNameAndPhone(params: {
  fullName: string;
  phone: string;
}): Promise<{
  profile: UserProfile | null;
  suspended: boolean;
}> {
  const digits = params.phone.replace(/\D/g, '').slice(0, 15);
  if (digits.length < 6) {
    throw new Error('Please enter a valid phone number (at least 6 digits).');
  }
  const cleanName = clampString(params.fullName, FIELD_LIMITS.displayName.max);
  if (cleanName.length < 1) {
    throw new Error('Please enter your registered full name.');
  }

  const candidateUids = buildCandidatePatientUids(digits);
  let matchedProfile: UserProfile | null = null;

  for (const uid of candidateUids) {
    const userPath = `users/${uid}`;
    const userRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        matchedProfile = snap.data() as UserProfile;
        break;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  }

  if (!matchedProfile) {
    throw new Error(
      'No existing patient account was found for this phone number. Please click "Create New Account" to register.'
    );
  }

  if (matchedProfile.accessStatus === 'suspended') {
    return { profile: matchedProfile, suspended: true };
  }

  if (normalizeNameForMatch(matchedProfile.displayName || '') !== normalizeNameForMatch(cleanName)) {
    throw new Error(
      'The name entered does not match the patient registered with this phone number. Please verify your spelling or create a new account.'
    );
  }

  return {
    profile: {
      ...matchedProfile,
      profileDescription: matchedProfile.profileDescription ?? '',
      phone: matchedProfile.phone ?? '',
      bloodGroup: matchedProfile.bloodGroup ?? '',
      permanentAddress: matchedProfile.permanentAddress ?? '',
      emergencyContact: matchedProfile.emergencyContact ?? '',
    },
    suspended: false,
  };
}

export async function registerNewPatientWithDetails(params: {
  fullName: string;
  bloodGroup: string;
  phone: string;
  permanentAddress: string;
}): Promise<{
  profile: UserProfile | null;
  registrationBlocked: boolean;
}> {
  const digits = params.phone.replace(/\D/g, '').slice(0, 15);
  if (digits.length < 6) {
    throw new Error('Please enter a valid phone number (at least 6 digits).');
  }
  const cleanName = clampString(params.fullName, FIELD_LIMITS.displayName.max);
  if (cleanName.length < 1) {
    throw new Error('Please enter your full name.');
  }
  const cleanAddress = clampString(params.permanentAddress, FIELD_LIMITS.permanentAddress.max);
  if (cleanAddress.length < FIELD_LIMITS.permanentAddress.min) {
    throw new Error('Please enter your complete permanent address (at least 4 characters).');
  }

  const candidateUids = buildCandidatePatientUids(digits);
  for (const existingUid of candidateUids) {
    const checkPath = `users/${existingUid}`;
    try {
      const checkSnap = await getDoc(doc(db, 'users', existingUid));
      if (checkSnap.exists()) {
        throw new Error(
          'An account already exists with this phone number. Please sign in using Existing Patient Login with your Name and Phone Number.'
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('An account already exists')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, checkPath);
    }
  }

  const uid = `pat_${digits}`;
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid,
    displayName: cleanName,
    email: '',
    profileDescription:
      'Outpatient registered with verified contact and permanent address details.',
    phone: clampString(params.phone.trim() || digits, FIELD_LIMITS.userPhone.max),
    bloodGroup: clampString(params.bloodGroup, FIELD_LIMITS.bloodGroup.max),
    permanentAddress: cleanAddress,
    emergencyContact: '',
    role: 'patient',
    accessStatus: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return {
      profile: createdSnap.exists() ? (createdSnap.data() as UserProfile) : null,
      registrationBlocked: false,
    };
  } catch (createErr) {
    const msg = createErr instanceof Error ? createErr.message : String(createErr);
    if (msg.includes('Missing or insufficient permissions')) {
      try {
        const cfgSnap = await getDoc(doc(db, 'hospitalConfig', 'settings'));
        if (cfgSnap.exists() && cfgSnap.data()?.allowNewRegistrations === false) {
          return { profile: null, registrationBlocked: true };
        }
      } catch {
        // Fall through to handleFirestoreError
      }
    }
    handleFirestoreError(createErr, OperationType.CREATE, userPath);
  }
}

export async function seedInitialHospitalDataIfAdmin(adminUid: string): Promise<void> {
  const configPath = 'hospitalConfig/settings';
  try {
    const configRef = doc(db, 'hospitalConfig', 'settings');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        ...DEFAULT_HOSPITAL_CONFIG,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, configPath);
  }

  const doctorsPath = 'doctors';
  try {
    const docsSnap = await getDocs(query(collection(db, 'doctors'), limit(100)));
    if (docsSnap.empty) {
      for (const doctor of DEFAULT_DOCTORS) {
        await setDoc(doc(db, 'doctors', doctor.doctorId), {
          ...doctor,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, doctorsPath);
  }
}

export function subscribeHospitalConfig(
  onData: (config: HospitalConfig) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'hospitalConfig/settings';
  return onSnapshot(
    doc(db, 'hospitalConfig', 'settings'),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as HospitalConfig);
      } else {
        onData({
          ...DEFAULT_HOSPITAL_CONFIG,
          updatedBy: 'system',
        });
      }
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeDoctors(
  onData: (doctors: Doctor[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'doctors';
  const q = query(collection(db, 'doctors'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Doctor);
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeDoctorSlots(
  doctorId: string,
  bookingDate: string,
  onData: (slots: DoctorSlot[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'doctorSlots';
  const q = query(
    collection(db, 'doctorSlots'),
    where('doctorId', '==', doctorId),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as DoctorSlot)
        .filter((s) => s.bookingDate === bookingDate)
        .sort((a, b) => a.tokenNumber - b.tokenNumber);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllDoctorSlots(
  onData: (slots: DoctorSlot[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'doctorSlots';
  const q = query(collection(db, 'doctorSlots'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as DoctorSlot);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllDoctorSlotsForDate(
  bookingDate: string,
  onData: (slots: DoctorSlot[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'doctorSlots';
  const q = query(
    collection(db, 'doctorSlots'),
    where('bookingDate', '==', bookingDate),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as DoctorSlot);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function subscribePatientTokens(
  uid: string,
  onData: (tokens: TokenBooking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'tokens';
  const q = query(collection(db, 'tokens'), where('patientUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as TokenBooking);
      list.sort((a, b) => {
        const timeDiff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        if (timeDiff !== 0) return timeDiff;
        const dateDiff = (b.bookingDate || '').localeCompare(a.bookingDate || '');
        if (dateDiff !== 0) return dateDiff;
        return b.tokenNumber - a.tokenNumber;
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePatientPayments(
  uid: string,
  onData: (payments: PaymentRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'payments';
  const q = query(collection(db, 'payments'), where('patientUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as PaymentRecord);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllUsersAdmin(
  onData: (users: UserProfile[]) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserProfile);
      list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeAllAdmins(
  onData: (admins: AdminRecord[]) => void
): Unsubscribe {
  const path = 'admins';
  return onSnapshot(
    collection(db, 'admins'),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AdminRecord));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeAllTokensAdmin(
  onData: (tokens: TokenBooking[]) => void
): Unsubscribe {
  const path = 'tokens';
  return onSnapshot(
    collection(db, 'tokens'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as TokenBooking);
      list.sort((a, b) => b.tokenNumber - a.tokenNumber);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeAllPaymentsAdmin(
  onData: (payments: PaymentRecord[]) => void
): Unsubscribe {
  const path = 'payments';
  return onSnapshot(
    collection(db, 'payments'),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PaymentRecord));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function updateOwnUserProfile(
  uid: string,
  updates: {
    displayName: string;
    profileDescription: string;
    phone: string;
    bloodGroup: string;
    permanentAddress: string;
    emergencyContact: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampString(updates.displayName || 'Patient', FIELD_LIMITS.displayName.max),
      profileDescription: clampString(updates.profileDescription, FIELD_LIMITS.profileDescription.max),
      phone: clampString(updates.phone, FIELD_LIMITS.userPhone.max),
      bloodGroup: clampString(updates.bloodGroup, FIELD_LIMITS.bloodGroup.max),
      permanentAddress: clampString(updates.permanentAddress, FIELD_LIMITS.permanentAddress.max),
      emergencyContact: clampString(updates.emergencyContact, FIELD_LIMITS.emergencyContact.max),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bookDoctorTokenWithPayment(params: {
  doctorId: string;
  selectedTokenNumber: number;
  bookingDate?: string;
  patientUid: string;
  patientName: string;
  visitReason: string;
  paymentMethod: PaymentMethod;
  paymentDetailLabel: string;
}): Promise<{ token: TokenBooking; payment: PaymentRecord }> {
  const {
    doctorId,
    selectedTokenNumber,
    bookingDate: requestedDate,
    patientUid,
    patientName,
    visitReason,
    paymentMethod,
    paymentDetailLabel,
  } = params;
  const doctorRef = doc(db, 'doctors', doctorId);
  const tokenId = makeSafeId('tok');
  const paymentId = makeSafeId('pay');
  const tokenRef = doc(db, 'tokens', tokenId);
  const paymentRefDoc = doc(db, 'payments', paymentId);
  const slotNumber = Math.floor(Number(selectedTokenNumber));

  const isDeskPayment = paymentMethod === 'Hospital Desk';
  const paymentStatus: PaymentStatus = isDeskPayment ? 'pending' : 'paid';
  const refPrefix = isDeskPayment ? 'DESK' : paymentMethod === 'UPI' ? 'UPI' : paymentMethod === 'Insurance' ? 'INS' : 'CARD';
  const paymentRefCode = clampString(
    `${refPrefix}-${Date.now().toString().slice(-6)}-${paymentDetailLabel}`.replace(/[^a-zA-Z0-9-]/g, ''),
    64
  );

  try {
    const result = await runTransaction(db, async (tx) => {
      const doctorSnap = await tx.get(doctorRef);
      if (!doctorSnap.exists()) {
        throw new Error('Selected doctor record was not found.');
      }
      const doctor = doctorSnap.data() as Doctor;
      if (!doctor.isAvailable) {
        throw new Error(`${doctor.name} is currently unavailable for new tokens.`);
      }

      const doctorActiveOpdDate = getDoctorOpdDate(doctor);
      const chosenDate =
        requestedDate && FIELD_LIMITS.DATE_REGEX.test(requestedDate)
          ? requestedDate
          : doctorActiveOpdDate;
      const slotId = makeSlotId(doctorId, chosenDate, slotNumber);
      const slotRef = doc(db, 'doctorSlots', slotId);

      const maxTokens = getDoctorTotalTokens(doctor);
      if (!Number.isFinite(slotNumber) || slotNumber < 1 || slotNumber > maxTokens) {
        throw new Error(
          `Please select a valid token between 1 and ${maxTokens}.`
        );
      }
      if (chosenDate === doctorActiveOpdDate && slotNumber <= doctor.currentServingNumber) {
        throw new Error(
          `Token ${formatTokenCode(doctor.tokenPrefix, slotNumber)} has already been served. Please select an upcoming token.`
        );
      }

      const tokenCode = formatTokenCode(doctor.tokenPrefix, slotNumber);
      const slotTime = getTokenSlotTimeWindow(doctor.shiftHours, slotNumber);
      if (isTokenSlotTimeOver(chosenDate, doctor.shiftHours, slotNumber)) {
        throw new Error(
          `Token ${tokenCode} (${slotTime} on ${chosenDate}) has expired because its time has ended. Please select an upcoming token.`
        );
      }

      const existingSlotSnap = await tx.get(slotRef);
      if (existingSlotSnap.exists()) {
        throw new Error(
          `Token ${tokenCode} was already selected for ${chosenDate}. Please pick another available token.`
        );
      }
      const safeReason = clampString(visitReason, FIELD_LIMITS.visitReason.max);
      const safePatientName = clampString(patientName || 'Patient', FIELD_LIMITS.displayName.max);
      const updatedLastIssued = Math.min(
        maxTokens,
        Math.max(doctor.lastIssuedNumber || 0, slotNumber)
      );

      tx.update(doctorRef, {
        lastIssuedNumber: updatedLastIssued,
        updatedAt: serverTimestamp(),
      });

      const slotPayload: DoctorSlot = {
        slotId,
        doctorId: doctor.doctorId,
        bookingDate: chosenDate,
        tokenNumber: slotNumber,
        tokenCode,
        slotTime,
        tokenId,
        createdAt: serverTimestamp(),
      };

      const tokenPayload: TokenBooking = {
        tokenId,
        doctorId: doctor.doctorId,
        doctorName: doctor.name,
        department: doctor.department,
        room: doctor.room,
        tokenNumber: slotNumber,
        tokenCode,
        patientUid,
        patientName: safePatientName,
        visitReason: safeReason.length >= 2 ? safeReason : 'General specialist consultation',
        feeAmount: doctor.consultationFee,
        paymentStatus,
        paymentMethod,
        paymentRef: paymentRefCode,
        queueStatus: 'waiting',
        bookingDate: chosenDate,
        slotTime,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const paymentPayload: PaymentRecord = {
        paymentId,
        tokenId,
        tokenCode,
        doctorId: doctor.doctorId,
        doctorName: doctor.name,
        patientUid,
        patientName: safePatientName,
        amount: doctor.consultationFee,
        method: paymentMethod,
        status: paymentStatus,
        referenceCode: paymentRefCode,
        createdAt: serverTimestamp(),
      };

      tx.set(slotRef, slotPayload);
      tx.set(tokenRef, tokenPayload);
      tx.set(paymentRefDoc, paymentPayload);

      return { token: tokenPayload, payment: paymentPayload };
    });

    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already selected') ||
        error.message.includes('already been served') ||
        error.message.includes('has expired') ||
        error.message.includes('currently unavailable') ||
        error.message.includes('valid token between'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `tokens/${tokenId}`);
  }
}

export async function completePendingTokenPayment(params: {
  tokenId: string;
  patientUid: string;
  paymentMethod: Exclude<PaymentMethod, 'Hospital Desk'>;
  paymentDetailLabel: string;
}): Promise<void> {
  const { tokenId, patientUid, paymentMethod, paymentDetailLabel } = params;
  const paymentsPath = 'payments';
  try {
    const q = query(
      collection(db, 'payments'),
      where('patientUid', '==', patientUid),
      where('tokenId', '==', tokenId)
    );
    const snap = await getDocs(q);
    const paymentDocId = snap.docs[0]?.id;
    const prefix = paymentMethod === 'UPI' ? 'UPI' : paymentMethod === 'Insurance' ? 'INS' : 'CARD';
    const paymentRefCode = clampString(
      `${prefix}-${Date.now().toString().slice(-6)}-${paymentDetailLabel}`.replace(/[^a-zA-Z0-9-]/g, ''),
      64
    );

    await runTransaction(db, async (tx) => {
      const tokenRef = doc(db, 'tokens', tokenId);
      tx.update(tokenRef, {
        paymentStatus: 'paid',
        paymentMethod,
        paymentRef: paymentRefCode,
        updatedAt: serverTimestamp(),
      });
      if (paymentDocId) {
        tx.update(doc(db, 'payments', paymentDocId), {
          status: 'paid',
          method: paymentMethod,
          referenceCode: paymentRefCode,
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, paymentsPath);
  }
}

export async function cancelWaitingToken(tokenId: string): Promise<void> {
  const path = `tokens/${tokenId}`;
  try {
    await runTransaction(db, async (tx) => {
      const tokenRef = doc(db, 'tokens', tokenId);
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists()) return;
      const tok = tokenSnap.data() as TokenBooking;
      const slotId = makeSlotId(tok.doctorId, tok.bookingDate, tok.tokenNumber);
      const slotRef = doc(db, 'doctorSlots', slotId);
      const slotSnap = await tx.get(slotRef);

      tx.update(tokenRef, {
        queueStatus: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      if (slotSnap.exists() && slotSnap.data()?.tokenId === tokenId) {
        tx.delete(slotRef);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Admin Control Operations
// ---------------------------------------------------------------------------
export async function adminUpdateHospitalConfig(
  adminUid: string,
  config: Omit<HospitalConfig, 'updatedAt' | 'updatedBy'>
): Promise<void> {
  const path = 'hospitalConfig/settings';
  try {
    await setDoc(doc(db, 'hospitalConfig', 'settings'), {
      hospitalName: clampString(config.hospitalName, FIELD_LIMITS.hospitalName.max),
      tagline: clampString(config.tagline, FIELD_LIMITS.tagline.max),
      description: clampString(config.description, FIELD_LIMITS.description.max),
      address: clampString(config.address, FIELD_LIMITS.address.max),
      phone: clampString(config.phone, FIELD_LIMITS.phone.max),
      opdHours: clampString(config.opdHours, FIELD_LIMITS.opdHours.max),
      portalOpen: Boolean(config.portalOpen),
      allowNewRegistrations: Boolean(config.allowNewRegistrations),
      maintenanceMessage: clampString(config.maintenanceMessage, FIELD_LIMITS.maintenanceMessage.max),
      acceptedPaymentMethods:
        config.acceptedPaymentMethods.length > 0 ? config.acceptedPaymentMethods : ['Card'],
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminSetUserAccessStatus(
  targetUid: string,
  accessStatus: AccessStatus
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      accessStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminToggleUserAdminRole(params: {
  targetUser: UserProfile;
  makeAdmin: boolean;
  grantedByUid: string;
}): Promise<void> {
  const { targetUser, makeAdmin, grantedByUid } = params;
  const userPath = `users/${targetUser.uid}`;
  const adminPath = `admins/${targetUser.uid}`;
  try {
    const newRole: UserRole = makeAdmin ? 'admin' : 'patient';
    await updateDoc(doc(db, 'users', targetUser.uid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    if (makeAdmin) {
      await setDoc(doc(db, 'admins', targetUser.uid), {
        uid: targetUser.uid,
        email: targetUser.email,
        displayName: targetUser.displayName,
        grantedBy: grantedByUid,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', targetUser.uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} / ${adminPath}`);
  }
}

export async function adminUpsertDoctor(
  doctor: Omit<Doctor, 'updatedAt'>
): Promise<void> {
  const safeId = doctor.doctorId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `doctors/${safeId}`;
  const cleanTotalTokens = Math.min(
    MAX_TOTAL_TOKENS,
    Math.max(1, Math.floor(Number(doctor.totalTokens) || 10))
  );
  const cleanOpdDate =
    doctor.opdDate && FIELD_LIMITS.DATE_REGEX.test(doctor.opdDate)
      ? doctor.opdDate
      : getTodayDateString();
  try {
    await setDoc(doc(db, 'doctors', safeId), {
      ...doctor,
      doctorId: safeId,
      name: clampString(doctor.name, 100),
      credentials: clampString(doctor.credentials, 80),
      specialty: clampString(doctor.specialty, 60),
      department: clampString(doctor.department, 60),
      room: clampString(doctor.room, 40),
      consultationFee: Math.min(Math.max(Number(doctor.consultationFee) || 25, 1), 50000),
      tokenPrefix: doctor.tokenPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TOKEN',
      currentServingNumber: Math.max(0, Math.floor(doctor.currentServingNumber)),
      lastIssuedNumber: Math.max(0, Math.floor(doctor.lastIssuedNumber)),
      totalTokens: cleanTotalTokens,
      opdDate: cleanOpdDate,
      experienceYears: Math.min(80, Math.max(0, Math.floor(doctor.experienceYears))),
      shiftHours: clampString(doctor.shiftHours, 80),
      bio: clampString(doctor.bio, 600),
      avatarUrl: clampString(doctor.avatarUrl, FIELD_LIMITS.avatarUrlMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminAdvanceDoctorQueue(doctor: Doctor): Promise<void> {
  const path = `doctors/${doctor.doctorId}`;
  try {
    const maxTokens = getDoctorTotalTokens(doctor);
    const upperBound = Math.max(doctor.lastIssuedNumber, maxTokens);
    const nextServing = Math.min(doctor.currentServingNumber + 1, upperBound);
    await updateDoc(doc(db, 'doctors', doctor.doctorId), {
      currentServingNumber: nextServing,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminToggleDoctorAvailability(doctor: Doctor): Promise<void> {
  const path = `doctors/${doctor.doctorId}`;
  try {
    await updateDoc(doc(db, 'doctors', doctor.doctorId), {
      isAvailable: !doctor.isAvailable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminResetDoctorQueue(doctorId: string): Promise<void> {
  const path = `doctors/${doctorId}`;
  try {
    await updateDoc(doc(db, 'doctors', doctorId), {
      currentServingNumber: 0,
      lastIssuedNumber: 0,
      updatedAt: serverTimestamp(),
    });
    const slotSnap = await getDocs(
      query(collection(db, 'doctorSlots'), where('doctorId', '==', doctorId), limit(100))
    );
    for (const sDoc of slotSnap.docs) {
      await deleteDoc(doc(db, 'doctorSlots', sDoc.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateTokenAndPayment(params: {
  tokenId: string;
  queueStatus?: QueueStatus;
  paymentStatus?: PaymentStatus;
}): Promise<void> {
  const { tokenId, queueStatus, paymentStatus } = params;
  const tokenPath = `tokens/${tokenId}`;
  try {
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (queueStatus) updates.queueStatus = queueStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    await updateDoc(doc(db, 'tokens', tokenId), updates);

    if (paymentStatus) {
      const q = query(collection(db, 'payments'), where('tokenId', '==', tokenId));
      const snap = await getDocs(q);
      for (const pDoc of snap.docs) {
        await updateDoc(doc(db, 'payments', pDoc.id), {
          status: paymentStatus,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, tokenPath);
  }
}
