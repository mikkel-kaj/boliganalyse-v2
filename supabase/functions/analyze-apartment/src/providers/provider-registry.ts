import { BaseProvider } from "./base-provider.ts";
import { BoligsidenProvider } from "./boligsiden-provider.ts";
import { extractDomain } from "../utils/url.ts";
import { createLogger } from "../utils/logger.ts";
import { FallbackProvider } from "./fallback-provider.ts";
import { HomeProvider } from "./home-provider.ts";
import { JsonLdProvider } from "./json-ld-provider.ts";

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
    // Register all available providers (Order still matters for priority)
    this.registerProvider(new BoligsidenProvider());
    this.registerProvider(new JsonLdProvider());
    this.registerProvider(new HomeProvider());
    this.registerProvider(new FallbackProvider());
    // Note: Add new providers here as they're implemented
    // this.registerProvider(new NyboligProvider());
    
    // FallbackProvider should not be included anymore, as we want to reject
    // requests that can't be handled by specialized providers or JSON-LD
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
   * Get a provider that can handle the given URL and HTML content
   * @param url URL to find a provider for
   * @param htmlContent HTML content to check (for JSON-LD detection)
   * @returns Provider that can handle the URL and content
   * @throws Error if no provider found
   */
  public getProviderForContent(url: string, htmlContent: string): BaseProvider {
    // Iterate through all providers and find the first one that can handle this URL/content
    for (const provider of this.providers) {
      if (provider.canHandle(url, htmlContent)) {
        logger.info(`Using ${provider.name} provider for URL: ${url}`);
        return provider;
      }
    }

    throw new Error(`No provider found that can handle URL: ${url}`);
  }
} 