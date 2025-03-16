import {ListingRepository} from "../repositories/listing-repository.ts";
import {AIAnalyzerService} from "./ai-analyzer.ts";
import {ProviderRegistry} from "../providers/provider-registry.ts";
import {config} from "../config/config.ts";
import {createLogger} from "../utils/logger.ts";
import {HTMLParseResult} from "../types/index.ts";

const logger = createLogger("ListingProcessor");

/**
 * Service for processing real estate listings
 * This is the implementation that would be used by the background processor
 */
export class ListingProcessorService {
  private repository: ListingRepository;
  private aiAnalyzer: AIAnalyzerService;
  private providerRegistry: ProviderRegistry;

  /**
   * Create a new listing processor service
   * @param repository Repository for data operations
   */
  constructor(repository: ListingRepository) {
    this.repository = repository;

    // Initialize AI analyzer with config
    this.aiAnalyzer = new AIAnalyzerService({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
    });

    // Get provider registry singleton
    this.providerRegistry = ProviderRegistry.getInstance();
  }

  /**
   * Process a listing in the background
   * @param listingId Listing ID to process
   * @param url Original URL
   * @param normalizedUrl Normalized URL
   * @returns Processing result
   */
  async processListing(listingId: string, url: string): Promise<boolean> {
    try {
      logger.info(`Starting processing for listing: ${listingId}`);

      // Update status to indicate processing has started
      await this.repository.updateStatus(listingId, "Søger efter salgsopslag");

      // Fetch HTML content
      const htmlContent = await this.fetchHtmlContent(url);
      logger.info(`Fetched HTML content for listing: ${htmlContent} and ${url} and ${listingId}`);

      if (!htmlContent) {
        throw new Error("Failed to fetch HTML content");
      }

      await this.repository.updateStatus(listingId, "Opslag fundet!");

      const provider = this.providerRegistry.getProviderForUrl(url);

      if (!provider) {
        throw new Error(`No provider found for URL: ${url}`);
      }

      // Update status
      await this.repository.updateStatus(
        listingId,
        "Leder efter fejl og mangler..",
      );

      // Parse HTML with provider
      const parseResult = await provider.parseHtml(url, htmlContent);

      // Update image URL if available
      if (parseResult.property_image_url) {
        await this.repository.updateListingMetadata(
          listingId,
          parseResult.property_image_url,
        );
      }

      // Check for original source URL
      let originalSourceResult: HTMLParseResult | undefined;

      if (parseResult.originalLink) {
        await this.repository.updateStatus(
          listingId,
          "Henter original kilde",
        );

        // Fetch original source HTML
        const originalSourceHtml = await this.fetchHtmlContent(
          parseResult.originalLink,
        );
        logger.info(`Fetched HTML content for listing: ${originalSourceHtml} and ${parseResult.originalLink} and ${listingId}`);

        const sourceProvider = this.providerRegistry.getProviderForUrl(parseResult.originalLink);

        originalSourceResult = await sourceProvider.parseHtml(
            parseResult.originalLink,
            originalSourceHtml,
        );
      }

      // Update status for AI analysis
      await this.repository.updateStatus(listingId, "Laver AI-analyse");

      logger.info(`Compiled the full text which will be analyzed for listing: ${parseResult.extractedText} and ${originalSourceResult?.extractedText}`);

      const analysisResult = await this.aiAnalyzer.analyzeMultipleTexts(
        parseResult,
        originalSourceResult
      );


      // Save analysis result
      await this.repository.saveAnalysisResult(listingId, analysisResult);

      logger.info(`Processing completed for listing: ${listingId}`);
      return true;
    } catch (error) {
      logger.error(`Processing failed for listing ${listingId}`, error);

      // Update status to indicate error
      try {
        await this.repository.updateStatus(
          listingId,
          `Fejl: ${error instanceof Error ? error.message : String(error)}`,
        );
      } catch (statusError) {
        logger.error(
          `Failed to update error status for listing ${listingId}`,
          statusError,
        );
      }

      return false;
    }
  }

  /**
   * Fetch HTML content from a URL
   * @param url URL to fetch
   * @returns HTML content or undefined on error
   */
  private async fetchHtmlContent(url: string): Promise<string> {
    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.http.timeout);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      signal: controller.signal,
    });

    // Clear the timeout
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.text();
  }
}
