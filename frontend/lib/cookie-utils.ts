const COOKIE_NAME = 'fast_requests';
const MAX_REQUESTS = 3;
const COOKIE_LIFETIME_DAYS = 30;

function getSecretKey(): string {
  if (typeof window === 'undefined') return 'default-secret-key';
  return window.location.hostname + window.location.origin + 'charisma-secret-2024';
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function createSignature(data: string): string {
  const secret = getSecretKey();
  return simpleHash(data + secret);
}

function verifySignature(data: string, signature: string): boolean {
  const expectedSignature = createSignature(data);
  return signature === expectedSignature;
}

function encrypt(data: string): string {
  if (typeof window === 'undefined') return '';
  const key = getSecretKey();
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  const signature = createSignature(data);
  const combined = btoa(encrypted) + '.' + signature;
  return btoa(combined);
}

function decrypt(encrypted: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const decoded = atob(encrypted);
    const [encryptedData, signature] = decoded.split('.');
    if (!encryptedData || !signature) return '';
    
    const key = getSecretKey();
    const data = atob(encryptedData);
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    if (!verifySignature(decrypted, signature)) {
      return '';
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
  expires.setTime(expires.getTime() + COOKIE_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encrypted)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
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

