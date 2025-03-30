import React from 'react';
import { Link } from 'react-router-dom';
import { AnalysisStatus, errorMessagesByStatus, isErrorStatus } from '@/lib/status';
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface StatusErrorProps {
  /**
   * The current status of the analysis
   */
  status: AnalysisStatus;
  
  /**
   * Custom error message (optional)
   */
  errorMessage?: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Whether to show a "Try Again" button
   */
  showRetryButton?: boolean;
}

/**
 * A component that displays an error message for error statuses
 */
const StatusError: React.FC<StatusErrorProps> = ({
  status,
  errorMessage,
  className = '',
  showRetryButton = true
}) => {
  // Only show for error statuses
  if (!isErrorStatus(status)) {
    return null;
  }
  
  // Use generic user-friendly messages instead of raw error details
  const getFriendlyErrorMessage = () => {
    switch (status) {
      case AnalysisStatus.ERROR:
        return "Vores system kunne ikke analysere denne bolig. Prøv igen senere eller med en anden boligannonce.";
      case AnalysisStatus.TIMEOUT:
        return "Analysen tog for længe at udføre. Prøv igen senere når vores system er mindre belastet.";
      case AnalysisStatus.CANCELLED:
        return "Analysen blev annulleret. Dette kan skyldes vedligeholdelse eller andre system-relaterede årsager.";
      case AnalysisStatus.INVALID_URL:
        return "Det angivne link er ugyldigt eller understøttes ikke. Prøv et boligopslag fra en af vores understøttede boligportaler.";
      default:
        return "Der opstod en fejl under behandlingen af boliganalysen.";
    }
  }
  
  // Get friendly message (ignore raw error details from backend)
  const friendlyMessage = getFriendlyErrorMessage();
  
  // In development mode, we can log the actual error for debugging
  if (process.env.NODE_ENV === 'development' && errorMessage) {
    console.error('Backend error details:', errorMessage);
  }
  
  return (
    <div className={`text-sm text-red-500 mt-4 p-3 bg-red-50 rounded-md ${className}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">
            {status === AnalysisStatus.ERROR && "Der opstod en fejl under analysen"}
            {status === AnalysisStatus.TIMEOUT && "Analysen tog for lang tid"}
            {status === AnalysisStatus.CANCELLED && "Analysen blev annulleret"}
            {status === AnalysisStatus.INVALID_URL && "Ugyldigt link"}
          </p>
          <p className="mt-1">{friendlyMessage}</p>
          
          {showRetryButton && (
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/">Prøv igen med en ny bolig</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusError;