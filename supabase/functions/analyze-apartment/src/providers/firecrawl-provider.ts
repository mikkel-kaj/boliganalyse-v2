import { BaseProvider } from "./base-provider.ts";
import { HTMLParseResult } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { config } from "../config/config.ts";

// Import Firecrawl using the alias defined in deno.json
import FirecrawlApp, { ScrapeResponse } from "@mendable/firecrawl-js";


/**
 * Provider that uses Firecrawl for enhanced web scraping
 */
export class FirecrawlProvider extends BaseProvider {

  logger = createLogger("FirecrawlProvider");

  private firecrawl: FirecrawlApp | undefined;

  constructor() {
    super();
    // Initialize Firecrawl with API key from config
    if (config.firecrawl && config.firecrawl.apiKey) {
      this.firecrawl = new FirecrawlApp({
        apiKey: config.firecrawl.apiKey,
      });
    } else {
      this.logger.warn("Firecrawl API key not configured. Provider will be disabled.");
    }
  }

  /**
   * Get the name of this provider
   */
  get name(): string {
    return "Firecrawl";
  }

  /**
   * Check if this provider can handle the given URL
   * Always returns true if API key is configured, as it's a universal fallback
   * @param url URL to check
   */
  canHandle(url: string, _htmlContent?: string): boolean {
    // Only enable this provider if API key is configured
    if (!config.firecrawl || !config.firecrawl.apiKey) {
      return false;
    }
    
    // Firecrawl can handle any URL
    return true;
  }

  /**
   * Extract property data using Firecrawl service
   * @param url URL to parse
   * @param htmlContent HTML content (unused, as Firecrawl fetches the content)
   */
  async parseHtml(url: string, _htmlContent: string): Promise<HTMLParseResult> {
    try {
      this.logger.info(`Scraping URL with Firecrawl: ${url}`);
      
      const response = await this.firecrawl?.scrapeUrl(url, {
        formats: ['markdown'],
      });
      
      if (!response) {
        throw new Error("Failed to get response from Firecrawl");
      }

      const succesResponse = response as ScrapeResponse;

      // Extract text from markdown
      const extractedText = succesResponse.markdown || "";
      
      // Try to extract an image URL from the metadata
      let imageUrl: string | undefined;
      
      // Check for image in metadata fields (prioritizing og:image)
      const metadata = succesResponse.metadata || {};
      
      if (metadata.ogImage) {
        // Direct ogImage property
        imageUrl = metadata.ogImage;
      } else if (metadata["og:image"]) {
        // og:image property
        imageUrl = metadata["og:image"];
      } else if (metadata.twitter && metadata.twitter.image) {
        // Twitter image as fallback
        imageUrl = metadata.twitter.image;
      } else if (typeof metadata["twitter:image"] === "string") {
        // Twitter image as direct property
        imageUrl = metadata["twitter:image"];
      } else {
        // Look for images in the first few markdown lines (as last resort)
        const imgMatch = extractedText.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }
      
      this.logger.info(`Extracted image URL: ${imageUrl || "No image found"}`);
      
      return {
        extractedText,
        property_image_url: imageUrl,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error scraping URL with Firecrawl: ${url}`, error);
      // Return minimal structure with error info
      return {
        extractedText: `Failed to scrape content from ${url}: ${errorMessage}`,
      };
    }
  }
} 