/**
 * Authentication & Role Management for Developer/Admin vs Choir Member (User)
 */

const STORAGE_KEYS = {
  ADMIN_PIN: 'koor_admin_pin_v1',
  ADMIN_AUTH_TOKEN: 'koor_admin_auth_token_v1',
};

// Default PIN for initial setup (supports alphanumeric characters, e.g. letters and numbers)
const DEFAULT_PIN = '1234';

export const getStoredAdminPin = (): string => {
  if (typeof window === 'undefined') return DEFAULT_PIN;
  try {
    const pin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
    return pin || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
};

export const setStoredAdminPin = (newPin: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const trimmed = newPin.trim();
    // Allow alphanumeric PIN of at least 3 characters
    if (trimmed.length < 3) return false;
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, trimmed);
    return true;
  } catch {
    return false;
  }
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
  const input = inputPin.trim();
  // Support exact match or case-insensitive match for ease of typing on mobile
  if (input === currentPin || input.toLowerCase() === currentPin.toLowerCase()) {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH_TOKEN, 'authenticated_admin_session');
    return true;
  }
  return false;
};

export const logoutAdmin = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH_TOKEN);
};
