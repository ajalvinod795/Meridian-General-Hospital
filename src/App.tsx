import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { Ban, LogOut } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  DEFAULT_HOSPITAL_CONFIG,
  Doctor,
  HospitalConfig,
  TokenBooking,
  UserProfile,
} from './types/hospital';
import {
  checkIsUserAdmin,
  ensureUserProfile,
  loginExistingPatientWithNameAndPhone,
  registerNewPatientWithDetails,
  seedInitialHospitalDataIfAdmin,
  subscribeDoctors,
  subscribeHospitalConfig,
  subscribePatientTokens,
  subscribeUserProfile,
} from './services/hospitalService';
import {
  getStoredPatientUid,
  isAdminSessionStored,
  setAdminSessionStored,
  setStoredPatientUid,
  verifyAdminCredentials,
} from './services/adminAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  LoginView,
  PatientLoginPayload,
} from './components/LoginView';
import { HospitalOverviewView } from './components/HospitalOverviewView';
import { DoctorsPageView } from './components/DoctorsPageView';
import { DoctorTokenPaymentView } from './components/DoctorTokenPaymentView';
import { MyTokensView } from './components/MyTokensView';
import { AdminConsoleView } from './components/AdminConsoleView';

type AppPage = 'overview' | 'doctors' | 'doctor-detail' | 'my-tokens' | 'admin';

function formatReadableError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('popup-blocked')) {
    return 'Sign-in popup was blocked by your browser or embedded preview. Please allow popups for this site or open the app in a new tab and try again.';
  }
  if (raw.includes('popup-closed-by-user') || raw.includes('cancelled-popup-request')) {
    return 'Google verification window was closed before completing sign-in.';
  }
  if (raw.includes('unauthorized-domain')) {
    return 'This preview domain is not yet authorized in Firebase Authentication.';
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      return `Unable to verify hospital data (${parsed.operationType || 'read'} on ${parsed.path || 'record'}): ${parsed.error}`;
    }
  } catch {
    // Not a JSON-serialized FirestoreErrorInfo
  }
  return raw || fallback;
}

function HospitalPortalApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminSession, setIsAdminSession] = useState(false);

  const [hospitalConfig, setHospitalConfig] = useState<HospitalConfig>({
    ...DEFAULT_HOSPITAL_CONFIG,
    updatedBy: 'system',
  });
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [myTokens, setMyTokens] = useState<TokenBooking[]>([]);

  const [currentPage, setCurrentPage] = useState<AppPage>('overview');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const handlingAdminSignInRef = useRef(false);

  const activateAdminUser = async (user: User): Promise<boolean> => {
    const hasAdminPrivileges = await checkIsUserAdmin(user);
    if (!hasAdminPrivileges) {
      await signOut(auth);
      setAdminSessionStored(false);
      setLoginError(
        `The Google account (${user.email || 'unknown'}) is not authorized as a Hospital Administrator. Please sign in with an authorized Admin Google account.`
      );
      return false;
    }

    const { profile } = await ensureUserProfile(user, true);
    if (!profile) {
      throw new Error('Unable to load or initialize the administrator profile.');
    }
    await seedInitialHospitalDataIfAdmin(user.uid);

    setStoredPatientUid(null);
    setAdminSessionStored(true);
    setFirebaseUser(user);
    setActiveUid(user.uid);
    setUserProfile(profile);
    setIsAdminSession(true);
    setLoginError(null);
    setCurrentPage('admin');
    return true;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (handlingAdminSignInRef.current) {
        return;
      }

      const storedPatientUid = getStoredPatientUid();

      if (!user) {
        setFirebaseUser(null);
        setIsAdminSession(false);
        setAdminSessionStored(false);

        if (storedPatientUid) {
          setActiveUid(storedPatientUid);
          setCurrentPage('overview');
        } else {
          setActiveUid(null);
          setUserProfile(null);
          setDoctors([]);
          setMyTokens([]);
        }
        setAuthReady(true);
        return;
      }

      const storedAdmin = isAdminSessionStored();
      if (storedAdmin) {
        setLoginLoading(true);
        try {
          await activateAdminUser(user);
        } catch (err) {
          setAdminSessionStored(false);
          setLoginError(
            formatReadableError(err, 'Unable to restore administrator session.')
          );
        } finally {
          setLoginLoading(false);
          setAuthReady(true);
        }
      } else if (storedPatientUid) {
        setActiveUid(storedPatientUid);
        setIsAdminSession(false);
        setCurrentPage('overview');
        setAuthReady(true);
      } else {
        setFirebaseUser(user);
        setActiveUid(null);
        setUserProfile(null);
        setIsAdminSession(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !activeUid) {
      return;
    }

    setPortalError(null);

    const handleFeedError = (label: string) => (err: Error) => {
      console.error(`Firestore subscription error (${label}):`, err);
      setPortalError(
        formatReadableError(err, `Unable to sync ${label} from hospital server.`)
      );
    };

    const unsubConfig = subscribeHospitalConfig(
      setHospitalConfig,
      handleFeedError('hospital configuration')
    );
    const unsubProfile = subscribeUserProfile(
      activeUid,
      (updated) => {
        if (updated) {
          setUserProfile({
            ...updated,
            profileDescription: updated.profileDescription ?? '',
            phone: updated.phone ?? '',
            bloodGroup: updated.bloodGroup ?? '',
            permanentAddress: updated.permanentAddress ?? '',
            emergencyContact: updated.emergencyContact ?? '',
          });
        } else if (!isAdminSession) {
          setStoredPatientUid(null);
          setActiveUid(null);
          setUserProfile(null);
        }
      },
      (err) => {
        console.error('Profile subscription error:', err);
        if (!isAdminSession) {
          setStoredPatientUid(null);
          setActiveUid(null);
          setUserProfile(null);
          setLoginError(
            formatReadableError(err, 'Unable to load your patient profile. Please sign in again.')
          );
        } else {
          handleFeedError('administrator profile')(err);
        }
      }
    );
    const unsubDoctors = subscribeDoctors(
      setDoctors,
      handleFeedError('doctors directory')
    );
    const unsubTokens = subscribePatientTokens(
      activeUid,
      setMyTokens,
      handleFeedError('patient bookings')
    );

    return () => {
      unsubConfig();
      unsubProfile();
      unsubDoctors();
      unsubTokens();
    };
  }, [authReady, activeUid, isAdminSession]);

  const handlePatientSignIn = async (payload: PatientLoginPayload) => {
    setLoginError(null);
    setLoginLoading(true);
    setAdminSessionStored(false);

    try {
      if (payload.mode === 'existing') {
        const { profile, suspended } =
          await loginExistingPatientWithNameAndPhone({
            fullName: payload.fullName,
            phone: payload.phone,
          });

        if (suspended) {
          setLoginError(
            'This patient account has been suspended by Hospital Administration.'
          );
          return;
        }
        if (!profile) {
          setLoginError('Unable to load your patient account. Please retry.');
          return;
        }

        setStoredPatientUid(profile.uid);
        setActiveUid(profile.uid);
        setUserProfile(profile);
        setIsAdminSession(false);
        setCurrentPage('overview');
        return;
      }

      const { profile, registrationBlocked } =
        await registerNewPatientWithDetails({
          fullName: payload.fullName,
          bloodGroup: payload.bloodGroup,
          phone: payload.phone,
          permanentAddress: payload.permanentAddress,
        });

      if (registrationBlocked || !profile) {
        setLoginError(
          'New patient registrations are currently paused by the Hospital Administrator.'
        );
        return;
      }

      setStoredPatientUid(profile.uid);
      setActiveUid(profile.uid);
      setUserProfile(profile);
      setIsAdminSession(false);
      setCurrentPage('overview');
    } catch (err) {
      setLoginError(
        formatReadableError(
          err,
          'Unable to enter patient portal. Please check your details and retry.'
        )
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminSignIn = async (username: string, password: string) => {
    setLoginError(null);
    if (!verifyAdminCredentials(username, password)) {
      setLoginError('Invalid administrator username or password.');
      return;
    }

    setLoginLoading(true);
    handlingAdminSignInRef.current = true;
    try {
      if (auth.currentUser) {
        const alreadyAdmin = await checkIsUserAdmin(auth.currentUser);
        if (alreadyAdmin) {
          await activateAdminUser(auth.currentUser);
          return;
        }
      }

      const cred = await signInWithPopup(auth, googleProvider);
      await activateAdminUser(cred.user);
    } catch (err) {
      setLoginError(
        formatReadableError(
          err,
          'Administrator Google verification was cancelled or blocked.'
        )
      );
    } finally {
      handlingAdminSignInRef.current = false;
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAdminSessionStored(false);
    setStoredPatientUid(null);
    setIsAdminSession(false);
    setActiveUid(null);
    setUserProfile(null);
    setDoctors([]);
    setMyTokens([]);
    if (auth.currentUser) {
      await signOut(auth);
    }
    setSelectedDoctorId(null);
    setCurrentPage('overview');
  };

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null;
    return doctors.find((d) => d.doctorId === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600 font-medium">
          Loading hospital portal...
        </div>
      </div>
    );
  }

  if (!activeUid) {
    return (
      <LoginView
        onPatientSignIn={handlePatientSignIn}
        onAdminSignIn={handleAdminSignIn}
        onClearError={() => setLoginError(null)}
        loading={loginLoading}
        errorMessage={loginError}
      />
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
          <div className="text-sm text-slate-700 font-medium">
            Loading your hospital portal profile...
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        </div>
      </div>
    );
  }

  if (userProfile.accessStatus === 'suspended' && !isAdminSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <Ban className="w-10 h-10 text-red-600 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">
            Account Access Suspended
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your patient portal access for {hospitalConfig.hospitalName} has been suspended by Hospital Administration. Please contact reception at{' '}
            <span className="font-mono">{hospitalConfig.phone}</span>.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  const navItems: { id: AppPage; label: string }[] = isAdminSession
    ? [
        { id: 'admin', label: 'Admin Console' },
        { id: 'doctors', label: 'Doctors Available' },
        { id: 'overview', label: 'Hospital & Profile' },
      ]
    : [
        { id: 'overview', label: 'Hospital & Profile' },
        { id: 'doctors', label: 'Doctors Available' },
        { id: 'my-tokens', label: 'My Tokens' },
      ];

  const openDoctorWorkspace = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setCurrentPage('doctor-detail');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setCurrentPage(isAdminSession ? 'admin' : 'overview')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer font-[family-name:var(--font-display)]"
          >
            {hospitalConfig.hospitalName}
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive =
                currentPage === item.id ||
                (item.id === 'doctors' && currentPage === 'doctor-detail');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentPage(item.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-teal-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Compact Nav */}
        <div className="md:hidden border-t border-slate-200 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          {navItems.map((item) => {
            const isActive =
              currentPage === item.id ||
              (item.id === 'doctors' && currentPage === 'doctor-detail');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.id)}
                className={`py-1 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {portalError && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4 text-xs text-red-800"
          >
            <span>{portalError}</span>
            <button
              type="button"
              onClick={() => setPortalError(null)}
              className="px-2.5 py-1 border border-red-200 bg-white rounded text-red-700 font-medium cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        {currentPage === 'overview' && (
          <HospitalOverviewView
            hospitalConfig={hospitalConfig}
            profile={userProfile}
            doctors={doctors}
            myTokens={myTokens}
            onNavigateDoctors={() => setCurrentPage('doctors')}
            onNavigateMyTokens={() => setCurrentPage('my-tokens')}
            onOpenDoctor={openDoctorWorkspace}
          />
        )}

        {currentPage === 'doctors' && (
          <DoctorsPageView
            hospitalConfig={hospitalConfig}
            doctors={doctors}
            isAdmin={isAdminSession}
            onSelectDoctor={openDoctorWorkspace}
            onNavigateAdmin={() => setCurrentPage('admin')}
          />
        )}

        {currentPage === 'doctor-detail' && selectedDoctor && (
          <DoctorTokenPaymentView
            doctor={selectedDoctor}
            hospitalConfig={hospitalConfig}
            profile={userProfile}
            isAdmin={isAdminSession}
            onBackToDoctors={() => setCurrentPage('doctors')}
            onNavigateMyTokens={() => setCurrentPage('my-tokens')}
          />
        )}

        {currentPage === 'doctor-detail' && !selectedDoctor && (
          <DoctorsPageView
            hospitalConfig={hospitalConfig}
            doctors={doctors}
            isAdmin={isAdminSession}
            onSelectDoctor={openDoctorWorkspace}
            onNavigateAdmin={() => setCurrentPage('admin')}
          />
        )}

        {currentPage === 'my-tokens' && (
          <MyTokensView
            hospitalConfig={hospitalConfig}
            tokens={myTokens}
            doctors={doctors}
            patientUid={userProfile.uid}
            onBrowseDoctors={() => setCurrentPage('doctors')}
            onOpenDoctor={openDoctorWorkspace}
          />
        )}

        {currentPage === 'admin' && isAdminSession && (
          <AdminConsoleView
            adminProfile={userProfile}
            hospitalConfig={hospitalConfig}
            doctors={doctors}
          />
        )}
      </main>

      <footer className="no-print bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {hospitalConfig.hospitalName} · {hospitalConfig.address}
          </span>
          <span className="font-mono tabular-nums">
            Helpline: {hospitalConfig.phone}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HospitalPortalApp />
    </ErrorBoundary>
  );
}
