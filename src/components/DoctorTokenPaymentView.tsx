import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Play,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Ticket,
  XCircle,
} from 'lucide-react';
import {
  Doctor,
  DoctorSlot,
  FIELD_LIMITS,
  formatCurrency,
  formatOpdDateDisplay,
  formatTokenCode,
  getDoctorOpdDate,
  getDoctorTotalTokens,
  getTokenSlotTimeWindow,
  HospitalConfig,
  isTokenSlotTimeOver,
  PaymentMethod,
  PaymentRecord,
  TokenBooking,
  UserProfile,
} from '../types/hospital';
import {
  adminAdvanceDoctorQueue,
  adminResetDoctorQueue,
  adminToggleDoctorAvailability,
  bookDoctorTokenWithPayment,
  getTodayDateString,
  subscribeDoctorSlots,
} from '../services/hospitalService';
import { SafeImage } from './SafeImage';
import { PaymentQrCard } from './PaymentQrCard';

interface DoctorTokenPaymentViewProps {
  doctor: Doctor;
  hospitalConfig: HospitalConfig;
  profile: UserProfile;
  isAdmin: boolean;
  onBackToDoctors: () => void;
  onNavigateMyTokens: () => void;
}

export const DoctorTokenPaymentView: React.FC<DoctorTokenPaymentViewProps> = ({
  doctor,
  hospitalConfig,
  profile,
  isAdmin,
  onBackToDoctors,
  onNavigateMyTokens,
}) => {
  const availableMethods = hospitalConfig.acceptedPaymentMethods;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    availableMethods[0] || 'Card'
  );
  const [visitReason, setVisitReason] = useState('');
  const [cardHolder, setCardHolder] = useState(profile.displayName);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [upiMode, setUpiMode] = useState<'qr' | 'vpa'>('qr');
  const [upiId, setUpiId] = useState('');
  const [upiTxnRef, setUpiTxnRef] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<DoctorSlot[]>([]);
  const [selectedTokenNumber, setSelectedTokenNumber] = useState<number | null>(null);
  const todayDate = getTodayDateString();
  const doctorOpdDate = getDoctorOpdDate(doctor);
  const [selectedDate, setSelectedDate] = useState(doctorOpdDate);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [issuedResult, setIssuedResult] = useState<{
    token: TokenBooking;
    payment: PaymentRecord;
  } | null>(null);

  const totalTokens = getDoctorTotalTokens(doctor);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedDate(getDoctorOpdDate(doctor));
  }, [doctor.doctorId, doctor.opdDate]);

  useEffect(() => {
    const activeBookingDate = FIELD_LIMITS.DATE_REGEX.test(selectedDate)
      ? selectedDate
      : doctorOpdDate;
    const unsub = subscribeDoctorSlots(
      doctor.doctorId,
      activeBookingDate,
      setDoctorSlots,
      (err) => {
        console.error('Error loading doctor slots:', err);
      }
    );
    return () => unsub();
  }, [doctor.doctorId, selectedDate, doctorOpdDate]);

  const servingCode =
    doctor.currentServingNumber > 0
      ? formatTokenCode(doctor.tokenPrefix, doctor.currentServingNumber)
      : 'Not Started';

  const bookedSlotMap = useMemo(() => {
    const map = new Map<number, DoctorSlot>();
    doctorSlots.forEach((s) => map.set(s.tokenNumber, s));
    return map;
  }, [doctorSlots]);

  const allSlots = useMemo(() => {
    const isDoctorActiveDate = selectedDate === doctorOpdDate;
    return Array.from({ length: totalTokens }, (_, idx) => {
      const tokenNumber = idx + 1;
      const tokenCode = formatTokenCode(doctor.tokenPrefix, tokenNumber);
      const slotTime = getTokenSlotTimeWindow(doctor.shiftHours, tokenNumber);
      const bookedSlot = bookedSlotMap.get(tokenNumber);
      const isBooked = Boolean(bookedSlot);
      const isServed = isDoctorActiveDate && tokenNumber <= doctor.currentServingNumber;
      const isTimeOver = isTokenSlotTimeOver(selectedDate, doctor.shiftHours, tokenNumber, nowMs);
      const isAvailable = !isBooked && !isServed && !isTimeOver;
      return {
        tokenNumber,
        tokenCode,
        slotTime,
        isBooked,
        isServed,
        isTimeOver,
        isAvailable,
      };
    });
  }, [
    totalTokens,
    doctor.tokenPrefix,
    doctor.shiftHours,
    doctor.currentServingNumber,
    bookedSlotMap,
    selectedDate,
    doctorOpdDate,
    nowMs,
  ]);

  const availableSlotsCount = useMemo(
    () => allSlots.filter((s) => s.isAvailable).length,
    [allSlots]
  );

  useEffect(() => {
    const current = allSlots.find((s) => s.tokenNumber === selectedTokenNumber);
    if (!current || !current.isAvailable) {
      const firstOpen = allSlots.find((s) => s.isAvailable);
      setSelectedTokenNumber(firstOpen ? firstOpen.tokenNumber : null);
    }
  }, [allSlots, selectedTokenNumber]);

  const selectedSlot = useMemo(
    () => allSlots.find((s) => s.tokenNumber === selectedTokenNumber) || null,
    [allSlots, selectedTokenNumber]
  );

  const selectedTokenCode = selectedSlot
    ? selectedSlot.tokenCode
    : 'None';
  const selectedSlotTime = selectedSlot ? selectedSlot.slotTime : '';

  const canBook =
    hospitalConfig.portalOpen &&
    doctor.isAvailable &&
    profile.accessStatus === 'active' &&
    selectedSlot !== null;

  const activeMethod: PaymentMethod = availableMethods.includes(selectedMethod)
    ? selectedMethod
    : availableMethods[0] || 'Card';

  const handleBookAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedSlot || !selectedSlot.isAvailable) {
      setFormError('Please select an available token slot before booking.');
      return;
    }

    if (visitReason.trim().length < FIELD_LIMITS.visitReason.min) {
      setFormError('Please enter a brief consultation reason (at least 2 characters).');
      return;
    }

    let detailLabel = 'ONLINE';
    if (activeMethod === 'Card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12) {
        setFormError('Please enter a valid 12–16 digit debit or credit card number.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
        setFormError('Please enter card expiry in MM/YY format.');
        return;
      }
      if (cardCvv.replace(/\D/g, '').length < 3) {
        setFormError('Please enter a valid 3 or 4 digit CVV.');
        return;
      }
      detailLabel = digits.slice(-4);
    } else if (activeMethod === 'UPI') {
      if (upiMode === 'vpa') {
        if (!upiId.includes('@') || upiId.trim().length < 5) {
          setFormError('Please enter a valid UPI ID (example: patient@bank).');
          return;
        }
        detailLabel = upiId.split('@')[0].slice(0, 8).toUpperCase();
      } else {
        const cleanRef = upiTxnRef.replace(/[^a-zA-Z0-9]/g, '').trim();
        detailLabel = cleanRef ? cleanRef.slice(-6).toUpperCase() : 'QRPAY';
      }
    } else if (activeMethod === 'Insurance') {
      if (insuranceProvider.trim().length < 2 || policyNumber.trim().length < 3) {
        setFormError('Please enter your insurance provider and policy number.');
        return;
      }
      detailLabel = policyNumber.trim().slice(-6).toUpperCase();
    } else {
      detailLabel = 'COUNTER';
    }

    setSubmitting(true);
    try {
      const res = await bookDoctorTokenWithPayment({
        doctorId: doctor.doctorId,
        selectedTokenNumber: selectedSlot.tokenNumber,
        bookingDate: selectedDate,
        patientUid: profile.uid,
        patientName: profile.displayName,
        visitReason,
        paymentMethod: activeMethod,
        paymentDetailLabel: detailLabel,
      });
      setIssuedResult(res);
      setVisitReason('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setUpiTxnRef('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not issue token. Please retry.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Back Action */}
      <div className="no-print flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToDoctors}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Doctors Available</span>
        </button>
        <div className="text-xs text-slate-500">
          {hospitalConfig.hospitalName} / {doctor.department} / {doctor.name}
        </div>
      </div>

      {/* Doctor Header Profile */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <SafeImage
            src={doctor.avatarUrl}
            alt={doctor.name}
            fallbackType="doctor"
            fallbackTitle={doctor.name}
            className="w-24 h-24 rounded-xl object-cover border border-slate-200 shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-semibold text-teal-700">{doctor.department}</span>
              <span aria-hidden="true">·</span>
              <span>{doctor.room}</span>
              <span aria-hidden="true">·</span>
              <span>{doctor.shiftHours}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>OPD Date: {formatOpdDateDisplay(doctorOpdDate)}</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{doctor.name}</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {doctor.credentials} · {doctor.specialty} · {doctor.experienceYears} years experience
            </p>
            <p className="mt-2.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
              {doctor.bio}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200">
          <div className="text-left lg:text-right">
            <p className="text-xs text-slate-500">Consultation Fee</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(doctor.consultationFee)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {doctor.isAvailable ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Accepting Tokens</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <XCircle className="w-4 h-4" />
                <span>Doctor Unavailable</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main 2-Column Workspace: Left = Doctor's Token System, Right = Doctor's Payment System */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Per-Doctor Token Queue Board */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6 no-print">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Select Doctor Token
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {totalTokens} tokens · 10m each
            </span>
          </div>

          {/* Consultation Date Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="doctor-token-date"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>Consultation Date</span>
              </label>
              {selectedDate !== doctorOpdDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(doctorOpdDate)}
                  className="text-[11px] font-medium text-teal-700 hover:underline cursor-pointer"
                >
                  Use Doctor Date ({doctorOpdDate})
                </button>
              )}
            </div>
            <input
              id="doctor-token-date"
              type="date"
              min={todayDate}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setFormError(null);
                }
              }}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <p className="text-[11px] text-slate-500">
              Showing tokens for <span className="font-mono font-semibold text-slate-700">{formatOpdDateDisplay(selectedDate)}</span>
              {selectedDate === doctorOpdDate ? ' (Doctor scheduled OPD date)' : ''}.
            </p>
          </div>

          {/* 3-Metric Queue Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-slate-900 text-white rounded-lg">
              <p className="text-xs text-slate-300">Now Serving</p>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums">
                {servingCode}
              </p>
            </div>
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-xs text-teal-800">Open Tokens</p>
              <p className="mt-1 text-lg font-bold text-teal-900 font-mono tabular-nums">
                {availableSlotsCount} / {totalTokens}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500">Slot Window</p>
              <p className="mt-1 text-lg font-bold text-slate-900 font-mono tabular-nums">
                10 mins
              </p>
            </div>
          </div>

          {/* Selectable All-Tokens Grid (10-Minute Slots, Exclusive Lock) */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span>Choose an Available Token Slot</span>
              <span className="font-mono tabular-nums">
                {totalTokens - availableSlotsCount} taken
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allSlots.map((slot) => {
                const isSelected = selectedTokenNumber === slot.tokenNumber;

                return (
                  <button
                    key={slot.tokenNumber}
                    type="button"
                    disabled={!slot.isAvailable || !doctor.isAvailable || !hospitalConfig.portalOpen}
                    onClick={() => {
                      if (!slot.isAvailable) return;
                      setSelectedTokenNumber(slot.tokenNumber);
                      setFormError(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      isSelected && slot.isAvailable
                        ? 'border-teal-700 bg-teal-50 text-teal-950 ring-2 ring-teal-600/25 cursor-pointer'
                        : slot.isAvailable
                          ? 'border-slate-200 bg-white hover:border-teal-500 hover:bg-slate-50 text-slate-900 cursor-pointer'
                          : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm tabular-nums">
                        {slot.tokenCode}
                      </span>
                      {isSelected && slot.isAvailable ? (
                        <span className="text-[11px] font-semibold text-teal-700">
                          Selected
                        </span>
                      ) : slot.isAvailable ? (
                        <span className="text-[11px] font-medium text-emerald-700">
                          Available
                        </span>
                      ) : slot.isBooked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Lock className="w-3 h-3" />
                          <span>Booked</span>
                        </span>
                      ) : slot.isServed ? (
                        <span className="text-[11px] font-medium text-slate-500">
                          Served
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Time Over</span>
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[11px] font-mono tabular-nums ${
                        slot.isAvailable ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {slot.slotTime}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Staff Queue Controls */}
          {isAdmin && (
            <div className="pt-5 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>Admin Queue Controls ({doctor.name})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={doctor.currentServingNumber >= totalTokens}
                  onClick={() => adminAdvanceDoctorQueue(doctor)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Call Next Token</span>
                </button>
                <button
                  type="button"
                  onClick={() => adminToggleDoctorAvailability(doctor)}
                  className="px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {doctor.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                </button>
                <button
                  type="button"
                  onClick={() => adminResetDoctorQueue(doctor.doctorId)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Queue</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: Per-Doctor Payment & Token Issue Checkout OR Issued Receipt */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          {issuedResult ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Token Confirmed &amp; Payment Recorded
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Present this digital pass at {issuedResult.token.room}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pass</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-500">Issued Token Number</p>
                  <p className="mt-1 text-4xl font-bold text-teal-700 font-mono tabular-nums">
                    {issuedResult.token.tokenCode}
                  </p>
                  {issuedResult.token.slotTime && (
                    <p className="mt-2 text-xs font-semibold text-slate-900 font-mono">
                      Time Slot: {issuedResult.token.slotTime}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-600">
                    Date: <span className="font-mono">{issuedResult.token.bookingDate}</span>
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Doctor</span>
                    <span className="font-semibold text-slate-900">
                      {issuedResult.token.doctorName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room</span>
                    <span className="font-medium text-slate-900">
                      {issuedResult.token.room}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consultation Fee</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(issuedResult.payment.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method</span>
                    <span className="font-medium text-slate-900">
                      {issuedResult.payment.method}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Status</span>
                    <span
                      className={`font-semibold capitalize ${
                        issuedResult.payment.status === 'paid'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {issuedResult.payment.status === 'paid'
                        ? 'Paid'
                        : 'Pending at Hospital Desk'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Receipt Reference</span>
                    <span className="font-mono text-slate-700">
                      {issuedResult.payment.referenceCode}
                    </span>
                  </div>
                </div>
              </div>

              {issuedResult.payment.status === 'pending' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Scan QR Code to Pay Pending Consultation Fee
                  </p>
                  <PaymentQrCard
                    compact
                    amount={issuedResult.payment.amount}
                    payeeName={hospitalConfig.hospitalName}
                    note={`Token ${issuedResult.token.tokenCode} - ${issuedResult.token.doctorName}`}
                    referenceLabel={`${issuedResult.token.tokenCode} · ${issuedResult.token.doctorName}`}
                  />
                </div>
              )}

              <div className="no-print flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onNavigateMyTokens}
                  className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  View in My Tokens &amp; Receipts
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedResult(null)}
                  className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Book Another Token
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBookAndPay} className="space-y-6">
              <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Book Token &amp; Complete Payment
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedSlot ? (
                      <>
                        Selected Token:{' '}
                        <span className="font-mono font-semibold text-teal-700">
                          {selectedTokenCode}
                        </span>{' '}
                        on <span className="font-mono font-medium text-slate-700">{selectedDate}</span>{' '}
                        ({selectedSlotTime}) · {formatCurrency(doctor.consultationFee)}
                      </>
                    ) : (
                      `All token slots for ${formatOpdDateDisplay(selectedDate)} are currently booked.`
                    )}
                  </p>
                </div>
                {selectedSlot && (
                  <div className="px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-right shrink-0">
                    <p className="text-[11px] font-bold font-mono text-teal-900">
                      {selectedTokenCode} · {selectedDate}
                    </p>
                    <p className="text-[11px] font-mono text-teal-700">
                      {selectedSlotTime}
                    </p>
                  </div>
                )}
              </div>

              {!canBook && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Booking Currently Unavailable</p>
                    <p className="mt-0.5 text-amber-800">
                      {!hospitalConfig.portalOpen
                        ? hospitalConfig.maintenanceMessage
                        : !doctor.isAvailable
                          ? `${doctor.name} is currently marked off-shift or unavailable.`
                          : selectedSlot === null
                            ? `All ${totalTokens} tokens for ${doctor.name} on ${formatOpdDateDisplay(selectedDate)} are booked, served, or past their consultation time. Try selecting a future date.`
                            : 'Your account access is currently suspended by administration.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Consultation Reason */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    01. Consultation Reason / Brief Symptoms
                  </label>
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    {visitReason.length}/{FIELD_LIMITS.visitReason.max}
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  disabled={!canBook}
                  maxLength={FIELD_LIMITS.visitReason.max}
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  placeholder="Describe your symptoms, follow-up purpose, or consultation notes..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
                />
              </div>

              {/* Step 2: Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  02. Select Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {availableMethods.map((method) => {
                    const active = activeMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={!canBook}
                        onClick={() => {
                          setSelectedMethod(method);
                          setFormError(null);
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                          active
                            ? 'border-teal-700 bg-teal-50 text-teal-950'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {method === 'Card' && <CreditCard className="w-4 h-4 shrink-0" />}
                          {method === 'UPI' && <QrCode className="w-4 h-4 shrink-0" />}
                          {method === 'Insurance' && <ShieldCheck className="w-4 h-4 shrink-0" />}
                          {method === 'Hospital Desk' && <Building className="w-4 h-4 shrink-0" />}
                          <span className="truncate">
                            {method === 'UPI' ? 'UPI / QR Code' : method}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Method-Specific Payment Details */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                {activeMethod === 'Card' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        disabled={!canBook}
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Card Number
                        </label>
                        <input
                          type="text"
                          disabled={!canBook}
                          maxLength={19}
                          placeholder="4532 8810 2231 9940"
                          value={cardNumber}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                            const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
                            setCardNumber(formatted);
                          }}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Expiry
                        </label>
                        <input
                          type="text"
                          disabled={!canBook}
                          maxLength={5}
                          placeholder="08/28"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          CVV
                        </label>
                        <input
                          type="password"
                          disabled={!canBook}
                          maxLength={4}
                          placeholder="123"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeMethod === 'UPI' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-lg">
                      <button
                        type="button"
                        disabled={!canBook}
                        onClick={() => {
                          setUpiMode('qr');
                          setFormError(null);
                        }}
                        className={`py-2 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          upiMode === 'qr'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Scan Payment QR</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canBook}
                        onClick={() => {
                          setUpiMode('vpa');
                          setFormError(null);
                        }}
                        className={`py-2 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          upiMode === 'vpa'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Enter UPI ID</span>
                      </button>
                    </div>

                    {upiMode === 'qr' ? (
                      <div className="space-y-3">
                        <PaymentQrCard
                          amount={doctor.consultationFee}
                          payeeName={hospitalConfig.hospitalName}
                          note={`Token ${selectedTokenCode} (${selectedSlotTime}) - ${doctor.name}`}
                          referenceLabel={`${selectedTokenCode} · ${selectedSlotTime}`}
                        />
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            UPI Reference / UTR Number (Optional after scanning)
                          </label>
                          <input
                            type="text"
                            disabled={!canBook}
                            maxLength={24}
                            placeholder="e.g. 432810945120 (optional)"
                            value={upiTxnRef}
                            onChange={(e) => setUpiTxnRef(e.target.value)}
                            className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Patient UPI ID
                        </label>
                        <input
                          type="text"
                          disabled={!canBook}
                          placeholder="username@okaxis"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                        <p className="mt-1.5 text-xs text-slate-500">
                          Instant consultation confirmation and receipt generation upon verification.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeMethod === 'Insurance' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Insurance Provider
                      </label>
                      <input
                        type="text"
                        disabled={!canBook}
                        placeholder="Star Health / HDFC ERGO / ICICI Lombard"
                        value={insuranceProvider}
                        onChange={(e) => setInsuranceProvider(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Policy / Member ID
                      </label>
                      <input
                        type="text"
                        disabled={!canBook}
                        placeholder="POL-884120"
                        value={policyNumber}
                        onChange={(e) => setPolicyNumber(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                )}

                {activeMethod === 'Hospital Desk' && (
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Your token will be reserved immediately with status{' '}
                      <span className="font-semibold">Pending at Hospital Desk</span>. You may pay at Reception Counter 1 before your turn or complete payment online anytime from My Tokens.
                    </p>
                  </div>
                )}
              </div>

              {/* Fee Summary */}
              <div className="pt-4 border-t border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Specialist Consultation ({doctor.name})</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(doctor.consultationFee)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Digital Token Issuance</span>
                  <span className="font-mono tabular-nums">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums text-lg">
                    {formatCurrency(doctor.consultationFee)}
                  </span>
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canBook || submitting}
                className="w-full py-3 px-5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Issuing Token & Processing Payment...'
                  : !selectedSlot
                    ? 'No Open Tokens Available'
                    : activeMethod === 'Hospital Desk'
                      ? `Reserve Token ${selectedTokenCode} (${selectedSlotTime})`
                      : `Pay ${formatCurrency(doctor.consultationFee)} & Book ${selectedTokenCode}`}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};
