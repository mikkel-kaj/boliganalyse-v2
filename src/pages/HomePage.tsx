
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

const HomePage = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [listingId, setListingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: recentListings } = useQuery({
    queryKey: ['recent-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);
      
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
    
    if (!url.trim()) {
      toast({
        title: "Angiv venligst URL",
        description: "Du skal indsætte et link til en boligannonce for at fortsætte.",
        variant: "destructive"
      });
      return;
    }

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
      <main className="flex-1">
        <section className="py-16 md:py-24 lg:py-32 container text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-block mb-6 px-4 py-1.5 bg-secondary rounded-full">
              <span className="text-sm font-medium">AI til boligkøb</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Undgå overraskelser<br />når du køber bolig
            </h1>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              AI-analyse af bolig som afslører skjulte
              risikofaktorer og spørgsmål du bør stille på visning.
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
                <span className="text-purple text-sm">❤️</span>
                <span className="text-sm font-medium">Nu med støtte til nybyggeri og fritidsboliger!</span>
              </div>
            </div>
            
            <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row max-w-lg mx-auto gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                  Bolig-annonce
                </div>
                <Input 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-28 h-12"
                  placeholder="Indsæt link til boligannonce..."
                  disabled={isAnalyzing}
                />
              </div>
              <Button 
                type="submit" 
                className="bg-purple hover:bg-purple-dark h-12 px-6"
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
            
            <p className="text-xs text-muted-foreground mt-4 max-w-2xl mx-auto">
              Boliganalyse.ai er et støtteværktøj til boligkøb, men erstatter ikke professionel rådgivning. 
              Alle beslutninger bør baseres på egen research og besigtigelse - vi tager ikke ansvar for eventuelle fejl i analysen.
            </p>
          </div>
        </section>
        
        {recentListings && recentListings.length > 0 && (
          <section className="py-12 md:py-16 container">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Nyligt analyserede boliger</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentListings.map((listing) => {
                const analysis = listing.analysis as any;
                if (!analysis?.property) return null;

                // Use property_image_url if available, otherwise fallback
                let imageUrl = '/placeholder.svg';
                if (listing.property_image_url) {
                  imageUrl = listing.property_image_url;
                }

                return (
                  <Link
                    key={listing.id}
                    to={`/analyse/${listing.id}`}
                    className="property-card bg-card rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all"
                  >
                    <div className="relative">
                      <img 
                        src={imageUrl} 
                        alt={analysis.property.address} 
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                        {new Date(listing.created_at).toLocaleDateString('da-DK')}
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-medium mb-1">{analysis.property.address}</h3>
                      <p className="text-lg font-bold mb-2">{analysis.property.price}</p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                        <span>{analysis.property.size}</span>
                      </div>
                      
                      {analysis.risks && analysis.risks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">RISIKOFAKTORER</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.risks.slice(0, 2).map((risk: any, idx: number) => (
                              <span key={idx} className="risk-badge bg-risk-default">
                                {risk.icon || '⚠️'} {risk.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {analysis.highlights && analysis.highlights.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">HØJDEPUNKTER</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.highlights.slice(0, 2).map((highlight: any, idx: number) => (
                              <span key={idx} className="highlight-badge bg-highlight-default/20 text-highlight-default">
                                {highlight.icon || '✨'} {highlight.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
      
      <footer className="py-6 border-t border-border">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2024 Boliganalyse.ai</p>
            <div className="flex items-center gap-4">
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
