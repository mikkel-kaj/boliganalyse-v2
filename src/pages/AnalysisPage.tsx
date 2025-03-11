import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Share2, AlertTriangle, 
  Check, HelpCircle, Star, Send, ExternalLink, Loader2,
  Building, Home, Map, PiggyBank, Scale, Key, Heart, Award, ThumbsUp, Lightbulb, Flag, Search
} from "lucide-react";

// Map icon names from API to Lucide React components
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'check': <Check className="h-5 w-5" />,
    'star': <Star className="h-5 w-5" />,
    'flag': <Flag className="h-5 w-5" />,
    'heart': <Heart className="h-5 w-5" />,
    'thumbs-up': <ThumbsUp className="h-5 w-5" />,
    'home': <Home className="h-5 w-5" />,
    'key': <Key className="h-5 w-5" />,
    'search': <Search className="h-5 w-5" />,
    'lightbulb': <Lightbulb className="h-5 w-5" />,
    'award': <Award className="h-5 w-5" />,
    'building': <Building className="h-5 w-5" />,
    'map': <Map className="h-5 w-5" />,
    'piggy-bank': <PiggyBank className="h-5 w-5" />,
    'scale': <Scale className="h-5 w-5" />
  };
  
  // Default to Lightbulb if the icon name is not found
  return iconMap[iconName?.toLowerCase()] || <Lightbulb className="h-5 w-5" />;
};

// Emoji fallback for when icon names are provided as emoji
const getCategoryIcon = (icon: string) => {
  // If it's an emoji (usually a single character), return it directly
  if (icon && icon.length <= 2) {
    return icon;
  }
  
  // Otherwise try to map to a Lucide icon
  return getIconComponent(icon);
};

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
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
          setRisks([
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
          ]);
          setHighlights([
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
          ]);
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
          
          const analysisData = data.analysis;
          
          // Use the stored analysis
          setProperty(analysisData.property);
          setRisks(analysisData.risks || []);
          setHighlights(analysisData.highlights || []);
        } else {
          console.log("No valid stored analysis found or analysis is incomplete");
          setError("Analysen er ikke fuldført endnu eller indeholder ikke den forventede data.");
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
  
  // Ensure we display the primary image
  const mainImage = property.images && property.images.length > 0 
    ? property.images[0] 
    : "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";

  // Add ID to risks and highlights if they don't have one
  const risksWithIds = risks.map((risk, index) => ({
    ...risk,
    id: risk.id || `risk-${index}`,
  }));

  const highlightsWithIds = highlights.map((highlight, index) => ({
    ...highlight,
    id: highlight.id || `highlight-${index}`,
  }));

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
                    src={mainImage}
                    alt={property.address}
                    className="w-full h-[300px] object-cover rounded-t-lg"
                  />
                  
                  <div className="p-6">
                    {/* Property details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                      <div>
                        <h3 className="text-sm text-muted-foreground">Totalpris</h3>
                        <p className="text-xl font-bold">kr {property.price || property.totalPrice || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{property.pricePerSqm || "N/A"} kr per m²</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Udbudspris</h3>
                        <p className="text-xl font-bold">kr {property.askingPrice || "N/A"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Fællesudgift/md</h3>
                        <p className="text-xl font-bold">kr {property.monthlyFee || "N/A"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Internt boligareal</h3>
                        <p className="text-xl font-bold">{property.size || "N/A"} m² {property.sizeType || ""}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Etage</h3>
                        <p className="text-xl font-bold">{property.floor || "N/A"}</p>
                      </div>
                      {property.yearBuilt && (
                        <div>
                          <h3 className="text-sm text-muted-foreground">Byggeår</h3>
                          <p className="text-xl font-bold">{property.yearBuilt}</p>
                        </div>
                      )}
                      {property.otherDetails && Object.entries(property.otherDetails).map(([key, value]: [string, any]) => (
                        <div key={key}>
                          <h3 className="text-sm text-muted-foreground">{key}</h3>
                          <p className="text-xl font-bold">{value}</p>
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
                            <div className="text-2xl mb-1">{risk.icon || "⚠️"}</div>
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
                            <div className="text-2xl mb-1">{highlight.icon || "✨"}</div>
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
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary/70">
                            {risk.categoryIcon || risk.icon || "⚠️"} {risk.category}
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
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Highlights section */}
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
                            {highlight.icon || "✨"}
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
              
              {/* Gallery if we have multiple images */}
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
