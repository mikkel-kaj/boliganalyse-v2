import React from 'react';
import { AnalysisStatus, analysisStatusMessages } from '@/lib/status';

interface StatusMessageProps {
  /**
   * The current status of the analysis
   */
  status: AnalysisStatus;
  
  /**
   * Override the default message (optional)
   */
  message?: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Custom rendering function (optional)
   */
  render?: (message: string, status: AnalysisStatus) => React.ReactNode;
}

/**
 * A component that displays a message for the current status
 */
const StatusMessage: React.FC<StatusMessageProps> = ({
  status,
  message,
  className = '',
  render
}) => {
  // Use provided message or get from status map
  const displayMessage = message || analysisStatusMessages[status] || '';
  
  // If a custom render function is provided, use it
  if (render) {
    return <>{render(displayMessage, status)}</>;
  }
  
  // Default rendering
  return (
    <div className={`text-center ${className}`}>
      <p className="font-medium">{displayMessage}</p>
    </div>
  );
};

export default StatusMessage;