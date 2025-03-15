import { Link } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import SEO from "@/components/SEO";

const RecentAnalysesPage = () => {
  const { toast } = useToast();

  // SEO schema for recent analyses page
  const recentAnalysesSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Nyligt analyserede boliger | Boliganalyse.ai",
    "description": "Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger.",
    "url": "https://boliganalyse.ai/analyseret"
  };

  const { data: recentProperties, isLoading, error } = useQuery({
    queryKey: ['recent-analyses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      
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
      <>
        <SEO 
          title="Nyligt analyserede boliger | Boliganalyse.ai"
          description="Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger."
          schema={recentAnalysesSchema}
        />

        <div className="container py-12">
          <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4 text-muted-foreground">Indlæser boliganalyser...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO 
          title="Nyligt analyserede boliger | Boliganalyse.ai"
          description="Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger."
          schema={recentAnalysesSchema}
        />

        <div className="container py-12">
          <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
          <div className="text-center py-12">
            <p className="text-destructive">Der opstod en fejl ved indlæsning af boliganalyser.</p>
            <p className="mt-2 text-muted-foreground">Prøv igen senere eller kontakt support hvis problemet fortsætter.</p>
          </div>
        </div>
      </>
    );
  }

  if (!recentProperties || recentProperties.length === 0) {
    return (
      <>
        <SEO 
          title="Nyligt analyserede boliger | Boliganalyse.ai"
          description="Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger."
          schema={recentAnalysesSchema}
        />

        <div className="container py-12">
          <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Ingen boliganalyser fundet.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Nyligt analyserede boliger | Boliganalyse.ai"
        description="Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger."
        schema={recentAnalysesSchema}
      />

      <div className="container py-12">
        <h1 className="text-3xl font-bold mb-8">Nyligt analyserede boliger</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentProperties.map((property: any) => {
            const analysis = property.analysis ? (property.analysis as any) : null;
            if (!analysis?.property && property.status !== "Opslag fundet!" && property.status !== "Første fase analyse gennemført") return null;

            // Determine the best image to display - prioritize property_image_url
            let imageUrl = '/placeholder.svg';
            
            if (property.property_image_url) {
              imageUrl = property.property_image_url;
            }

            return (
              <Link 
                key={property.id} 
                to={`/analyse/${property.id}`}
                className="property-card bg-card rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all"
              >
                <div className="relative">
                  <img 
                    src={imageUrl} 
                    alt={analysis?.property?.address || "Bolig under analyse"} 
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                    {new Date(property.created_at).toLocaleDateString('da-DK')}
                  </div>
                  {!analysis?.property && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-sm font-medium text-white bg-purple px-3 py-1 rounded-full">
                        {property.status}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium mb-1">
                    {analysis?.property?.address || "Bolig under analyse"}
                  </h3>
                  <p className="text-lg font-bold mb-2">
                    {analysis?.property?.price || "Analyserer..."}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>{analysis?.property?.size || ""}</span>
                  </div>
                  
                  {analysis?.risks && analysis.risks.length > 0 && (
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
                  
                  {analysis?.highlights && analysis.highlights.length > 0 && (
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
    </>
  );
};

export default RecentAnalysesPage;
