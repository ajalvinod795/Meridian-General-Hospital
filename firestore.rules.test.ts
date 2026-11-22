/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Matrix)
 * Run against Firebase Emulator Suite with @firebase/rules-unit-testing when emulators are active.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Self-Admin Role Escalation on User Creation',
    collection: 'users/patient_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      uid: 'patient_1',
      displayName: 'Mallory',
      email: 'mallory@example.com',
      profileDescription: 'Escalation attempt',
      phone: '',
      bloodGroup: '',
      emergencyContact: '',
      role: 'admin',
      accessStatus: 'active',
    },
  },
  {
    id: 2,
    name: 'Suspended User Token Creation Bypass',
    collection: 'tokens/tok_suspended',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      tokenId: 'tok_suspended',
      doctorId: 'dr_reed',
      patientUid: 'suspended_user_1',
      queueStatus: 'waiting',
    },
  },
  {
    id: 3,
    name: 'Booking When Admin Paused Portal Intake',
    collection: 'tokens/tok_paused',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      tokenId: 'tok_paused',
      doctorId: 'dr_reed',
      patientUid: 'patient_1',
      queueStatus: 'waiting',
    },
  },
  {
    id: 4,
    name: 'Consultation Fee Tampering',
    collection: 'tokens/tok_fee_hack',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      tokenId: 'tok_fee_hack',
      doctorId: 'dr_reed',
      feeAmount: 0,
      patientUid: 'patient_1',
    },
  },
  {
    id: 5,
    name: 'Sequential Token Number Skipping',
    collection: 'tokens/tok_skip',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      tokenId: 'tok_skip',
      doctorId: 'dr_reed',
      tokenNumber: 999,
      patientUid: 'patient_1',
    },
  },
  {
    id: 6,
    name: 'Unavailable Doctor Booking',
    collection: 'tokens/tok_unavail',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      tokenId: 'tok_unavail',
      doctorId: 'dr_offline',
      patientUid: 'patient_1',
    },
  },
  {
    id: 7,
    name: 'Shadow Field Injection on Profile Update',
    collection: 'users/patient_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      profileDescription: 'Valid update',
      isVerifiedAdmin: true,
    },
  },
  {
    id: 8,
    name: 'Cross-User PII List Query',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { requesterUid: 'patient_1' },
  },
  {
    id: 9,
    name: 'Unverified Email Admin Spoof',
    collection: 'hospitalConfig/settings',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      email: 'ajalvinod1234@gmail.com',
      email_verified: false,
      portalOpen: false,
    },
  },
  {
    id: 10,
    name: 'Path ID Poisoning',
    collection: 'doctors/bad$id!@',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { doctorId: 'bad$id!@' },
  },
  {
    id: 11,
    name: 'Terminal Token State Reversal',
    collection: 'tokens/tok_completed',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { queueStatus: 'waiting' },
  },
  {
    id: 12,
    name: 'Backdated Client Timestamp Forgery',
    collection: 'payments/pay_backdated',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      paymentId: 'pay_backdated',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
];
