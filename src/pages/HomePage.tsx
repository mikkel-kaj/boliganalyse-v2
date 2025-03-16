import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import { validateBoligsideUrl } from '../utils/validators';
import { RiskIcon, HighlightIcon } from '@/components/IconMapper';
import SEO from '@/components/SEO';
import { ListingPreview } from '@/components/ListingPreview';

const HomePage = () => {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [listingId, setListingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // SEO schema for homepage
  const homePageSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Boliganalyse.ai",
    "url": "https://boliganalyse.ai",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://boliganalyse.ai?url={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const { data: recentListings } = useQuery({
    queryKey: ['recent-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .eq('status', 'Analyse fuldført')
        .limit(8);
      
      if (error) throw error;
      return data;
    }
  });

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
    }, 2000);
    
    return () => clearInterval(interval);
  }, [listingId, isAnalyzing, navigate, toast]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate URL
    const validation = validateBoligsideUrl(url);
    if (!validation.valid) {
      setUrlError(validation.error || "Ugyldig URL");
      toast({
        title: "Ugyldig URL",
        description: validation.error || "URL'en ser ikke ud til at være en gyldig Boligsiden URL.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

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
      } else {
        toast({
          title: "Analyse startet",
          description: "Vi er ved at analysere boligannoncen.",
        });
        navigate(`/analyse/${data.listing.id}`);
      }
      
      setIsAnalyzing(false);
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

  const renderStatusMessage = () => {
    switch (analyzingStatus) {
      case 'fetching':
        return 'Indlæser boligdetaljer...';
      case 'analyzing':
        return 'Analyserer boligdata...';
      case 'completed':
        return 'Analyse fuldført!';
      default:
        return 'Forbereder analyse...';
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col">
      <SEO schema={homePageSchema} />
      <main className="flex-1">
        <section className="py-8 sm:py-16 md:py-24 lg:py-32 container text-center px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-block mb-4 sm:mb-6 px-4 py-1.5 bg-secondary rounded-full">
              <span className="text-sm font-medium">AI til boligkøb</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Undgå overraskelser<br className="hidden sm:block" /> når du køber bolig
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-10 max-w-2xl mx-auto px-4 sm:px-0">
              AI-analyse af bolig som afslører skjulte
              risikofaktorer og spørgsmål du bør stille på visning.
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
                <span className="text-purple text-sm">❤️</span>
                <span className="text-xs sm:text-sm font-medium">Nu med støtte til nybyggeri og fritidsboliger!</span>
              </div>
            </div>
            
            <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row max-w-lg mx-auto gap-3 px-4 sm:px-0">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                  Bolig-annonce
                </div>
                <Input 
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setUrlError(null);
                  }}
                  className={`pl-28 h-12 text-base sm:text-sm ${urlError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Indsæt link til boligannonce..."
                  disabled={isAnalyzing}
                />
              </div>
              <Button 
                type="submit" 
                className="bg-purple hover:bg-purple-dark h-12 px-6 w-full sm:w-auto"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-base sm:text-sm">{renderStatusMessage()}</span>
                  </>
                ) : (
                  <>
                    <span className="text-base sm:text-sm">Analyser bolig</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
            
            {urlError && (
              <p className="text-xs text-red-500 mt-2">
                {urlError}
              </p>
            )}
            
            <p className="text-xs text-muted-foreground mt-4 max-w-2xl mx-auto">
              Indsæt en URL fra <strong>Boligsiden</strong> - f.eks. https://www.boligsiden.dk/adresse/kapelvej-27-3700-roenne
              <br />
              Boliganalyse.ai er et støtteværktøj til boligkøb, men erstatter ikke professionel rådgivning. 
              Alle beslutninger bør baseres på egen research og besigtigelse - vi tager ikke ansvar for eventuelle fejl i analysen.
            </p>
          </div>
        </section>
        
        {recentListings && recentListings.length > 0 && (
          <section className="py-6 sm:py-8 md:py-12 container px-2 sm:px-4 md:px-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 text-center">
              Nyligt analyserede boliger
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
              {recentListings.map((listing) => (
                <ListingPreview key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}
      </main>
      
      <footer className="py-6 border-t border-border mt-auto">
        <div className="container px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2024 Boliganalyse.ai</p>
            <div className="flex items-center gap-6 sm:gap-4">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Kontakt os</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Om os</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Vilkår</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
