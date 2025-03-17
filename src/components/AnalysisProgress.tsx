import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from '@/components/ui/use-toast';
import { ImagePlaceholder } from './ImagePlaceholder';

const statusMessages: Record<string, { message: string, progress: number, isError?: boolean }> = {
  "Starter analyse": { message: "Forbereder analyse...", progress: 5 },
  "Søger efter salgsopslag": { message: "Finder boligannoncen...", progress: 20 },
  "Opslag fundet!": { message: "Boligannonce fundet!", progress: 40 },
  "Første fase analyse gennemført": { message: "Første analyse gennemført...", progress: 50 },
  "Leder efter fejl og mangler..": { message: "Analyserer boligdetaljer...", progress: 70 },
  "Analyse fuldført": { message: "Analyse fuldført!", progress: 100 },
  "Fejl": { message: "Der opstod en fejl under analysen", progress: 100, isError: true },
};

interface AnalysisProgressProps {
  status: string;
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
  const { message, progress, isError } = statusMessages[status] || 
    { message: "Analyserer bolig...", progress: 50 };
  
  // Use property image if available, fallback to background image or default
  const imageUrl = propertyImageUrl || backgroundImage || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";
  
  // Show toast for error if we have an error message and error status
  React.useEffect(() => {
    if (isError && errorMessage) {
      toast({
        title: "Der opstod en fejl",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [isError, errorMessage]);

  return (
    <div className="relative min-h-[400px] flex items-center justify-center">
      <div className="absolute inset-0">
        <ImagePlaceholder
          alt="Analyse i gang"
          className="w-full h-full"
        />
      </div>
      <div className="relative z-10 text-center">
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
        <h2 className="text-xl font-semibold mb-2">{message}</h2>
        {progress !== undefined && (
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisProgress;
