
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Search } from "lucide-react";

const NewAnalysisPage = () => {
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

    // Navigate to the analysis page
    navigate('/analyse/demo');
  };

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Ny analyse</h1>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Indtast boligannonce</h2>
          
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Indsæt link til boligannonce
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="f.eks. https://www.boligsiden.dk/adresse/..."
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Du kan indsætte URL'en fra salgsopslaget på Boligsiden, Home, EDC, danbolig osv.
              </p>
            </div>
            
            <Button type="submit" className="w-full bg-purple hover:bg-purple-dark">
              <span>Analyser bolig</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              Vi henter og analyserer boligdata fra annoncen ved hjælp af kunstig intelligens.
              Analysen tager normalt under 30 sekunder.
            </p>
          </form>
        </div>
        
        <div className="mt-8">
          <h2 className="text-lg font-medium mb-4">Sådan virker det</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                1
              </div>
              <h3 className="font-medium mb-2">Indsæt link</h3>
              <p className="text-sm text-muted-foreground">
                Kopier linket fra boligannoncen og indsæt det ovenfor
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                2
              </div>
              <h3 className="font-medium mb-2">AI-analyse</h3>
              <p className="text-sm text-muted-foreground">
                Vores AI gennemgår alle detaljer i boligannoncen
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="bg-purple/10 text-purple rounded-full w-8 h-8 flex items-center justify-center mb-3">
                3
              </div>
              <h3 className="font-medium mb-2">Få resultatet</h3>
              <p className="text-sm text-muted-foreground">
                Se risikofaktorer og højdepunkter for boligen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAnalysisPage;
