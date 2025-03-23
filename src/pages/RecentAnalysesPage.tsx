import {supabase} from "@/integrations/supabase/client";
import {useQuery} from '@tanstack/react-query';
import SEO from "@/components/SEO";
import {ListingPreview} from '@/components/ListingPreview';
import {AnalysisStatus} from '@/types/status';

const RecentAnalysesPage = () => {
    // SEO schema for recent analyses page
    const recentAnalysesSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Nyligt analyserede boliger | Boliganalyse.ai",
        "description": "Udforsk nyligt AI-analyserede boliger på Boliganalyse.ai. Se risikofaktorer og højdepunkter ved forskellige boliger.",
        "url": "https://boliganalyse.ai/analyseret"
    };

    const {data: recentProperties, isLoading, error} = useQuery({
        queryKey: ['recent-analyses'],
        queryFn: async () => {
            const {data, error} = await supabase
                .from('client_apartment_listings')
                .select('*')
                .eq('status', AnalysisStatus.COMPLETED)
                .order('created_at', {ascending: false})
                .limit(30);

            if (error) {
                throw error;
            }

            // Filter out listings missing property data
            if (!data) return [];
            
            return data.filter(listing => 
                listing?.analysis?.property?.address
            );
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
                        <p className="mt-2 text-muted-foreground">Prøv igen senere eller kontakt support hvis problemet
                            fortsætter.</p>
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

            <div className="container py-4 sm:py-8 px-2 sm:px-4 md:px-6">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 px-2 sm:px-0">
                    Nyligt analyserede boliger
                </h1>

                {/* Mobile view: 2 columns with smaller cards */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
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
