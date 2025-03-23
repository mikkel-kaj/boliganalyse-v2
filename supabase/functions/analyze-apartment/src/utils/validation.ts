import { extractDomain } from "./url.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("Validation");

/**
 * Structure for URL validation results
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * List of supported real estate domains
 */
export const SUPPORTED_DOMAINS = [
  // Major aggregators
  'boligsiden.dk',
  
  // Major real estate chains
  'home.dk',
  'nybolig.dk',
  'edc.dk',
  'danbolig.dk',
  'estate.dk',
  'realmaeglerne.dk',
  
  // Rental properties
  'lejebolig.dk',
  'boligportal.dk',
  
  // Other real estate agencies
  'lokalbolig.dk',
  'robinhus.dk',
  'boligone.dk',
  '1848.dk',
  'dinmaegler.dk',
  'lilholts.dk',
  'coldwellbanker.dk'
];

/**
 * Validates that a URL is from a supported real estate provider
 * @param url URL to validate
 * @returns Validation result with error message if invalid
 */
export function validateListingUrl(url: string): ValidationResult {
  // Check if URL is provided
  if (!url) {
    return { valid: false, error: "URL er ikke angivet" };
  }

  try {
    // Parse URL to check structure
    const parsedUrl = new URL(url);
    const domain = extractDomain(url);
    
    // Check for ViewPage in the URL path
    if (parsedUrl.href.includes('ViewPage')) {
      return { 
        valid: false, 
        error: "URL'en ser ud til at være en bolig der ikke er til salg." 
      };
    }
    
    // Special case: For Boligsiden URLs, use the more strict validation
    if (domain === 'boligsiden.dk') {
      return validateBoligsideUrl(url);
    }
    
    // For all other domains, just check if the domain is supported
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      return { 
        valid: false, 
        error: "URL'en skal være fra en understøttet boligportal. Se listen over understøttede portaler på forsiden."
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

/**
 * Legacy function to validate Boligsiden URLs for backward compatibility
 */
export function validateBoligsideUrl(url: string): ValidationResult {
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
    
    // Check for udbud parameter
    if (!parsedUrl.searchParams.has('udbud')) {
      return {
        valid: false,
        error: "URL'en skal indeholde en udbuds-ID (udbud=...)"
      };
    }
    
    if (parsedUrl.href.includes('ViewPage')) {
      return { 
        valid: false, 
        error: "URL'en ser ud til at være en bolig der ikke er til salg." 
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