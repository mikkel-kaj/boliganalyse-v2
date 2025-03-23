import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import { validateListingUrl } from '../utils/validators';
import { RiskIcon, HighlightIcon } from '@/components/IconMapper';
import SEO from '@/components/SEO';
import { ListingPreview } from '@/components/ListingPreview';
import { AnalysisStatus, analysisStatusMessages, statusFromString } from '@/types/status';

const HomePage = () => {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.PENDING);
  const [listingId, setListingId] = useState<string | null>(null);
  const navigate = useNavigate();

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
        .from('client_apartment_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .eq('status', AnalysisStatus.COMPLETED)
        .limit(20);
      
      if (error) throw error;
      
      // Filter out listings missing property data
      if (!data) return [];
      
      const validListings = data.filter(listing => 
        listing?.analysis?.property?.address
      );
      
      return validListings.slice(0, 8);
    }
  });

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate URL
    const validation = validateListingUrl(url);
    if (!validation.valid) {
      setUrlError(validation.error || "Ugyldig URL");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus(AnalysisStatus.QUEUED);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-apartment', {
        body: { url }
      });

      if (error) {
        console.error("Error calling analyze-apartment function:", error);
        setIsAnalyzing(false);
        setAnalysisStatus(AnalysisStatus.ERROR);
        return;
      }

      console.log("Analysis response:", data);
      setListingId(data.listing.id);

      if (data.isExisting) {
        navigate(`/analyse/${data.listing.id}`);
        setIsAnalyzing(false);
      } else {
        // Keep isAnalyzing true to continue polling for updates
        navigate(`/analyse/${data.listing.id}`);
      }
    } catch (err) {
      console.error("Error during analysis:", err);
      setIsAnalyzing(false);
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  };

  const renderStatusMessage = () => {
    return analysisStatusMessages[analysisStatus] || "Forbereder analyse...";
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col">
      <SEO schema={homePageSchema} />
      <main className="flex-1">
        <section className="mt-12 container text-center px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-block mb-4 sm:mb-6 px-4 py-1.5 bg-secondary rounded-full">
              <span className="text-sm font-medium">AI til boligkøb</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Undgå overraskelser<br className="hidden sm:block" /> når du køber bolig
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-10 max-w-2xl mx-auto px-4 sm:px-0">
              AI-analyse af bolig som afslører skjulte
              risikofaktorer og spørgsmål du bør stille til fremvisning.
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
            
            <div className="mt-8 max-w-2xl mx-auto px-5 sm:px-0">
              {/* URL example and supported sites */}
              <div className="bg-secondary/20 rounded-lg p-4 mb-4">
                <div className="flex items-start sm:items-center mb-2">
                  <CheckCircle2 className="text-green-600 w-5 h-5 mt-0.5 sm:mt-0 mr-2 flex-shrink-0" />
                  <h4 className="font-medium text-sm">Understøtter alle større danske ejendomsmæglere</h4>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground ml-7">
                  <p className="mb-2">
                    Indsæt en URL fra f.eks. Boligsiden, Home, EDC, Nybolig, DanBolig, eller andre danske mæglere
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs opacity-80 font-mono">
                    <code className="bg-background rounded p-2 truncate">
                      https://boligsiden.dk/adresse/kapelvej-27?udbud=123456
                    </code>
                    <code className="bg-background rounded p-2 truncate">
                      https://home.dk/...
                    </code>
                  </div>
                </div>
              </div>
              
              {/* Disclaimer */}
              <div className="text-xs sm:text-sm text-muted-foreground bg-secondary/10 p-4 rounded-lg">
                <strong className="font-medium">Bemærk:</strong> Boliganalyse.ai er et støtteværktøj til boligkøb, men erstatter ikke professionel rådgivning. 
                Alle beslutninger bør baseres på egen research og besigtigelse - vi tager ikke ansvar for eventuelle fejl i analysen.
              </div>
            </div>
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
      
      <footer className="border-t border-border mt-auto">
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
