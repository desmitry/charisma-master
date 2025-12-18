const COOKIE_NAME = 'fast_requests';
const MAX_REQUESTS = 3;

function encrypt(data: string): string {
  if (typeof window === 'undefined') return '';
  const key = window.location.hostname || 'default';
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  return btoa(encrypted);
}

function decrypt(encrypted: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const key = window.location.hostname || 'default';
    const data = atob(encrypted);
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch {
    return '';
  }
}

export function getFastRequestsCount(): number {
  if (typeof document === 'undefined') return MAX_REQUESTS;
  
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${COOKIE_NAME}=`));
  
  if (!cookie) {
    setFastRequestsCount(MAX_REQUESTS);
    return MAX_REQUESTS;
  }
  
  const value = cookie.split('=')[1];
  try {
    const decrypted = decrypt(decodeURIComponent(value));
    const count = parseInt(decrypted, 10);
    return isNaN(count) ? MAX_REQUESTS : Math.max(0, count);
  } catch {
    return MAX_REQUESTS;
  }
}

export function setFastRequestsCount(count: number): void {
  if (typeof document === 'undefined') return;
  
  const encrypted = encrypt(count.toString());
  const expires = new Date();
  expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
  
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encrypted)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export function decrementFastRequests(): number {
  const current = getFastRequestsCount();
  const newCount = Math.max(0, current - 1);
  setFastRequestsCount(newCount);
  return newCount;
}

export function hasFastRequestsAvailable(): boolean {
  return getFastRequestsCount() > 0;
}

