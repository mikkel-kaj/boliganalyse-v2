import {BaseProvider} from "./base-provider.ts";
import {HTMLParseResult} from "../types/index.ts";
import {createLogger} from "../utils/logger.ts";
import * as htmlUtils from "../utils/html.ts";

const logger = createLogger("FallbackProvider");

/**
 * Provider implementation for Boligsiden.dk
 */
export class FallbackProvider extends BaseProvider {
  /**
   * Get the name of this provider
   */
  get name(): string {
    return "FallbackProvider";
  }

  /**
   * Check if this provider can handle the given URL
   * @param url URL to check
   */
  canHandle(url: string): boolean {
    return true;
  }

  /**
   * Parse HTML content to extract structured data
   * @param htmlContent HTML content to parse
   * @param url URL of the html content
   */
  async parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const property_image_url = undefined;
      const extractedText = await htmlUtils.extractTextFromHtml(htmlContent);
      const originalLink = undefined;

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
