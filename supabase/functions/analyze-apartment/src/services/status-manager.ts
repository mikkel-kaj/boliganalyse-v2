import {SupabaseClient} from "@supabase/supabase-js";
import {config} from "../config/config.ts";
import {createLogger} from "../utils/logger.ts";
import {AnalysisStatus} from "../types/status.ts";
import {supabase_private} from "../supabase/client.ts";

const logger = createLogger("StatusManager");

/**
 * Manages status updates for listing analysis
 */
export class StatusManager {
  private supabase: SupabaseClient<any, "private", any>;
  private tableName: string;

  /**
   * Create a new status manager
   */
  constructor() {
    this.supabase = supabase_private;

    this.tableName = `${config.database.listingsTable}`;
  }

  /**
   * Update a listing's status
   *
   * @param id Listing ID
   * @param status New status
   * @param additionalFields Additional fields to update
   * @returns Success indicator
   */
  async updateStatus(
    id: string,
    status: AnalysisStatus,
    additionalFields: Record<string, any> = {},
  ): Promise<boolean> {
    try {
      // Log the status update
      logger.info(`Updating status for listing ${id} to ${status}`);

      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...additionalFields,
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      logger.error(
        `Error updating status for listing ${id} to ${status}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Set an error status with appropriate details
   */
  async setErrorStatus(
    id: string,
    error: Error | string | unknown,
    status: AnalysisStatus = AnalysisStatus.ERROR,
  ): Promise<boolean> {
    // Format the error message
    const errorMessage = error instanceof Error
      ? `${error.message}\n${error.stack || ""}`
      : String(error);

    // Additional error metadata
    const errorDetails = {
      error_message: errorMessage,
    };

    // Update with error status
    return this.updateStatus(id, status, errorDetails);
  }
}
