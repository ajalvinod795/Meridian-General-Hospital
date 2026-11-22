import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  CreditCard,
  Droplets,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  DEFAULT_HOSPITAL_CONFIG,
  FIELD_LIMITS,
  HOSPITAL_ATRIUM_IMAGE,
} from '../types/hospital';
import { SafeImage } from './SafeImage';

export type LoginIntent = 'patient' | 'admin';
export type PatientAuthMode = 'existing' | 'register';

export type PatientLoginPayload =
  | {
      mode: 'existing';
      fullName: string;
      phone: string;
    }
  | {
      mode: 'register';
      fullName: string;
      bloodGroup: string;
      phone: string;
      permanentAddress: string;
    };

interface LoginViewProps {
  onPatientSignIn: (payload: PatientLoginPayload) => Promise<void>;
  onAdminSignIn: (username: string, password: string) => Promise<void>;
  onClearError?: () => void;
  loading: boolean;
  errorMessage: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onPatientSignIn,
  onAdminSignIn,
  onClearError,
  loading,
  errorMessage,
}) => {
  const [intent, setIntent] = useState<LoginIntent>(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/admin' || window.location.hash === '#admin')
    ) {
      return 'admin';
    }
    return 'patient';
  });

  // Patient Login Form State (Existing Login vs Create New Account)
  const [patientMode, setPatientMode] = useState<PatientAuthMode>('existing');
  const [fullName, setFullName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');

  // Admin Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
        setIntent('admin');
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientMode === 'existing') {
      await onPatientSignIn({
        mode: 'existing',
        fullName,
        phone,
      });
    } else {
      await onPatientSignIn({
        mode: 'register',
        fullName,
        bloodGroup,
        phone,
        permanentAddress,
      });
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdminSignIn(username, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal Top Brand Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-[family-name:var(--font-display)]">
            {DEFAULT_HOSPITAL_CONFIG.hospitalName}
          </span>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span>Outpatient Token &amp; Payment System</span>
            <span aria-hidden="true">·</span>
            <span>{DEFAULT_HOSPITAL_CONFIG.opdHours}</span>
          </div>
        </div>
      </header>

      {/* Main Split Portal Entry */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden items-stretch">
          {/* Left Column: Hospital Overview & Architectural Visual */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 text-white relative overflow-hidden">
            <div className="relative h-64 lg:h-80 w-full overflow-hidden">
              <SafeImage
                src={HOSPITAL_ATRIUM_IMAGE}
                alt="MALABAR MEDICAL COLLEGE main reception atrium"
                fallbackType="hospital"
                fallbackTitle={DEFAULT_HOSPITAL_CONFIG.hospitalName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            </div>

            <div className="p-8 lg:p-10 flex-1 flex flex-col justify-between gap-8">
              <div>
                <p className="text-xs font-medium text-teal-300 mb-2">
                  Digital Outpatient Reception
                </p>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-[#c6c4c4] leading-tight [text-wrap:balance]">
                  MALABAR MEDICAL COLLEGE
                </h1>
                <p className="mt-3 text-sm lg:text-base text-slate-300 leading-relaxed max-w-xl">
                  {DEFAULT_HOSPITAL_CONFIG.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-teal-300 text-xs font-medium mb-1">
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span>Specialist Directory</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Check live doctor availability across departments before booking.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-teal-300 text-xs font-medium mb-1">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Per-Doctor Tokens</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Dedicated queue counters and estimated wait times per physician.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-teal-300 text-xs font-medium mb-1">
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>Rupee Checkout</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pay consultation fees in ₹ INR via Card, UPI, Insurance, or Desk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Patient Details Login & Separate Admin Login */}
          <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-center bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {intent === 'admin'
                  ? 'Administrator Login'
                  : patientMode === 'register'
                    ? 'Create New Patient Account'
                    : 'Patient Portal Login'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                {intent === 'admin'
                  ? 'Separate restricted login to manage overall hospital portal access.'
                  : patientMode === 'register'
                    ? 'Register as a new patient with your full name, blood group, phone number, and permanent address.'
                    : 'Sign in with your registered full name and phone number.'}
              </p>
            </div>

            {/* Interactive Role Segmented Control */}
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
              role="tablist"
              aria-label="Login access mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={intent === 'patient'}
                onClick={() => {
                  setIntent('patient');
                  onClearError?.();
                  if (window.location.hash === '#admin') {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  intent === 'patient'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>Patient Login</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intent === 'admin'}
                onClick={() => {
                  setIntent('admin');
                  onClearError?.();
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  intent === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin Login</span>
              </button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-2 text-xs text-red-800"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
                {intent === 'patient' &&
                  patientMode === 'existing' &&
                  errorMessage.includes('No existing patient account') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode('register');
                        onClearError?.();
                      }}
                      className="ml-6 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 hover:bg-red-100 text-red-900 font-semibold rounded-md cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Switch to Create New Account</span>
                    </button>
                  )}
                {intent === 'patient' &&
                  patientMode === 'register' &&
                  errorMessage.includes('An account already exists') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode('existing');
                        onClearError?.();
                      }}
                      className="ml-6 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 hover:bg-red-100 text-red-900 font-semibold rounded-md cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Switch to Existing Patient Login</span>
                    </button>
                  )}
              </div>
            )}

            {intent === 'patient' ? (
              <form onSubmit={handlePatientSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="patient-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Patient Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="patient-name"
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.displayName.max}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {patientMode === 'existing' ? (
                  <div>
                    <label
                      htmlFor="patient-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Registered Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="patient-phone"
                        type="tel"
                        required
                        maxLength={FIELD_LIMITS.userPhone.max}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label
                          htmlFor="patient-blood-group"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Blood Group
                        </label>
                        <div className="relative">
                          <Droplets className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            id="patient-blood-group"
                            required
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
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

                      <div className="sm:col-span-7">
                        <label
                          htmlFor="patient-phone"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            id="patient-phone"
                            type="tel"
                            required
                            maxLength={FIELD_LIMITS.userPhone.max}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="patient-address"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Permanent Address
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <textarea
                          id="patient-address"
                          rows={3}
                          required
                          maxLength={FIELD_LIMITS.permanentAddress.max}
                          value={permanentAddress}
                          onChange={(e) => setPermanentAddress(e.target.value)}
                          placeholder="House/Flat No., Street, City, District, PIN Code"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>
                    {loading
                      ? patientMode === 'existing'
                        ? 'Signing In...'
                        : 'Creating Account...'
                      : patientMode === 'existing'
                        ? 'Sign In to Patient Portal'
                        : 'Create Account & Enter Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <div className="pt-2 border-t border-slate-200">
                  {patientMode === 'existing' ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setPatientMode('register');
                        onClearError?.();
                      }}
                      className="w-full py-2.5 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>Create New Account (New Patient)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setPatientMode('existing');
                        onClearError?.();
                      }}
                      className="w-full py-2.5 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>Already Registered? Back to Patient Login</span>
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-username"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Admin Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="admin-username"
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter admin username"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Admin Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  After credential verification, complete Google verification with an authorized hospital administrator account to unlock overall portal controls.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {loading ? 'Verifying Admin Access...' : 'Sign In to Admin Console'}
                  </span>
                </button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">
                {DEFAULT_HOSPITAL_CONFIG.address}
              </p>
              <p>
                24/7 Helpline:{' '}
                <span className="font-mono tabular-nums">
                  {DEFAULT_HOSPITAL_CONFIG.phone}
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
