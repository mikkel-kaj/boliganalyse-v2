import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AnalysisProgress from "@/components/AnalysisProgress";
import { 
  ArrowLeft, Share2, AlertTriangle,
  Send, ExternalLink, Loader2, Star, Check, FileText
} from "lucide-react";
import { getIconComponent, getCategoryIcon, RiskIcon, HighlightIcon } from "@/components/IconMapper";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import FeedbackForm from "@/components/FeedbackForm";

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("Starter analyse");
  const placeholderImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";
  
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
        
        const analysisData = data.analysis;
        
        setProperty(analysisData.property);
        setSummary(analysisData.summary);

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
          
          // Update state with new data from payload
          if (payload.new) {
            // Update status if it changed
            if (payload.new.status) {
              console.log('New status:', payload.new.status);
              setStatus(payload.new.status);
            }
            
            // Update listing with property_image_url if it's available
            if (payload.new.property_image_url) {
              console.log('New property image URL:', payload.new.property_image_url);
              setListing(prevListing => ({
                ...prevListing,
                property_image_url: payload.new.property_image_url
              }));
            }
            
            // If the analysis is completed, fetch the full listing with analysis data
            if (payload.new.status === "Analyse fuldført") {
              fetchListing();
            }
          }
        }
      )
      .subscribe((status) => {
        
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
  const mainImage = listing?.property_image_url || placeholderImage;

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

  // Generate property schema for SEO
  const generatePropertySchema = () => {
    if (!property) return null;
    
    return {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "name": `${property.address}`,
      "description": `AI-analyse af ${property.address} - ${property.zip_code} ${property.city}. Boliganalyse.ai afslører potentielle risikofaktorer og højdepunkter ved boligen.`,
      "url": `https://boliganalyse.ai/analyse/${id}`,
      "image": property.image_url || '',
      "address": {
        "@type": "PostalAddress",
        "addressLocality": property.city,
        "postalCode": property.zip_code,
        "streetAddress": property.address
      },
      "offers": {
        "@type": "Offer",
        "price": property.price,
        "priceCurrency": "DKK"
      },
      "floorSize": {
        "@type": "QuantitativeValue",
        "value": property.size,
        "unitCode": "MTK"
      }
    };
  };

  return (
    <div className="min-h-[calc(100vh-80px)]">
      {property && (
        <SEO 
          title={`Boliganalyse af ${property.address} - ${property.zip_code} ${property.city}`}
          description={`AI-analyse af ${property.address}. Identificerer potentielle risikofaktorer og højdepunkter ved boligen. Pris: ${property.price ? property.price.toLocaleString('da-DK') + ' kr.' : 'N/A'}, størrelse: ${property.size} m².`}
          ogImage={property.image_url || '/og-image.png'}
          ogType="article"
          schema={generatePropertySchema()}
        />
      )}

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
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                      <div className="md:w-1/2">
                        <img 
                          src={mainImage}
                          alt={property.address}
                          className="w-full h-[240px] object-cover rounded-lg"
                        />
                      </div>
                      <div className="md:w-1/2 flex flex-col justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold mb-1">{property.address}</h2>
                          <p className="text-muted-foreground mb-3">{property.zip_code} {property.city}</p>
                          
                          <div className="mb-4">
                            <h3 className="text-sm text-muted-foreground mb-1">Totalpris</h3>
                            <p className="text-2xl font-bold">
                              {property.price}
                            </p>
                            {property.pricePerM2 && (
                              <p className="text-sm text-muted-foreground">{property.pricePerM2} per m²</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {propertyDetails.slice(0, 4).map((detail, index) => (
                            <div key={`top-detail-${index}`} className="border-t pt-2">
                              <h3 className="text-xs uppercase text-muted-foreground">{detail.label}</h3>
                              <p className="text-base font-medium">
                                {detail.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {propertyDetails.slice(4).map((detail, index) => (
                        <div key={`detail-${index}`} className="border rounded-md p-3">
                          <h3 className="text-xs uppercase text-muted-foreground">{detail.label}</h3>
                          <p className="text-base font-medium">
                            {detail.value}
                          </p>
                          {detail.subValue && (
                            <p className="text-xs text-muted-foreground">{detail.subValue}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {summary && summary.trim() !== '' && (
                      <div className="mb-6 border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-purple-500 dark:text-purple-400 mt-1">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium mb-2">
                              AI-opsummering
                            </h3>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {summary}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-medium">Risikoer <span className="text-sm text-muted-foreground">(klik for detaljer)</span></h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {risksWithIds.map((risk) => (
                          <HoverCard key={risk.id} openDelay={100} closeDelay={100}>
                            <HoverCardTrigger asChild>
                              <div 
                                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 px-3 py-2 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <div className="text-amber-500 dark:text-amber-400">
                                  {getCategoryIcon(risk.category, 4)}
                                </div>
                                <span className="text-xs font-medium text-amber-950 dark:text-amber-100">{risk.title}</span>
                                <span className="text-xs">▸</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80 p-4">
                              <div>
                                <h4 className="font-medium mb-2">{risk.title}</h4>
                                <p className="text-sm mb-3">{risk.details || risk.description}</p>
                                
                                {risk.recommendations && risk.recommendations.length > 0 && (
                                  <div className="mt-4 border border-dashed border-amber-200 dark:border-amber-900/50 rounded-lg p-3 hover:border-amber-300 dark:hover:border-amber-800 transition-colors bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 dark:to-transparent backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-1">
                                        <Send className="h-4 w-4 text-amber-500" />
                                      </div>
                                      <span className="font-medium text-sm text-amber-900 dark:text-amber-100">Spørg mægler</span>
                                    </div>
                                    <p className="text-sm text-amber-950 dark:text-amber-50 pl-6 relative">
                                      <span className="absolute left-0 top-0 text-amber-400 dark:text-amber-500">"</span>
                                      {risk.recommendations[0].prompt || risk.question || 'Hvad kan du fortælle om dette?'}
                                      <span className="text-amber-400 dark:text-amber-500">"</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-medium">Højdepunkter <span className="text-sm text-muted-foreground">(klik for detaljer)</span></h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {highlightsWithIds.map((highlight) => (
                          <HoverCard key={highlight.id} openDelay={100} closeDelay={100}>
                            <HoverCardTrigger asChild>
                              <div 
                                className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 px-3 py-2 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <div className="text-emerald-500 dark:text-emerald-400">
                                  {getIconComponent(highlight.icon || 'lightbulb', 4)}
                                </div>
                                <span className="text-xs font-medium text-emerald-950 dark:text-emerald-100">{highlight.title}</span>
                                <span className="text-xs">▸</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80 p-4">
                              <div>
                                <h4 className="font-medium mb-2">{highlight.title}</h4>
                                <p className="text-sm">{highlight.details}</p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground">Analysen er baseret på AI-analyse af boligens salgsopslag. Se detaljerede rapporter nedenfor for mere information.</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="mt-6">
                  <CardContent className="p-6">
                    <Tabs defaultValue="risks" className="w-full">
                      <TabsList className="mb-6 w-full justify-start border-b">
                        <TabsTrigger value="risks" className="flex items-center gap-2 -mb-px data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none pb-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span>Risikovurdering</span>
                          {risksWithIds.length > 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {risksWithIds.length}
                            </span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="highlights" className="flex items-center gap-2 -mb-px data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none pb-3">
                          <Star className="h-4 w-4 text-emerald-500" />
                          <span>Højdepunkter</span>
                          {highlightsWithIds.length > 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {highlightsWithIds.length}
                            </span>
                          )}
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="risks" className="mt-0">
                        <div className="space-y-6">
                          {risksWithIds.map((risk) => (
                            <div key={risk.id} className="group">
                              <div className="flex items-start gap-3">
                                <div className="text-amber-500 dark:text-amber-400 mt-1">
                                  {getCategoryIcon(risk.category, 5)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-medium mb-2">
                                    {risk.title}
                                  </h3>
                                  
                                  <p className="text-sm text-muted-foreground">
                                    {risk.details || risk.description}
                                  </p>
                                  
                                  {risk.excerpt && (
                                    <blockquote className="mt-3 text-sm italic border-l-2 border-muted pl-3 text-muted-foreground">
                                      {risk.excerpt}
                                    </blockquote>
                                  )}
                                  
                                  {risk.recommendations && risk.recommendations.length > 0 && (
                                    <div className="mt-4 border border-dashed border-amber-200 dark:border-amber-900/50 rounded-lg p-3 hover:border-amber-300 dark:hover:border-amber-800 transition-colors bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 dark:to-transparent backdrop-blur-sm">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-1">
                                          <Send className="h-4 w-4 text-amber-500" />
                                        </div>
                                        <span className="font-medium text-sm text-amber-900 dark:text-amber-100">Spørg mægler</span>
                                      </div>
                                      <p className="text-sm text-amber-950 dark:text-amber-50 pl-6 relative">
                                        <span className="text-amber-400 dark:text-amber-500">"</span>
                                        {risk.recommendations[0].prompt || risk.question || 'Hvad kan du fortælle om dette?'}
                                        <span className="text-amber-400 dark:text-amber-500">"</span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="highlights" className="mt-0">
                        <div className="space-y-6">
                          {highlightsWithIds.map((highlight) => (
                            <div key={highlight.id} className="group">
                              <div className="flex items-start gap-3">
                                <div className="text-emerald-500 dark:text-emerald-400 mt-1">
                                  {getIconComponent(highlight.icon || 'lightbulb', 5)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-medium mb-2">
                                    {highlight.title}
                                  </h3>
                                  
                                  <p className="text-sm text-muted-foreground">
                                    {highlight.details}
                                  </p>
                                  
                                  {highlight.category && (
                                    <div className="mt-3 flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground border-l-2 border-emerald-200 dark:border-emerald-900/50 pl-3">
                                        {highlight.category}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                    
                    <div className="mt-6 pt-6 border-t">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <p className="text-sm">
                          Denne analyse er genereret af vores AI-system baseret på boligens salgsopslag. 
                          Vi anbefaler at du bruger spørgsmålene markeret med <Send className="h-3 w-3 inline mx-1" /> 
                          til at få uddybende svar fra mægleren.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div>
              
                <Card className="mt-6">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Share2 className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-medium">Del analyse</h2>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      Del denne analyse med andre, som også er interesseret i boligen.
                    </p>
                    
                    <Button className="w-full" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" /> Kopiér link
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="mt-6">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4">Giv feedback</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Hjælp os med at forbedre vores analyser ved at sende feedback om denne rapport.
                    </p>
                    
                    <FeedbackForm 
                      propertyId={id}
                      propertyAddress={property?.address}
                    />
                  </CardContent>
                </Card>
                
                {property.images && property.images.length > 1 && (
                  <Card className="mt-6">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-lg">Galleri</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {property.images.slice(1, 7).map((image: string, index: number) => (
                          <img 
                            key={`img-${index}`}
                            src={image}
                            alt={`${property.address} - billede ${index + 2}`}
                            className="w-full h-20 object-cover rounded-md"
                          />
                        ))}
                        {property.images.length > 7 && (
                          <div className="relative">
                            <img
                              src={property.images[7]}
                              alt={`${property.address} - billede 8`}
                              className="w-full h-20 object-cover rounded-md opacity-70"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md text-white font-medium">
                              +{property.images.length - 7} mere
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Card className="mt-6">
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    <p className="mb-2">
                      Boliganalyse.ai er et værktøj til at hjælpe dig med boligkøb, men erstatter ikke professionel rådgivning. 
                      Informationen, der gives, er kun til vejledende formål. 
                    </p>
                    <p>
                      Alle købsbeslutninger skal baseres på egen research og besigtigelse. 
                      Vi tager ikke ansvar for fejl, mangler eller råd givet i analysen.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
