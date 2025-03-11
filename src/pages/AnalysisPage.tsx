
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, Share2, Home, Map, AlertTriangle, 
  Check, HelpCircle, Star, Send 
} from "lucide-react";

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data - in a real app, you'd fetch the property details based on the ID
  const property = {
    id: id || 'demo',
    address: "Strandvejen 42, 2900 Hellerup",
    timeAgo: "3 min",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
    totalPrice: "4 650 000",
    pricePerSqm: "58 125",
    askingPrice: "4 495 000",
    monthlyFee: "3 850",
    size: "80",
    floor: "3",
    yearBuilt: "1934",
    energyRating: "D",
    rooms: "3",
    bedrooms: "2",
    risks: [
      {
        id: "1",
        icon: "🏗️",
        title: "Revnet flise i entré",
        description: "Der er påvist en revnet flise i entréen, hvilket kan medføre behov for reparation.",
        category: "Byggeteknisk",
        categoryIcon: "🏗️",
        categoryColor: "risk-building"
      },
      {
        id: "2",
        icon: "🔧",
        title: "Membran på badeværelset",
        description: "Mere end halvdelen af forventet levetid er passeret på membranløsningen i badeværelset.",
        category: "Byggeteknisk",
        categoryIcon: "🔧",
        categoryColor: "risk-technical"
      },
      {
        id: "3",
        icon: "🚨",
        title: "Ingen komfurvagt installeret",
        description: "Der er ikke monteret komfurvagt i køkkenet, hvilket er et krav til denne type køkken.",
        category: "Sikkerhed",
        categoryIcon: "🚨",
        categoryColor: "risk-safety"
      },
      {
        id: "4",
        icon: "💨",
        title: "Naturlig ventilation på badeværelset",
        description: "Badeværelset har kun naturlig ventilation, hvilket kan være utilstrækkeligt.",
        category: "Ventilation",
        categoryIcon: "💨",
        categoryColor: "risk-ventilation"
      },
      {
        id: "5",
        icon: "🏛️",
        title: "Ældre bygning med ukendt vedligeholdelseshistorik",
        description: "Bygningen er fra 1934 og har ikke en komplet vedligeholdelseshistorik.",
        category: "Bygningshistorik",
        categoryIcon: "🏛️",
        categoryColor: "risk-history"
      }
    ],
    highlights: [
      {
        id: "1",
        icon: "🚌",
        title: "Nærhed til offentlig transport",
        description: "Tæt på flere buslinjer og S-togstation inden for 5 minutters gang.",
        category: "Transport",
        categoryColor: "highlight-transport"
      },
      {
        id: "2",
        icon: "🍽️",
        title: "Moderne køkkenløsning",
        description: "Nyere køkken med induktionskogeplade, indbygget ovn og opvaskemaskine.",
        category: "Køkken",
        categoryColor: "highlight-kitchen"
      },
      {
        id: "3",
        icon: "💰",
        title: "Ingen dokumentafgift",
        description: "Andelsbolig uden dokumentafgift ved køb, hvilket kan spare omkring 45.000 kr.",
        category: "Økonomi",
        categoryColor: "highlight-financial"
      },
      {
        id: "4",
        icon: "🏘️",
        title: "Velholdt beboelsesejendom",
        description: "Andelsboligforeningen er veldrevet med god økonomi og vedligeholdelse.",
        category: "Forening",
        categoryColor: "highlight-community"
      },
      {
        id: "5",
        icon: "🚲",
        title: "Fællesarealer med faciliteter",
        description: "Fælles gårdhave, cykelskur og vaskekælder til beboernes rådighed.",
        category: "Faciliteter",
        categoryColor: "highlight-facilities"
      }
    ]
  };

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
                <p className="text-sm text-muted-foreground">{property.timeAgo} siden</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" /> Del analyse
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  <img 
                    src={property.image} 
                    alt={property.address}
                    className="w-full h-[300px] object-cover rounded-t-lg"
                  />
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pt-6 pb-3 border-b">
                      <TabsList className="grid grid-cols-3">
                        <TabsTrigger value="overview" className="text-xs sm:text-sm">
                          <Home className="h-3 w-3 mr-1 sm:mr-2" /> Oversigt
                        </TabsTrigger>
                        <TabsTrigger value="risks" className="text-xs sm:text-sm">
                          <AlertTriangle className="h-3 w-3 mr-1 sm:mr-2" /> Risikofaktorer
                        </TabsTrigger>
                        <TabsTrigger value="highlights" className="text-xs sm:text-sm">
                          <Star className="h-3 w-3 mr-1 sm:mr-2" /> Højdepunkter
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="overview" className="p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                        <div>
                          <h3 className="text-sm text-muted-foreground">Totalpris</h3>
                          <p className="text-xl font-bold">{property.totalPrice} kr</p>
                          <p className="text-xs text-muted-foreground">{property.pricePerSqm} kr per m²</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Udbudspris</h3>
                          <p className="text-xl font-bold">{property.askingPrice} kr</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Boligydelse/md</h3>
                          <p className="text-xl font-bold">{property.monthlyFee} kr</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Boligareal</h3>
                          <p className="text-xl font-bold">{property.size} m²</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Etage</h3>
                          <p className="text-xl font-bold">{property.floor}</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Byggeår</h3>
                          <p className="text-xl font-bold">{property.yearBuilt}</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Energimærke</h3>
                          <p className="text-xl font-bold">{property.energyRating}</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Rum</h3>
                          <p className="text-xl font-bold">{property.rooms}</p>
                        </div>
                        <div>
                          <h3 className="text-sm text-muted-foreground">Soveværelser</h3>
                          <p className="text-xl font-bold">{property.bedrooms}</p>
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Kort oversigt over risikofaktorer</h3>
                        <div className="space-y-3">
                          {property.risks.slice(0, 3).map(risk => (
                            <div key={risk.id} className="flex items-start gap-3">
                              <div className="text-xl">{risk.icon}</div>
                              <div>
                                <p className="font-medium">{risk.title}</p>
                                <p className="text-sm text-muted-foreground">{risk.description}</p>
                              </div>
                            </div>
                          ))}
                          {property.risks.length > 3 && (
                            <Button 
                              variant="outline" 
                              onClick={() => setActiveTab('risks')}
                              className="mt-2"
                            >
                              Se alle {property.risks.length} risikofaktorer
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Kort oversigt over højdepunkter</h3>
                        <div className="space-y-3">
                          {property.highlights.slice(0, 3).map(highlight => (
                            <div key={highlight.id} className="flex items-start gap-3">
                              <div className="text-xl">{highlight.icon}</div>
                              <div>
                                <p className="font-medium">{highlight.title}</p>
                                <p className="text-sm text-muted-foreground">{highlight.description}</p>
                              </div>
                            </div>
                          ))}
                          {property.highlights.length > 3 && (
                            <Button 
                              variant="outline" 
                              onClick={() => setActiveTab('highlights')}
                              className="mt-2"
                            >
                              Se alle {property.highlights.length} højdepunkter
                            </Button>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="risks" className="p-6">
                      <h2 className="text-xl font-bold mb-6 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                        Risikofaktorer
                      </h2>
                      
                      <p className="text-sm text-muted-foreground mb-6">
                        Baseret på AI-analyse af boligens salgsopgave og offentligt tilgængelige data.
                      </p>
                      
                      <div className="space-y-8">
                        {property.risks.map((risk, index) => (
                          <div key={risk.id} className="border-b pb-6 last:border-none">
                            <div className="flex items-start gap-4">
                              <div className="bg-card p-2 rounded-lg text-xl">{risk.icon}</div>
                              <div className="flex-1">
                                <h3 className="text-lg font-medium mb-1">
                                  {index + 1}. {risk.title}
                                </h3>
                                <p className="text-sm mb-4">
                                  {risk.description}
                                </p>
                                
                                <div className="flex items-center gap-2 mb-4">
                                  <span className={`px-2 py-1 rounded-full text-xs bg-${risk.categoryColor} bg-opacity-20`}>
                                    {risk.categoryIcon} {risk.category}
                                  </span>
                                </div>
                                
                                <div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleAskQuestion(`Vedrørende ${risk.title.toLowerCase()}: Hvad vil det koste at udbedre dette problem?`)}
                                  >
                                    <HelpCircle className="h-3 w-3 mr-1" />
                                    Spørg mægler
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="highlights" className="p-6">
                      <h2 className="text-xl font-bold mb-6 flex items-center">
                        <Star className="h-5 w-5 mr-2 text-yellow-500" />
                        Højdepunkter
                      </h2>
                      
                      <p className="text-sm text-muted-foreground mb-6">
                        Positive aspekter ved denne bolig baseret på AI-analyse af boligens data.
                      </p>
                      
                      <div className="space-y-8">
                        {property.highlights.map((highlight, index) => (
                          <div key={highlight.id} className="border-b pb-6 last:border-none">
                            <div className="flex items-start gap-4">
                              <div className="bg-card p-2 rounded-lg text-xl">
                                {highlight.icon}
                              </div>
                              <div>
                                <h3 className="text-lg font-medium mb-1">
                                  {highlight.title}
                                </h3>
                                <p className="text-sm mb-4">
                                  {highlight.description}
                                </p>
                                
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded-full text-xs bg-${highlight.categoryColor}/20 text-${highlight.categoryColor}`}>
                                    {highlight.category}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium mb-4">Send feedback</h2>
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
                  <h2 className="text-lg font-medium mb-4">Spørgsmål til mægler</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Her er forslag til spørgsmål du kan stille ejendomsmægleren.
                  </p>
                  
                  <div className="space-y-3">
                    {property.risks.slice(0, 3).map(risk => (
                      <div key={`q-${risk.id}`} className="p-3 bg-secondary rounded-lg">
                        <p className="text-sm font-medium">Vedrørende {risk.title.toLowerCase()}:</p>
                        <p className="text-sm">Hvad vil det koste at udbedre dette problem?</p>
                      </div>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="w-full mt-4">
                    <Check className="h-4 w-4 mr-2" /> Marker som stillet
                  </Button>
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
