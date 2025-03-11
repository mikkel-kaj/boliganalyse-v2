
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NewAnalysisPage = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "Angiv venligst URL",
        description: "Du skal indsætte et link til en boligannonce for at fortsætte.",
        variant: "destructive"
      });
      return;
    }

    // Basic validation to check if URL contains bolig or ejendom
    if (!url.includes('bolig') && !url.includes('ejendom')) {
      toast({
        title: "Ugyldig URL",
        description: "URL'en ser ikke ud til at være en boligliste. Kontroller og prøv igen.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Call our Supabase Edge Function to analyze the apartment listing
      const { data, error } = await supabase.functions.invoke('analyze-apartment', {
        body: { url }
      });

      if (error) {
        console.error("Error calling analyze-apartment function:", error);
        toast({
          title: "Fejl ved analyse",
          description: "Der opstod en fejl under analysen af boligen. Prøv igen senere.",
          variant: "destructive"
        });
        setIsAnalyzing(false);
        return;
      }

      console.log("Analysis response:", data);

      if (data.isExisting) {
        toast({
          title: "Eksisterende analyse fundet",
          description: "Vi har allerede analyseret denne bolig.",
        });
      } else {
        toast({
          title: "Analyse startet",
          description: "Vi er ved at analysere boligannoncen. Dette kan tage op til 30 sekunder.",
        });
      }

      // In both cases, navigate to the analysis page
      // For now, we'll navigate to the demo page, but in a real implementation
      // we would use the actual listing ID
      navigate('/analyse/demo');
    } catch (err) {
      console.error("Error during analysis:", err);
      toast({
        title: "Fejl ved analyse",
        description: "Der opstod en fejl under analysen af boligen. Prøv igen senere.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Ny analyse</h1>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Indtast boligannonce</h2>
          
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Indsæt link til boligannonce
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="f.eks. https://www.boligsiden.dk/adresse/..."
                  className="pl-10"
                  disabled={isAnalyzing}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Du kan indsætte URL'en fra salgsopslaget på Boligsiden, Home, EDC, danbolig osv.
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-purple hover:bg-purple-dark"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Analyserer...</span>
                </>
              ) : (
                <>
                  <span>Analyser bolig</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              Vi henter og analyserer boligdata fra annoncen ved hjælp af kunstig intelligens.
              Analysen tager normalt under 30 sekunder.
            </p>
          </form>
        </div>
        
        <div className="mt-8">
          <h2 className="text-lg font-medium mb-4">Sådan virker det</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                1
              </div>
              <h3 className="font-medium mb-2">Indsæt link</h3>
              <p className="text-sm text-muted-foreground">
                Kopier linket fra boligannoncen og indsæt det ovenfor
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                2
              </div>
              <h3 className="font-medium mb-2">AI-analyse</h3>
              <p className="text-sm text-muted-foreground">
                Vores AI gennemgår alle detaljer i boligannoncen
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                3
              </div>
              <h3 className="font-medium mb-2">Få resultatet</h3>
              <p className="text-sm text-muted-foreground">
                Se risikofaktorer og højdepunkter for boligen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAnalysisPage;
