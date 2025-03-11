
import { Link } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

const RecentAnalysesPage = () => {
  const { toast } = useToast();

  const { data: recentProperties, isLoading, error } = useQuery({
    queryKey: ['recent-analyses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Error fetching analyses:", error);
        toast({
          title: "Fejl ved indlæsning",
          description: "Der opstod en fejl ved indlæsning af boliganalyser. Prøv igen senere.",
          variant: "destructive"
        });
        throw error;
      }
      
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="container py-12">
        <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-muted-foreground">Indlæser boliganalyser...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-12">
        <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
        <div className="text-center py-12">
          <p className="text-destructive">Der opstod en fejl ved indlæsning af boliganalyser.</p>
          <p className="mt-2 text-muted-foreground">Prøv igen senere eller kontakt support hvis problemet fortsætter.</p>
        </div>
      </div>
    );
  }

  if (!recentProperties || recentProperties.length === 0) {
    return (
      <div className="container py-12">
        <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ingen boliganalyser fundet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recentProperties.map((property) => {
          const analysis = property.analysis ? (property.analysis as any) : null;
          if (!analysis?.property) return null;

          return (
            <Link 
              key={property.id} 
              to={`/analyse/${property.id}`}
              className="property-card bg-card rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all"
            >
              <div className="relative">
                <img 
                  src={analysis.property.images?.[0] || '/placeholder.svg'} 
                  alt={analysis.property.address} 
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                  {new Date(property.created_at).toLocaleDateString('da-DK')}
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-medium mb-1">{analysis.property.address}</h3>
                <p className="text-lg font-bold mb-2">{analysis.property.price}</p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>{analysis.property.size}</span>
                </div>
                
                {analysis.risks && analysis.risks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">RISIKOFAKTORER</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.risks.slice(0, 2).map((risk: any, idx: number) => (
                        <span key={idx} className="risk-badge bg-risk-default">
                          {risk.icon || '⚠️'} {risk.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.highlights && analysis.highlights.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">HØJDEPUNKTER</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.highlights.slice(0, 2).map((highlight: any, idx: number) => (
                        <span key={idx} className="highlight-badge bg-highlight-default/20 text-highlight-default">
                          {highlight.icon || '✨'} {highlight.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentAnalysesPage;
