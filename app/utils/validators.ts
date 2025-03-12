/**
 * Frontend URL validation utilities
 */

/**
 * Validates that a URL is a valid Boligsiden address URL.
 * This should be kept in sync with the backend validation in
 * supabase/functions/analyze-apartment/utils/validation.ts
 * 
 * @param url URL to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateBoligsideUrl(url: string): { valid: boolean; error?: string } {
  // Check if URL is provided
  if (!url) {
    return { valid: false, error: "URL er ikke angivet" };
  }

  try {
    // Parse URL to check structure
    const parsedUrl = new URL(url);
    
    // Check hostname (allow both www and non-www versions)
    if (!parsedUrl.hostname.match(/^(www\.)?boligsiden\.dk$/i)) {
      return { 
        valid: false, 
        error: "URL skal være fra boligsiden.dk" 
      };
    }
    
    // Check path starts with /adresse/
    if (!parsedUrl.pathname.startsWith('/adresse/')) {
      return { 
        valid: false, 
        error: "URL skal starte med 'https://www.boligsiden.dk/adresse/'" 
      };
    }
    
    // Extract and validate the address part
    const addressPart = parsedUrl.pathname.replace('/adresse/', '');
    
    // Check if there's anything after /adresse/
    if (!addressPart || addressPart.length < 3) {
      return { 
        valid: false, 
        error: "Adressedelen af URL'en mangler eller er for kort" 
      };
    }
    
    // Basic check that the address part looks valid
    // We're not being too strict here, just making sure it's not completely invalid
    if (!addressPart.match(/^[a-zA-Z0-9æøåÆØÅ\-_]+/)) {
      return { 
        valid: false, 
        error: "Adressen i URL'en ser ikke gyldig ud" 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: "Ugyldig URL-format" 
    };
  }
} 