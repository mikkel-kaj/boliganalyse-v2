import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Map database status values to user-friendly Danish messages
const statusMessages: Record<string, { message: string, progress: number }> = {
  "Starter analyse": { message: "Forbereder analyse...", progress: 5 },
  "Søger efter salgsopslag": { message: "Finder boligannoncen...", progress: 20 },
  "Opslag fundet!": { message: "Boligannonce fundet!", progress: 40 },
  "Første fase analyse gennemført": { message: "Første analyse gennemført...", progress: 50 },
  "Leder efter fejl og mangler..": { message: "Analyserer boligdetaljer...", progress: 70 },
  "Analyse fuldført": { message: "Analyse fuldført!", progress: 100 },
  "Fejl": { message: "Der opstod en fejl under analysen", progress: 100 },
};

interface AnalysisProgressProps {
  status: string;
  backgroundImage?: string;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ status, backgroundImage }) => {
  const { message, progress } = statusMessages[status] || 
    { message: "Analyserer bolig...", progress: 50 };
  
  const defaultImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";
  
  return (
    <div className="relative w-full h-[400px] mb-6 overflow-hidden rounded-lg">
      {/* Background image with blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-sm"
        style={{ 
          backgroundImage: `url(${backgroundImage || defaultImage})`,
          filter: 'brightness(0.7) blur(4px)'
        }}
      />
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="h-12 w-12 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-center mb-2">{message}</h2>
        <p className="text-sm text-center mb-6 max-w-md">
          Vi analyserer boligen grundigt. Dette kan tage op til 30 sekunder.
        </p>
        
        {/* Progress bar */}
        <div className="w-full max-w-md h-2 bg-white/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple transition-all duration-500 ease-out"
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
