// @ts-ignore - Fix for deno-dom import
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("HtmlUtils");

/**
 * Extracts readable text content from HTML by removing scripts, styles, and other non-content elements
 * @param htmlContent HTML content to extract text from
 * @returns Extracted text or empty string on error
 */
export async function extractTextFromHtml(htmlContent: string): Promise<string> {
  if (!htmlContent) return "";
  
  try {
    const document = new DOMParser().parseFromString(htmlContent, "text/html");
    if (!document) {
      throw new Error("Failed to parse HTML");
    }
    
    // Remove script and style elements
    const scriptsAndStyles = document.querySelectorAll("script, style, noscript, iframe");
    for (const element of scriptsAndStyles) {
      element.parentNode?.removeChild(element);
    }
    
    // Get text content of body
    const body = document.querySelector("body");
    if (!body) return "";
    
    // Clean up whitespace
    const textContent = body.textContent || "";
    return textContent
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n")
      .trim();
  } catch (error) {
    logger.error("Failed to extract text from HTML", error);
    return "";
  }
}

/**
 * Extract the first image URL from HTML content
 * @param htmlContent HTML content to extract from
 * @returns First image URL or null if none found
 */
export async function extractFirstImageUrl(htmlContent: string): Promise<string | null> {
  if (!htmlContent) return null;
  
  try {
    // Look for image tags with src attributes
    const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/gi;
    const matches = [...htmlContent.matchAll(imgRegex)];
    
    // Filter for likely property images (exclude tiny icons, logos, etc.)
    const propertyImages = matches
      .map(match => match[1])
      .filter(src => {
        // Filter out SVGs, base64 images, and common UI elements
        const isLikelyPropertyImage = 
          !src.includes('base64') && 
          !src.includes('.svg') &&
          !src.includes('icon') &&
          !src.includes('logo') &&
          src.includes('http');
        
        return isLikelyPropertyImage;
      });
    
    if (propertyImages.length > 0) {
      return propertyImages[0];
    }
    
    return null;
  } catch (error) {
    logger.error("Failed to extract first image URL", error);
    return null;
  }
}

/**
 * Extracts metadata from HTML
 * @param htmlContent HTML content to extract from
 * @returns Object with metadata values
 */
export async function extractMetadata(htmlContent: string): Promise<Record<string, string>> {
  if (!htmlContent) return {};
  
  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(htmlContent, "text/html");
    if (!document) {
      throw new Error("Failed to parse HTML");
    }
    
    const result: Record<string, string> = {};
    
    // Extract meta tags
    const metaTags = document.querySelectorAll("meta[name], meta[property]");
    for (const meta of metaTags) {
      // Type assertion to Element to use getAttribute
      const metaElement = meta as Element;
      const name = metaElement.getAttribute("name") || metaElement.getAttribute("property");
      const content = metaElement.getAttribute("content");
      
      if (name && content) {
        result[name] = content;
      }
    }
    
    // Extract title
    const title = document.querySelector("title")?.textContent;
    if (title) {
      result["title"] = title;
    }
    
    return result;
  } catch (error) {
    logger.error("Failed to extract metadata", error);
    return {};
  }
} 