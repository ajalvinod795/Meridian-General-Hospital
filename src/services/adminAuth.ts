const ADMIN_SESSION_KEY = 'meridian_admin_session_active';
const PATIENT_UID_STORAGE_KEY = 'meridian_patient_session_uid';

// Verified without exposing credentials in UI
const EXPECTED_USERNAME = 'AJALVINOD';
const EXPECTED_PASSWORD_CODES = [65, 118, 64, 54, 50, 51, 56, 54, 49];

export function verifyAdminCredentials(username: string, password: string): boolean {
  const cleanUser = username.trim().toUpperCase();
  if (cleanUser !== EXPECTED_USERNAME) {
    return false;
  }
  if (password.length !== EXPECTED_PASSWORD_CODES.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < EXPECTED_PASSWORD_CODES.length; i++) {
    mismatch |= password.charCodeAt(i) ^ EXPECTED_PASSWORD_CODES[i];
  }
  return mismatch === 0;
}

export function isAdminSessionStored(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminSessionStored(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function getStoredPatientUid(): string | null {
  try {
    return sessionStorage.getItem(PATIENT_UID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPatientUid(uid: string | null): void {
  try {
    if (uid) {
      sessionStorage.setItem(PATIENT_UID_STORAGE_KEY, uid);
    } else {
      sessionStorage.removeItem(PATIENT_UID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}
