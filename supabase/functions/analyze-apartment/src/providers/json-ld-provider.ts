import {BaseProvider} from "./base-provider.ts";
import {HTMLParseResult} from "../types/index.ts";
import {createLogger} from "../utils/logger.ts";
import {DOMParser, Element} from "deno-dom";
import * as htmlUtils from "../utils/html.ts";
import {extractTextFromHtml} from "../utils/html.ts";

const logger = createLogger("JsonLdProvider");

/**
 * Provider that extracts data from JSON-LD on any real estate site
 */
export class JsonLdProvider extends BaseProvider {
  /**
   * Get the name of this provider
   */
  override get name(): string {
    return "JSON-LD Provider";
  }

  /**
   * Check if this provider can handle the given content
   * @param url URL to check (ignored for this provider)
   * @param htmlContent HTML content to check for JSON-LD data
   */
  override canHandle(url: string, htmlContent?: string): boolean {
    if (htmlContent) {
      try {
        const document = new DOMParser().parseFromString(htmlContent, "text/html");
        if (!document) return false;
        
        const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
        return jsonLdElements.length > 0;
      } catch (error) {
        logger.error("Error checking if provider can handle content", error);
        return false;
      }
    }
    
    // If no HTML content provided, always return false
    return false;
  }

  /**
   * Extract the original source URL from the HTML content
   * Usually the URL itself for direct JSON-LD sites
   */
  async extractSourceUrl(htmlContent: string): Promise<string | undefined> {
    try {
      // Try to extract URL from JSON-LD if possible
      const document = new DOMParser().parseFromString(htmlContent, "text/html");
      if (!document) return undefined;
      
      const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            const data = JSON.parse(content);
            
            // Check if it's an array or single object
            const items = Array.isArray(data) ? data : [data];
            
            // Look for canonical URL in various possible properties
            for (const item of items) {
              if (item.url) return item.url;
              if (item.mainEntityOfPage?.id) return item.mainEntityOfPage.id;
              if (item.mainEntityOfPage) return item.mainEntityOfPage;
            }
          }
        } catch (error) {
          logger.error("Error parsing JSON-LD for source URL", error);
        }
      }
      
      // If no URL found in JSON-LD, check for canonical link in HTML
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        const href = (canonicalLink as Element).getAttribute("href");
        if (href) return href;
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract source URL", error);
      return undefined;
    }
  }

  /**
   * Extract the main property image URL from the HTML content
   */
  override async extractImageUrl(htmlContent: string): Promise<string | undefined> {
    try {
      // First check JSON-LD for image URLs
      const document = new DOMParser().parseFromString(htmlContent, "text/html");
      if (!document) return undefined;
      
      const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            const data = JSON.parse(content);
            
            // Check if it's an array or single object
            const items = Array.isArray(data) ? data : [data];
            
            // Look for images in various possible properties
            for (const item of items) {
              // For RealEstateListing type
              if (item.image && typeof item.image === "string") return item.image;
              if (item.image && Array.isArray(item.image) && item.image.length > 0) return item.image[0];
              
              // For nested structures
              if (item.offers?.itemOffered?.image) return item.offers.itemOffered.image;
            }
          }
        } catch (error) {
          logger.error("Error parsing JSON-LD for image URL", error);
        }
      }
      
      // If no image in JSON-LD, check meta tags
      const ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (ogImageMeta) {
        const content = (ogImageMeta as Element).getAttribute("content");
        if (content) return content;
      }
      
      // Fall back to generic image extraction
      const imageUrl = await htmlUtils.extractFirstImageUrl(htmlContent);
      if (imageUrl) return imageUrl;
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract image URL", error);
      return undefined;
    }
  }

  /**
   * Parse HTML content to extract structured data
   */
  async parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const energyRating = await this.extractEnergyRating(htmlContent);
      const property_image_url = await this.extractImageUrl(htmlContent);
      const originalLink = url; // For direct JSON-LD sites, URL is already the source
      const textContent = htmlUtils.extractTextFromHtml(htmlContent);

      // Extract specific fields from JSON-LD
      const specificFields = await this.extractSpecificFields(htmlContent);
      const extractedText = JSON.stringify(specificFields) + "\n" + textContent;

      return {
        originalLink,
        energyRating,
        property_image_url,
        extractedText,
        partialAnalysis: specificFields,
      };
    } catch (error) {
      logger.error("Failed to parse HTML", error);
      return {};
    }
  }

  /**
   * Extract data from JSON-LD
   */
  async extractSpecificFields(htmlContent: string): Promise<Record<string, any>> {
    try {
      const document = new DOMParser().parseFromString(htmlContent, "text/html");
      if (!document) {
        throw new Error("Failed to parse HTML");
      }

      // Extract structured data from JSON-LD
      const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
      
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            // Simply parse and return the JSON-LD content as is
            return JSON.parse(content);
          }
        } catch (jsonError) {
          logger.error("Failed to parse JSON-LD", jsonError);
        }
      }
      
      // Return empty object if no JSON-LD found
      return {};
    } catch (error) {
      logger.error("Failed to extract specific fields", error);
      return {};
    }
  }
} 