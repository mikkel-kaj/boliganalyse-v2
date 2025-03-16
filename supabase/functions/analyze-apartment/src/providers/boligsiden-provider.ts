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
   * Extract the original source URL from the Boligsiden URL
   * @param url The Boligsiden URL containing the case ID
   */
  async extractSourceUrl(url: string): Promise<string | undefined> {
    try {
      // Extract the case ID from the URL query parameter
      const caseIdMatch = url.match(/[?&]udbud=([^&]+)/);
      if (!caseIdMatch || !caseIdMatch[1]) {
        logger.info("No case ID found in URL");
        return undefined;
      }

      const caseId = caseIdMatch[1];
      const redirectUrl = `https://www.boligsiden.dk/viderestilling/${caseId}`;
      
      logger.info(`Constructed redirect URL: ${redirectUrl}`);
      return redirectUrl;

    } catch (error) {
      logger.error("Failed to extract source URL", error);
      return undefined;
    }
  }

  /**
   * Parse HTML content to extract structured data
   * @param htmlContent HTML content to parse
   * @param url URL of the html content
   */
  async parseHtml(htmlContent: string, url?: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const energyRating = await this.extractEnergyRating(htmlContent);
      const property_image_url = await this.extractImageUrl(htmlContent);
      let extractedText = await htmlUtils.extractTextFromHtml(htmlContent);
      const originalLink = url ? await this.extractSourceUrl(url) : undefined;

      // Extract specific fields for this provider
      const specificFields = await this.extractSpecificFields(htmlContent);


      // Remove certain phrases from extractedText -

      extractedText = extractedText.replace(
          /Se hvilke internetforbindelser, der er tilgængelige på adressen. Bemærk, at mobildækning ikke er oplyst./g,
          "",
      );

      // RadonrisikoRadonrisikoen vurderes til at være ukendtUkendt
      extractedText = extractedText.replace(
            /RadonrisikoRadonrisikoen vurderes til at være ukendtUkendt/g,
            "",
        );


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
