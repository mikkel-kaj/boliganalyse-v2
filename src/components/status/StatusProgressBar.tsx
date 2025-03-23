import React from 'react';
import { AnalysisStatus, calculateProgress, getProgressBarClasses } from '@/lib/status';

interface StatusProgressBarProps {
  /**
   * The current status of the analysis
   */
  status: AnalysisStatus;
  
  /**
   * Override the calculated progress percentage (optional)
   */
  progress?: number;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Width of the progress bar
   */
  width?: string;
}

/**
 * A component that displays a progress bar for the current status
 */
const StatusProgressBar: React.FC<StatusProgressBarProps> = ({
  status,
  progress,
  className = '',
  width = 'w-48'
}) => {
  // Use provided progress or calculate from status
  const progressPercentage = progress !== undefined 
    ? progress 
    : calculateProgress(status);
  
  // Get appropriate classes based on status
  const barClasses = getProgressBarClasses(status);
  
  return (
    <div className={`${width} h-2 bg-muted rounded-full overflow-hidden ${className}`}>
      <div
        className={barClasses}
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  );
};

export default StatusProgressBar;