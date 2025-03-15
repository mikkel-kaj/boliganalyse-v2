import { BaseProvider } from "./base-provider.ts";
import { BoligsidenProvider } from "./boligsiden-provider.ts";
import { extractDomain } from "../utils/url.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ProviderRegistry");

/**
 * Registry for managing all provider implementations
 */
export class ProviderRegistry {
  private providers: BaseProvider[] = [];
  private static instance: ProviderRegistry;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Register all available providers
    this.registerProvider(new BoligsidenProvider());
    
    // Note: Add new providers here as they're implemented
    // this.registerProvider(new HomeProvider());
    // this.registerProvider(new NyboligProvider());
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }
  
  /**
   * Register a new provider
   * @param provider Provider implementation to register
   */
  public registerProvider(provider: BaseProvider): void {
    this.providers.push(provider);
    logger.info(`Registered provider: ${provider.name}`);
  }
  
  /**
   * Get all registered providers
   */
  public getAllProviders(): BaseProvider[] {
    return [...this.providers];
  }
  
  /**
   * Get a provider that can handle the given URL
   * @param url URL to find a provider for
   * @returns Provider that can handle the URL or undefined if none found
   */
  public getProviderForUrl(url: string): BaseProvider | undefined {
    try {
      // Try to find a provider that can handle this URL
      const provider = this.providers.find(p => p.canHandle(url));
      
      if (provider) {
        logger.info(`Found provider for URL ${url}: ${provider.name}`);
        return provider;
      }
      
      // Log the domain to help identify missing providers
      const domain = extractDomain(url);
      logger.warn(`No provider found for domain: ${domain}`);
      
      return undefined;
    } catch (error) {
      logger.error(`Error finding provider for URL: ${url}`, error);
      return undefined;
    }
  }
  
  /**
   * Get a provider by name
   * @param name Name of the provider to get
   * @returns Provider with the given name or undefined if not found
   */
  public getProviderByName(name: string): BaseProvider | undefined {
    return this.providers.find(p => p.name === name);
  }
} 