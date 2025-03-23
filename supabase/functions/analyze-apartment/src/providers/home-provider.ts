import {BaseProvider} from "./base-provider.ts";
import {HTMLParseResult} from "../types/index.ts";
import {extractDomain} from "../utils/url.ts";
import {createLogger} from "../utils/logger.ts";

import {DOMParser, Element} from "deno-dom";
import * as htmlUtils from "../utils/html.ts";

const logger = createLogger("HomeProvider");

/**
 * Provider implementation for Home.dk
 */
export class HomeProvider extends BaseProvider {
  /**
   * Get the name of this provider
   */
  override get name(): string {
    return "Home.dk";
  }

  /**
   * Check if this provider can handle the given URL
   * @param url URL to check
   * @param htmlContent Optional HTML content (not used by this provider)
   */
  override canHandle(url: string, htmlContent?: string): boolean {
    try {
      const domain = extractDomain(url);
      return domain === "home.dk";
    } catch {
      return false;
    }
  }

  /**
   * Extract the original source URL from the Boligsiden URL
   * Since this is already a direct link to the realtor, we return the URL itself
   * @param url The Home URL
   */
  override async extractSourceUrl(url: string): Promise<string | undefined> {
    return url; // For direct realtor links, the URL is already the source
  }

  /**
   * Extract the main property image URL from the HTML content
   * @param htmlContent HTML content to extract from 
   */
  override async extractImageUrl(htmlContent: string): Promise<string | undefined> {
    try {
      // First try to get from meta tags (most reliable)
      const parser = new DOMParser();
      const document = parser.parseFromString(htmlContent, "text/html");
      
      if (!document) {
        throw new Error("Failed to parse HTML");
      }
      
      // First check meta tags for og:image
      const ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (ogImageMeta) {
        const content = (ogImageMeta as Element).getAttribute("content");
        if (content) {
          return content;
        }
      }
      
      // Look for property images in large image elements
      const propertyImages = document.querySelectorAll('.property-details-main__header img, .image-gallery-preview img');
      if (propertyImages.length > 0) {
        const src = (propertyImages[0] as Element).getAttribute("src");
        if (src) {
          return src;
        }
      }
      
      // Fall back to generic image extraction
      const imageUrl = await htmlUtils.extractFirstImageUrl(htmlContent);
      if (imageUrl) {
        return imageUrl;
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to extract image URL", error);
      return undefined;
    }
  }

  /**
   * Parse HTML content to extract structured data
   * @param htmlContent HTML content to parse
   * @param url URL of the html content
   */
  override async parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult> {
    try {
      // Extract basic fields that are common across providers
      const energyRating = await this.extractEnergyRating(htmlContent);
      const property_image_url = await this.extractImageUrl(htmlContent);
      const extractedText = await htmlUtils.extractTextFromHtml(htmlContent);
      const originalLink = url; // For direct realtor links, URL is already the source

      // Extract specific fields for this provider
      const specificFields = await this.extractSpecificFields(htmlContent);

      return {
        originalLink,
        energyRating,
        property_image_url,
        extractedText,
        partialAnalysis: specificFields,
      };
    } catch (error) {
      logger.error("Failed to parse HTML", error);
      return {};
    }
  }

  /**
   * Extract provider-specific fields from HTML
   * @param htmlContent HTML content to parse
   */
  override async extractSpecificFields(
    htmlContent: string,
  ): Promise<Record<string, any>> {
    try {
      const document = new DOMParser().parseFromString(
        htmlContent,
        "text/html",
      );
      if (!document) {
        throw new Error("Failed to parse HTML");
      }

      const result: Record<string, any> = {};

      // Extract structured data if available (JSON-LD)
      const jsonLdElements = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      
      for (const element of jsonLdElements) {
        try {
          const content = element.textContent;
          if (content) {
            const data = JSON.parse(content);
            
            // Store the entire JSON-LD data structure
            result.jsonLd = data;
            
            // If we have a RealEstateListing, also set a few key fields at the top level for convenience
            if (Array.isArray(data)) {
              const realEstateListing = data.find(item => item["@type"] === "RealEstateListing");
              if (realEstateListing) {
                if (realEstateListing.description) result.description = realEstateListing.description;
                if (realEstateListing.offers?.price) result.price = realEstateListing.offers.price;
                if (realEstateListing.offers?.itemOffered?.numberOfRooms) result.rooms = realEstateListing.offers.itemOffered.numberOfRooms;
                if (realEstateListing.offers?.itemOffered?.address?.streetAddress) result.address = realEstateListing.offers.itemOffered.address.streetAddress;
                
                // Check for energy rating in additionalProperty
                const additionalProperties = realEstateListing.offers?.itemOffered?.additionalProperty;
                if (Array.isArray(additionalProperties)) {
                  const energyRating = additionalProperties.find(prop => prop.name === "EnergyRating");
                  if (energyRating && energyRating.value) result.energyRating = energyRating.value;
                }
              }
            }
            
            // No need to further process if we have the full JSON-LD data
            return result;
          }
        } catch (jsonError) {
          logger.error("Failed to parse JSON-LD", jsonError);
        }
      }

      // Only if we didn't find JSON-LD data, extract data from HTML directly
      // Extract address (if not already from JSON-LD)
      if (!result.address) {
        const addressElem = document.querySelector("h1.h3.h3--bold");
        if (addressElem?.textContent) {
          result.address = addressElem.textContent.trim();
        }
      }

      // Extract price
      if (!result.price) {
        const priceElem = document.querySelector("p.h3:contains('Leje pr. md.')");
        if (priceElem?.textContent) {
          const priceMatch = priceElem.textContent.match(/(\d[\d\.,]+)\s*kr/);
          if (priceMatch && priceMatch[1]) {
            result.price = priceMatch[1].replace(/\./g, "").replace(",", ".");
          }
        }
      }

      // Extract property size and type
      const sizeElem = document.querySelector(".property-details-information__facts p.h3:first-child");
      if (sizeElem?.textContent) {
        const sizeMatch = sizeElem.textContent.match(/(\d+)\s*m2\s+(.*)/);
        if (sizeMatch) {
          result.size = parseInt(sizeMatch[1], 10);
          result.propertyType = sizeMatch[2].trim();
        }
      }

      // Extract property description
      const descriptionElem = document.querySelector(".property-details-information__description");
      if (descriptionElem?.textContent) {
        result.description = descriptionElem.textContent.trim();
      }

      // Extract rooms
      const roomsElem = document.querySelector(".base-usp:has(.base-usp__name:contains('Antal rum')) .h1");
      if (roomsElem?.textContent) {
        result.rooms = parseInt(roomsElem.textContent, 10);
      }

      // Extract energy rating if not already found
      if (!result.energyRating) {
        const energyRatingElem = document.querySelector(".base-usp:has(.base-usp__name:contains('Energimærke')) .nuxt-icon");
        if (energyRatingElem) {
          const svgTitle = (energyRatingElem as Element).querySelector("svg title");
          if (svgTitle?.textContent) {
            const energyMatch = svgTitle.textContent.match(/Energimærke\s+([A-G])/i);
            if (energyMatch && energyMatch[1]) {
              result.energyRating = energyMatch[1];
            }
          }
        }
      }

      // Extract additional property features
      const usps = document.querySelectorAll(".usps__items .base-usp");
      if (usps.length > 0) {
        const features: Record<string, string | boolean | number> = {};
        
        usps.forEach(usp => {
          const nameElem = (usp as Element).querySelector(".base-usp__name");
          const valueElem = (usp as Element).querySelector(".h1");
          
          if (nameElem && valueElem) {
            const name = nameElem.textContent?.trim().toLowerCase();
            const value = valueElem.textContent?.trim();
            
            if (name && value) {
              // Handle boolean values (Ja/Nej)
              if (value === "Ja") {
                features[name] = true;
              } else if (value === "Nej") {
                features[name] = false;
              } else if (!isNaN(parseInt(value, 10))) {
                features[name] = parseInt(value, 10);
              } else {
                features[name] = value;
              }
            }
          }
        });
        
        if (Object.keys(features).length > 0) {
          result.features = features;
        }
      }

      // Extract economy details
      const economyRows = document.querySelectorAll(".property-details-economy__row");
      if (economyRows.length > 0) {
        const economy: Record<string, string | number> = {};
        
        economyRows.forEach(row => {
          const nameElem = (row as Element).querySelector(".property-details-economy__name p");
          const valueElem = (row as Element).querySelector(".property-details-economy__value");
          
          if (nameElem && valueElem) {
            const name = nameElem.textContent?.trim();
            const value = valueElem.textContent?.trim();
            
            if (name && value) {
              economy[name] = value;
              
              // Try to convert to numbers where appropriate
              const numericValue = value.replace(/\./g, "").replace(/,/g, ".").replace(/\s*kr\.?/g, "").trim();
              if (!isNaN(parseFloat(numericValue))) {
                economy[`${name}_numeric`] = parseFloat(numericValue);
              }
            }
          }
        });
        
        if (Object.keys(economy).length > 0) {
          result.economy = economy;
        }
      }
      
      return result;
    } catch (error) {
      logger.error("Failed to extract specific fields", error);
      return {};
    }
  }
} 