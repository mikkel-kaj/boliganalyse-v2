/**
 * Standardized analysis status values used throughout the application
 * IMPORTANT: These must match exactly with frontend status values
 */
export enum AnalysisStatus {
  // Initial states
  PENDING = "pending",                   // Initial status when created but not yet started
  QUEUED = "queued",                     // Analysis is queued for processing
  
  // Processing states (granular updates)
  FETCHING_HTML = "fetching_html",       // Fetching the HTML content
  PARSING_DATA = "parsing_data",         // Extracting structured data from HTML
  PREPARING_ANALYSIS = "preparing_analysis", // Preparing data for AI analysis
  ANALYZING = "analyzing",               // AI is analyzing the data
  GENERATING_INSIGHTS = "generating_insights", // Generating insights from analysis
  FINALIZING = "finalizing",             // Finalizing the analysis results
  
  // Terminal states
  COMPLETED = "completed",               // Analysis completed successfully
  ERROR = "error",                       // Analysis failed with error
  INVALID_URL = "invalid_url",           // URL was invalid or unsupported
  TIMEOUT = "timeout",                   // Analysis timed out
  CANCELLED = "cancelled"                // Analysis was cancelled by user or system
}

/**
 * Safely convert a string status to enum value
 * This function is now more robust and handles various cases consistently
 * 
 * @param status The status string to convert
 * @returns The corresponding AnalysisStatus enum value or PENDING if not recognized
 */
export function statusFromString(status: string): AnalysisStatus {
  if (!status) return AnalysisStatus.PENDING;
  
  // First, try direct value match - most efficient and reliable
  const allStatuses = Object.values(AnalysisStatus);
  if (allStatuses.includes(status as AnalysisStatus)) {
    return status as AnalysisStatus;
  }
  else {
    // no match found
    console.error(`Unknown status string: ${status}`);
    return AnalysisStatus.ERROR;
  }
} 