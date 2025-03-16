import { Link } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import SEO from "@/components/SEO";
import { ListingPreview } from '@/components/ListingPreview';

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
          {recentProperties.map((property) => (
            <ListingPreview 
              key={property.id} 
              listing={property} 
              showStatus={true}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default RecentAnalysesPage;
