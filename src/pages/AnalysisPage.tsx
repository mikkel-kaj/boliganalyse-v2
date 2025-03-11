
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Share2, AlertTriangle, 
  Check, HelpCircle, Star, Send, ExternalLink, Loader2
} from "lucide-react";

// Fallback function in case the analysis is missing from the database
const generateAnalysis = (htmlContent: string | null, propertyId: string) => {
  // This is where you would use AI to analyze the HTML content
  // For now, we'll return mock data
  return {
    property: {
      id: propertyId,
      address: extractAddress(htmlContent),
      image: extractImage(htmlContent) || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
      totalPrice: extractPrice(htmlContent, 'totalPrice'),
      pricePerSqm: extractPrice(htmlContent, 'pricePerSqm'),
      askingPrice: extractPrice(htmlContent, 'askingPrice'),
      monthlyFee: extractPrice(htmlContent, 'monthlyFee'),
      size: extractSize(htmlContent),
      sizeType: "BRA",
      floor: extractFloor(htmlContent),
      yearBuilt: extractYearBuilt(htmlContent),
    },
    risks: generateRisks(htmlContent),
    highlights: generateHighlights(htmlContent)
  };
};

// Helper functions to extract data from HTML content
function extractAddress(htmlContent: string | null): string {
  if (!htmlContent) return "Adresse ikke tilgængelig";
  
  try {
    // Basic extraction attempt - in a real implementation you would use 
    // more sophisticated parsing
    const addressMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
    return addressMatch ? addressMatch[1].trim() : "Adresse ikke fundet";
  } catch (error) {
    console.error("Error extracting address:", error);
    return "Adresse ikke tilgængelig";
  }
}

function extractImage(htmlContent: string | null): string | null {
  if (!htmlContent) return null;
  
  try {
    // Look for image URLs in the HTML
    const imgMatch = htmlContent.match(/src="(https:\/\/[^"]*\.(jpg|jpeg|png|webp))/i);
    return imgMatch ? imgMatch[1] : null;
  } catch (error) {
    console.error("Error extracting image:", error);
    return null;
  }
}

function extractPrice(htmlContent: string | null, priceType: string): string {
  if (!htmlContent) return "N/A";
  
  try {
    // Different price patterns to look for
    let priceMatch = null;
    
    if (priceType === 'totalPrice') {
      priceMatch = htmlContent.match(/kontantpris:?\s*([\d\.]+)/i);
    } else if (priceType === 'askingPrice') {
      priceMatch = htmlContent.match(/udbudspris:?\s*([\d\.]+)/i);
    } else if (priceType === 'monthlyFee') {
      priceMatch = htmlContent.match(/[måned|md]\.?\s*[udgift|bidrag]:?\s*([\d\.]+)/i);
    } else if (priceType === 'pricePerSqm') {
      priceMatch = htmlContent.match(/pris pr\. m²:?\s*([\d\.]+)/i);
    }
    
    return priceMatch ? priceMatch[1].trim() : "N/A";
  } catch (error) {
    console.error(`Error extracting ${priceType}:`, error);
    return "N/A";
  }
}

function extractSize(htmlContent: string | null): string {
  if (!htmlContent) return "N/A";
  
  try {
    const sizeMatch = htmlContent.match(/boligareal:?\s*([\d]+)\s*m²/i);
    return sizeMatch ? sizeMatch[1].trim() : "N/A";
  } catch (error) {
    console.error("Error extracting size:", error);
    return "N/A";
  }
}

function extractFloor(htmlContent: string | null): string {
  if (!htmlContent) return "N/A";
  
  try {
    const floorMatch = htmlContent.match(/etage:?\s*(\d+)/i);
    return floorMatch ? floorMatch[1].trim() : "st";
  } catch (error) {
    console.error("Error extracting floor:", error);
    return "N/A";
  }
}

function extractYearBuilt(htmlContent: string | null): string {
  if (!htmlContent) return "N/A";
  
  try {
    const yearMatch = htmlContent.match(/bygge[år|aar]:?\s*(\d{4})/i);
    return yearMatch ? yearMatch[1].trim() : "N/A";
  } catch (error) {
    console.error("Error extracting year built:", error);
    return "N/A";
  }
}

