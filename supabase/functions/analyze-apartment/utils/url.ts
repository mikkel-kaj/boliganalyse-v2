
/**
 * Remove query params etc. from the URL so duplicates are recognized
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    console.error("Error normalizing URL:", error);
    return url; // fallback
  }
}
