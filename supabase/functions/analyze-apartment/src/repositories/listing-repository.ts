import { SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/config.ts";
import { ListingData } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { AnalysisStatus } from "../types/status.ts";
import { supabase_private } from "../supabase/client.ts";

const logger = createLogger("ListingRepository");

/**
 * Sanitize text by removing null bytes and other problematic characters
 * @param text Text to sanitize
 * @returns Sanitized text or undefined if input is undefined
 */
function sanitizeText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.replace(/\u0000/g, '').trim();
}

export class ListingRepository {
  private supabase: SupabaseClient<any, "private", any>;
  private tableName: string;

  constructor(supabaseClient?: SupabaseClient<any, "private", any>) {
    this.supabase = supabaseClient ?? supabase_private;
    this.tableName = config.database.listingsTable;
  }

  async findByNormalizedUrl(normalizedUrl: string): Promise<ListingData | null> {
    const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("normalized_url", normalizedUrl)
        .maybeSingle();

    if (error) {
      logger.error(`Error finding listing by normalized URL: ${normalizedUrl}`, error);
      throw error;
    }

    return data;
  }

  async createListing(url: string, normalizedUrl: string): Promise<ListingData> {
    const { data, error } = await this.supabase
        .from(this.tableName)
        .insert({
          url,
          normalized_url: normalizedUrl,
          status: AnalysisStatus.PENDING,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
      logger.error(`Error creating listing for URL: ${url}`, error);
      throw error;
    }

    return data;
  }

  async deleteByUrl(url: string): Promise<boolean> {
    const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq("url", url);

    if (error) {
      logger.error(`Error deleting listing by URL: ${url}`, error);
      throw error;
    }

    return true;
  }

  async updateStatus(
      id: string,
      status: AnalysisStatus,
      error_message: string | null = null,
  ): Promise<boolean> {
    logger.info(`Updating status for listing ${id} to ${status}`);

    const { error } = await this.supabase
        .from(this.tableName)
        .update({
          status,
          error_message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
      logger.error(`Error updating status for listing ${id}`, error);
      throw error;
    }

    return true;
  }

  async setErrorStatus(
      id: string,
      error: Error | string | unknown,
      status: AnalysisStatus = AnalysisStatus.ERROR,
  ): Promise<boolean> {
    let errorMessage = '';
    
    if (typeof error === 'object' && error !== null) {
      if ('message' in error) {
        errorMessage = `${(error as any).message}`;
      if ('stack' in error) {
        errorMessage += `\n${(error as any).stack || ""}`;
      }
      } else if (error instanceof Error) {
        errorMessage = `${error.message}\n${error.stack || ""}`;
      } else {
        errorMessage = String(error);
      }
    } else {
      errorMessage = String(error);
    }

    return this.updateStatus(id, status, errorMessage);
  }

  async saveAnalysisResult(
      id: string,
      analysisResult: any,
      status: AnalysisStatus = AnalysisStatus.COMPLETED,
  ): Promise<boolean> {
    const { error } = await this.supabase
        .from(this.tableName)
        .update({
          analysis: analysisResult,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
      logger.error(`Error saving analysis result for listing ${id}`, error);
      throw error;
    }

    return true;
  }

  async updateListingMetadata(
      id: string,
      metadata: Partial<Pick<ListingData, "property_image_url" | "html_url" | "html_url_redirect" | "text_extracted" | "text_extracted_redirect" | "url_redirect">>,
  ): Promise<boolean> {
    // Sanitize text fields
    const sanitizedMetadata = { ...metadata };


    
    if (sanitizedMetadata.html_url) {
      sanitizedMetadata.html_url = sanitizeText(sanitizedMetadata.html_url);
    }
    
    if (sanitizedMetadata.html_url_redirect) {
      sanitizedMetadata.html_url_redirect = sanitizeText(sanitizedMetadata.html_url_redirect);
    }
    
    const updateData = { ...sanitizedMetadata, updated_at: new Date().toISOString() };

    const { error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq("id", id);

    if (error) {
      logger.error(`Error updating metadata for listing ${id}`, error);
      throw error;
    }

    return true;
  }
}
