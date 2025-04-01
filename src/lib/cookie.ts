/**
 * Cookie utilities for managing browser cookies
 */

/**
 * Sets a cookie with the specified name, value, and expiration days
 */
export function setCookie(name: string, value: string, days: number = 30): void {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  
  const cookieValue = encodeURIComponent(value) + 
    (days ? `; expires=${expirationDate.toUTCString()}` : '') + 
    '; path=/';
  
  document.cookie = `${name}=${cookieValue}`;
}

/**
 * Gets a cookie value by name
 * Returns null if the cookie doesn't exist
 */
export function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  
  return null;
}

/**
 * Checks if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

/**
 * Deletes a cookie by setting its expiration date to the past
 */
export function deleteCookie(name: string): void {
  setCookie(name, '', -1);
} 