import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Doctor,
  DoctorSlot,
  formatCurrency,
  formatOpdDateDisplay,
  formatTokenCode,
  getDoctorOpdDate,
  getDoctorTotalTokens,
  getTokenSlotTimeWindow,
  HospitalConfig,
  isTokenSlotTimeOver,
  TOKEN_INTERVAL_MINUTES,
} from '../types/hospital';
import { subscribeAllDoctorSlots } from '../services/hospitalService';
import { SafeImage } from './SafeImage';

interface DoctorsPageViewProps {
  hospitalConfig: HospitalConfig;
  doctors: Doctor[];
  isAdmin: boolean;
  onSelectDoctor: (doctorId: string) => void;
  onNavigateAdmin: () => void;
}

export const DoctorsPageView: React.FC<DoctorsPageViewProps> = ({
  hospitalConfig,
  doctors,
  isAdmin,
  onSelectDoctor,
  onNavigateAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [allSlots, setAllSlots] = useState<DoctorSlot[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = subscribeAllDoctorSlots(
      setAllSlots,
      (err) => {
        console.error('Error loading doctor slot summary:', err);
      }
    );
    return () => unsub();
  }, []);

  const bookedSlotsByDoctorAndDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    allSlots.forEach((slot) => {
      const key = `${slot.doctorId}__${slot.bookingDate}`;
      if (!map.has(key)) {
        map.set(key, new Set<number>());
      }
      map.get(key)!.add(slot.tokenNumber);
    });
    return map;
  }, [allSlots]);

  const departments = useMemo(() => {
    const set = new Set<string>(['All']);
    doctors.forEach((d) => set.add(d.department));
    return Array.from(set);
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((docItem) => {
      if (onlyAvailable && !docItem.isAvailable) return false;
      if (selectedDepartment !== 'All' && docItem.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          docItem.name.toLowerCase().includes(q) ||
          docItem.specialty.toLowerCase().includes(q) ||
          docItem.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [doctors, onlyAvailable, selectedDepartment, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-700 mb-1">
              {hospitalConfig.hospitalName} · Specialist Outpatient Directory
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Doctors Available
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
              Select any physician to view all 10-minute token time slots, pick an open token, and complete consultation payment.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {filteredDoctors.filter((d) => d.isAvailable).length} available · {doctors.length} total specialists
          </div>
        </div>

        {/* Search & Department Segmented Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDepartment === dept
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctor or specialty..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyAvailable
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {onlyAvailable ? 'Showing Available Only' : 'Available Only'}
            </button>
          </div>
        </div>
      </div>

      {/* Empty Directory State */}
      {doctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">
            No Specialists Published Yet
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            The hospital administrator has not published today&apos;s doctor roster yet.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Admin Console to Publish Doctors</span>
            </button>
          )}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            No doctors match your current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDepartment('All');
              setSearchQuery('');
              setOnlyAvailable(false);
            }}
            className="mt-3 text-xs font-medium text-teal-700 hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      ) : (
        /* Doctor Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDoctors.map((doctor) => {
            const totalTokens = getDoctorTotalTokens(doctor);
            const doctorOpdDate = getDoctorOpdDate(doctor);
            const bookedSet =
              bookedSlotsByDoctorAndDate.get(`${doctor.doctorId}__${doctorOpdDate}`) ||
              new Set<number>();
            const openSlotNumbers: number[] = [];
            for (let n = 1; n <= totalTokens; n++) {
              const expired = isTokenSlotTimeOver(
                doctorOpdDate,
                doctor.shiftHours,
                n,
                nowMs
              );
              if (!bookedSet.has(n) && n > doctor.currentServingNumber && !expired) {
                openSlotNumbers.push(n);
              }
            }
            const openCount = openSlotNumbers.length;
            const nextOpenNumber = openSlotNumbers[0] ?? null;
            const nextOpenCode = nextOpenNumber
              ? formatTokenCode(doctor.tokenPrefix, nextOpenNumber)
              : 'Closed / Full';
            const nextOpenSlotWindow = nextOpenNumber
              ? getTokenSlotTimeWindow(doctor.shiftHours, nextOpenNumber)
              : null;
            const servingCode =
              doctor.currentServingNumber > 0
                ? formatTokenCode(doctor.tokenPrefix, doctor.currentServingNumber)
                : 'Not Started';

            return (
              <article
                key={doctor.doctorId}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6"
              >
                <div className="flex items-start gap-5">
                  <SafeImage
                    src={doctor.avatarUrl}
                    alt={doctor.name}
                    fallbackType="doctor"
                    fallbackTitle={doctor.name}
                    className="w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-medium text-teal-700">{doctor.department}</span>
                      <span aria-hidden="true">·</span>
                      <span>{doctor.room}</span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 truncate">
                      {doctor.name}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {doctor.credentials} · {doctor.specialty} · {doctor.experienceYears} yrs exp
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                      {doctor.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Available · {doctor.shiftHours}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-700">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Unavailable / Off Shift</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-slate-700 font-mono tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span>{formatOpdDateDisplay(doctorOpdDate)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {doctor.bio}
                </p>

                {/* Per-Doctor Live Queue & Fee Strip */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 text-xs">
                  <div>
                    <p className="text-slate-500">Now Serving</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 font-mono tabular-nums">
                      {servingCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Next Open Slot</p>
                    <p className="mt-0.5 text-sm font-bold text-teal-700 font-mono tabular-nums">
                      {nextOpenCode}
                    </p>
                    {nextOpenSlotWindow && (
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {nextOpenSlotWindow}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">Consult Fee</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(doctor.consultationFee)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {openCount} / {totalTokens} open ({TOKEN_INTERVAL_MINUTES}m slots)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDoctor(doctor.doctorId)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Select Token &amp; Pay</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