function generateRisks(htmlContent: string | null): any[] {
  // This would be where AI would analyze the HTML to find actual risks
  // For now, we'll return some generic risks
  return [
    {
      id: "1",
      icon: "🏗️",
      title: "Ældre bygning",
      description: "Bygningen er ældre og kan have vedligeholdelsesbehov.",
      quote: '"Boligen er opført før 1950 og kan have ældre installationer."',
      category: "Byggeteknisk",
      categoryIcon: "🏗️",
      categoryColor: "risk-building",
      question: "Hvad er de største vedligeholdelsesudgifter i de seneste 5 år?"
    },
    {
      id: "2",
      icon: "🔧",
      title: "Potentielle fugtproblemer",
      description: "Der kan være tegn på fugtproblemer som bør undersøges nærmere.",
      quote: '"Der kan være tegn der indikerer tidligere fugtskader."',
      category: "Byggeteknisk",
      categoryIcon: "🔧",
      categoryColor: "risk-technical",
      question: "Er der konstateret fugtproblemer i boligen tidligere?"
    },
    {
      id: "3",
      icon: "💰",
      title: "Kommende større udgifter",
      description: "Der kan være planlagt større renoveringer i ejendommen.",
      quote: '"Ejerforeningen har varslet kommende projekter."',
      category: "Økonomi",
      categoryIcon: "💰",
      categoryColor: "risk-financial",
      question: "Hvilke større projekter er planlagt i foreningen og hvad er den økonomiske konsekvens?"
    }
  ];
}

