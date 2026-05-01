import { AnalysisStatus } from './types';

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
  [AnalysisStatus.INVALID_URL]: "Ugyldigt link",
  [AnalysisStatus.TIMEOUT]: "Analysen tog for lang tid",
  [AnalysisStatus.CANCELLED]: "Analysen blev annulleret"
};

/**
 * Map of status to user-friendly error messages
 */
export const errorMessagesByStatus: {
  [AnalysisStatus.INVALID_URL]: string;
  [AnalysisStatus.CANCELLED]: string;
  [AnalysisStatus.ERROR]: string;
  [AnalysisStatus.TIMEOUT]: string
} = {
  [AnalysisStatus.ERROR]: "Der opstod en uventet fejl under analysen. Prøv igen eller kontakt support hvis problemet fortsætter.",
  [AnalysisStatus.INVALID_URL]: "Det angivne link er ugyldigt eller understøttes ikke. Prøv et andet boligopslag fra en understøttet boligportal.",
  [AnalysisStatus.TIMEOUT]: "Analysen tog for lang tid at fuldføre. Prøv venligst igen senere, da systemet kan være overbelastet.",
  [AnalysisStatus.CANCELLED]: "Analysen blev annulleret. Dette kan skyldes vedligeholdelse eller andre systemrelaterede årsager.",
};

/**
 * Determine the CSS classes for a status indicator based on the status
 */
export function getStatusIndicatorClasses(currentStatus: AnalysisStatus, targetStatus: AnalysisStatus): string {
  // Determine status order for visual progression
  const statusOrder = {
    [AnalysisStatus.PENDING]: 0,
    [AnalysisStatus.QUEUED]: 1,
    [AnalysisStatus.FETCHING_HTML]: 2,
    [AnalysisStatus.PARSING_DATA]: 3,
    [AnalysisStatus.AWAITING_DOCUMENTS]: 4,
    [AnalysisStatus.PREPARING_ANALYSIS]: 5,
    [AnalysisStatus.ANALYZING]: 6,
    [AnalysisStatus.GENERATING_INSIGHTS]: 7,
    [AnalysisStatus.FINALIZING]: 8,
    [AnalysisStatus.COMPLETED]: 9
  };

  // Base class for all indicators
  let classes = "h-2 w-2 rounded-full ";

  // Error states show red indicators
  if ([AnalysisStatus.ERROR, AnalysisStatus.INVALID_URL, AnalysisStatus.TIMEOUT, AnalysisStatus.CANCELLED].includes(currentStatus)) {
    return classes + "bg-red-500";
  }

  // Current active status shows purple animated indicator
  if (currentStatus === targetStatus) {
    return classes + "bg-purple animate-pulse";
  }

  // Completed steps show green
  if (statusOrder[currentStatus] >= statusOrder[targetStatus]) {
    return classes + "bg-green-500";
  }

  // Future steps show gray
  return classes + "bg-gray-300";
}

/**
 * Get appropriate progress bar classes based on status
 */
export function getProgressBarClasses(status: AnalysisStatus): string {
  // Base class for all progress bars
  let classes = "h-full transition-all duration-500 ";
  
  // Error states show red
  if ([AnalysisStatus.ERROR, AnalysisStatus.INVALID_URL, AnalysisStatus.TIMEOUT, AnalysisStatus.CANCELLED].includes(status)) {
    return classes + "bg-red-500";
  }
  
  // Normal states show purple
  return classes + "bg-purple";
}
