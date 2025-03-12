import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AnalysisProgress from "@/components/AnalysisProgress";
import { 
  ArrowLeft, Share2, AlertTriangle, 
  Check, HelpCircle, Star, Send, ExternalLink, Loader2
} from "lucide-react";
import { getIconComponent, getCategoryIcon, RiskIcon, HighlightIcon } from "@/components/IconMapper";

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("Starter analyse");
  
  // Function to fetch listing data
  const fetchListing = async () => {
    if (!id) {
      setError("Ingen analyse-ID angivet");
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        setError("Analysen blev ikke fundet");
        setLoading(false);
        return;
      }
      
      setListing(data);
      setStatus(data.status || "Starter analyse");
      
      // If analysis is available, parse it
      if (data.analysis && 
          typeof data.analysis === 'object' && 
          'property' in data.analysis) {
        console.log("Using stored analysis from database:", data.analysis);
        
        const analysisData = data.analysis;
        
        setProperty(analysisData.property);
        
        const risksArray = Array.isArray(analysisData.risks) ? analysisData.risks : [];
        const highlightsArray = Array.isArray(analysisData.highlights) ? analysisData.highlights : [];
        
        setRisks(risksArray);
        setHighlights(highlightsArray);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching listing:", err);
      setError("Der opstod en fejl ved indlæsning af analysen");
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchListing();
  }, [id]);
  
  // Set up real-time subscription for status updates
  useEffect(() => {
    if (!id) return;
    
    const channel = supabase
      .channel('table-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'apartment_listings',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Change received!', payload);
          
          // Directly update the status without refetching the entire listing
          if (payload.new && payload.new.status) {
            console.log('New status:', payload.new.status);
            setStatus(payload.new.status);
            
            // If the analysis is completed, fetch the full listing with analysis data
            if (payload.new.status === "Analyse fuldført") {
              fetchListing();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link kopieret",
      description: "Analyselinket er kopieret til udklipsholderen.",
      duration: 3000,
    });
  };

  const handleAskQuestion = (question: string) => {
    toast({
      title: "Spørgsmål noteret",
      description: "Dette spørgsmål er tilføjet til din liste over spørgsmål at stille ejendomsmægleren.",
      duration: 3000,
    });
  };

  // Show loading spinner only for initial load
  if (loading && !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-purple" />
          <h2 className="text-xl font-medium">Indlæser analyse...</h2>
          <p className="text-muted-foreground">Det kan tage et øjeblik at hente alle detaljer.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-medium mb-2">Der opstod en fejl</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Tilbage til forsiden</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Analysis is not complete yet, show progress
  if (!property || status !== "Analyse fuldført") {
    // Try to get property address if available in the analysis
    const address = property?.address || "Boligadresse";
      
    return (
      <div className="container py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-medium">{address}</h1>
          </div>
          
          <AnalysisProgress 
            status={status} 
            propertyImageUrl={listing?.property_image_url}
          />
          
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-medium mb-4">Hvad sker der nu?</h2>
              <p className="text-muted-foreground mb-4">
                Vores AI-system arbejder på at analysere boligen. Dette inkluderer:
              </p>
              
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status !== "Starter analyse" ? 'bg-green-500' : 'bg-purple animate-pulse'}`} />
                  <span>Forberedelse af analyse</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status === "Søger efter salgsopslag" ? 'bg-purple animate-pulse' : (status === "Starter analyse" ? 'bg-gray-300' : 'bg-green-500')}`} />
                  <span>Indsamling af data fra boligannoncen</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status === "Opslag fundet!" ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`} />
                  <span>Indledende analyse af boligen</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status === "Første fase analyse gennemført" ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag", "Opslag fundet!"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`} />
                  <span>Identifikation af nøgleinformation</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status === "Leder efter fejl og mangler.." ? 'bg-purple animate-pulse' : (["Starter analyse", "Søger efter salgsopslag", "Opslag fundet!", "Første fase analyse gennemført"].includes(status) ? 'bg-gray-300' : 'bg-green-500')}`} />
                  <span>AI-vurdering af risici og højdepunkter</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${status === "Analyse fuldført" ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>Færdiggørelse af analysen</span>
                </li>
              </ul>
              
              <p className="text-sm text-muted-foreground">
                Siden opdaterer automatisk, når analysen er færdig. Du behøver ikke at genindlæse siden.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const originalUrl = listing?.url || "";
  const timeAgoDisplay = listing ? "Lige nu" : property.timeAgo || "Lige nu";
  
  // Use the property_image_url from the listing as the main image
  const mainImage = listing?.property_image_url || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";

  const risksWithIds = risks.map((risk, index) => ({
    ...risk,
    id: risk.id || `risk-${index}`,
  }));

  const highlightsWithIds = highlights.map((highlight, index) => ({
    ...highlight,
    id: highlight.id || `highlight-${index}`,
  }));

  // Helper function to get property details
  const getPropertyDetails = () => {
    const details = [];
    
    // Add primary details
    if (property.price) {
      details.push({
        label: "Totalpris",
        value: property.price,
        subValue: property.pricePerM2 ? `${property.pricePerM2} per m²` : null
      });
    }
    
    if (property.askingPrice) {
      details.push({
        label: "Udbudspris",
        value: property.askingPrice,
        subValue: null
      });
    }
    
    if (property.buyingExpenses) {
      details.push({
        label: "Købsomkostninger",
        value: property.buyingExpenses,
        subValue: null
      });
    }
    
    if (property.monthlyFee) {
      details.push({
        label: "Fællesudgift/md",
        value: property.monthlyFee,
        subValue: null
      });
    }
    
    if (property.size) {
      details.push({
        label: "Boligareal",
        value: property.size,
        subValue: null
      });
    }

    if (property.boligType) {
      details.push({
        label: "Boligtype",
        value: property.boligType,
        subValue: null
      });
    }
    
    if (property.floor) {
      details.push({
        label: "Etage",
        value: property.floor,
        subValue: null
      });
    }
    
    if (property.yearBuilt || property.byggeaar) {
      details.push({
        label: "Byggeår",
        value: property.yearBuilt || property.byggeaar,
        subValue: null
      });
    }

    if (property.energiMaerke) {
      details.push({
        label: "Energimærke",
        value: property.energiMaerke,
        subValue: null
      });
    }
    
    // Add any additional details
    if (property.otherDetails && typeof property.otherDetails === 'object') {
      Object.entries(property.otherDetails).forEach(([key, value]) => {
        if (typeof value === 'string') {
          details.push({
            label: key,
            value: value,
            subValue: null
          });
        }
      });
    } else if (typeof property.otherDetails === 'string') {
      details.push({
        label: "Beskrivelse",
        value: property.otherDetails,
        subValue: null
      });
    }
    
    // Include any other fields not explicitly handled above
    const handledFields = [
      'price', 'askingPrice', 'buyingExpenses', 'monthlyFee', 'size', 'boligType',
      'floor', 'yearBuilt', 'byggeaar', 'energiMaerke', 'otherDetails',
      'address', 'images', 'timeAgo', 'pricePerM2'
    ];
    
    Object.entries(property).forEach(([key, value]) => {
      if (!handledFields.includes(key) && typeof value === 'string' && value.trim() !== '') {
        details.push({
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
          value: value,
          subValue: null
        });
      }
    });
    
    return details;
  };

  const propertyDetails = getPropertyDetails();

  return (
    <div className="min-h-screen pb-12">
      <div className="container py-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                <h1 className="text-xl font-medium">{property.address}</h1>
                <p className="text-sm text-muted-foreground">{timeAgoDisplay} siden</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {originalUrl && (
                <Button variant="outline" size="sm" className="flex items-center gap-1" 
                  onClick={() => window.open(originalUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" /> Annonce
                </Button>
              )}
              <Button variant="outline" size="sm" className="flex items-center gap-1"
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" /> Kort
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-1">
                <Share2 className="h-4 w-4" /> Del analyse
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  <img 
                    src={mainImage}
                    alt={property.address}
                    className="w-full h-[300px] object-cover rounded-t-lg"
                  />
                  
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                      {propertyDetails.map((detail, index) => (
                        <div key={`detail-${index}`}>
                          <h3 className="text-sm text-muted-foreground">{detail.label}</h3>
                          <p className="text-xl font-bold">
                            {detail.value}
                          </p>
                          {detail.subValue && (
                            <p className="text-xs text-muted-foreground">{detail.subValue}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-medium">Risici <span className="text-sm text-muted-foreground">(klik for detaljer)</span></h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {risksWithIds.map((risk) => (
                          <div key={risk.id} className="bg-secondary/50 p-3 rounded-lg flex flex-col items-center text-center w-[calc(20%-8px)] min-w-[100px] cursor-pointer hover:bg-secondary transition-colors">
                            <div className="text-2xl mb-1">{getCategoryIcon(risk.category, 5)}</div>
                            <div className="text-xs leading-tight">{risk.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-medium">Højdepunkter <span className="text-sm text-muted-foreground">(klik for detaljer)</span></h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {highlightsWithIds.map((highlight) => (
                          <div key={highlight.id} className="bg-secondary/50 p-3 rounded-lg flex flex-col items-center text-center w-[calc(20%-8px)] min-w-[100px] cursor-pointer hover:bg-secondary transition-colors">
                            <div className="text-2xl mb-1">{getIconComponent(highlight.icon || 'lightbulb', 6)}</div>
                            <div className="text-xs leading-tight">{highlight.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold">Risikovurdering</h2>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-6">
                    Baseret på AI-analyse af boligens salgsopslag.
                  </p>
                  
                  <div className="space-y-6">
                    {risksWithIds.map((risk, index) => (
                      <div key={risk.id} className="border border-border rounded-lg p-6">
                        <div className="flex items-start gap-2 mb-3">
                          <h3 className="text-lg font-medium">
                            {index + 1}. {risk.title}
                          </h3>
                        </div>
                        
                        <p className="text-sm mb-2">
                          {risk.details || risk.description}
                        </p>
                        
                        {risk.excerpt && (
                          <div className="bg-muted p-3 rounded-md italic text-sm mb-3">
                            {risk.excerpt}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary/70 flex items-center gap-1">
                            <RiskIcon risk={risk} />
                          </span>
                        </div>
                        
                        {risk.recommendations && risk.recommendations.length > 0 && (
                          <div className="border-t border-border pt-3 mt-3">
                            <div className="text-xs text-muted-foreground uppercase mb-1">
                              {risk.recommendations[0].promptTitle || "SPØRG MÆGLEREN"}
                            </div>
                            <p className="text-sm font-medium text-purple">
                              "{risk.recommendations[0].prompt || risk.question}"
                            </p>
                            {risk.recommendations.length > 1 && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <div className="text-xs text-muted-foreground mb-1">
                                  Flere spørgsmål:
                                </div>
                                <ul className="space-y-1 text-sm">
                                  {risk.recommendations.slice(1).map((rec, idx) => (
                                    <li key={`rec-${risk.id}-${idx}`} className="text-purple">
                                      "{rec.prompt}"
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <h2 className="text-xl font-bold">Højdepunkter</h2>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-6">
                    Disse er de vigtigste fordele ved boligen.
                  </p>
                  
                  <div className="space-y-6">
                    {highlightsWithIds.map((highlight, index) => (
                      <div key={highlight.id} className="border border-border rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-2xl">
                            {getIconComponent(highlight.icon || 'lightbulb', 6)}
                          </div>
                          <h3 className="text-lg font-medium">
                            {highlight.title}
                          </h3>
                        </div>
                        
                        <p className="text-sm">
                          {highlight.details}
                        </p>
                        
                        {highlight.category && (
                          <div className="flex items-center gap-2 mt-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary/70">
                              {highlight.category}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium mb-4">Giv feedback</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Hjælp os med at forbedre vores analyser ved at sende feedback om denne rapport.
                  </p>
                  
                  <div className="space-y-4">
                    <textarea 
                      className="w-full h-32 p-3 border rounded-md bg-background resize-none"
                      placeholder="Skriv din feedback her..."
                    />
                    
                    <Button className="w-full">
                      <Send className="h-4 w-4 mr-2" /> Send feedback
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium mb-4">Spørgsmål til mægleren</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Her er forslag til spørgsmål, du kan stille ejendomsmægleren.
                  </p>
                  
                  <div className="space-y-3">
                    {risksWithIds.slice(0, 3).map(risk => (
                      <div key={`q-${risk.id}`} className="p-3 bg-secondary rounded-lg">
                        <p className="text-sm font-medium">Vedrørende {risk.title.toLowerCase()}:</p>
                        {risk.recommendations && risk.recommendations.length > 0 ? (
                          <p className="text-sm">"{risk.recommendations[0].prompt}"</p>
                        ) : (
                          <p className="text-sm">"{risk.question || 'Hvad kan du fortælle om dette?'}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="w-full mt-4">
                    <Check className="h-4 w-4 mr-2" /> Markér som spurgt
                  </Button>
                </CardContent>
              </Card>
              
              {property.images && property.images.length > 1 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Galleri</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-2">
                      {property.images.slice(1, 5).map((image: string, index: number) => (
                        <img 
                          key={`img-${index}`}
                          src={image}
                          alt={`${property.address} - billede ${index + 2}`}
                          className="w-full h-24 object-cover rounded-md"
                        />
                      ))}
                      {property.images.length > 5 && (
                        <div className="relative">
                          <img
                            src={property.images[5]}
                            alt={`${property.address} - billede 6`}
                            className="w-full h-24 object-cover rounded-md opacity-70"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md text-white font-medium">
                            +{property.images.length - 5} mere
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Card className="mt-6">
                <CardContent className="p-6 text-xs text-muted-foreground">
                  <p className="mb-4">
                    Boliganalyse.ai er et værktøj til at hjælpe dig med boligkøb, men erstatter ikke professionel rådgivning. 
                    Informationen, der gives, er kun til vejledende formål og er ikke juridisk eller professionel rådgivning.
                  </p>
                  <p>
                    Alle købsbeslutninger bør baseres på egen research, besigtigelse og professionel rådgivning. 
                    Vi tager ikke ansvar for eventuelle fejl eller mangler i analysen.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
