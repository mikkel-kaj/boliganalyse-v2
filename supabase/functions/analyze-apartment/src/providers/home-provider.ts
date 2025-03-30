import {BaseProvider} from "./base-provider.ts";
import {HTMLParseResult} from "../types/index.ts";
import {extractDomain} from "../utils/url.ts";
import {createLogger} from "../utils/logger.ts";

import {DOMParser, Element} from "deno-dom";
import * as htmlUtils from "../utils/html.ts";

const logger = createLogger("HomeProvider");

/**
 * Provider implementation for Home.dk
 */
export class HomeProvider extends BaseProvider {
  /**
   * Get the name of this provider
   */
  override get name(): string {
    return "Home.dk";
  }

  /**
   * Check if this provider can handle the given URL
   * @param url URL to check
   * @param htmlContent Optional HTML content (not used by this provider)
   */
  override canHandle(url: string, htmlContent?: string): boolean {
    try {
      const domain = extractDomain(url);
      return domain === "home.dk";
    } catch {
      return false;
    }
  }

  /**
   * Extract the main property image URL from the HTML content
   * @param htmlContent HTML content to extract from
   */
  override async extractImageUrl(htmlContent: string): Promise<string | undefined> {
    try {
      // First try to get from meta tags (most reliable)
      const parser = new DOMParser();
      const document = parser.parseFromString(htmlContent, "text/html");
      
      if (!document) {
        throw new Error("Failed to parse HTML");
      }
      
      // First check meta tags for og:image
      const ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (ogImageMeta) {
        const content = (ogImageMeta as Element).getAttribute("content");
        if (content) {
          return content;
        }
      }
      
      // Look for property images in large image elements
      const propertyImages = document.querySelectorAll('.property-details-main__header img, .image-gallery-preview img');
      if (propertyImages.length > 0) {
        const src = (propertyImages[0] as Element).getAttribute("src");
        if (src) {
          return src;
        }
      }
      
      // Fall back to generic image extraction
      const imageUrl = await htmlUtils.extractFirstImageUrl(htmlContent);
      if (imageUrl) {
        return imageUrl;
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract image URL", error);
      return undefined;
    }
  }

  /**
   * Parse HTML content to extract structured data
   * @param htmlContent HTML content to parse
   * @param url URL of the html content
   */
  override async parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const property_image_url = await this.extractImageUrl(htmlContent);
      const extractedText = await htmlUtils.extractTextFromHtml(htmlContent);
      const originalLink = url; // For direct realtor links, URL is already the source

      return {
        originalLink,
        property_image_url,
        extractedText,
      };
    } catch (error) {
      logger.error("Failed to parse HTML", error);
      return {};
    }
  }
} 