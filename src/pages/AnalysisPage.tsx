import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {useToast} from "@/hooks/use-toast";
import {supabase} from "@/integrations/supabase/client";
import AnalysisProgress from "@/components/AnalysisProgress";
import {AlertTriangle, ArrowLeft, ExternalLink, FileText, Loader2, Send, Share2, Star, MapPin} from "lucide-react";
import {getCategoryIcon, getIconComponent} from "@/components/IconMapper";
import {HoverCard, HoverCardContent, HoverCardTrigger} from "@/components/ui/hover-card";
import SEO from "@/components/SEO";
import FeedbackForm from "@/components/FeedbackForm";
import AnalysisProgressView from "@/components/AnalysisProgressView";
import AnalysisDetailsView from "@/components/AnalysisDetailsView";
import AnalysisInitialLoading from "@/components/AnalysisInitialLoading";

const AnalysisPage = () => {
    const {id} = useParams();
    const {toast} = useToast();
    const [loading, setLoading] = useState(true);
    const [listing, setListing] = useState<any>(null);
    const [property, setProperty] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<any | null>(null);
    const [risks, setRisks] = useState<any[]>([]);
    const [highlights, setHighlights] = useState<any[]>([]);
    const [status, setStatus] = useState<string>("Starter analyse");
    const placeholderImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";

    // Function to fetch listing data
    const fetchListing = async () => {
        if (!id) {
            setError("Ingen analyse-ID angivet");
            setLoading(false);
            return;
        }

        try {
            const {data, error} = await supabase
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
            setStatus(data.status || "Starter analyse");

            // If analysis is available, parse it
            if (data.analysis &&
                typeof data.analysis === 'object' &&
                'property' in data.analysis) {

                const analysisData = data.analysis;

                setProperty(analysisData.property);
                setSummary(analysisData.summary);

                const risksArray = Array.isArray(analysisData.risks) ? analysisData.risks : [];
                const highlightsArray = Array.isArray(analysisData.highlights) ? analysisData.highlights : [];

                setRisks(risksArray);
                setHighlights(highlightsArray);
            }

            setLoading(false);
        } catch (err) {
            console.error("Error fetching listing:", err);
            setError("Der opstod en fejl ved indlæsning af analysen");
            setLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchListing();
    }, [id]);

    // Set up real-time subscription for status updates
    useEffect(() => {
        if (!id) return;

        const channel = supabase
            .channel('table-db-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'apartment_listings',
                    filter: `id=eq.${id}`
                },
                (payload) => {
                    console.log('Change received!', payload);

                    // Update state with new data from payload
                    if (payload.new) {
                        // Update status if it changed
                        if (payload.new.status) {
                            console.log('New status:', payload.new.status);
                            setStatus(payload.new.status);
                        }

                        // Update listing with property_image_url if it's available
                        if (payload.new.property_image_url) {
                            console.log('New property image URL:', payload.new.property_image_url);
                            setListing(prevListing => ({
                                ...prevListing,
                                property_image_url: payload.new.property_image_url
                            }));
                        }

                        // If the analysis is completed, fetch the full listing with analysis data
                        if (payload.new.status === "Analyse fuldført") {
                            fetchListing();
                        }
                    }
                }
            )
            .subscribe((status) => {

            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            title: "Link kopieret",
            description: "Analyselinket er kopieret til udklipsholderen.",
            duration: 3000,
        });
    };

    const getTimeAgo = (date: string) => {
        const now = new Date();
        const past = new Date(date);
        const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
        
        if (diffInSeconds < 150) {
            return 'lige nu';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} ${minutes === 1 ? 'minut' : 'minutter'} siden`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} ${hours === 1 ? 'time' : 'timer'} siden`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} ${days === 1 ? 'dag' : 'dage'} siden`;
        }
    };

    // Helper function to get property details
    const getPropertyDetails = (property: any) => {
        const details = [];

        // Add all available property details
        const detailsMapping = [
            { key: 'boligType', label: 'Boligtype' },
            { key: 'ejerform', label: 'Ejerform' },
            { key: 'size', label: 'Størrelse' },
            { key: 'værelser', label: 'Værelser' },
            { key: 'price', label: 'Pris' },
            { key: 'pricePerM2', label: 'Pris pr. m²' },
            { key: 'udbetaling', label: 'Udbetaling' },
            { key: 'maanedligeUdgift', label: 'Månedlig udgift' },
            { key: 'byggeaar', label: 'Byggeår' },
            { key: 'renoveringsaar', label: 'Renoveringsår' },
            { key: 'floor', label: 'Etage' },
            { key: 'energiMaerke', label: 'Energimærke' }
        ];

        detailsMapping.forEach(({ key, label }) => {
            if (property[key]) {
                details.push({
                    label,
                    value: property[key],
                    subValue: null
                });
            }
        });

        // Add any additional details from otherDetails
        if (property.otherDetails && typeof property.otherDetails === 'object') {
            Object.entries(property.otherDetails).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    details.push({
                        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
                        value: value,
                        subValue: null
                    });
                }
            });
        }

        return details;
    };

    if (loading) {
        return <AnalysisInitialLoading error={error} />;
    }

    if (!property || status !== "Analyse fuldført") {
        const address = property?.address || "Boligadresse";
        return (
            <AnalysisProgressView
                status={status}
                propertyImageUrl={listing?.property_image_url}
                address={address}
            />
        );
    }

    const timeAgoDisplay = listing?.created_at ? getTimeAgo(listing.created_at) : "Lige nu";
    const propertyDetails = getPropertyDetails(property);

    return (
        <AnalysisDetailsView
            property={property}
            listing={listing}
            risks={risks}
            highlights={highlights}
            summary={summary}
            timeAgoDisplay={timeAgoDisplay}
            propertyDetails={propertyDetails}
            onShare={handleShare}
            originalUrl={listing?.url || ""}
            propertyId={id || ""}
        />
    );
};

export default AnalysisPage;
