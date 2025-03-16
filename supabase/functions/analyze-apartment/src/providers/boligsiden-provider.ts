import {BaseProvider} from "./base-provider.ts";
import {HTMLParseResult} from "../types/index.ts";
import {extractDomain} from "../utils/url.ts";
import {createLogger} from "../utils/logger.ts";

import {DOMParser} from "deno-dom";
import * as htmlUtils from "../utils/html.ts";

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

      // Look for the caseUrl pattern which contains the direct link to the real estate agent's site
      logger.info("Looking for caseUrl in HTML content");
      const caseUrlPattern = /caseUrl\\\":\\\"(https?:\/\/[^\\\"]+)\\\"/;
      const caseUrlMatch = htmlContent.match(caseUrlPattern);
      
      if (caseUrlMatch && caseUrlMatch[1]) {
        const realEstateUrl = caseUrlMatch[1];
        logger.info(`Found real estate agent URL: ${realEstateUrl}`);
        return realEstateUrl;
      }
      

      logger.info("No real estate agent link found");
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
      const property_image_url = await this.extractImageUrl(htmlContent);
      const extractedText = await htmlUtils.extractTextFromHtml(htmlContent);
      const originalLink = await this.extractSourceUrl(htmlContent);

      // Extract specific fields for this provider
      const specificFields = await this.extractSpecificFields(htmlContent);

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
   * Extract provider-specific fields from HTML
   * @param htmlContent HTML content to parse
   */
  async extractSpecificFields(
    htmlContent: string,
  ): Promise<Record<string, any>> {
    try {
      const document = new DOMParser().parseFromString(
        htmlContent,
        "text/html",
      );
      if (!document) {
        throw new Error("Failed to parse HTML");
      }

      const result: Record<string, any> = {};

      // Extract structured data if available (JSON-LD)
      const jsonLdElements = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            const data = JSON.parse(content);
            if (data && typeof data === "object") {
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
      const title = document.querySelector("title")?.textContent;
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
