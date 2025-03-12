
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from '@/components/ui/use-toast';

// Map database status values to user-friendly Danish messages
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
    <div className="relative w-full h-[400px] mb-6 overflow-hidden rounded-lg">
      {/* Property image with blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-sm"
        style={{ 
          backgroundImage: `url(${imageUrl})`,
          filter: 'brightness(0.7) blur(4px)'
        }}
      />
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Property image (non-blurred) in the center if available */}
      {propertyImageUrl && (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full flex items-center justify-center p-6 z-10">
          <div className="relative max-w-[250px] max-h-[200px] rounded-lg overflow-hidden shadow-xl">
            <img 
              src={propertyImageUrl}
              alt="Bolig billede"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
        {isError ? (
          <AlertTriangle className="h-12 w-12 text-red-500 mb-6" />
        ) : (
          <Loader2 className="h-12 w-12 animate-spin mb-6" />
        )}
        
        <h2 className="text-2xl font-bold text-center mb-2">{message}</h2>
        
        {isError && errorMessage ? (
          <p className="text-sm text-center mb-6 max-w-md text-red-300">
            {errorMessage}
          </p>
        ) : (
          <p className="text-sm text-center mb-6 max-w-md">
            {isError 
              ? "Der opstod desværre en fejl under analysen. Prøv igen senere eller kontakt kundeservice."
              : "Vi analyserer boligen grundigt. Dette kan tage op til 30 sekunder."}
          </p>
        )}
        
        {/* Progress bar */}
        <div className="w-full max-w-md h-2 bg-white/30 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${isError ? 'bg-red-500' : 'bg-purple'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-xs mt-2 text-white/80">
          {Math.round(progress)}% gennemført
        </p>
      </div>
    </div>
  );
};

export default AnalysisProgress;
