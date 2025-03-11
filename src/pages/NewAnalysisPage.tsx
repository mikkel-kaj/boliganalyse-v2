
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Search, Loader2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

const NewAnalysisPage = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [listingId, setListingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Effect to poll for updates if we're analyzing a listing
  useEffect(() => {
    if (!listingId || !isAnalyzing) return;
    
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('status, id')
        .eq('id', listingId)
        .single();
      
      if (error) {
        console.error("Error polling for status updates:", error);
        return;
      }
      
      setAnalyzingStatus(data.status);
      
      if (data.status === 'completed') {
        clearInterval(interval);
        setIsAnalyzing(false);
        toast({
          title: "Analyse fuldført",
          description: "Boliganalysen er nu klar.",
        });
        navigate(`/analyse/${listingId}`);
      } else if (data.status === 'error') {
        clearInterval(interval);
        setIsAnalyzing(false);
        toast({
          title: "Fejl ved analyse",
          description: "Der opstod en fejl under analysen. Prøv igen senere.",
          variant: "destructive"
        });
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }, [listingId, isAnalyzing, navigate, toast]);

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
    setAnalyzingStatus('starter');

    try {
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
        navigate(`/analyse/${data.listing.id}`);
        setIsAnalyzing(false);
      } else {
        setListingId(data.listing.id);
        setAnalyzingStatus(data.listing.status);
        toast({
          title: "Analyse startet",
          description: "Vi er ved at analysere boligannoncen. Dette kan tage op til 30 sekunder.",
        });
      }
    } catch (err) {
      console.error("Error during analysis:", err);
      toast({
        title: "Fejl ved analyse",
        description: "Der opstod en fejl under analysen af boligen. Prøv igen senere.",
        variant: "destructive"
      });
      setIsAnalyzing(false);
    }
  };

  // Render status message based on current status
  const renderStatusMessage = () => {
    switch (analyzingStatus) {
      case 'fetching':
        return 'Indlæser boligdetaljer...';
      case 'analyzing':
        return 'Analyserer boligdata med AI...';
      case 'completed':
        return 'Analyse fuldført!';
      default:
        return 'Forbereder analyse...';
    }
  };

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Home className="h-12 w-12 mx-auto mb-4 text-purple" />
          <h1 className="text-3xl font-bold mb-2">Ny boliganalyse</h1>
          <p className="text-muted-foreground">
            Indsæt link til en boligannonce, og lad vores AI analysere den for dig
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
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
                    <span>{renderStatusMessage()}</span>
                  </>
                ) : (
                  <>
                    <span>Analyser bolig</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isAnalyzing && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      analyzingStatus === 'fetching' ? 'bg-blue-500 animate-pulse' : 
                      analyzingStatus === 'analyzing' ? 'bg-purple animate-pulse' : 
                      analyzingStatus === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm font-medium">{renderStatusMessage()}</span>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple transition-all duration-500"
                    style={{ 
                      width: analyzingStatus === 'fetching' ? '33%' :
                             analyzingStatus === 'analyzing' ? '66%' :
                             analyzingStatus === 'completed' ? '100%' : '0%' 
                    }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Vi bruger kunstig intelligens til at analysere boligen. Dette kan tage op til 30 sekunder.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-12">
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
