import React from 'react';
import { Button } from "@/components/ui/button";
import { Brain, Cloud } from "lucide-react";

const DetailedCommercial: React.FC = () => {
  return (
    <div className="pt-2 border-t border-border">
      <div className="bg-card rounded-lg p-2 relative overflow-hidden">
        {/* Reklame banner */}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Reklame
          </span>
        
        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <span>Brug for en konsulent i AI og Cloud?</span>
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <img 
              src="https://www.mikkelkajandersen.dk/img/profile_pic.jpg" 
              alt="Mikkel Kaj Andersen" 
              className="w-14 h-14 rounded-full object-cover"
            />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Mikkel Kaj Andersen</h3>
              <p className="text-sm text-primary">AI • Cloud • Full Stack</p>
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">10+ års erfaring</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            For det første - tak fordi du bruger sitet - jeg håber du fik gavn af din analyse.
            Det er mig, som står bag - Mikkel Kaj Andersen - og jeg er konsulent indenfor avancerede AI-løsninger, herunder custom LLM implementeringer, optimeringsalgoritmer og full stack / cloud udvikling. <br></br><br></br>Tag gerne et kig, hvis du har brug for en konsulent i AI og Cloud.
          </p>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-transparent hover:bg-accent border-border" 
              asChild
            >
              <a href="https://www.mikkelkajandersen.dk/" target="_blank" rel="noopener noreferrer">
                Læs mere
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedCommercial; 