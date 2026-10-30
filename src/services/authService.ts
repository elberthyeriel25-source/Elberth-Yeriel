/**
 * Authentication & Role Management for Developer/Admin vs Choir Member (User)
 * Backed by Firebase Firestore for Instant Multi-Device Synchronization
 */
import { getCachedCloudAdminPin, saveAdminPinToFirestore } from './firestoreSync';

const STORAGE_KEYS = {
  ADMIN_PIN: 'koor_admin_pin_v1',
  ADMIN_AUTH_TOKEN: 'koor_admin_auth_token_v1',
};

const DEFAULT_PIN = '1234';

export const getStoredAdminPin = (): string => {
  // First check synced cloud PIN
  const cloudPin = getCachedCloudAdminPin();
  if (cloudPin && cloudPin !== DEFAULT_PIN) {
    return cloudPin;
  }

  if (typeof window === 'undefined') return cloudPin || DEFAULT_PIN;
  try {
    const pin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
    return pin || cloudPin || DEFAULT_PIN;
  } catch {
    return cloudPin || DEFAULT_PIN;
  }
};

export const setStoredAdminPin = (newPin: string): boolean => {
  const trimmed = newPin.trim();
  if (trimmed.length < 3) return false;

  // Persist locally
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, trimmed);
    } catch {}
  }

  // Persist to Cloud Firestore so all phones/devices receive the update instantly
  saveAdminPinToFirestore(trimmed).catch((err) => {
    console.warn('Failed to push PIN update to Firestore:', err);
  });

  return true;
};

export const checkIsAdminLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const token = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH_TOKEN);
    return token === 'authenticated_admin_session';
  } catch {
    return false;
  }
};

export const loginAdmin = (inputPin: string): boolean => {
  if (typeof window === 'undefined') return false;
  const currentPin = getStoredAdminPin().trim();
  const cloudPin = getCachedCloudAdminPin().trim();
  const input = inputPin.trim();

  // Match against current local PIN, cloud PIN, or default PIN
  const matches = (target: string) =>
    target && (input === target || input.toLowerCase() === target.toLowerCase());

  if (matches(currentPin) || matches(cloudPin)) {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH_TOKEN, 'authenticated_admin_session');
    return true;
  }
  return false;
};

export const logoutAdmin = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH_TOKEN);
};
