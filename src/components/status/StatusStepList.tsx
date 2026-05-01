import React from 'react';
import { AnalysisStatus } from '@/lib/status';
import StatusIndicator from './StatusIndicator';

interface Step {
  status: AnalysisStatus;
  label: string;
}

interface StatusStepListProps {
  /**
   * The current status of the analysis
   */
  currentStatus: AnalysisStatus;
  
  /**
   * The steps to display (optional, defaults to standard workflow)
   */
  steps?: Step[];
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * A component that displays a list of steps for the entire analysis process
 */
const StatusStepList: React.FC<StatusStepListProps> = ({
  currentStatus,
  steps,
  className = ''
}) => {
  // Default steps if not provided
  const defaultSteps: Step[] = [
    { status: AnalysisStatus.QUEUED, label: 'Forberedelse af analyse' },
    { status: AnalysisStatus.FETCHING_HTML, label: 'Indsamling af data fra boligannoncen' },
    { status: AnalysisStatus.PARSING_DATA, label: 'Indledende analyse af boligen' },
    { status: AnalysisStatus.AWAITING_DOCUMENTS, label: 'Henter dokumenter fra mægler' },
    { status: AnalysisStatus.PREPARING_ANALYSIS, label: 'Identifikation af nøgleinformation' },
    { status: AnalysisStatus.ANALYZING, label: 'AI-vurdering af risici og højdepunkter' },
    { status: AnalysisStatus.COMPLETED, label: 'Færdiggørelse af analysen' }
  ];
  
  const displaySteps = steps || defaultSteps;
  
  return (
    <ul className={`space-y-2 ${className}`}>
      {displaySteps.map((step) => (
        <li key={step.status}>
          <StatusIndicator
            currentStatus={currentStatus}
            targetStatus={step.status}
            label={step.label}
          />
        </li>
      ))}
    </ul>
  );
};

export default StatusStepList;