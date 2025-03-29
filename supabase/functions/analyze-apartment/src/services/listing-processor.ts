import {ListingRepository} from "../repositories/listing-repository.ts";
import {AIAnalyzerService} from "./ai-analyzer.ts";
import {ProviderRegistry} from "../providers/provider-registry.ts";
import {config} from "../config/config.ts";
import {createLogger} from "../utils/logger.ts";
import {HTMLParseResult} from "../types/index.ts";
import {AnalysisStatus} from "../types/status.ts";

const logger = createLogger("ListingProcessor");

/**
 * Service for processing apartment listings
 */
export class ListingProcessorService {
  private repository: ListingRepository;
  private aiAnalyzer: AIAnalyzerService;
  private providerRegistry: ProviderRegistry;
  private fetchOptions: RequestInit;

  /**
   * Create a new listing processor
   * @param repository Repository for listing data operations
   * @param aiAnalyzer AI service for text analysis
   * @param providerRegistry Registry of providers to use
   */
  constructor(
    repository: ListingRepository,
    aiAnalyzer?: AIAnalyzerService,
    providerRegistry?: ProviderRegistry,
  ) {
    this.repository = repository;
    this.aiAnalyzer = aiAnalyzer || new AIAnalyzerService({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
    });
    this.providerRegistry = providerRegistry || ProviderRegistry.getInstance();

    // Set up fetch options with timeout
    this.fetchOptions = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      redirect: "follow",
    };
  }

  /**
   * Process a listing
   * @param listingId Listing ID
   * @param url URL to process
   * @returns Processing result
   */
  async processListing(listingId: string, url: string): Promise<boolean> {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.warn(`Processing timeout for listing: ${listingId}`);
      // The timeout error will be caught by the catch block
    }, 3000000); // 5 minute timeout for full processing

    try {
      logger.info(`Starting processing for listing: ${listingId}`);
      await this.repository.updateStatus(
        listingId,
        AnalysisStatus.FETCHING_HTML,
      );

      const htmlContent = await this.fetchHtmlContent(url);
      logger.info(`Fetched HTML content for URL: ${url}`);

      if (!htmlContent) {
        throw new Error("Failed to fetch HTML content");
      }

      let provider;

      try {
        provider = this.providerRegistry.getProviderForContent(
          url,
          htmlContent,
        );
      } catch (providerError) {
        logger.error(`No suitable provider found for URL: ${url}`);

        throw new Error(
          `No suitable provider found for this listing. Please try a supported provider like boligsiden.dk, home.dk, or a site using JSON-LD.`,
        );
      }

      await this.repository.updateStatus(
        listingId,
        AnalysisStatus.PARSING_DATA,
      );

      const parseResult = await provider.parseHtml(url, htmlContent);

      let originalSourceResult: HTMLParseResult | undefined;
      let originalSourceHtml: string | null = null;

      if (parseResult.originalLink && parseResult.originalLink !== url) {
        await this.repository.updateStatus(
          listingId,
          AnalysisStatus.PREPARING_ANALYSIS,
        );

        originalSourceHtml = await this.fetchHtmlContent(
          parseResult.originalLink,
        );
        logger.info(
          `Fetched HTML content from original source: ${parseResult.originalLink}`,
        );

        try {
          const sourceProvider = this.providerRegistry.getProviderForContent(
            parseResult.originalLink,
            originalSourceHtml,
          );

          originalSourceResult = await sourceProvider.parseHtml(
            parseResult.originalLink,
            originalSourceHtml,
          );

        } catch (sourceProviderError) {
          logger.warn(
            `Could not find provider for original source URL: ${parseResult.originalLink}`,
          );
        }
      }
      // Save redirect URL data
      await this.repository.updateListingMetadata(
          listingId,
          {
            text_extracted: parseResult.extractedText,
            text_extracted_redirect: originalSourceResult?.extractedText,
            html_url: htmlContent,
            html_url_redirect: originalSourceHtml,
            url_redirect: parseResult.originalLink !== url
                ? parseResult.originalLink
                : null,
          },
      );

      await this.repository.updateStatus(
        listingId,
        AnalysisStatus.GENERATING_INSIGHTS,
      );

      const analysisResult = await this.aiAnalyzer.analyzeMultipleTexts(
        parseResult,
        originalSourceResult,
      );

      await this.repository.updateStatus(listingId, AnalysisStatus.FINALIZING);

      await this.repository.saveAnalysisResult(listingId, analysisResult);

      logger.info(`Processing completed for listing: ${listingId}`);
      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      clearTimeout(timeoutId);

      logger.error(`Processing failed for listing ${listingId}`, error);

      let status = AnalysisStatus.ERROR;

      if (error instanceof DOMException && error.name === "AbortError") {
        status = AnalysisStatus.TIMEOUT;
      }

      await this.repository.setErrorStatus(listingId, error, status);

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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        ...this.fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${url}, status: ${response.status}`,
        );
      }

      return await response.text();
    } catch (error) {
      logger.error(`Error fetching HTML content from ${url}`, error);
      throw error;
    }
  }
}
