/**
 * Standardized analysis status values used throughout the application
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
 * Represents groupings of statuses by their operational meaning
 */
export enum StatusGroup {
  INITIAL = 'initial',
  PROCESSING = 'processing',
  TERMINAL = 'terminal',
  ERROR = 'error'
}

/**
 * Maps each status to its logical group
 */
export const STATUS_GROUPS: Record<AnalysisStatus, StatusGroup> = {
  [AnalysisStatus.PENDING]: StatusGroup.INITIAL,
  [AnalysisStatus.QUEUED]: StatusGroup.INITIAL,
  [AnalysisStatus.FETCHING_HTML]: StatusGroup.PROCESSING,
  [AnalysisStatus.PARSING_DATA]: StatusGroup.PROCESSING,
  [AnalysisStatus.PREPARING_ANALYSIS]: StatusGroup.PROCESSING,
  [AnalysisStatus.ANALYZING]: StatusGroup.PROCESSING,
  [AnalysisStatus.GENERATING_INSIGHTS]: StatusGroup.PROCESSING,
  [AnalysisStatus.FINALIZING]: StatusGroup.PROCESSING,
  [AnalysisStatus.COMPLETED]: StatusGroup.TERMINAL,
  [AnalysisStatus.ERROR]: StatusGroup.ERROR,
  [AnalysisStatus.INVALID_URL]: StatusGroup.ERROR,
  [AnalysisStatus.TIMEOUT]: StatusGroup.ERROR,
  [AnalysisStatus.CANCELLED]: StatusGroup.ERROR
};

/**
 * Mapping of processing steps to their numerical order
 * Used for determining progress and completion percentage
 */
export const PROCESSING_ORDER: Record<AnalysisStatus, number> = {
  [AnalysisStatus.PENDING]: 0,
  [AnalysisStatus.QUEUED]: 1,
  [AnalysisStatus.FETCHING_HTML]: 2,
  [AnalysisStatus.PARSING_DATA]: 3,
  [AnalysisStatus.PREPARING_ANALYSIS]: 4,
  [AnalysisStatus.ANALYZING]: 5,
  [AnalysisStatus.GENERATING_INSIGHTS]: 6,
  [AnalysisStatus.FINALIZING]: 7,
  [AnalysisStatus.COMPLETED]: 8,
  [AnalysisStatus.ERROR]: -1,
  [AnalysisStatus.INVALID_URL]: -1,
  [AnalysisStatus.TIMEOUT]: -1,
  [AnalysisStatus.CANCELLED]: -1
};
