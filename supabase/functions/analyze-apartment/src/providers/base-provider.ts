import { ProviderInfo, HTMLParseResult } from "../types/index.ts";
import * as htmlUtils from "../utils/html.ts";
import { createLogger } from "../utils/logger.ts";


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
   * Check if this provider can handle the given URL and optionally HTML content
   * @param url URL to check
   * @param htmlContent Optional HTML content to check
   */
  abstract canHandle(url: string, htmlContent?: string): boolean;
  
  /**
   * Parse HTML content to extract structured data
   * @param url
   * @param htmlContent HTML content to parse
   */
  abstract parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult>;

  async extractImageUrl(htmlContent: string): Promise<string | undefined> {
    try {
      const imageUrl = await htmlUtils.extractFirstImageUrl(htmlContent);
      return imageUrl || undefined;
    } catch (error) {
      logger.error("Failed to extract image URL", error);
      return undefined;
    }
  }
} 