function generateHighlights(htmlContent: string | null): any[] {
  // This would be where AI would analyze the HTML to find actual highlights
  // For now, we'll return some generic highlights
  return [
    {
      id: "1",
      icon: "🚌",
      title: "God infrastruktur",
      description: "Tæt på offentlig transport og indkøbsmuligheder.",
      category: "Beliggenhed",
      categoryColor: "highlight-location"
    },
    {
      id: "2",
      icon: "☀️",
      title: "Gode lysforhold",
      description: "Boligen har gode lysforhold med vinduer i flere retninger.",
      category: "Boligen",
      categoryColor: "highlight-property"
    },
    {
      id: "3",
      icon: "🏙️",
      title: "Attraktivt område",
      description: "Beliggende i et attraktivt område med god efterspørgsel.",
      category: "Marked",
      categoryColor: "highlight-market"
    }
  ];
}

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchListing = async () => {
      if (!id) {
        setError("Ingen analyse-ID angivet");
        setLoading(false);
        return;
      }
      
      try {
        // If this is the demo listing
        if (id === 'demo') {
          // Set up demo data
          setProperty({
            id: 'demo',
            address: "Strømsveien 20, 0657 Oslo",
            timeAgo: "3 min",
            image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
            totalPrice: "2.799.073",
            pricePerSqm: "186.515",
            askingPrice: "2.200.000",
            monthlyFee: "5.660",
            size: "15",
            sizeType: "BRA-i",
            floor: "2",
            yearBuilt: "1931",
          });
          setRisks(generateRisks(null));
          setHighlights(generateHighlights(null));
          setLoading(false);
          return;
        }
        
        // Fetch the actual listing from Supabase
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
        
        // Check if we have an analysis in the JSONB column and it's properly structured
        if (data.analysis && 
            typeof data.analysis === 'object' && 
            'property' in data.analysis && 
            'risks' in data.analysis && 
            'highlights' in data.analysis) {
          console.log("Using stored analysis from database:", data.analysis);
          
          const analysisData = data.analysis as {
            property: any;
            risks: any[];
            highlights: any[];
          };
          
          // Use the stored analysis
          setProperty(analysisData.property);
          setRisks(analysisData.risks || []);
          setHighlights(analysisData.highlights || []);
        } else {
          console.log("No valid stored analysis found, generating analysis from HTML content");
          
          // Generate analysis from the HTML content
          const analyzedData = generateAnalysis(data.html_content, data.id);
          setProperty(analyzedData.property);
          setRisks(analyzedData.risks);
          setHighlights(analyzedData.highlights);
        }
        
      } catch (err) {
        console.error("Error fetching listing:", err);
        setError("Der opstod en fejl ved indlæsning af analysen");
      } finally {
        setLoading(false);
      }
    };
    
    fetchListing();
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

  if (loading) {
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

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-xl font-medium mb-2">Kunne ikke finde analyse</h2>
          <p className="text-muted-foreground mb-6">Vi kunne ikke finde den ønskede boliganalyse.</p>
          <Button asChild>
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Tilbage til forsiden</Link>
          </Button>
        </div>
      </div>
    );
  }

  const originalUrl = listing?.url || "";
  const timeAgoDisplay = listing ? "Lige nu" : property.timeAgo || "Lige nu";

  return (
    <div className="min-h-screen pb-12">
      <div className="container py-6">
        <div className="flex flex-col gap-6">
          {/* Header with address and actions */}
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
          
          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  <img 
                    src={property.image} 
                    alt={property.address}
                    className="w-full h-[300px] object-cover rounded-t-lg"
                  />
                  
                  <div className="p-6">
                    {/* Property details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                      <div>
                        <h3 className="text-sm text-muted-foreground">Totalpris</h3>
                        <p className="text-xl font-bold">kr {property.totalPrice}</p>
                        <p className="text-xs text-muted-foreground">{property.pricePerSqm} kr per m²</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Udbudspris</h3>
                        <p className="text-xl font-bold">kr {property.askingPrice}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Fællesudgift/md</h3>
                        <p className="text-xl font-bold">kr {property.monthlyFee}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Internt boligareal</h3>
                        <p className="text-xl font-bold">{property.size} m² {property.sizeType}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Etage</h3>
                        <p className="text-xl font-bold">{property.floor}</p>
                      </div>
                    </div>
                    
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-medium">Risici <span className="text-sm text-muted-foreground">(klik for detaljer)</span></h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {risks.map((risk) => (
                          <div key={risk.id} className="bg-secondary/50 p-3 rounded-lg flex flex-col items-center text-center w-[calc(20%-8px)] min-w-[100px] cursor-pointer hover:bg-secondary transition-colors">
                            <div className="text-2xl mb-1">{risk.icon}</div>
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
                        {highlights.map((highlight) => (
                          <div key={highlight.id} className="bg-secondary/50 p-3 rounded-lg flex flex-col items-center text-center w-[calc(20%-8px)] min-w-[100px] cursor-pointer hover:bg-secondary transition-colors">
                            <div className="text-2xl mb-1">{highlight.icon}</div>
                            <div className="text-xs leading-tight">{highlight.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Risk analysis section */}
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
                    {risks.map((risk, index) => (
                      <div key={risk.id} className="border border-border rounded-lg p-6">
                        <div className="flex items-start gap-2 mb-3">
                          <h3 className="text-lg font-medium">
                            {index + 1}. {risk.title}
                          </h3>
                        </div>
                        
                        <p className="text-sm mb-2">
                          {risk.description}
                        </p>
                        
                        <div className="bg-muted p-3 rounded-md italic text-sm mb-3">
                          {risk.quote}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary/70">
                            {risk.categoryIcon} {risk.category}
                          </span>
                        </div>
                        
                        <div className="border-t border-border pt-3 mt-3">
                          <div className="text-xs text-muted-foreground uppercase mb-1">SPØRG MÆGLEREN</div>
                          <p className="text-sm font-medium text-purple">"{risk.question}"</p>
                        </div>
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
                    {risks.slice(0, 3).map(risk => (
                      <div key={`q-${risk.id}`} className="p-3 bg-secondary rounded-lg">
                        <p className="text-sm font-medium">Vedrørende {risk.title.toLowerCase()}:</p>
                        <p className="text-sm">"{risk.question}"</p>
                      </div>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="w-full mt-4">
                    <Check className="h-4 w-4 mr-2" /> Markér som spurgt
                  </Button>
                </CardContent>
              </Card>
              
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
