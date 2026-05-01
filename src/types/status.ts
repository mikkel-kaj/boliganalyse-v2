/**
 * Standardized analysis status values used throughout the application
 * IMPORTANT: These must match exactly with backend status values
 */
export enum AnalysisStatus {
  // Initial states
  PENDING = "pending",                   // Initial status when created but not yet started
  QUEUED = "queued",                     // Analysis is queued for processing
  
  // Processing states (granular updates)
  FETCHING_HTML = "fetching_html",       // Fetching the HTML content
  PARSING_DATA = "parsing_data",         // Extracting structured data from HTML
  AWAITING_DOCUMENTS = "awaiting_documents", // Waiting on broker to email documents
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
 * Map of statuses to human-readable Danish messages for display to users
 */
export const analysisStatusMessages: Record<AnalysisStatus, string> = {
  [AnalysisStatus.PENDING]: "Venter på at starte analyse...",
  [AnalysisStatus.QUEUED]: "I kø til analyse...",
  [AnalysisStatus.FETCHING_HTML]: "Indlæser bolig-annonce...",
  [AnalysisStatus.PARSING_DATA]: "Udtrækker boligdata...",
  [AnalysisStatus.AWAITING_DOCUMENTS]: "Henter dokumenter fra mægler (~30 sek)",
  [AnalysisStatus.PREPARING_ANALYSIS]: "Forbereder AI-analyse...",
  [AnalysisStatus.ANALYZING]: "Analyserer boligdata...",
  [AnalysisStatus.GENERATING_INSIGHTS]: "Genererer indsigter og anbefalinger...",
  [AnalysisStatus.FINALIZING]: "Færdiggør analyse...",
  [AnalysisStatus.COMPLETED]: "Analyse fuldført!",
  [AnalysisStatus.ERROR]: "Fejl under analysen",
  [AnalysisStatus.INVALID_URL]: "Ugyldig bolig-URL",
  [AnalysisStatus.TIMEOUT]: "Analysen tog for lang tid",
  [AnalysisStatus.CANCELLED]: "Analysen blev annulleret"
};

/**
 * Map of statuses to progress percentage estimations
 */
export const analysisStatusProgress: Record<AnalysisStatus, number> = {
  [AnalysisStatus.PENDING]: 0,
  [AnalysisStatus.QUEUED]: 5,
  [AnalysisStatus.FETCHING_HTML]: 10,
  [AnalysisStatus.PARSING_DATA]: 25,
  [AnalysisStatus.AWAITING_DOCUMENTS]: 35,
  [AnalysisStatus.PREPARING_ANALYSIS]: 40,
  [AnalysisStatus.ANALYZING]: 60,
  [AnalysisStatus.GENERATING_INSIGHTS]: 80,
  [AnalysisStatus.FINALIZING]: 95,
  [AnalysisStatus.COMPLETED]: 100,
  [AnalysisStatus.ERROR]: 0,
  [AnalysisStatus.INVALID_URL]: 0,
  [AnalysisStatus.TIMEOUT]: 0,
  [AnalysisStatus.CANCELLED]: 0
};

/**
 * Check if a status is a terminal state that requires no further processing
 */
export function isTerminalStatus(status: AnalysisStatus): boolean {
  return [
    AnalysisStatus.COMPLETED,
    AnalysisStatus.ERROR,
    AnalysisStatus.INVALID_URL,
    AnalysisStatus.TIMEOUT,
    AnalysisStatus.CANCELLED
  ].includes(status);
}

/**
 * Check if a status is an active processing state
 */
export function isProcessingStatus(status: AnalysisStatus): boolean {
  return [
    AnalysisStatus.FETCHING_HTML,
    AnalysisStatus.PARSING_DATA,
    AnalysisStatus.AWAITING_DOCUMENTS,
    AnalysisStatus.PREPARING_ANALYSIS,
    AnalysisStatus.ANALYZING,
    AnalysisStatus.GENERATING_INSIGHTS,
    AnalysisStatus.FINALIZING
  ].includes(status);
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
  
  // If not a direct match, try case-insensitive value match
  const statusLower = status.toLowerCase();
  const matchByValue = allStatuses.find(
    enumValue => (enumValue as string).toLowerCase() === statusLower
  );
  if (matchByValue) {
    return matchByValue;
  }
  
  // Legacy status mappings for backward compatibility
  switch (statusLower) {
    case 'fetching':
      return AnalysisStatus.FETCHING_HTML;
    case 'parsing':
    case 'extracting':
      return AnalysisStatus.PARSING_DATA;
    case 'analyzing':
      return AnalysisStatus.ANALYZING;
    case 'analyse fuldført':
      return AnalysisStatus.COMPLETED;
    case 'completed':
      return AnalysisStatus.COMPLETED;
    case 'error':
    case 'failed':
    case 'fejl':
      return AnalysisStatus.ERROR;
    case 'timeout':
    case 'timed out':
      return AnalysisStatus.TIMEOUT;
    case 'cancelled':
    case 'canceled':
    case 'annulleret':
      return AnalysisStatus.CANCELLED;
    default:
      return AnalysisStatus.PENDING;
  }
} 