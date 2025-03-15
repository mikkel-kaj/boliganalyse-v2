/**
 * URL utility functions
 */

/**
 * Remove query params and fragments from the URL to help identify duplicates
 * @param url Original URL to normalize
 * @returns Normalized URL without query parameters or fragments
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    console.error("Error normalizing URL:", error);
    return url; // fallback to original URL on error
  }
}

/**
 * Extract the domain from a URL
 * @param url URL to extract domain from
 * @returns Domain name or empty string on error
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.error("Error extracting domain:", error);
    return '';
  }
}

/**
 * Checks if a URL is absolute
 * @param url URL to check
 * @returns True if URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  try {
    // If we can create a URL object without errors, it's absolute
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a relative URL against a base URL
 * @param baseUrl Base URL to resolve against
 * @param relativeUrl Relative URL to resolve
 * @returns Absolute URL or empty string on error
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (error) {
    console.error("Error resolving URL:", error);
    return '';
  }
} 