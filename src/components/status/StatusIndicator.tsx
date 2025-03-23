import React from 'react';
import { AnalysisStatus, getStatusIndicatorClasses } from '@/lib/status';

interface StatusIndicatorProps {
  /**
   * The current status of the analysis
   */
  currentStatus: AnalysisStatus;
  
  /**
   * The target status to visualize (represents a step in the process)
   */
  targetStatus: AnalysisStatus;
  
  /**
   * Label to display next to the indicator
   */
  label: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * A component that displays a step indicator for a given status
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  currentStatus,
  targetStatus,
  label,
  className = ''
}) => {
  const indicatorClasses = getStatusIndicatorClasses(currentStatus, targetStatus);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={indicatorClasses} />
      <span>{label}</span>
    </div>
  );
};

export default StatusIndicator;