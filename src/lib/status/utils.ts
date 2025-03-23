import {AnalysisStatus, PROCESSING_ORDER, STATUS_GROUPS, StatusGroup} from './types';

/**
 * Check if a status belongs to a specific status group
 */
export function isInStatusGroup(status: AnalysisStatus, group: StatusGroup): boolean {
  return STATUS_GROUPS[status] === group;
}

/**
 * Check if a status is a terminal state that requires no further processing
 */
export function isTerminalStatus(status: AnalysisStatus): boolean {
  return isInStatusGroup(status, StatusGroup.TERMINAL) || isInStatusGroup(status, StatusGroup.ERROR);
}

/**
 * Check if a status is an active processing state
 */
export function isProcessingStatus(status: AnalysisStatus): boolean {
  return isInStatusGroup(status, StatusGroup.PROCESSING);
}

/**
 * Check if a status is an error state
 */
export function isErrorStatus(status: AnalysisStatus): boolean {
  return isInStatusGroup(status, StatusGroup.ERROR);
}

/**
 * Calculate progress percentage based on status
 */
export function calculateProgress(status: AnalysisStatus): number {
  const order = PROCESSING_ORDER[status];
  
  // Error states have no progress
  if (order < 0) return 0;
  
  // Calculate percentage based on position in workflow
  const maxSteps = PROCESSING_ORDER[AnalysisStatus.COMPLETED];
  return Math.floor((order / maxSteps) * 100);
}

/**
 * Safely convert a string status to enum value
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
}