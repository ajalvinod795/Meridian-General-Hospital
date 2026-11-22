import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  Edit3,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  AdminRecord,
  ALL_PAYMENT_METHODS,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_DOCTORS,
  DEFAULT_TOTAL_TOKENS,
  Doctor,
  FIELD_LIMITS,
  formatCurrency,
  formatOpdDateDisplay,
  formatTokenCode,
  getDoctorOpdDate,
  getDoctorTotalTokens,
  getLocalTodayDateString,
  HospitalConfig,
  MAX_TOTAL_TOKENS,
  normalizeTokenCode,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  QueueStatus,
  TokenBooking,
  UserProfile,
} from '../types/hospital';
import {
  adminAdvanceDoctorQueue,
  adminResetDoctorQueue,
  adminSetUserAccessStatus,
  adminToggleDoctorAvailability,
  adminToggleUserAdminRole,
  adminUpdateHospitalConfig,
  adminUpdateTokenAndPayment,
  adminUpsertDoctor,
  subscribeAllAdmins,
  subscribeAllPaymentsAdmin,
  subscribeAllTokensAdmin,
  subscribeAllUsersAdmin,
} from '../services/hospitalService';
import { SafeImage } from './SafeImage';
import { PaymentQrCard } from './PaymentQrCard';

async function compressDoctorPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, or WebP).');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to read the selected image file.'));
      el.src = objectUrl;
    });

    const targetSize = 280;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }

    // Center-crop square portrait while preserving aspect ratio
    const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = Math.max(0, ((img.naturalWidth || img.width) - minSide) / 2);
    const sy = Math.max(0, ((img.naturalHeight || img.height) - minSide) / 2);
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

    let dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    if (dataUrl.length > FIELD_LIMITS.avatarUrlMax) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    }
    if (dataUrl.length > FIELD_LIMITS.avatarUrlMax) {
      throw new Error('Selected photo is too large even after compression. Please pick a smaller image.');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface AdminConsoleViewProps {
  adminProfile: UserProfile;
  hospitalConfig: HospitalConfig;
  doctors: Doctor[];
}

type AdminTab = 'access' | 'users' | 'doctors' | 'ledger';

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  adminProfile,
  hospitalConfig,
  doctors,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('access');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [allTokens, setAllTokens] = useState<TokenBooking[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);

  // Hospital Config Form State
  const [configDraft, setConfigDraft] = useState(hospitalConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  // Add New Doctor State
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCreds, setNewDocCreds] = useState('MD');
  const [newDocSpecialty, setNewDocSpecialty] = useState('');
  const [newDocDept, setNewDocDept] = useState('General Medicine');
  const [newDocRoom, setNewDocRoom] = useState('Suite 101 · Wing A');
  const [newDocFee, setNewDocFee] = useState('600');
  const [newDocPrefix, setNewDocPrefix] = useState('TOKEN');
  const [newDocHours, setNewDocHours] = useState('09:00 AM – 04:00 PM');
  const [newDocOpdDate, setNewDocOpdDate] = useState(getLocalTodayDateString);
  const [newDocExp, setNewDocExp] = useState('8');
  const [newDocTotalTokens, setNewDocTotalTokens] = useState(String(DEFAULT_TOTAL_TOKENS));
  const [newDocBio, setNewDocBio] = useState('');
  const [newDocAvatarUrl, setNewDocAvatarUrl] = useState('');
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorNotice, setDoctorNotice] = useState<string | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);

  // Edit Existing Doctor State
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [editDocCreds, setEditDocCreds] = useState('');
  const [editDocSpecialty, setEditDocSpecialty] = useState('');
  const [editDocDept, setEditDocDept] = useState('');
  const [editDocRoom, setEditDocRoom] = useState('');
  const [editDocFee, setEditDocFee] = useState('');
  const [editDocPrefix, setEditDocPrefix] = useState('');
  const [editDocHours, setEditDocHours] = useState('');
  const [editDocOpdDate, setEditDocOpdDate] = useState(getLocalTodayDateString);
  const [editDocExp, setEditDocExp] = useState('0');
  const [editDocTotalTokens, setEditDocTotalTokens] = useState(String(DEFAULT_TOTAL_TOKENS));
  const [editDocBio, setEditDocBio] = useState('');
  const [editDocAvatarUrl, setEditDocAvatarUrl] = useState('');
  const [editDocAvailable, setEditDocAvailable] = useState(true);

  const [editingFeeDocId, setEditingFeeDocId] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState('');
  const [editingTokensDocId, setEditingTokensDocId] = useState<string | null>(null);
  const [editingTokensValue, setEditingTokensValue] = useState('');
  const [editingDateDocId, setEditingDateDocId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [qrPreview, setQrPreview] = useState<{
    title: string;
    amount: number;
    note: string;
    referenceLabel: string;
  } | null>(null);
  const [customQrAmount, setCustomQrAmount] = useState('500');
  const [customQrNote, setCustomQrNote] = useState('OPD Consultation Fee');

  useEffect(() => {
    setConfigDraft(hospitalConfig);
  }, [hospitalConfig]);

  useEffect(() => {
    const unsubUsers = subscribeAllUsersAdmin(setUsers);
    const unsubAdmins = subscribeAllAdmins(setAdmins);
    const unsubTokens = subscribeAllTokensAdmin(setAllTokens);
    const unsubPayments = subscribeAllPaymentsAdmin(setAllPayments);
    return () => {
      unsubUsers();
      unsubAdmins();
      unsubTokens();
      unsubPayments();
    };
  }, []);

  const adminUidSet = useMemo(() => {
    return new Set(admins.map((a) => a.uid));
  }, [admins]);

  const totalRevenue = useMemo(() => {
    return allPayments
      .filter((p) => p.status === 'paid')
      .reduce((acc, p) => acc + p.amount, 0);
  }, [allPayments]);

  const handleSaveHospitalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigNotice(null);
    try {
      await adminUpdateHospitalConfig(adminProfile.uid, {
        hospitalName: configDraft.hospitalName,
        tagline: configDraft.tagline,
        description: configDraft.description,
        address: configDraft.address,
        phone: configDraft.phone,
        opdHours: configDraft.opdHours,
        portalOpen: configDraft.portalOpen,
        allowNewRegistrations: configDraft.allowNewRegistrations,
        maintenanceMessage: configDraft.maintenanceMessage,
        acceptedPaymentMethods: configDraft.acceptedPaymentMethods,
      });
      setConfigNotice('Global hospital settings and portal access controls saved.');
    } finally {
      setSavingConfig(false);
    }
  };

  const togglePaymentMethod = (method: PaymentMethod) => {
    setConfigDraft((prev) => {
      const exists = prev.acceptedPaymentMethods.includes(method);
      if (exists && prev.acceptedPaymentMethods.length === 1) {
        return prev; // keep at least one payment method enabled
      }
      return {
        ...prev,
        acceptedPaymentMethods: exists
          ? prev.acceptedPaymentMethods.filter((m) => m !== method)
          : [...prev.acceptedPaymentMethods, method],
      };
    });
  };

  const startEditingDoctor = (docItem: Doctor) => {
    setShowAddDoctor(false);
    setDoctorError(null);
    setDoctorNotice(null);
    setEditingDoctor(docItem);
    setEditDocName(docItem.name);
    setEditDocCreds(docItem.credentials);
    setEditDocSpecialty(docItem.specialty);
    setEditDocDept(docItem.department);
    setEditDocRoom(docItem.room);
    setEditDocFee(String(docItem.consultationFee));
    setEditDocPrefix(docItem.tokenPrefix === 'GEN' ? 'TOKEN' : docItem.tokenPrefix);
    setEditDocHours(docItem.shiftHours);
    setEditDocOpdDate(getDoctorOpdDate(docItem));
    setEditDocExp(String(docItem.experienceYears));
    setEditDocTotalTokens(String(getDoctorTotalTokens(docItem)));
    setEditDocBio(docItem.bio);
    setEditDocAvatarUrl(docItem.avatarUrl || '');
    setEditDocAvailable(docItem.isAvailable);
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDoctorError(null);
    try {
      const compressed = await compressDoctorPhotoFile(file);
      if (target === 'new') {
        setNewDocAvatarUrl(compressed);
      } else {
        setEditDocAvatarUrl(compressed);
      }
    } catch (err) {
      setDoctorError(
        err instanceof Error ? err.message : 'Unable to process selected photo.'
      );
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDoctorError(null);
    setDoctorNotice(null);
    setSavingDoctor(true);
    try {
      const slug = newDocName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const doctorId = `dr_${slug || Date.now()}`.slice(0, 64);

      const cleanTotalTokens = Math.min(
        MAX_TOTAL_TOKENS,
        Math.max(1, Math.floor(Number(newDocTotalTokens) || DEFAULT_TOTAL_TOKENS))
      );

      const cleanOpdDate = FIELD_LIMITS.DATE_REGEX.test(newDocOpdDate)
        ? newDocOpdDate
        : getLocalTodayDateString();

      await adminUpsertDoctor({
        doctorId,
        name: newDocName,
        credentials: newDocCreds,
        specialty: newDocSpecialty || newDocDept,
        department: newDocDept,
        room: newDocRoom,
        consultationFee: Number(newDocFee) || 500,
        tokenPrefix: newDocPrefix,
        currentServingNumber: 0,
        lastIssuedNumber: 0,
        totalTokens: cleanTotalTokens,
        opdDate: cleanOpdDate,
        isAvailable: true,
        shiftHours: newDocHours,
        experienceYears: Number(newDocExp) || 8,
        bio:
          newDocBio.trim().length >= 10
            ? newDocBio
            : `Attending specialist in ${newDocDept} providing outpatient consultations.`,
        avatarUrl: newDocAvatarUrl.trim(),
      });

      setShowAddDoctor(false);
      setNewDocName('');
      setNewDocSpecialty('');
      setNewDocBio('');
      setNewDocAvatarUrl('');
      setNewDocExp('8');
      setNewDocPrefix('TOKEN');
      setNewDocOpdDate(getLocalTodayDateString());
      setNewDocTotalTokens(String(DEFAULT_TOTAL_TOKENS));
      setDoctorNotice(`Added ${newDocName.trim()} for ${formatOpdDateDisplay(cleanOpdDate)} (${cleanTotalTokens} tokens).`);
    } catch (err) {
      setDoctorError(
        err instanceof Error ? err.message : 'Unable to save new doctor.'
      );
    } finally {
      setSavingDoctor(false);
    }
  };

  const handleSaveEditedDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    setDoctorError(null);
    setDoctorNotice(null);
    setSavingDoctor(true);
    try {
      const cleanFee = Math.min(Math.max(Number(editDocFee) || 100, 1), 50000);
      const cleanExp = Math.min(80, Math.max(0, Math.floor(Number(editDocExp) || 0)));
      const cleanTotalTokens = Math.min(
        MAX_TOTAL_TOKENS,
        Math.max(1, Math.floor(Number(editDocTotalTokens) || DEFAULT_TOTAL_TOKENS))
      );
      const cleanOpdDate = FIELD_LIMITS.DATE_REGEX.test(editDocOpdDate)
        ? editDocOpdDate
        : getDoctorOpdDate(editingDoctor);
      const dateChanged = cleanOpdDate !== getDoctorOpdDate(editingDoctor);
      const cleanBio =
        editDocBio.trim().length >= 10
          ? editDocBio.trim()
          : `Attending specialist in ${editDocDept || 'General Medicine'} providing outpatient consultations.`;

      await adminUpsertDoctor({
        doctorId: editingDoctor.doctorId,
        name: editDocName,
        credentials: editDocCreds || 'MD',
        specialty: editDocSpecialty || editDocDept,
        department: editDocDept,
        room: editDocRoom,
        consultationFee: cleanFee,
        tokenPrefix: editDocPrefix || editingDoctor.tokenPrefix,
        currentServingNumber: dateChanged ? 0 : editingDoctor.currentServingNumber,
        lastIssuedNumber: dateChanged ? 0 : editingDoctor.lastIssuedNumber,
        totalTokens: cleanTotalTokens,
        opdDate: cleanOpdDate,
        isAvailable: editDocAvailable,
        shiftHours: editDocHours,
        experienceYears: cleanExp,
        bio: cleanBio,
        avatarUrl: editDocAvatarUrl.trim(),
      });

      const updatedName = editDocName.trim();
      setEditingDoctor(null);
      setDoctorNotice(
        `Updated details, photo, OPD date (${formatOpdDateDisplay(cleanOpdDate)}), and ${cleanTotalTokens} token slots for ${updatedName}.`
      );
    } catch (err) {
      setDoctorError(
        err instanceof Error ? err.message : 'Unable to update doctor details.'
      );
    } finally {
      setSavingDoctor(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setDoctorError(null);
    setDoctorNotice(null);
    for (const d of DEFAULT_DOCTORS) {
      await adminUpsertDoctor(d);
    }
    setDoctorNotice('Default doctor roster restored.');
  };

  const handleSaveInlineFee = async (docItem: Doctor) => {
    const parsed = Number(editingFeeValue);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50000) return;
    await adminUpsertDoctor({
      doctorId: docItem.doctorId,
      name: docItem.name,
      credentials: docItem.credentials,
      specialty: docItem.specialty,
      department: docItem.department,
      room: docItem.room,
      consultationFee: parsed,
      tokenPrefix: docItem.tokenPrefix,
      currentServingNumber: docItem.currentServingNumber,
      lastIssuedNumber: docItem.lastIssuedNumber,
      totalTokens: getDoctorTotalTokens(docItem),
      opdDate: getDoctorOpdDate(docItem),
      isAvailable: docItem.isAvailable,
      shiftHours: docItem.shiftHours,
      experienceYears: docItem.experienceYears,
      bio: docItem.bio,
      avatarUrl: docItem.avatarUrl,
    });
    setEditingFeeDocId(null);
  };

  const handleSaveInlineTotalTokens = async (docItem: Doctor) => {
    const parsed = Math.floor(Number(editingTokensValue));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_TOTAL_TOKENS) return;
    await adminUpsertDoctor({
      doctorId: docItem.doctorId,
      name: docItem.name,
      credentials: docItem.credentials,
      specialty: docItem.specialty,
      department: docItem.department,
      room: docItem.room,
      consultationFee: docItem.consultationFee,
      tokenPrefix: docItem.tokenPrefix,
      currentServingNumber: docItem.currentServingNumber,
      lastIssuedNumber: docItem.lastIssuedNumber,
      totalTokens: parsed,
      opdDate: getDoctorOpdDate(docItem),
      isAvailable: docItem.isAvailable,
      shiftHours: docItem.shiftHours,
      experienceYears: docItem.experienceYears,
      bio: docItem.bio,
      avatarUrl: docItem.avatarUrl,
    });
    setEditingTokensDocId(null);
    setDoctorNotice(`Set ${parsed} tokens (10-minute slots) for ${docItem.name}.`);
  };

  const handleSaveInlineOpdDate = async (docItem: Doctor) => {
    if (!FIELD_LIMITS.DATE_REGEX.test(editingDateValue)) return;
    const dateChanged = editingDateValue !== getDoctorOpdDate(docItem);
    await adminUpsertDoctor({
      doctorId: docItem.doctorId,
      name: docItem.name,
      credentials: docItem.credentials,
      specialty: docItem.specialty,
      department: docItem.department,
      room: docItem.room,
      consultationFee: docItem.consultationFee,
      tokenPrefix: docItem.tokenPrefix,
      currentServingNumber: dateChanged ? 0 : docItem.currentServingNumber,
      lastIssuedNumber: dateChanged ? 0 : docItem.lastIssuedNumber,
      totalTokens: getDoctorTotalTokens(docItem),
      opdDate: editingDateValue,
      isAvailable: docItem.isAvailable,
      shiftHours: docItem.shiftHours,
      experienceYears: docItem.experienceYears,
      bio: docItem.bio,
      avatarUrl: docItem.avatarUrl,
    });
    setEditingDateDocId(null);
    setDoctorNotice(
      `Scheduled ${docItem.name} for ${formatOpdDateDisplay(editingDateValue)}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Hospital Administration &amp; Overall Access Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Admin Control Console
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Control global portal access, user permissions, hospital profile, doctor queues, and consultation payments.
            </p>
          </div>

          {/* Admin Section Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'access', label: 'Access & Hospital' },
                { id: 'users', label: `Users (${users.length})` },
                { id: 'doctors', label: `Doctors (${doctors.length})` },
                { id: 'ledger', label: `Tokens & Payments (${allTokens.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-500">Global OPD Intake</p>
            <p
              className={`mt-1 text-base font-bold ${
                hospitalConfig.portalOpen ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {hospitalConfig.portalOpen ? 'Open for Bookings' : 'Paused by Admin'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Registered Accounts</p>
            <p className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {users.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Tokens Issued</p>
            <p className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {allTokens.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Verified Payments Collected</p>
            <p className="mt-1 text-xl font-bold text-teal-700 font-mono tabular-nums">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
        </div>
      </section>

      {/* TAB 1: Global Access & Hospital Profile */}
      {activeTab === 'access' && (
        <form
          onSubmit={handleSaveHospitalConfig}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Global App Access &amp; Hospital Description
              </h2>
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Saving...' : 'Save Global Settings'}</span>
            </button>
          </div>

          {configNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{configNotice}</span>
            </div>
          )}

          {/* Master Access Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  OPD Token Intake Access
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  When paused, patients cannot book new tokens across any doctor.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfigDraft((p) => ({ ...p, portalOpen: !p.portalOpen }))
                }
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                  configDraft.portalOpen
                    ? 'bg-emerald-700 text-white'
                    : 'bg-amber-700 text-white'
                }`}
              >
                {configDraft.portalOpen ? 'Open (Active)' : 'Paused'}
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  New Patient Registrations
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Control whether new Google accounts can onboard as patients.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfigDraft((p) => ({
                    ...p,
                    allowNewRegistrations: !p.allowNewRegistrations,
                  }))
                }
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                  configDraft.allowNewRegistrations
                    ? 'bg-emerald-700 text-white'
                    : 'bg-red-700 text-white'
                }`}
              >
                {configDraft.allowNewRegistrations ? 'Allowed' : 'Blocked'}
              </button>
            </div>
          </div>

          {/* Accepted Payment Methods */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Enabled Hospital Payment Methods
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PAYMENT_METHODS.map((method) => {
                const enabled = configDraft.acceptedPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      enabled
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    {enabled ? `Enabled: ${method}` : `Disabled: ${method}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Maintenance / Paused Intake Notice
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.maintenanceMessage.max}
              value={configDraft.maintenanceMessage}
              onChange={(e) =>
                setConfigDraft((p) => ({ ...p, maintenanceMessage: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {/* Hospital Profile Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hospital Name
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.hospitalName.max}
                value={configDraft.hospitalName}
                onChange={(e) =>
                  setConfigDraft((p) => ({ ...p, hospitalName: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tagline
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.tagline.max}
                value={configDraft.tagline}
                onChange={(e) =>
                  setConfigDraft((p) => ({ ...p, tagline: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Campus Address
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.address.max}
                value={configDraft.address}
                onChange={(e) =>
                  setConfigDraft((p) => ({ ...p, address: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Helpline Phone
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.phone.max}
                  value={configDraft.phone}
                  onChange={(e) =>
                    setConfigDraft((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  OPD Hours
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.opdHours.max}
                  value={configDraft.opdHours}
                  onChange={(e) =>
                    setConfigDraft((p) => ({ ...p, opdHours: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Hospital Description
            </label>
            <textarea
              rows={3}
              required
              maxLength={FIELD_LIMITS.description.max}
              value={configDraft.description}
              onChange={(e) =>
                setConfigDraft((p) => ({ ...p, description: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      )}

      {/* TAB 2: User Access & Admin Delegation */}
      {activeTab === 'users' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                User Access Control &amp; Role Assignment
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Suspend accounts or delegate Admin privileges
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Phone / Email</th>
                  <th className="py-3 px-4 font-semibold">Blood Group &amp; Address</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Access Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => {
                  const isBootstrapped = u.email === BOOTSTRAPPED_ADMIN_EMAIL;
                  const hasAdminAccess = isBootstrapped || adminUidSet.has(u.uid);
                  const isSelf = u.uid === adminProfile.uid;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {u.displayName}
                        {isSelf ? ' (You)' : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {u.phone || u.email || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {u.bloodGroup ? `${u.bloodGroup} · ` : ''}
                        {u.permanentAddress || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {hasAdminAccess ? (
                          <span className="text-teal-700">Administrator</span>
                        ) : (
                          <span className="text-slate-700">Patient</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {u.accessStatus === 'active' ? (
                          <span className="text-emerald-700">Active</span>
                        ) : (
                          <span className="text-red-700">Suspended</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {!isBootstrapped && !isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                adminSetUserAccessStatus(
                                  u.uid,
                                  u.accessStatus === 'active' ? 'suspended' : 'active'
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border font-medium cursor-pointer ${
                                u.accessStatus === 'active'
                                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.accessStatus === 'active' ? (
                                <>
                                  <Ban className="w-3 h-3" />
                                  <span>Suspend Access</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Restore Access</span>
                                </>
                              )}
                            </button>

                            {u.email && (
                              <button
                                type="button"
                                onClick={() =>
                                  adminToggleUserAdminRole({
                                    targetUser: u,
                                    makeAdmin: !hasAdminAccess,
                                    grantedByUid: adminProfile.uid,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>{hasAdminAccess ? 'Revoke Admin' : 'Make Admin'}</span>
                              </button>
                            )}
                          </>
                        )}
                        {isBootstrapped && (
                          <span className="text-slate-400">Primary System Admin</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: Doctors & Per-Doctor Token Queues */}
      {activeTab === 'doctors' && (
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Doctor Roster, Photos &amp; Queue Management
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Restore Default Doctors
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDoctor(null);
                  setDoctorError(null);
                  setDoctorNotice(null);
                  setShowAddDoctor((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Doctor</span>
              </button>
            </div>
          </div>

          {doctorNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{doctorNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDoctorNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {doctorError && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-3"
            >
              <span>{doctorError}</span>
              <button
                type="button"
                onClick={() => setDoctorError(null)}
                className="text-red-700 hover:text-red-900 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showAddDoctor && (
            <form
              onSubmit={handleAddDoctor}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Publish New Doctor &amp; Photo
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddDoctor(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close add doctor form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Picker for New Doctor */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center gap-4">
                <SafeImage
                  src={newDocAvatarUrl}
                  alt={newDocName || 'New doctor photo'}
                  fallbackType="doctor"
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Doctor Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'new')}
                        className="hidden"
                      />
                    </label>
                    {newDocAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setNewDocAvatarUrl('')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Or paste photo URL (https://... or /src/assets/images/...)"
                    value={newDocAvatarUrl.startsWith('data:') ? '' : newDocAvatarUrl}
                    onChange={(e) => setNewDocAvatarUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  {newDocAvatarUrl.startsWith('data:') && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Uploaded photo ready to save.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Doctor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Priya Nair"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dermatology"
                    value={newDocDept}
                    onChange={(e) => setNewDocDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Specialty
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Clinical Dermatology"
                    value={newDocSpecialty}
                    onChange={(e) => setNewDocSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Credentials
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MD, FAAD"
                    value={newDocCreds}
                    onChange={(e) => setNewDocCreds(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Consultation Room
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suite 210"
                    value={newDocRoom}
                    onChange={(e) => setNewDocRoom(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Fee (₹ INR)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50000}
                      value={newDocFee}
                      onChange={(e) => setNewDocFee(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Token Prefix
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      placeholder="TOKEN"
                      value={newDocPrefix}
                      onChange={(e) => setNewDocPrefix(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    OPD Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDocOpdDate}
                    onChange={(e) => setNewDocOpdDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Shift Hours
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocHours}
                    onChange={(e) => setNewDocHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Total Tokens (10m slots)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={MAX_TOTAL_TOKENS}
                    value={newDocTotalTokens}
                    onChange={(e) => setNewDocTotalTokens(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={80}
                    value={newDocExp}
                    onChange={(e) => setNewDocExp(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Clinical Biography (min 10 chars)
                  </label>
                  <input
                    type="text"
                    placeholder="Specialist areas and consultation focus"
                    value={newDocBio}
                    onChange={(e) => setNewDocBio(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingDoctor}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingDoctor ? 'Saving...' : 'Save Doctor'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctor(false)}
                  className="px-4 py-2 border border-slate-300 text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {editingDoctor && (
            <form
              onSubmit={handleSaveEditedDoctor}
              className="bg-white border-2 border-teal-700 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Edit Doctor Details &amp; Photo — {editingDoctor.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close edit doctor form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Editor for Existing Doctor */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center gap-4">
                <SafeImage
                  src={editDocAvatarUrl}
                  alt={editDocName || editingDoctor.name}
                  fallbackType="doctor"
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{editDocAvatarUrl ? 'Change Photo' : 'Add Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'edit')}
                        className="hidden"
                      />
                    </label>
                    {editDocAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setEditDocAvatarUrl('')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Or paste photo URL (https://... or /src/assets/images/...)"
                    value={editDocAvatarUrl.startsWith('data:') ? '' : editDocAvatarUrl}
                    onChange={(e) => setEditDocAvatarUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  {editDocAvatarUrl.startsWith('data:') && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Custom uploaded photo attached. Click Save Doctor Changes to publish.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Doctor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editDocName}
                    onChange={(e) => setEditDocName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Credentials
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={editDocCreds}
                    onChange={(e) => setEditDocCreds(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={editDocDept}
                    onChange={(e) => setEditDocDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Specialty
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={editDocSpecialty}
                    onChange={(e) => setEditDocSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Consultation Room
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={editDocRoom}
                    onChange={(e) => setEditDocRoom(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Fee (₹ INR)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50000}
                      value={editDocFee}
                      onChange={(e) => setEditDocFee(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Token Prefix
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={editDocPrefix}
                      onChange={(e) =>
                        setEditDocPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    OPD Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDocOpdDate}
                    onChange={(e) => setEditDocOpdDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Shift Hours
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={editDocHours}
                    onChange={(e) => setEditDocHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Total Tokens (10m slots)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={MAX_TOTAL_TOKENS}
                    value={editDocTotalTokens}
                    onChange={(e) => setEditDocTotalTokens(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={80}
                    value={editDocExp}
                    onChange={(e) => setEditDocExp(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDocAvailable}
                    onChange={(e) => setEditDocAvailable(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Available for OPD Tokens
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Clinical Biography (min 10 characters)
                </label>
                <textarea
                  rows={2}
                  required
                  maxLength={600}
                  value={editDocBio}
                  onChange={(e) => setEditDocBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingDoctor}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingDoctor ? 'Saving Changes...' : 'Save Doctor Changes'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4 font-semibold">Doctor</th>
                  <th className="py-3 px-4 font-semibold">Department &amp; Room</th>
                  <th className="py-3 px-4 font-semibold">OPD Date</th>
                  <th className="py-3 px-4 font-semibold">Fee</th>
                  <th className="py-3 px-4 font-semibold">Tokens Limit (10m)</th>
                  <th className="py-3 px-4 font-semibold">Serving / Issued</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Details &amp; Queue Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doctors.map((docItem) => {
                  const totalTokens = getDoctorTotalTokens(docItem);
                  const docOpdDate = getDoctorOpdDate(docItem);
                  return (
                  <tr key={docItem.doctorId} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={docItem.avatarUrl}
                          alt={docItem.name}
                          fallbackType="doctor"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {docItem.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {docItem.credentials} · {docItem.experienceYears} yrs
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {docItem.department} · {docItem.room}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {editingDateDocId === docItem.doctorId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={editingDateValue}
                            onChange={(e) => setEditingDateValue(e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineOpdDate(docItem)}
                            className="px-2 py-1 bg-teal-700 text-white rounded text-[11px] font-sans font-medium cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDateDocId(null)}
                            className="px-2 py-1 border border-slate-300 bg-white rounded text-[11px] font-sans cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDateDocId(docItem.doctorId);
                            setEditingDateValue(docOpdDate);
                          }}
                          title="Click to set doctor OPD date"
                          className="hover:text-teal-700 underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                          {formatOpdDateDisplay(docOpdDate)}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-900">
                      {editingFeeDocId === docItem.doctorId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={50000}
                            value={editingFeeValue}
                            onChange={(e) => setEditingFeeValue(e.target.value)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineFee(docItem)}
                            className="px-2 py-1 bg-teal-700 text-white rounded text-[11px] font-sans font-medium cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFeeDocId(null)}
                            className="px-2 py-1 border border-slate-300 bg-white rounded text-[11px] font-sans cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFeeDocId(docItem.doctorId);
                            setEditingFeeValue(String(docItem.consultationFee));
                          }}
                          title="Click to edit consultation fee in INR"
                          className="hover:text-teal-700 underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                          {formatCurrency(docItem.consultationFee)}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-900">
                      {editingTokensDocId === docItem.doctorId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={MAX_TOTAL_TOKENS}
                            value={editingTokensValue}
                            onChange={(e) => setEditingTokensValue(e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineTotalTokens(docItem)}
                            className="px-2 py-1 bg-teal-700 text-white rounded text-[11px] font-sans font-medium cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTokensDocId(null)}
                            className="px-2 py-1 border border-slate-300 bg-white rounded text-[11px] font-sans cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTokensDocId(docItem.doctorId);
                            setEditingTokensValue(String(totalTokens));
                          }}
                          title="Click to change number of 10-minute tokens for this doctor"
                          className="hover:text-teal-700 underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                          {totalTokens} tokens
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {formatTokenCode(docItem.tokenPrefix, docItem.currentServingNumber)} /{' '}
                      {formatTokenCode(docItem.tokenPrefix, totalTokens)}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {docItem.isAvailable ? (
                        <span className="text-emerald-700">Available</span>
                      ) : (
                        <span className="text-red-700">Unavailable</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setQrPreview({
                            title: `Consultation Fee QR — ${docItem.name}`,
                            amount: docItem.consultationFee,
                            note: `OPD Fee - ${docItem.name}`,
                            referenceLabel: `${docItem.name} (${docItem.department})`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-md cursor-pointer"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Fee QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingDoctor(docItem)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-teal-700 bg-teal-50 hover:bg-teal-100 text-teal-900 font-medium rounded-md cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Details / Photo</span>
                      </button>
                      <button
                        type="button"
                        disabled={docItem.currentServingNumber >= totalTokens}
                        onClick={() => adminAdvanceDoctorQueue(docItem)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-md cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Call Next</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => adminToggleDoctorAvailability(docItem)}
                        className="px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-md cursor-pointer"
                      >
                        {docItem.isAvailable ? 'Set Off-Shift' : 'Set Available'}
                      </button>
                      <button
                        type="button"
                        onClick={() => adminResetDoctorQueue(docItem.doctorId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-md cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: Hospital-Wide Tokens & Payment Ledger */}
      {activeTab === 'ledger' && (
        <section className="space-y-4">
          {/* Custom Amount Payment QR Generator */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Generate Payment QR for Any Amount
                </h2>
                <p className="text-xs text-slate-500">
                  Enter any ₹ INR amount and purpose to generate a scannable UPI QR code for desk collection or customize the hospital UPI ID.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Amount to Pay (₹ INR)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={customQrAmount}
                  onChange={(e) => setCustomQrAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Payment Description / Note
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={customQrNote}
                  onChange={(e) => setCustomQrNote(e.target.value)}
                  placeholder="OPD Fee / Lab Test"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const parsed = Math.max(1, Number(customQrAmount) || 500);
                  setQrPreview({
                    title: `Custom Payment QR (${formatCurrency(parsed)})`,
                    amount: parsed,
                    note: customQrNote || 'Hospital Payment',
                    referenceLabel: customQrNote || 'Hospital Counter Payment',
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Generate Payment QR</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Hospital Token &amp; Payment Ledger
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {allTokens.length} tokens · {allPayments.length} payment records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4 font-semibold">Token</th>
                  <th className="py-3 px-4 font-semibold">Patient</th>
                  <th className="py-3 px-4 font-semibold">Doctor</th>
                  <th className="py-3 px-4 font-semibold">Fee &amp; Method</th>
                  <th className="py-3 px-4 font-semibold">Queue State</th>
                  <th className="py-3 px-4 font-semibold">Payment State</th>
                  <th className="py-3 px-4 font-semibold text-right">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allTokens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No tokens issued yet.
                    </td>
                  </tr>
                ) : (
                  allTokens.map((t) => (
                    <tr key={t.tokenId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div>{normalizeTokenCode(t.tokenCode)}</div>
                        {t.slotTime && (
                          <div className="text-[11px] font-normal text-slate-500">
                            {t.slotTime}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{t.patientName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {t.doctorName} · {t.department}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                        {formatCurrency(t.feeAmount)} ({t.paymentMethod})
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={t.queueStatus}
                          onChange={(e) =>
                            adminUpdateTokenAndPayment({
                              tokenId: t.tokenId,
                              queueStatus: e.target.value as QueueStatus,
                            })
                          }
                          className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        >
                          <option value="waiting">waiting</option>
                          <option value="serving">serving</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={t.paymentStatus}
                          onChange={(e) =>
                            adminUpdateTokenAndPayment({
                              tokenId: t.tokenId,
                              paymentStatus: e.target.value as PaymentStatus,
                            })
                          }
                          className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        >
                          <option value="paid">paid</option>
                          <option value="pending">pending</option>
                          <option value="refunded">refunded</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setQrPreview({
                              title: `Token ${t.tokenCode} Payment QR — ${t.patientName}`,
                              amount: t.feeAmount,
                              note: `Token ${t.tokenCode} - ${t.doctorName}`,
                              referenceLabel: `${t.tokenCode} · ${t.patientName}`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded cursor-pointer"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>QR</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </section>
      )}

      {/* Payment QR Preview Modal */}
      {qrPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {qrPreview.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQrPreview(null)}
                aria-label="Close payment QR modal"
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PaymentQrCard
              allowVpaEdit
              amount={qrPreview.amount}
              payeeName={hospitalConfig.hospitalName}
              note={qrPreview.note}
              referenceLabel={qrPreview.referenceLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
};
