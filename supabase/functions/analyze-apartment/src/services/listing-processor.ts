import { ListingRepository } from "../repositories/listing-repository.ts";
import { AIAnalyzerService } from "./ai-analyzer.ts";
import { ProviderRegistry } from "../providers/provider-registry.ts";
import { config } from "../config/config.ts";
import { createLogger } from "../utils/logger.ts";

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
      model: config.openai.model
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
  async processListing(listingId: string, url: string, normalizedUrl: string): Promise<boolean> {
    try {
      logger.info(`Starting processing for listing: ${listingId}`);
      
      // Update status to indicate processing has started
      await this.repository.updateStatus(listingId, "Henter HTML indhold");
      
      // Fetch HTML content
      const htmlContent = await this.fetchHtmlContent(url);
      if (!htmlContent) {
        await this.repository.updateStatus(listingId, "Fejl: Kunne ikke hente indhold");
        throw new Error(`Failed to fetch HTML content for ${url}`);
      }
      
      // Find appropriate provider
      const provider = this.providerRegistry.getProviderForUrl(url);
      if (!provider) {
        await this.repository.updateStatus(listingId, "Fejl: Ingen understøttet udbyder");
        throw new Error(`No provider found for URL: ${url}`);
      }
      
      // Update status
      await this.repository.updateStatus(listingId, "Analyserer indhold");
      
      // Parse HTML with provider
      const parseResult = await provider.parseHtml(htmlContent);
      
      // Update image URL if available
      if (parseResult.property_image_url) {
        await this.repository.updateListingMetadata(
          listingId,
          parseResult.property_image_url
        );
      }
      
      // Check for original source URL
      let originalSourceHtml: string | undefined;
      if (parseResult.originalLink) {
        await this.repository.updateStatus(
          listingId, 
          "Henter original kilde", 
        );
        
        // Fetch original source HTML
        originalSourceHtml = await this.fetchHtmlContent(parseResult.originalLink);
      }
      
      // Perform AI analysis
      let analysisResult;
      
      if (originalSourceHtml) {
        // If we have both original and aggregator HTML, analyze both
        analysisResult = await this.aiAnalyzer.analyzeMultipleContents(
          htmlContent,
          originalSourceHtml,
          parseResult.partialAnalysis
        );
      } else {
        // Otherwise just analyze the main HTML
        analysisResult = await this.aiAnalyzer.analyzeHtmlContent(
          htmlContent,
          parseResult.partialAnalysis
        );
      }
      
      // Add source information
      analysisResult.source = provider.name;
      
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
          `Fejl: ${error instanceof Error ? error.message : String(error)}`
        );
      } catch (statusError) {
        logger.error(`Failed to update error status for listing ${listingId}`, statusError);
      }
      
      return false;
    }
  }
  
  /**
   * Fetch HTML content from a URL
   * @param url URL to fetch
   * @returns HTML content or undefined on error
   */
  private async fetchHtmlContent(url: string): Promise<string | undefined> {
    try {
      // Set up AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.http.timeout);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      logger.error(`Error fetching HTML content from ${url}`, error);
      return undefined;
    }
  }
} 