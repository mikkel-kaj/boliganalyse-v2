import { ProviderInfo, HTMLParseResult } from "../types/index.ts";
import * as htmlUtils from "../utils/html.ts";
import { createLogger } from "../utils/logger.ts";

// Import DOMParser using the exact import path from deno.json
import { DOMParser } from "deno-dom";

const logger = createLogger("BaseProvider");

/**
 * Abstract base class for all real estate listing providers
 */
export abstract class BaseProvider implements ProviderInfo {
  /**
   * Get the name of this provider
   */
  abstract get name(): string;
  
  /**
   * Check if this provider can handle the given URL
   * @param url URL to check
   */
  abstract canHandle(url: string): boolean;
  
  /**
   * Extract the original source URL from the HTML content if available
   * @param htmlContent HTML content to extract from
   */
  abstract extractSourceUrl(htmlContent: string): Promise<string | undefined>;
  
  /**
   * Parse HTML content to extract structured data
   * @param url
   * @param htmlContent HTML content to parse
   */
  abstract parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult>;
  
  /**
   * Extract any specific fields that are unique to this provider
   * @param htmlContent HTML content to parse
   */
  abstract extractSpecificFields(htmlContent: string): Promise<Record<string, object>>;
  
  /**
   * Extract energy rating from the HTML if available 
   * Used for AI analysis input, not stored directly in database
   * @param htmlContent HTML content to parse
   */
  async extractEnergyRating(htmlContent: string): Promise<string | undefined> {
    // Default implementation that can be overridden by specific providers
    try {
      const parser = new DOMParser();
      const document = parser.parseFromString(htmlContent, "text/html");
      if (!document) {
        return undefined;
      }
      
      // Look for common energy rating patterns
      // 1. Try SVG titles (common in Danish real estate sites)
      const svgTitles = document.querySelectorAll("svg title");
      for (const title of svgTitles) {
        const titleText = title.textContent || "";
        const match = /Energimærke\s+([A-G])/i.exec(titleText);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      // 2. Look for text content with energy rating
      const bodyText = document.body?.textContent || "";
      const textMatch = /energimærke:?\s*([A-G])/i.exec(bodyText) || 
                       /energy\s+label:?\s*([A-G])/i.exec(bodyText);
      if (textMatch && textMatch[1]) {
        return textMatch[1];
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract energy rating", error);
      return undefined;
    }
  }
  
  /**
   * Utility method to extract the first image URL
   * @param htmlContent HTML content to parse
   */
  async extractImageUrl(htmlContent: string): Promise<string | undefined> {
    try {
      const imageUrl = await htmlUtils.extractFirstImageUrl(htmlContent);
      return imageUrl || undefined;
    } catch (error) {
      logger.error("Failed to extract image URL", error);
      return undefined;
    }
  }
  
  /**
   * Extract plain text from HTML for AI processing
   * @param htmlContent HTML content to parse
   */
  async extractText(htmlContent: string): Promise<string> {
    try {
      return await htmlUtils.extractTextFromHtml(htmlContent);
    } catch (error) {
      logger.error("Failed to extract text", error);
      return "";
    }
  }
} 