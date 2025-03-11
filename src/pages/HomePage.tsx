
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight } from "lucide-react";

const HomePage = () => {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "Angiv venligst URL",
        description: "Du skal indsætte et link til en boligannonce for at fortsætte.",
        variant: "destructive"
      });
      return;
    }

    // In a real app, we might validate the URL format more rigorously
    if (!url.includes('bolig') && !url.includes('ejendom')) {
      toast({
        title: "Ugyldig URL",
        description: "URL'en ser ikke ud til at være en boligliste. Kontroller og prøv igen.",
        variant: "destructive"
      });
      return;
    }

    // In a mock version, we'll just redirect to the analysis page
    // In reality, you'd send this URL to your backend for processing
    navigate('/analyse/demo');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col">
      <main className="flex-1">
        <section className="py-16 md:py-24 lg:py-32 container text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-block mb-6 px-4 py-1.5 bg-secondary rounded-full">
              <span className="text-sm font-medium">AI for boligkøb</span>
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
                <span className="text-sm font-medium">Nå med støtte for nybygg og fritidsboliger!</span>
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
                  placeholder="Lim ind Finn-kode eller Finn-lenke..."
                />
              </div>
              <Button type="submit" className="bg-purple hover:bg-purple-dark h-12 px-6">
                <span>Analyser bolig</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            
            <p className="text-xs text-muted-foreground mt-4 max-w-2xl mx-auto">
              Boliganalyse.ai er et støtteverktøy for boligkjøp, men erstatter ikke profesjonell rådgivning. 
              Alle beslutninger bør baseres på egen research og befaring - vi tar ikke ansvar for eventuelle feil i analysen.
            </p>
          </div>
        </section>
        
        <section className="py-12 md:py-16 container">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Nylig analyserte boliger</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentProperties.map((property, index) => (
              <div key={index} className="property-card bg-card rounded-xl overflow-hidden border border-border">
                <div className="relative">
                  <img 
                    src={property.image} 
                    alt={property.address} 
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                    {property.timeAgo} siden
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium mb-1">{property.address}</h3>
                  <p className="text-lg font-bold mb-2">{property.price} kr</p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>{property.size} m²</span>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">RISIKOFAKTORER</h4>
                    <div className="flex flex-wrap gap-2">
                      {property.risks.map((risk, idx) => (
                        <span key={idx} className={`risk-badge bg-${risk.color}`}>
                          {risk.icon} {risk.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">HØJDEPUNKTER</h4>
                    <div className="flex flex-wrap gap-2">
                      {property.highlights.map((highlight, idx) => (
                        <span key={idx} className={`highlight-badge bg-${highlight.color}/20 text-${highlight.color}`}>
                          {highlight.icon} {highlight.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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

// Mock data for recent properties
const recentProperties = [
  {
    address: "Mågevej 12, 2400 København",
    price: "2 995 000",
    size: "75",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
    timeAgo: "5 min",
    risks: [
      { label: "Slidt badeværelse", icon: "🚿", color: "risk-building" },
      { label: "Ældre vinduer", icon: "🪟", color: "risk-technical" },
    ],
    highlights: [
      { label: "Moderne køkken", icon: "🍽️", color: "highlight-kitchen" },
      { label: "Tæt på metro", icon: "🚇", color: "highlight-transport" },
    ]
  },
  {
    address: "Vesterbrogade 67, 1620 København",
    price: "4 250 000",
    size: "92",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
    timeAgo: "2 timer",
    risks: [
      { label: "Lav energimærkning", icon: "⚡", color: "risk-default" },
      { label: "Ventilationsproblemer", icon: "💨", color: "risk-ventilation" },
    ],
    highlights: [
      { label: "Nyligt renoveret", icon: "🏗️", color: "highlight-default" },
      { label: "Elevator i bygningen", icon: "🛗", color: "highlight-facilities" },
    ]
  },
  {
    address: "Amagerbrogade 123, 2300 København",
    price: "3 495 000",
    size: "81",
    image: "https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
    timeAgo: "1 dag",
    risks: [
      { label: "Støj fra gaden", icon: "🔊", color: "risk-default" },
      { label: "Gamle rør", icon: "🔧", color: "risk-technical" },
    ],
    highlights: [
      { label: "Altan", icon: "🏠", color: "highlight-default" },
      { label: "Ingen dokumentavgift", icon: "💰", color: "highlight-financial" },
    ]
  },
  {
    address: "Østerbrogade 45, 2100 København",
    price: "5 750 000",
    size: "110",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80",
    timeAgo: "3 dage",
    risks: [
      { label: "Ældre bygning", icon: "🏛️", color: "risk-history" },
      { label: "Behov for badeværelsesrenovering", icon: "🛁", color: "risk-building" },
    ],
    highlights: [
      { label: "God transportmulighed", icon: "🚌", color: "highlight-transport" },
      { label: "Fællesfaciliteter", icon: "🏘️", color: "highlight-community" },
    ]
  }
];

export default HomePage;
