import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, QrCode, Settings2 } from 'lucide-react';
import { formatCurrency } from '../types/hospital';

const DEFAULT_HOSPITAL_UPI_VPA = 'malabarmedical@sbi';
const UPI_VPA_STORAGE_KEY = 'mmc_hospital_upi_vpa';

function getStoredHospitalUpiVpa(): string {
  try {
    const saved = localStorage.getItem(UPI_VPA_STORAGE_KEY);
    if (saved && saved.includes('@') && saved.trim().length >= 5) {
      return saved.trim();
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_HOSPITAL_UPI_VPA;
}

function saveStoredHospitalUpiVpa(vpa: string): void {
  try {
    localStorage.setItem(UPI_VPA_STORAGE_KEY, vpa.trim());
  } catch {
    // Ignore storage errors
  }
}

export function buildUpiPaymentUri(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const cleanAmount = Math.max(1, Number(params.amount) || 0).toFixed(2);
  const query = new URLSearchParams({
    pa: params.vpa.trim(),
    pn: params.payeeName.trim().slice(0, 60),
    am: cleanAmount,
    cu: 'INR',
    tn: params.note.trim().slice(0, 80),
  });
  return `upi://pay?${query.toString()}`;
}

interface PaymentQrCardProps {
  amount: number;
  payeeName: string;
  note: string;
  referenceLabel?: string;
  allowVpaEdit?: boolean;
  compact?: boolean;
}

export const PaymentQrCard: React.FC<PaymentQrCardProps> = ({
  amount,
  payeeName,
  note,
  referenceLabel,
  allowVpaEdit = false,
  compact = false,
}) => {
  const [vpa, setVpa] = useState<string>(() => getStoredHospitalUpiVpa());
  const [editingVpa, setEditingVpa] = useState(false);
  const [vpaDraft, setVpaDraft] = useState(vpa);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const upiUri = useMemo(
    () =>
      buildUpiPaymentUri({
        vpa,
        payeeName,
        amount,
        note,
      }),
    [vpa, payeeName, amount, note]
  );

  useEffect(() => {
    let cancelled = false;
    setQrError(null);
    QRCode.toDataURL(upiUri, {
      width: compact ? 180 : 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError('Unable to generate payment QR code.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [upiUri, compact]);

  const handleCopyVpa = async () => {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback unavailable
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    const safeAmount = Math.round(amount);
    link.download = `payment-qr-inr-${safeAmount}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveVpa = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = vpaDraft.trim();
    if (!cleaned.includes('@') || cleaned.length < 5) {
      return;
    }
    setVpa(cleaned);
    saveStoredHospitalUpiVpa(cleaned);
    setEditingVpa(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="shrink-0 flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl mx-auto sm:mx-0">
          {qrError ? (
            <div className="w-40 h-40 flex items-center justify-center text-xs text-red-700 text-center p-3">
              {qrError}
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`UPI Payment QR Code for ${formatCurrency(amount)}`}
              className={compact ? 'w-36 h-36 object-contain' : 'w-44 h-44 object-contain'}
            />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
              Generating QR...
            </div>
          )}
          <span className="mt-2 text-[11px] font-mono font-bold text-slate-900 tabular-nums">
            {formatCurrency(amount)}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Scan &amp; Pay Exact Amount</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(amount)}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Scan with GPay, PhonePe, Paytm, or any UPI app. The amount{' '}
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(amount)}
              </span>{' '}
              is pre-filled automatically.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Payee</span>
              <span className="font-semibold text-slate-900 truncate">
                {payeeName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Hospital UPI ID</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-medium text-slate-900 truncate">
                  {vpa}
                </span>
                <button
                  type="button"
                  onClick={handleCopyVpa}
                  title="Copy Hospital UPI ID"
                  className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            {referenceLabel && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Purpose</span>
                <span className="font-mono text-slate-700 truncate">
                  {referenceLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!qrDataUrl}
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download QR</span>
            </button>

            {allowVpaEdit && !editingVpa && (
              <button
                type="button"
                onClick={() => {
                  setVpaDraft(vpa);
                  setEditingVpa(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Set Receiving UPI ID</span>
              </button>
            )}
          </div>

          {allowVpaEdit && editingVpa && (
            <form onSubmit={handleSaveVpa} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                required
                value={vpaDraft}
                onChange={(e) => setVpaDraft(e.target.value)}
                placeholder="hospital@upi"
                className="flex-1 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingVpa(false)}
                className="px-2.5 py-1.5 border border-slate-300 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
