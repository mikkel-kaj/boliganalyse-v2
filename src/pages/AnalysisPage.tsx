
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
    totalPrice: "2 799 073",
    pricePerSqm: "186 515",
    askingPrice: "2 200 000",
    monthlyFee: "5 660",
    size: "15",
    sizeType: "BRA-i",
    floor: "2",
    yearBuilt: "1931",
    risks: [
      {
        id: "1",
        icon: "🏗️",
        title: "Sprekt gulvflis i entré",
        description: "Det er påvist en sprekt gulvflis i entré, noe som kan medføre behov for utbedringer.",
        quote: '"Det er avvik: Det er påvist en sprekt gulvflis i entré."',
        category: "Byggteknisk",
        categoryIcon: "🏗️",
        categoryColor: "risk-building",
        question: "Hva vil det koste å utbedre den sprukne flisen?"
      },
      {
        id: "2",
        icon: "🔧",
        title: "Membran på badet",
        description: "Mer enn halvparten av forventet brukstid har passert på membranløsningen i badet.",
        quote: '"Mer enn halvparten av forventet brukstid er passert på membranløsningen."',
        category: "Byggteknisk",
        categoryIcon: "🔧",
        categoryColor: "risk-technical",
        question: "Når må membranen sannsynligvis skiftes, og hva vil kostnadene være?"
      },
      {
        id: "3",
        icon: "🚨",
        title: "Ingen komfyrvakt installert",
        description: "Det er ikke montert komfyrvakt på kjøkkenet, noe som bryter med dagens forskrifter.",
        quote: '"Det er ikke montert komfyrvakt i kjøkkenet som er krav på dette kjøkkenet."',
        category: "Sikkerhet",
        categoryIcon: "🚨",
        categoryColor: "risk-safety",
        question: "Hvilke konsekvenser kan det få å ikke ha komfyrvakt på plass?"
      },
      {
        id: "4",
        icon: "💨",
        title: "Naturlig ventilasjon på bad",
        description: "Badet har kun naturlig ventilasjon, noe som kan være utilstrekkelig.",
        quote: '"Rommet har kun naturlig ventilasjon."',
        category: "Ventilasjon",
        categoryIcon: "💨",
        categoryColor: "risk-ventilation",
        question: "Er det mulig å installere en mekanisk ventilasjonsløsning, og hvordan kan dette gjøres?"
      },
      {
        id: "5",
        icon: "🏛️",
        title: "Eldre bygning med ukjent vedlikeholdshistorikk",
        description: "Bygningen er fra 1931 og har ikke en fullstendig vedlikeholdshistorikk.",
        quote: '"Forhold som har fått TG2 og TG3 må gjennomgås spesielt nøye."',
        category: "Bygningshistorikk",
        categoryIcon: "🏛️",
        categoryColor: "risk-history",
        question: "Hvilke større oppgraderinger eller vedlikehold har blitt gjort på bygningen de siste årene?"
      }
    ],
    highlights: [
      {
        id: "1",
        icon: "🚌",
        title: "Nærhet til kollektivtransport",
        description: "Tett på flere busslinjer og T-banestasjon innen 5 minutters gange.",
        category: "Transport",
        categoryColor: "highlight-transport"
      },
      {
        id: "2",
        icon: "🍽️",
        title: "Moderne kjøkkenløsning",
        description: "Nyere kjøkken med induksjonstopp, innbygget stekeovn og oppvaskmaskin.",
        category: "Kjøkken",
        categoryColor: "highlight-kitchen"
      },
      {
        id: "3",
        icon: "💰",
        title: "Ingen dokumentavgift",
        description: "Borettslag uten dokumentavgift ved kjøp, som kan spare omkring 45.000 kr.",
        category: "Økonomi",
        categoryColor: "highlight-financial"
      },
      {
        id: "4",
        icon: "🏘️",
        title: "Godt tilrettelagt for pendlere",
        description: "Sentral beliggenhet med gode transportmuligheter til og fra jobb.",
        category: "Beliggenhet",
        categoryColor: "highlight-community"
      },
      {
        id: "5",
        icon: "🚲",
        title: "Fellesarealer med fasiliteter",
        description: "Felles gårdsrom, sykkelparkering og vaskerom til beboernes disposisjon.",
        category: "Fasiliteter",
        categoryColor: "highlight-facilities"
      }
    ]
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link kopiert",
      description: "Analyselinket er kopiert til utklippstavlen.",
      duration: 3000,
    });
  };

  const handleAskQuestion = (question: string) => {
    toast({
      title: "Spørsmål notert",
      description: "Dette spørsmålet er lagt til i din liste over spørsmål å stille eiendomsmegleren.",
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
                <ExternalLink className="h-4 w-4" /> Annonse
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ExternalLink className="h-4 w-4" /> Kart
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
                        <h3 className="text-sm text-muted-foreground">Prisantydning</h3>
                        <p className="text-xl font-bold">kr {property.askingPrice}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Felleskost/mnd</h3>
                        <p className="text-xl font-bold">kr {property.monthlyFee}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Internt bruksareal</h3>
                        <p className="text-xl font-bold">{property.size} m² {property.sizeType}</p>
                      </div>
                      <div>
                        <h3 className="text-sm text-muted-foreground">Etasje</h3>
                        <p className="text-xl font-bold">{property.floor}</p>
                      </div>
                    </div>
                    
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-medium">Risikoer <span className="text-sm text-muted-foreground">(klikk for detaljer)</span></h3>
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
                        <h3 className="text-base font-medium">Høydepunkter <span className="text-sm text-muted-foreground">(klikk for detaljer)</span></h3>
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
                    Basert på AI-analyse av boligens salgsoppgave.
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
                          <div className="text-xs text-muted-foreground uppercase mb-1">SPØR MEGLER</div>
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
                  <h2 className="text-lg font-medium mb-4">Gi tilbakemelding</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Hjelp oss å forbedre våre analyser ved å sende tilbakemelding om denne rapporten.
                  </p>
                  
                  <div className="space-y-4">
                    <textarea 
                      className="w-full h-32 p-3 border rounded-md bg-background resize-none"
                      placeholder="Skriv din tilbakemelding her..."
                    />
                    
                    <Button className="w-full">
                      <Send className="h-4 w-4 mr-2" /> Send tilbakemelding
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium mb-4">Spørsmål til megler</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Her er forslag til spørsmål du kan stille eiendomsmegleren.
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
                    <Check className="h-4 w-4 mr-2" /> Marker som stilt
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardContent className="p-6 text-xs text-muted-foreground">
                  <p className="mb-4">
                    Boliganalyse.ai er et verktøy for å hjelpe deg med boligkjøp, men erstatter ikke profesjonell rådgivning. 
                    Informasjonen som gis er kun for veiledende formål og er ikke juridisk eller profesjonell rådgivning.
                  </p>
                  <p>
                    Alle kjøpsbeslutninger bør baseres på egen research, befaring og profesjonell rådgivning. 
                    Vi tar ikke ansvar for eventuelle feil eller mangler i analysen.
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
