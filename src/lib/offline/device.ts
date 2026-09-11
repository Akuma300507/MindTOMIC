/**
 * Stable Persistent Device Identifier & UUID Generator
 * Mind to Mic Offline-First Architecture
 */

/**
 * Generates a standard RFC4122 version 4 UUID.
 * Uses native crypto.randomUUID() when available in modern browsers,
 * with a cryptographically sound fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback if crypto.randomUUID fails in non-secure contexts
    }
  }

  // RFC4122 v4 compliant fallback
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Math.random fallback for very old environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_KEY = 'm2m_device_id';
const DEVICE_NAME_KEY = 'm2m_device_name';

/**
 * Retrieves or initializes the persistent device identifier.
 * Stored in localStorage so it remains stable across browser sessions.
 * Never uses IP addresses.
 */
export function getDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id || id.trim() === '') {
        id = `dev-${generateUUID()}`;
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    }
  } catch (err) {
    console.warn('Unable to access localStorage for deviceId:', err);
  }
  return `dev-mem-${Date.now()}`;
}

/**
 * Retrieves or generates a user-friendly device label for multi-device identification.
 */
export function getDeviceName(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(DEVICE_NAME_KEY);
      if (stored && stored.trim() !== '') return stored;
    }
  } catch {}

  const devId = getDeviceId();
  const shortId = devId.replace(/^dev-/, '').slice(0, 6).toUpperCase();
  return `Station Device (${shortId})`;
}

/**
 * Sets a custom friendly name for this device installation.
 */
export function setDeviceName(name: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_NAME_KEY, name);
    }
  } catch {}
}
