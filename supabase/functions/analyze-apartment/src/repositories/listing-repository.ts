import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/config.ts";
import { ListingData, AnalysisResult } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ListingRepository");

/**
 * Repository for apartment listing data operations
 */
export class ListingRepository {
  private supabase: SupabaseClient;
  private tableName: string;
  
  /**
   * Create a new listing repository
   * @param supabaseClient Optional existing Supabase client
   */
  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      this.supabase = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey
      );
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
        .from(this.tableName)
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
        .from(this.tableName)
        .insert([
          {
            url,
            normalized_url: normalizedUrl,
            status: "Starter analyse"
          },
        ])
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
  
  /**
   * Update a listing's status
   * @param id Listing ID
   * @param status New status
   * @param additionalFields Additional fields to update
   * @returns Success indicator
   */
  async updateStatus(
    id: string, 
    status: string, 
    additionalFields: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
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
    analysisResult: AnalysisResult, 
    status = "Analyse fuldført"
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
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
   * Update listing with image URL
   * @param id Listing ID
   * @param imageUrl Image URL
   * @returns Success indicator
   */
  async updateListingMetadata(
    id: string, 
    imageUrl?: string
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      if (imageUrl) {
        updateData.property_image_url = imageUrl;
      }
      
      const { error } = await this.supabase
        .from(this.tableName)
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