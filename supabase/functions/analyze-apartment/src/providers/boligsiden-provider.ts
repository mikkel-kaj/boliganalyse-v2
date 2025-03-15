import { BaseProvider } from "./base-provider.ts";
import { HTMLParseResult } from "../types/index.ts";
import { extractDomain } from "../utils/url.ts";
import { createLogger } from "../utils/logger.ts";

// @ts-ignore - Fix for deno-dom import
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const logger = createLogger("BoligsidenProvider");

/**
 * Provider implementation for Boligsiden.dk
 */
export class BoligsidenProvider extends BaseProvider {
  /**
   * Get the name of this provider
   */
  get name(): string {
    return "Boligsiden.dk";
  }
  
  /**
   * Check if this provider can handle the given URL
   * @param url URL to check
   */
  canHandle(url: string): boolean {
    try {
      const domain = extractDomain(url);
      return domain === "boligsiden.dk";
    } catch {
      return false;
    }
  }
  
  /**
   * Extract the original source URL from HTML content if available
   * @param htmlContent HTML content to extract from
   */
  async extractSourceUrl(htmlContent: string): Promise<string | undefined> {
    try {
      const parser = new DOMParser();
      const document = parser.parseFromString(htmlContent, "text/html");
      if (!document) {
        throw new Error("Failed to parse HTML");
      }
      
      // Look for original listing URL
      // Boligsiden aggregates listings from other sites and typically links to the original
      const selectors = [
        'a[href*="home.dk"]',
        'a[href*="nybolig.dk"]',
        'a[href*="edc.dk"]',
        'a[href*="realmaeglerne.dk"]',
        'a[href*="danbolig.dk"]'
      ];
      
      for (const selector of selectors) {
        const link = document.querySelector(selector);
        if (link) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('http')) {
            logger.info(`Found original source URL: ${href}`);
            return href;
          }
        }
      }
      
      // Check canonical link as a fallback
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        const href = canonical.getAttribute('href');
        if (href && href.includes("boligsiden.dk")) {
          return href;
        }
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract source URL", error);
      return undefined;
    }
  }
  
  /**
   * Parse HTML content to extract structured data
   * @param htmlContent HTML content to parse
   */
  async parseHtml(htmlContent: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const energyRating = await this.extractEnergyRating(htmlContent);
      const imageUrl = await this.extractImageUrl(htmlContent);
      const extractedText = await this.extractText(htmlContent);
      const originalLink = await this.extractSourceUrl(htmlContent);
      
      // Extract specific fields for this provider
      const specificFields = await this.extractSpecificFields(htmlContent);
      
      return {
        originalLink,
        energyRating,
        imageUrl,
        extractedText,
        partialAnalysis: specificFields
      };
    } catch (error) {
      logger.error("Failed to parse HTML", error);
      return {};
    }
  }
  
  /**
   * Extract provider-specific fields from HTML
   * @param htmlContent HTML content to parse
   */
  async extractSpecificFields(htmlContent: string): Promise<Record<string, any>> {
    try {
      const document = new DOMParser().parseFromString(htmlContent, "text/html");
      if (!document) {
        throw new Error("Failed to parse HTML");
      }
      
      const result: Record<string, any> = {};
      
      // Extract structured data if available (JSON-LD)
      const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            const data = JSON.parse(content);
            if (data && typeof data === 'object') {
              // Add relevant fields from structured data
              if (data.price) result.price = data.price;
              if (data.name) result.name = data.name;
              if (data.description) result.description = data.description;
              if (data.address) result.address = data.address;
            }
          }
        } catch (jsonError) {
          logger.error("Failed to parse JSON-LD", jsonError);
        }
      }
      
      // Extract address from title or meta tags
      const title = document.querySelector('title')?.textContent;
      if (title) {
        const addressMatch = title.match(/^(.*?)(?: \| Boligsiden)?$/);
        if (addressMatch && addressMatch[1]) {
          result.addressFromTitle = addressMatch[1].trim();
        }
      }
      
      return result;
    } catch (error) {
      logger.error("Failed to extract specific fields", error);
      return {};
    }
  }
} 