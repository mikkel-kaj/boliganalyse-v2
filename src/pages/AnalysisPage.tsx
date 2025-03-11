
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, Share2, AlertTriangle, 
  Check, HelpCircle, Star, Send, ExternalLink
} from "lucide-react";

const AnalysisPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data for the property analysis
  const property = {
    id: id || 'demo',
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
    risks: [
      {
        id: "1",
        icon: "🏗️",
        title: "Sprækket gulvflise i entré",
        description: "Der er påvist en sprækket gulvflise i entréen, hvilket kan medføre behov for udbedringer.",
        quote: '"Der er afvigelse: Der er påvist en sprækket gulvflise i entréen."',
        category: "Byggeteknisk",
        categoryIcon: "🏗️",
        categoryColor: "risk-building",
        question: "Hvad vil det koste at udbedre den sprukne flise?"
      },
      {
        id: "2",
        icon: "🔧",
        title: "Membran på badeværelset",
        description: "Mere end halvdelen af den forventede brugstid er passeret på membranløsningen i badeværelset.",
        quote: '"Mere end halvdelen af den forventede brugstid er passeret på membranløsningen."',
        category: "Byggeteknisk",
        categoryIcon: "🔧",
        categoryColor: "risk-technical",
        question: "Hvornår skal membranen sandsynligvis udskiftes, og hvad vil omkostningerne være?"
      },
      {
        id: "3",
        icon: "🚨",
        title: "Ingen komfurvagt installeret",
        description: "Der er ikke monteret komfurvagt i køkkenet, hvilket bryder med nuværende forskrifter.",
        quote: '"Der er ikke monteret komfurvagt i køkkenet, hvilket er et krav for dette køkken."',
        category: "Sikkerhed",
        categoryIcon: "🚨",
        categoryColor: "risk-safety",
        question: "Hvilke konsekvenser kan det få ikke at have komfurvagt på plads?"
      },
      {
        id: "4",
        icon: "💨",
        title: "Naturlig ventilation på badeværelse",
        description: "Badeværelset har kun naturlig ventilation, hvilket kan være utilstrækkeligt.",
        quote: '"Rummet har kun naturlig ventilation."',
        category: "Ventilation",
        categoryIcon: "💨",
        categoryColor: "risk-ventilation",
        question: "Er det muligt at installere en mekanisk ventilationsløsning, og hvordan kan dette gøres?"
      },
      {
        id: "5",
        icon: "🏛️",
        title: "Ældre bygning med ukendt vedligeholdelseshistorik",
        description: "Bygningen er fra 1931 og har ikke en fuldstændig vedligeholdelseshistorik.",
        quote: '"Forhold, der har fået TG2 og TG3, skal gennemgås særligt omhyggeligt."',
        category: "Bygningshistorik",
        categoryIcon: "🏛️",
        categoryColor: "risk-history",
        question: "Hvilke større opgraderinger eller vedligeholdelse er blevet udført på bygningen de seneste år?"
      }
    ],
    highlights: [
      {
        id: "1",
        icon: "🚌",
        title: "Tæt på offentlig transport",
        description: "Tæt på flere buslinjer og metrostation inden for 5 minutters gang.",
        category: "Transport",
        categoryColor: "highlight-transport"
      },
      {
        id: "2",
        icon: "🍽️",
        title: "Moderne køkkenløsning",
        description: "Nyere køkken med induktionskomfur, indbygget ovn og opvaskemaskine.",
        category: "Køkken",
        categoryColor: "highlight-kitchen"
      },
      {
        id: "3",
        icon: "💰",
        title: "Ingen tinglysningsafgift",
        description: "Andelsbolig uden tinglysningsafgift ved køb, hvilket kan spare omkring 45.000 kr.",
        category: "Økonomi",
        categoryColor: "highlight-financial"
      },
      {
        id: "4",
        icon: "🏘️",
        title: "Velegnet til pendlere",
        description: "Central beliggenhed med gode transportmuligheder til og fra arbejde.",
        category: "Beliggenhed",
        categoryColor: "highlight-community"
      },
      {
        id: "5",
        icon: "🚲",
        title: "Fællesarealer med faciliteter",
        description: "Fælles gårdareal, cykelparkering og vaskeri til beboernes disposition.",
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
          {/* Header with address and actions */}
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
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ExternalLink className="h-4 w-4" /> Annonce
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
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
                        {property.risks.map((risk) => (
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
                        {property.highlights.map((highlight) => (
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
                    {property.risks.map((risk, index) => (
                      <div key={risk.id} className="border border-border rounded-lg p-6">
                        <div className="flex items-start gap-2 mb-3">
                          <h3 className="text-lg font-medium">
                            {index + 1}. {risk.title}
                          </h3>
                        </div>
                        
                        <p className="text-sm mb-2">
                          {risk.description} {risk.quote}
                        </p>
                        
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
                    {property.risks.slice(0, 3).map(risk => (
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
