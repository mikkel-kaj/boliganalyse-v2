import { ListingData, AnalysisResult, AnalysisOptions } from "../types/index.ts";
import { ListingRepository } from "../repositories/listing-repository.ts";
import { AIAnalyzerService } from "./ai-analyzer.ts";
import { ProviderRegistry } from "../providers/provider-registry.ts";
import { validateListingUrl } from "../utils/validation.ts";
import { config } from "../config/config.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ListingAnalyzer");

/**
 * Service for analyzing real estate listings
 */
export class ListingAnalyzerService {
  private repository: ListingRepository;
  private aiAnalyzer: AIAnalyzerService;
  private providerRegistry: ProviderRegistry;
  
  /**
   * Create a new listing analyzer service
   * @param repository Repository for data operations
   * @param aiAnalyzer AI analyzer service
   */
  constructor(
    repository: ListingRepository,
    aiAnalyzer: AIAnalyzerService
  ) {
    this.repository = repository;
    this.aiAnalyzer = aiAnalyzer;
    this.providerRegistry = ProviderRegistry.getInstance();
  }
  
  /**
   * Analyze a listing by URL
   * @param url URL to analyze
   * @param normalizedUrl Normalized URL
   * @param options Analysis options
   * @returns Analysis result
   */
  async analyzeListing(
    url: string, 
    normalizedUrl: string,
    options: AnalysisOptions = {}
  ): Promise<ListingData> {
    try {
      // Validate URL
      const validation = validateListingUrl(url);
      if (!validation.valid) {
        throw new Error(`Invalid URL: ${validation.error}`);
      }
      
      // Check if listing exists and if we should reanalyze
      let listing = await this.repository.findByNormalizedUrl(normalizedUrl);
      
      // If listing exists and we're not forcing reanalysis, return it
      if (listing && !options.forceReanalysis && listing.analysis) {
        logger.info(`Using existing analysis for ${normalizedUrl}`);
        return listing;
      }
      
      // Create new listing if it doesn't exist
      if (!listing) {
        listing = await this.repository.createListing(url, normalizedUrl);
        logger.info(`Created new listing for ${url}`);
      }
      
      // Update status to indicate analysis has started
      await this.repository.updateStatus(listing.id, "Henter indhold");
      
      // Fetch HTML content
      const htmlContent = await this.fetchHtmlContent(url);
      if (!htmlContent) {
        await this.repository.updateStatus(listing.id, "Fejl: Kunne ikke hente indhold");
        throw new Error(`Failed to fetch HTML content for ${url}`);
      }
      
      // Find appropriate provider
      const provider = this.providerRegistry.getProviderForUrl(url);
      if (!provider) {
        await this.repository.updateStatus(listing.id, "Fejl: Ingen understøttet udbyder");
        throw new Error(`No provider found for URL: ${url}`);
      }
      
      // Update status
      await this.repository.updateStatus(listing.id, "Analyserer indhold");
      
      // Parse HTML with provider
      const parseResult = await provider.parseHtml(htmlContent);
      
      // Update metadata
      if (parseResult.energyRating || parseResult.property_image_url) {
        await this.repository.updateListingMetadata(
          listing.id,
          parseResult.property_image_url
        );
      }
      
      // Check for original source URL
      let originalSourceHtml: string | undefined;
      if (parseResult.originalLink) {
        await this.repository.updateStatus(
          listing.id, 
          "Henter original kilde", 
        );
        
        // Fetch original source HTML
        originalSourceHtml = await this.fetchHtmlContent(parseResult.originalLink);
      }
      
      // Perform AI analysis
      let analysisResult: AnalysisResult;
      
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
      await this.repository.saveAnalysisResult(listing.id, analysisResult);
      
      // Return updated listing
      const updatedListing = await this.repository.findByNormalizedUrl(normalizedUrl);
      if (!updatedListing) {
        throw new Error(`Failed to retrieve updated listing for ${normalizedUrl}`);
      }
      
      return updatedListing;
    } catch (error) {
      logger.error(`Error analyzing listing: ${url}`, error);
      throw error;
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