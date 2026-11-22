import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  MapPin,
  Phone,
  Printer,
  QrCode,
  Save,
  Stethoscope,
  Ticket,
  User,
  XCircle,
} from 'lucide-react';
import {
  Doctor,
  FIELD_LIMITS,
  formatCurrency,
  formatTokenCode,
  getTokenSlotTimeWindow,
  HOSPITAL_ATRIUM_IMAGE,
  HospitalConfig,
  normalizeTokenCode,
  TokenBooking,
  UserProfile,
} from '../types/hospital';
import { updateOwnUserProfile } from '../services/hospitalService';
import { SafeImage } from './SafeImage';
import { PaymentQrCard } from './PaymentQrCard';

function formatRecordedDateTime(createdAt: unknown, fallbackDate: string): string {
  try {
    let d: Date | null = null;
    if (createdAt && typeof (createdAt as { toDate?: () => Date }).toDate === 'function') {
      d = (createdAt as { toDate: () => Date }).toDate();
    } else if (createdAt && typeof (createdAt as { seconds?: number }).seconds === 'number') {
      d = new Date((createdAt as { seconds: number }).seconds * 1000);
    }
    if (d && !Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback to bookingDate
  }
  return fallbackDate;
}

interface HospitalOverviewViewProps {
  hospitalConfig: HospitalConfig;
  profile: UserProfile;
  doctors: Doctor[];
  myTokens: TokenBooking[];
  onNavigateDoctors: () => void;
  onNavigateMyTokens: () => void;
  onOpenDoctor: (doctorId: string) => void;
}

type HistoryFilter = 'all' | 'pending' | 'completed' | 'unpaid' | 'cancelled';

export const HospitalOverviewView: React.FC<HospitalOverviewViewProps> = ({
  hospitalConfig,
  profile,
  doctors,
  myTokens,
  onNavigateDoctors,
  onNavigateMyTokens,
  onOpenDoctor,
}) => {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [profileDescription, setProfileDescription] = useState(profile.profileDescription || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || '');
  const [permanentAddress, setPermanentAddress] = useState(profile.permanentAddress || '');
  const [emergencyContact, setEmergencyContact] = useState(profile.emergencyContact || '');
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [qrTokenId, setQrTokenId] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.displayName || '');
    setProfileDescription(profile.profileDescription || '');
    setPhone(profile.phone || '');
    setBloodGroup(profile.bloodGroup || '');
    setPermanentAddress(profile.permanentAddress || '');
    setEmergencyContact(profile.emergencyContact || '');
  }, [profile]);

  const doctorMap = useMemo(() => {
    const map = new Map<string, Doctor>();
    doctors.forEach((d) => map.set(d.doctorId, d));
    return map;
  }, [doctors]);

  const availableDoctorsCount = doctors.filter((d) => d.isAvailable).length;
  const activeTokensCount = myTokens.filter(
    (t) => t.queueStatus === 'waiting' || t.queueStatus === 'serving'
  ).length;
  const completedTokensCount = myTokens.filter(
    (t) => t.queueStatus === 'completed'
  ).length;
  const cancelledTokensCount = myTokens.filter(
    (t) => t.queueStatus === 'cancelled'
  ).length;
  const pendingPaymentTokensCount = myTokens.filter(
    (t) => t.paymentStatus === 'pending' && t.queueStatus !== 'cancelled'
  ).length;

  const totalPaidAmount = useMemo(() => {
    return myTokens
      .filter((t) => t.paymentStatus === 'paid')
      .reduce((sum, t) => sum + t.feeAmount, 0);
  }, [myTokens]);

  const pendingBalanceAmount = useMemo(() => {
    return myTokens
      .filter((t) => t.paymentStatus === 'pending' && t.queueStatus !== 'cancelled')
      .reduce((sum, t) => sum + t.feeAmount, 0);
  }, [myTokens]);

  const filteredHistory = useMemo(() => {
    return myTokens.filter((t) => {
      if (historyFilter === 'pending') {
        return t.queueStatus === 'waiting' || t.queueStatus === 'serving';
      }
      if (historyFilter === 'completed') {
        return t.queueStatus === 'completed';
      }
      if (historyFilter === 'unpaid') {
        return t.paymentStatus === 'pending' && t.queueStatus !== 'cancelled';
      }
      if (historyFilter === 'cancelled') {
        return t.queueStatus === 'cancelled';
      }
      return true;
    });
  }, [myTokens, historyFilter]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveNotice(null);
    try {
      await updateOwnUserProfile(profile.uid, {
        displayName,
        profileDescription,
        phone,
        bloodGroup,
        permanentAddress,
        emergencyContact,
      });
      setEditing(false);
      setSaveNotice('Profile description and contact details updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Global Portal Paused Banner when Admin closes OPD intake */}
      {!hospitalConfig.portalOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Online Token Intake Paused by Administration</p>
            <p className="mt-0.5 text-amber-800">{hospitalConfig.maintenanceMessage}</p>
          </div>
        </div>
      )}

      {/* Hero Split: Hospital Name & Profile Description */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-8 flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
              <span className="font-medium text-teal-700">Hospital Profile</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                {hospitalConfig.portalOpen ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>OPD Token Intake Open</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>OPD Intake Paused</span>
                  </>
                )}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              {hospitalConfig.hospitalName}
            </h1>
            <p className="mt-1.5 text-base font-medium text-slate-700">
              {hospitalConfig.tagline}
            </p>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-2xl">
              {hospitalConfig.description}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>{hospitalConfig.address}</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>{hospitalConfig.opdHours}</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span className="font-mono tabular-nums">{hospitalConfig.phone}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateDoctors}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Stethoscope className="w-4 h-4 shrink-0" />
              <span>View Doctors Available</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={onNavigateMyTokens}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>My Tokens ({activeTokensCount})</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 min-h-64 lg:min-h-full relative">
          <SafeImage
            src={HOSPITAL_ATRIUM_IMAGE}
            alt={hospitalConfig.hospitalName}
            fallbackType="hospital"
            fallbackTitle={hospitalConfig.hospitalName}
            className="w-full h-full object-cover lg:absolute lg:inset-0"
          />
        </div>
      </section>

      {/* Full-Width 4-Column Quick Status Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Doctors Available Today</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {availableDoctorsCount} / {doctors.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Your Active Tokens</p>
          <p className="mt-1.5 text-2xl font-bold text-teal-700 font-mono tabular-nums">
            {activeTokensCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Account Role</p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900 capitalize">
            Registered Patient
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Portal Access Status</p>
          <p className="mt-1.5 text-lg font-semibold text-emerald-700 capitalize">
            {profile.accessStatus}
          </p>
        </div>
      </section>

      {/* Personal Profile Description Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Your Profile &amp; Clinical Description
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Phone: {profile.phone || 'Not added'} · Blood Group: {profile.bloodGroup || 'Not specified'}
              </p>
            </div>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setSaveNotice(null);
                setEditing(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile Description</span>
            </button>
          )}
        </div>

        {saveNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {!editing ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                Profile Description &amp; Medical Notes
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {profile.profileDescription ||
                  'No profile description added yet. Click Edit Profile Description to add allergies, preferred consultation notes, or visit background.'}
              </p>
            </div>
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div>
                <p className="text-xs text-slate-500">Full Name</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {profile.displayName}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Contact Phone</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono tabular-nums">
                  {profile.phone || 'Not added'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Permanent Address</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {profile.permanentAddress || 'Not added'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Emergency Contact</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {profile.emergencyContact || 'Not added'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.displayName.max}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.userPhone.max}
                  placeholder="+1 555 0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Permanent Address
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.permanentAddress.max}
                placeholder="House/Flat No., Street, City, PIN Code"
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Emergency Contact
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.emergencyContact.max}
                placeholder="Name and phone number of emergency contact"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Profile Description (Medical Background, Allergies, Visit Preferences)
                </label>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {profileDescription.length}/{FIELD_LIMITS.profileDescription.max}
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={FIELD_LIMITS.profileDescription.max}
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="Describe any ongoing conditions, allergies, or preferred care notes for your doctor..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Recorded Booking & Consultation History Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 mb-1">
              <FileText className="w-4 h-4" />
              <span>Patient Consultation &amp; Billing Ledger</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Recorded Booking History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete record of all booked tokens, consultation details, queue progress (completed, serving, waiting, or cancelled), and ₹ INR payment status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={onNavigateDoctors}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Book New Token</span>
            </button>
            <button
              type="button"
              onClick={onNavigateMyTokens}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Manage Payments &amp; Receipts</span>
            </button>
          </div>
        </div>

        {/* History Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <p className="text-xs text-slate-500">Total Recorded Bookings</p>
            <p className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {myTokens.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pending / Active Queue</p>
            <p className="mt-1 text-xl font-bold text-amber-700 font-mono tabular-nums">
              {activeTokensCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Completed Consultations</p>
            <p className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
              {completedTokensCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Paid / Pending Balance</p>
            <p className="mt-1 text-sm font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(totalPaidAmount)} paid
              {pendingBalanceAmount > 0 && (
                <span className="block text-xs font-semibold text-amber-700">
                  {formatCurrency(pendingBalanceAmount)} pending
                </span>
              )}
            </p>
          </div>
        </div>

        {/* History Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit no-print">
          {(
            [
              { id: 'all', label: `All Bookings (${myTokens.length})` },
              { id: 'pending', label: `Pending / In Queue (${activeTokensCount})` },
              { id: 'completed', label: `Completed (${completedTokensCount})` },
              { id: 'unpaid', label: `Payment Pending (${pendingPaymentTokensCount})` },
              { id: 'cancelled', label: `Cancelled (${cancelledTokensCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHistoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                historyFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Recorded Bookings List */}
        {filteredHistory.length === 0 ? (
          <div className="p-10 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <Ticket className="w-9 h-9 text-slate-400 mx-auto mb-2.5" />
            <h3 className="text-base font-semibold text-slate-900">
              {myTokens.length === 0
                ? 'No Bookings Recorded Yet'
                : 'No Bookings Match This Filter'}
            </h3>
            <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
              {myTokens.length === 0
                ? 'Once you book a consultation token with a doctor, every detail—token code, doctor, visit reason, queue completion status, and payment receipt—will be recorded here.'
                : 'Switch filter tabs above to view your other consultation records.'}
            </p>
            {myTokens.length === 0 && (
              <button
                type="button"
                onClick={onNavigateDoctors}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Browse Doctors &amp; Book Token</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((booking) => {
              const docItem = doctorMap.get(booking.doctorId);
              const liveServing = docItem
                ? docItem.currentServingNumber > 0
                  ? formatTokenCode(docItem.tokenPrefix, docItem.currentServingNumber)
                  : 'Not Started'
                : '—';
              const aheadCount =
                docItem && booking.queueStatus === 'waiting'
                  ? Math.max(0, booking.tokenNumber - docItem.currentServingNumber)
                  : 0;
              const slotTime =
                booking.slotTime ||
                (docItem
                  ? getTokenSlotTimeWindow(docItem.shiftHours, booking.tokenNumber)
                  : '');

              return (
                <article
                  key={booking.tokenId}
                  className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white"
                >
                  {/* Top Row: Token + Doctor + Recorded Time + Status */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="px-3.5 py-2.5 bg-slate-900 text-white rounded-lg text-center shrink-0">
                        <p className="text-[10px] text-slate-300">Token</p>
                        <p className="text-lg font-bold font-mono tabular-nums">
                          {normalizeTokenCode(booking.tokenCode)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-teal-700">
                            {booking.department}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{booking.room}</span>
                          {slotTime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-teal-800">
                                <Clock className="w-3 h-3" />
                                <span>{slotTime}</span>
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {formatRecordedDateTime(booking.createdAt, booking.bookingDate)}
                            </span>
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {booking.doctorName}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-medium text-slate-700">Consultation Reason:</span>{' '}
                          {booking.visitReason}
                        </p>
                      </div>
                    </div>

                    {/* Queue & Payment Status Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200 text-xs shrink-0">
                      <div>
                        <p className="text-slate-500">Visit Status</p>
                        <p className="mt-0.5 font-semibold inline-flex items-center gap-1">
                          {booking.queueStatus === 'completed' && (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-emerald-700">Completed</span>
                            </>
                          )}
                          {booking.queueStatus === 'serving' && (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span className="text-teal-700">In Consultation</span>
                            </>
                          )}
                          {booking.queueStatus === 'waiting' && (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="text-amber-800">
                                Pending ({aheadCount} ahead)
                              </span>
                            </>
                          )}
                          {booking.queueStatus === 'cancelled' && (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span className="text-red-700">Cancelled</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Now Serving</p>
                        <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                          {liveServing}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Fee &amp; Method</p>
                        <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(booking.feeAmount)} · {booking.paymentMethod}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Payment Status</p>
                        <p
                          className={`mt-0.5 font-semibold ${
                            booking.paymentStatus === 'paid'
                              ? 'text-emerald-700'
                              : booking.paymentStatus === 'pending'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                          }`}
                        >
                          {booking.paymentStatus === 'paid'
                            ? 'Paid'
                            : booking.paymentStatus === 'pending'
                              ? 'Pending at Desk'
                              : 'Refunded'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recorded Identifiers & Quick Actions */}
                  <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 font-mono">
                      <span>Booking ID: {booking.tokenId}</span>
                      <span>Payment Ref: {booking.paymentRef}</span>
                      <span>Patient: {booking.patientName}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => onOpenDoctor(booking.doctorId)}
                        className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg cursor-pointer"
                      >
                        Doctor Queue
                      </button>
                      {booking.paymentStatus === 'pending' &&
                        booking.queueStatus !== 'cancelled' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setQrTokenId(
                                  qrTokenId === booking.tokenId ? null : booking.tokenId
                                )
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-teal-700 bg-teal-50 hover:bg-teal-100 text-teal-900 font-semibold rounded-lg cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>
                                {qrTokenId === booking.tokenId ? 'Hide QR' : 'Payment QR'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={onNavigateMyTokens}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Complete Payment</span>
                            </button>
                          </>
                        )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  {qrTokenId === booking.tokenId && (
                    <div className="pt-2 no-print">
                      <PaymentQrCard
                        compact
                        amount={booking.feeAmount}
                        payeeName={hospitalConfig.hospitalName}
                        note={`Token ${normalizeTokenCode(booking.tokenCode)} - ${booking.doctorName}`}
                        referenceLabel={`${normalizeTokenCode(booking.tokenCode)} · ${booking.doctorName}`}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
