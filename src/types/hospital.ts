export type UserRole = 'patient' | 'admin';
export type AccessStatus = 'active' | 'suspended';
export type PaymentMethod = 'Card' | 'UPI' | 'Insurance' | 'Hospital Desk';
export type PaymentStatus = 'paid' | 'pending' | 'refunded';
export type QueueStatus = 'waiting' | 'serving' | 'completed' | 'cancelled';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'ajalvinod1234@gmail.com';

export const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  'Card',
  'UPI',
  'Insurance',
  'Hospital Desk',
];

export const FIELD_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  PREFIX_REGEX: /^[A-Z0-9]+$/,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  hospitalName: { min: 2, max: 120 },
  tagline: { min: 2, max: 200 },
  description: { min: 10, max: 1500 },
  address: { min: 4, max: 250 },
  phone: { min: 5, max: 40 },
  opdHours: { min: 3, max: 100 },
  maintenanceMessage: { min: 0, max: 500 },
  displayName: { min: 1, max: 100 },
  profileDescription: { min: 0, max: 800 },
  userPhone: { min: 0, max: 30 },
  bloodGroup: { min: 0, max: 10 },
  permanentAddress: { min: 4, max: 300 },
  emergencyContact: { min: 0, max: 120 },
  visitReason: { min: 2, max: 400 },
  doctorBio: { min: 10, max: 600 },
  avatarUrlMax: 200000,
  consultationFeeMax: 50000,
} as const;

export interface HospitalConfig {
  hospitalName: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  opdHours: string;
  portalOpen: boolean;
  allowNewRegistrations: boolean;
  maintenanceMessage: string;
  acceptedPaymentMethods: PaymentMethod[];
  updatedAt?: unknown;
  updatedBy: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  profileDescription: string;
  phone: string;
  bloodGroup: string;
  permanentAddress: string;
  emergencyContact: string;
  role: UserRole;
  accessStatus: AccessStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
  grantedBy: string;
  createdAt?: unknown;
}

export const DEFAULT_TOTAL_TOKENS = 10;
export const MAX_TOTAL_TOKENS = 60;
export const TOKEN_INTERVAL_MINUTES = 10;

export interface Doctor {
  doctorId: string;
  name: string;
  credentials: string;
  specialty: string;
  department: string;
  room: string;
  consultationFee: number;
  tokenPrefix: string;
  currentServingNumber: number;
  lastIssuedNumber: number;
  totalTokens?: number;
  opdDate?: string;
  isAvailable: boolean;
  shiftHours: string;
  experienceYears: number;
  bio: string;
  avatarUrl: string;
  updatedAt?: unknown;
}

