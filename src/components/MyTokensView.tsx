import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Printer,
  QrCode,
  Stethoscope,
  Ticket,
  XCircle,
} from 'lucide-react';
import {
  Doctor,
  formatCurrency,
  formatTokenCode,
  getTokenSlotTimeWindow,
  HospitalConfig,
  normalizeTokenCode,
  PaymentMethod,
  TokenBooking,
} from '../types/hospital';
import {
  cancelWaitingToken,
  completePendingTokenPayment,
} from '../services/hospitalService';
import { PaymentQrCard } from './PaymentQrCard';

interface MyTokensViewProps {
  hospitalConfig: HospitalConfig;
  tokens: TokenBooking[];
  doctors: Doctor[];
  patientUid: string;
  onBrowseDoctors: () => void;
  onOpenDoctor: (doctorId: string) => void;
}

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

export const MyTokensView: React.FC<MyTokensViewProps> = ({
  hospitalConfig,
  tokens,
  doctors,
  patientUid,
  onBrowseDoctors,
  onOpenDoctor,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'history'>('all');
  const [payingTokenId, setPayingTokenId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, 'Hospital Desk'>>('UPI');
  const [payDetail, setPayDetail] = useState('');
  const [processing, setProcessing] = useState(false);

  const doctorMap = useMemo(() => {
    const map = new Map<string, Doctor>();
    doctors.forEach((d) => map.set(d.doctorId, d));
    return map;
  }, [doctors]);

  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      if (filter === 'active') {
        return t.queueStatus === 'waiting' || t.queueStatus === 'serving';
      }
      if (filter === 'history') {
        return t.queueStatus === 'completed' || t.queueStatus === 'cancelled';
      }
      return true;
    });
  }, [tokens, filter]);

  const handleCompletePayment = async (token: TokenBooking) => {
    setProcessing(true);
    try {
      await completePendingTokenPayment({
        tokenId: token.tokenId,
        patientUid,
        paymentMethod: payMethod,
        paymentDetailLabel:
          payDetail.replace(/[^a-zA-Z0-9]/g, '').trim().slice(-6).toUpperCase() ||
          (payMethod === 'UPI' ? 'QRPAY' : 'ONLINE'),
      });
      setPayingTokenId(null);
      setPayDetail('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700 mb-1">
            {hospitalConfig.hospitalName} · Patient Queue &amp; Billing
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            My Tokens &amp; Payment Receipts
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(['all', 'active', 'history'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap cursor-pointer ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All Tokens' : tab === 'active' ? 'Active' : 'Completed / Cancelled'}
            </button>
          ))}
        </div>
      </div>

      {filteredTokens.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Ticket className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">
            No Tokens Found
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            Browse available doctors to book a consultation token and complete your payment.
          </p>
          <button
            type="button"
            onClick={onBrowseDoctors}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Browse Available Doctors</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTokens.map((token) => {
            const docItem = doctorMap.get(token.doctorId);
            const liveServing = docItem
              ? docItem.currentServingNumber > 0
                ? formatTokenCode(docItem.tokenPrefix, docItem.currentServingNumber)
                : 'Not Started'
              : '—';
            const aheadCount =
              docItem && token.queueStatus === 'waiting'
                ? Math.max(0, token.tokenNumber - docItem.currentServingNumber)
                : 0;
            const slotTime =
              token.slotTime ||
              (docItem
                ? getTokenSlotTimeWindow(docItem.shiftHours, token.tokenNumber)
                : '');

            return (
              <article
                key={token.tokenId}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-5">
                    <div className="px-4 py-3 bg-slate-900 text-white rounded-lg text-center shrink-0">
                      <p className="text-[11px] text-slate-300">Token</p>
                      <p className="text-xl font-bold font-mono tabular-nums">
                        {normalizeTokenCode(token.tokenCode)}
                      </p>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-teal-700">{token.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>{token.room}</span>
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
                        <span className="font-mono tabular-nums">
                          {formatRecordedDateTime(token.createdAt, token.bookingDate)}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                        {token.doctorName}
                      </h2>
                      <p className="text-xs text-slate-600 mt-1">
                        Reason: {token.visitReason}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 text-xs border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200">
                    <div>
                      <p className="text-slate-500">Doctor Serving</p>
                      <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                        {liveServing}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Queue Status</p>
                      <p className="mt-0.5 font-semibold capitalize inline-flex items-center gap-1">
                        {token.queueStatus === 'waiting' && (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-amber-800">
                              Waiting ({aheadCount} ahead)
                            </span>
                          </>
                        )}
                        {token.queueStatus === 'serving' && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Now Serving</span>
                          </>
                        )}
                        {token.queueStatus === 'completed' && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-slate-700">Completed</span>
                          </>
                        )}
                        {token.queueStatus === 'cancelled' && (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span className="text-red-700">Cancelled</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fee &amp; Method</p>
                      <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(token.feeAmount)} · {token.paymentMethod}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Payment</p>
                      <p
                        className={`mt-0.5 font-semibold capitalize ${
                          token.paymentStatus === 'paid'
                            ? 'text-emerald-700'
                            : token.paymentStatus === 'pending'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {token.paymentStatus === 'paid'
                          ? 'Paid'
                          : token.paymentStatus === 'pending'
                            ? 'Pending at Desk'
                            : 'Refunded'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Inline Pending Payment Upgrade & QR Payment Box */}
                {payingTokenId === token.tokenId && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">
                        Complete Payment Online ({formatCurrency(token.feeAmount)})
                      </p>
                      <button
                        type="button"
                        onClick={() => setPayingTokenId(null)}
                        className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    {payMethod === 'UPI' && (
                      <PaymentQrCard
                        compact
                        amount={token.feeAmount}
                        payeeName={hospitalConfig.hospitalName}
                        note={`Token ${normalizeTokenCode(token.tokenCode)} - ${token.doctorName}`}
                        referenceLabel={`${normalizeTokenCode(token.tokenCode)} · ${token.doctorName}`}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={payMethod}
                        onChange={(e) =>
                          setPayMethod(
                            e.target.value as Exclude<PaymentMethod, 'Hospital Desk'>
                          )
                        }
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="UPI">UPI / Scan QR Code</option>
                        <option value="Card">Credit / Debit Card</option>
                        <option value="Insurance">Health Insurance</option>
                      </select>
                      <input
                        type="text"
                        placeholder={
                          payMethod === 'Card'
                            ? 'Last 4 digits or card ref'
                            : payMethod === 'UPI'
                              ? 'UTR / Ref or UPI ID (optional for QR)'
                              : 'Insurance Policy ID'
                        }
                        value={payDetail}
                        onChange={(e) => setPayDetail(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => handleCompletePayment(token)}
                          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          {processing ? 'Processing...' : 'Confirm Payment'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayingTokenId(null)}
                          className="px-3 py-2 border border-slate-300 bg-white text-xs rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 font-mono">
                    ID: {token.tokenId} · Ref: {token.paymentRef}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDoctor(token.doctorId)}
                      className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg cursor-pointer"
                    >
                      View Doctor Queue
                    </button>
                    {token.paymentStatus === 'pending' &&
                      token.queueStatus !== 'cancelled' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPayMethod('UPI');
                              setPayingTokenId(
                                payingTokenId === token.tokenId ? null : token.tokenId
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pay via QR / Online</span>
                          </button>
                        </>
                      )}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Receipt</span>
                    </button>
                    {token.queueStatus === 'waiting' && (
                      <button
                        type="button"
                        onClick={() => cancelWaitingToken(token.tokenId)}
                        className="px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg cursor-pointer"
                      >
                        Cancel Token
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
