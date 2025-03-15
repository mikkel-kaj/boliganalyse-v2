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
   * Get a provider that can handle the given URL
   * @param url URL to find a provider for
   * @returns Provider that can handle the URL or undefined if none found
   */
  public getProviderForUrl(url: string): BaseProvider {
    // Try to find a provider that can handle this URL
    const provider = this.providers.find(p => p.canHandle(url));

    if (provider) {
      logger.info(`Found provider for URL ${url}: ${provider.name}`);
      return provider;
    }

    throw new Error(`No provider found for URL: ${url}`);
  }
} 