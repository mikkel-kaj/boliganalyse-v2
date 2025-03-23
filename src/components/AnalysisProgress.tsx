import React from 'react';
import { AlertTriangle } from "lucide-react";
import { AnalysisStatus, isErrorStatus } from '@/lib/status';
import { StatusMessage, StatusProgressBar } from './status';

interface AnalysisProgressProps {
  status: AnalysisStatus;
  backgroundImage?: string;
  errorMessage?: string;
  propertyImageUrl?: string;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ 
  status, 
  backgroundImage,
  errorMessage,
  propertyImageUrl
}) => {
  const isError = isErrorStatus(status);
  
  // Use property image if available, fallback to background image or default
  const imageUrl = propertyImageUrl || backgroundImage || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";
  
  // Show toast for error but use friendly message instead of raw error
  React.useEffect(() => {
    if (isError) {
      // Log the actual error in development mode only
      if (process.env.NODE_ENV === 'development' && errorMessage) {
        console.error('Backend error:', errorMessage);
      }

      // User-friendly error message based on status
      const friendlyMessage = (() => {
        switch (status) {
          case AnalysisStatus.ERROR:
            return "Vi kunne ikke analysere denne bolig. Prøv igen med en anden boligannonce.";
          case AnalysisStatus.TIMEOUT:
            return "Analysen tog for lang tid at fuldføre. Prøv igen senere.";
          case AnalysisStatus.CANCELLED:
            return "Analysen blev annulleret.";
          case AnalysisStatus.INVALID_URL:
            return "Den angivne URL er ikke gyldig eller understøttes ikke.";
          default:
            return "Der opstod en uventet fejl under analysen.";
        }
      })();
    }
  }, [isError, status]);

  return (
    <div className="relative min-h-[400px] flex items-center justify-center">
      <div className="absolute inset-0">
        <div
            className="absolute inset-0 bg-cover bg-center blur-sm"
            style={{
              backgroundImage: `url(${imageUrl})`,
              filter: 'brightness(0.7) blur(4px)'
            }}
        />
      </div>
      <div className="relative z-10 text-center">
        {isError ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        ) : (
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-purple animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        )}
        
        <StatusMessage 
          status={status} 
          className="text-xl font-semibold mb-2"
        />
        
        <StatusProgressBar 
          status={status} 
          className="mx-auto"
        />
      </div>
    </div>
  );
};

export default AnalysisProgress;