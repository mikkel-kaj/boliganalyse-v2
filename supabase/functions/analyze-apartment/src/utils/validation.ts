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
 * URL validation utilities
 */

/**
 * Domain configuration structure
 */
interface DomainConfig {
  pathPrefix: string;
  minPathLength: number;
  requiresUdbudParam: boolean;
}

/**
 * Mapping of supported domains with their configurations
 */
interface SupportedDomains {
  [domain: string]: DomainConfig;
}

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
    
    // Check if domain is from a supported provider
    const supportedDomains: SupportedDomains = {
      'boligsiden.dk': {
        pathPrefix: '/adresse/',
        minPathLength: 2,
        requiresUdbudParam: true
      },
      'home.dk': {
        pathPrefix: '/ejerbolig/',
        minPathLength: 3,
        requiresUdbudParam: false
      },
      'nybolig.dk': {
        pathPrefix: '/til-salg/',
        minPathLength: 3,
        requiresUdbudParam: false
      }
      // Add more providers as needed
    };
    
    // Check if domain is supported
    const provider = supportedDomains[domain];
    if (!provider) {
      return { 
        valid: false, 
        error: "URL'en skal være fra en understøttet boligportal (boligsiden.dk, home.dk, nybolig.dk)"
      };
    }
    
    // Check path prefix for specific domain requirements
    if (!parsedUrl.pathname.startsWith(provider.pathPrefix)) {
      return { 
        valid: false, 
        error: `URL'en skal starte med '${domain}${provider.pathPrefix}'` 
      };
    }
    
    // Extract and validate the path part
    const pathPart = parsedUrl.pathname.replace(provider.pathPrefix, '');
    
    // Check if there's enough content after the prefix
    if (!pathPart || pathPart.length < provider.minPathLength) {
      return { 
        valid: false, 
        error: "Adressedelen af URL'en mangler eller er for kort" 
      };
    }

    // Check for udbud parameter if required
    if (provider.requiresUdbudParam && !parsedUrl.searchParams.has('udbud')) {
      return {
        valid: false,
        error: "URL'en skal indeholde en udbuds-ID (udbud=...)"
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