export interface TokenBooking {
  tokenId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  room: string;
  tokenNumber: number;
  tokenCode: string;
  patientUid: string;
  patientName: string;
  visitReason: string;
  feeAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  queueStatus: QueueStatus;
  bookingDate: string;
  slotTime?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DoctorSlot {
  slotId: string;
  doctorId: string;
  bookingDate: string;
  tokenNumber: number;
  tokenCode: string;
  slotTime: string;
  tokenId: string;
  createdAt?: unknown;
}

export interface PaymentRecord {
  paymentId: string;
  tokenId: string;
  tokenCode: string;
  doctorId: string;
  doctorName: string;
  patientUid: string;
  patientName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceCode: string;
  createdAt?: unknown;
}

export const DEFAULT_HOSPITAL_CONFIG: Omit<HospitalConfig, 'updatedAt' | 'updatedBy'> = {
  hospitalName: 'MALABAR MEDICAL COLLEGE',
  tagline: 'Multispecialty Outpatient Care & Real-Time OPD Token Center',
  description:
    'MALABAR MEDICAL COLLEGE provides coordinated outpatient specialist care, rapid diagnostic triage, and transparent digital queue tokens across Cardiology, Neurology, Orthopedics, and Pediatrics. Patients sign in to manage their personal clinical profile, inspect live doctor availability, reserve per-doctor queue tokens, and complete consultation payments online or at the desk.',
  address: '420 Meridian Medical Campus, North Wing, Suite 100',
  phone: '+1 (800) 555-0194',
  opdHours: 'Mon – Sat · 08:00 AM – 08:00 PM',
  portalOpen: true,
  allowNewRegistrations: true,
  maintenanceMessage:
    'Outpatient token intake is temporarily paused by hospital administration for emergency triage. Active tokens remain valid.',
  acceptedPaymentMethods: ['Card', 'UPI', 'Insurance', 'Hospital Desk'],
};

export const HOSPITAL_ATRIUM_IMAGE = '/src/assets/images/hospital_atrium_1795323480260.jpg';

export const DEFAULT_DOCTORS: Omit<Doctor, 'updatedAt'>[] = [
  {
    doctorId: 'dr_evelyn_reed',
    name: 'Dr. Evelyn Reed',
    credentials: 'MD, FACC',
    specialty: 'Interventional Cardiology',
    department: 'Cardiology',
    room: 'Suite 204 · Wing B',
    consultationFee: 900,
    tokenPrefix: 'CARD',
    currentServingNumber: 3,
    lastIssuedNumber: 5,
    totalTokens: 10,
    isAvailable: true,
    shiftHours: '09:00 AM – 03:00 PM',
    experienceYears: 18,
    bio: 'Senior attending cardiologist specializing in preventive cardiology, hypertension management, echocardiography review, and non-invasive cardiac diagnostics.',
    avatarUrl: '/src/assets/images/doctor_cardiology_1795323479530.jpg',
  },
  {
    doctorId: 'dr_kenji_sato',
    name: 'Dr. Kenji Sato',
    credentials: 'MD, PhD',
    specialty: 'Clinical Neurology',
    department: 'Neurology',
    room: 'Suite 312 · Wing A',
    consultationFee: 1000,
    tokenPrefix: 'NEUR',
    currentServingNumber: 2,
    lastIssuedNumber: 4,
    totalTokens: 10,
    isAvailable: true,
    shiftHours: '10:00 AM – 04:30 PM',
    experienceYears: 15,
    bio: 'Board-certified neurologist focusing on migraine protocols, peripheral neuropathy, cerebrovascular follow-ups, and comprehensive neurological evaluations.',
    avatarUrl: '/src/assets/images/doctor_neurology_1795323479535.jpg',
  },
  {
    doctorId: 'dr_sarah_jenkins',
    name: 'Dr. Sarah Jenkins',
    credentials: 'MD, FAAOS',
    specialty: 'Orthopedic Surgery & Sports Med',
    department: 'Orthopedics',
    room: 'Suite 108 · Wing C',
    consultationFee: 750,
    tokenPrefix: 'ORTH',
    currentServingNumber: 5,
    lastIssuedNumber: 7,
    totalTokens: 10,
    isAvailable: true,
    shiftHours: '08:30 AM – 02:30 PM',
    experienceYears: 12,
    bio: 'Orthopedic specialist treating joint pain, ligament injuries, fracture follow-ups, and minimally invasive musculoskeletal rehabilitation plans.',
    avatarUrl: '/src/assets/images/doctor_orthopedics_1795323479180.jpg',
  },
  {
    doctorId: 'dr_marcus_evans',
    name: 'Dr. Marcus Evans',
    credentials: 'MD, FAAP',
    specialty: 'General & Developmental Pediatrics',
    department: 'Pediatrics',
    room: 'Suite 115 · Wing A',
    consultationFee: 600,
    tokenPrefix: 'PEDI',
    currentServingNumber: 4,
    lastIssuedNumber: 6,
    totalTokens: 10,
    isAvailable: true,
    shiftHours: '09:00 AM – 05:00 PM',
    experienceYears: 11,
    bio: 'Attending pediatrician providing routine wellness checkups, immunization guidance, acute pediatric consultations, and adolescent care.',
    avatarUrl: '/src/assets/images/doctor_pediatrics_1795323479242.jpg',
  },
];

export function formatTokenCode(prefix: string, num: number): string {
  const normalizedPrefix = !prefix || prefix === 'GEN' ? 'TOKEN' : prefix;
  return `${normalizedPrefix}-${String(num).padStart(2, '0')}`;
}

export function normalizeTokenCode(code: string): string {
  return (code || '').replace(/^GEN-/, 'TOKEN-');
}

export function getLocalTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDoctorOpdDate(doctor: Pick<Doctor, 'opdDate'>): string {
  if (doctor.opdDate && FIELD_LIMITS.DATE_REGEX.test(doctor.opdDate)) {
    return doctor.opdDate;
  }
  return getLocalTodayDateString();
}

export function formatOpdDateDisplay(dateStr: string): string {
  if (!FIELD_LIMITS.DATE_REGEX.test(dateStr)) return dateStr || getLocalTodayDateString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const formatted = dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return dateStr === getLocalTodayDateString() ? `${formatted} (Today)` : formatted;
}

export function getDoctorTotalTokens(doctor: Pick<Doctor, 'totalTokens'>): number {
  const n = Number(doctor.totalTokens);
  if (Number.isFinite(n) && n >= 1) {
    return Math.min(MAX_TOTAL_TOKENS, Math.floor(n));
  }
  return DEFAULT_TOTAL_TOKENS;
}

export function makeSlotId(
  doctorId: string,
  bookingDate: string,
  tokenNumber: number
): string {
  return `${doctorId}_${bookingDate}_tok_${tokenNumber}`;
}

function parseShiftStartMinutes(shiftHours: string): number {
  const match = shiftHours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 9 * 60; // Default 09:00 AM
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 9 * 60;
  return hour * 60 + minute;
}

function formatMinutesAs12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
}

export function getTokenSlotTimeWindow(
  shiftHours: string,
  tokenNumber: number
): string {
  const startBase = parseShiftStartMinutes(shiftHours || '09:00 AM');
  const startMin = startBase + Math.max(0, tokenNumber - 1) * TOKEN_INTERVAL_MINUTES;
  const endMin = startMin + TOKEN_INTERVAL_MINUTES;
  return `${formatMinutesAs12Hour(startMin)} – ${formatMinutesAs12Hour(endMin)}`;
}

export function getTokenSlotEndTimestamp(
  bookingDate: string,
  shiftHours: string,
  tokenNumber: number
): number {
  if (!FIELD_LIMITS.DATE_REGEX.test(bookingDate)) return 0;
  const [year, month, day] = bookingDate.split('-').map(Number);
  const startBase = parseShiftStartMinutes(shiftHours || '09:00 AM');
  const endMin = startBase + Math.max(1, tokenNumber) * TOKEN_INTERVAL_MINUTES;
  const endHour = Math.floor(endMin / 60);
  const endMinute = endMin % 60;
  const dt = new Date(year, (month || 1) - 1, day || 1, endHour, endMinute, 0, 0);
  return dt.getTime();
}

export function isTokenSlotTimeOver(
  bookingDate: string,
  shiftHours: string,
  tokenNumber: number,
  nowMs: number = Date.now()
): boolean {
  const endTs = getTokenSlotEndTimestamp(bookingDate, shiftHours, tokenNumber);
  if (!Number.isFinite(endTs) || endTs <= 0) return false;
  return nowMs >= endTs;
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
