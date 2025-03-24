import { SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/config.ts";
import { ListingData } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { AnalysisStatus } from "../types/status.ts";
import {supabase_private} from "../supabase/client.ts";

const logger = createLogger("ListingRepository");

export class ListingRepository {
  private supabase: SupabaseClient<any, "private", any>;
  private tableName: string;

  constructor(supabaseClient?: SupabaseClient<any, "private", any>) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      // Use any schema to avoid type errors when accessing tables in different schemas
      this.supabase = supabase_private;
    }
    this.tableName = config.database.listingsTable;
  }
  
  /**
   * Find a listing by its normalized URL
   * @param normalizedUrl Normalized URL to search for
   * @returns Listing data or null if not found
   */
  async findByNormalizedUrl(normalizedUrl: string): Promise<ListingData | null> {
    try {
      const { data, error } = await this.supabase
        .from(`${this.tableName}`)
        .select("*")
        .eq("normalized_url", normalizedUrl)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error(`Error finding listing by normalized URL: ${normalizedUrl}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new listing
   * @param url Original URL
   * @param normalizedUrl Normalized URL
   * @returns Created listing data
   */
  async createListing(url: string, normalizedUrl: string): Promise<ListingData> {
    try {
      const { data, error } = await this.supabase
        .from(`${this.tableName}`)
        .insert({
          url,
          normalized_url: normalizedUrl,
          status: AnalysisStatus.PENDING,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error(`Error creating listing for URL: ${url}`, error);
      throw error;
    }
  }

  //Delete a listing by its url
  async deleteByUrl(url: string): Promise<boolean> {
      try {
      const { error } = await this.supabase
          .from(`${this.tableName}`)
          .delete()
          .eq("url", url);

      if (error) {
          throw error;
      }

      return true;
      } catch (error) {
      logger.error(`Error deleting listing by normalized URL: ${url}`, error);
      throw error;
      }
  }
  
  /**
   * Update a listing's status
   * @param id Listing ID
   * @param status New status from AnalysisStatus enum
   * @param additionalFields Additional fields to update
   * @returns Success indicator
   */
  async updateStatus(
    id: string, 
    status: AnalysisStatus,
    additionalFields: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(`${this.tableName}`)
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          ...additionalFields
        })
        .eq("id", id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error updating status for listing ${id} to ${status}`, error);
      throw error;
    }
  }
  
  /**
   * Save analysis results for a listing
   * @param id Listing ID
   * @param analysisResult Analysis results
   * @param status Optional new status
   * @returns Success indicator
   */
  async saveAnalysisResult(
    id: string, 
    analysisResult: any,
    status = AnalysisStatus.COMPLETED
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(`${this.tableName}`)
        .update({
          analysis: analysisResult,
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error saving analysis result for listing ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Update listing with metadata
   * @param id Listing ID
   * @param imageUrl Image URL (optional)
   * @param htmlUrl Original HTML URL (optional)
   * @param htmlUrlRedirect Redirected HTML URL (optional)
   * @param textExtracted Extracted text from original URL (optional)
   * @param textExtractedRedirect Extracted text from redirected URL (optional)
   * @returns Success indicator
   */
  async updateListingMetadata(
    id: string, 
    imageUrl?: string,
    htmlUrl?: string,
    htmlUrlRedirect?: string,
    textExtracted?: string,
    textExtractedRedirect?: string
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      if (imageUrl) {
        updateData.property_image_url = imageUrl;
      }
      
      if (htmlUrl) {
        updateData.html_url = htmlUrl;
      }
      
      if (htmlUrlRedirect) {
        updateData.html_url_redirect = htmlUrlRedirect;
      }
      
      if (textExtracted) {
        updateData.text_extracted = textExtracted;
      }
      
      if (textExtractedRedirect) {
        updateData.text_extracted_redirect = textExtractedRedirect;
      }
      
      const { error } = await this.supabase
        .from(`${this.tableName}`)
        .update(updateData)
        .eq("id", id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error updating metadata for listing ${id}`, error);
      throw error;
    }
  }
} 