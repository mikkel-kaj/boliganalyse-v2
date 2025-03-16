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

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md mx-auto">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive"/>
                    <h2 className="text-xl font-medium mb-2">Der opstod en fejl</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Button asChild>
                        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/> Tilbage til forsiden</Link>
                    </Button>
                </div>
            </div>
        );
    }

    // Analysis is not complete yet, show progress
    if (!property || status !== "Analyse fuldført") {
        // Try to get property address if available in the analysis
        const address = property?.address || "Boligadresse";

        return (
            <AnalysisProgressView
                status={status}
                propertyImageUrl={listing?.property_image_url}
                address={address}
            />
        );
    }

    const originalUrl = listing?.url || "";
    
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

    const timeAgoDisplay = listing?.created_at ? getTimeAgo(listing.created_at) : "Lige nu";

    // Use the property_image_url from the listing as the main image
    const mainImage = listing?.property_image_url || placeholderImage;

    const risksWithIds = risks.map((risk, index) => ({
        ...risk,
        id: risk.id || `risk-${index}`,
    }));

    const highlightsWithIds = highlights.map((highlight, index) => ({
        ...highlight,
        id: highlight.id || `highlight-${index}`,
    }));

    // Helper function to get property details
    const getPropertyDetails = () => {
        const details = [];

        // Add primary details
        if (property.price) {
            details.push({
                label: "Totalpris",
                value: property.price,
                subValue: property.pricePerM2 ? `${property.pricePerM2} per m²` : null
            });
        }

        if (property.askingPrice) {
            details.push({
                label: "Udbudspris",
                value: property.askingPrice,
                subValue: null
            });
        }

        if (property.buyingExpenses) {
            details.push({
                label: "Købsomkostninger",
                value: property.buyingExpenses,
                subValue: null
            });
        }

        if (property.monthlyFee) {
            details.push({
                label: "Fællesudgift/md",
                value: property.monthlyFee,
                subValue: null
            });
        }

        if (property.size) {
            details.push({
                label: "Boligareal",
                value: property.size,
                subValue: null
            });
        }

        if (property.boligType) {
            details.push({
                label: "Boligtype",
                value: property.boligType,
                subValue: null
            });
        }

        if (property.floor) {
            details.push({
                label: "Etage",
                value: property.floor,
                subValue: null
            });
        }

        if (property.yearBuilt || property.byggeaar) {
            details.push({
                label: "Byggeår",
                value: property.yearBuilt || property.byggeaar,
                subValue: null
            });
        }

        if (property.energiMaerke) {
            details.push({
                label: "Energimærke",
                value: property.energiMaerke,
                subValue: null
            });
        }

        // Add any additional details
        if (property.otherDetails && typeof property.otherDetails === 'object') {
            Object.entries(property.otherDetails).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    details.push({
                        label: key,
                        value: value,
                        subValue: null
                    });
                }
            });
        } else if (typeof property.otherDetails === 'string') {
            details.push({
                label: "Beskrivelse",
                value: property.otherDetails,
                subValue: null
            });
        }

        // Include any other fields not explicitly handled above
        const handledFields = [
            'price', 'askingPrice', 'buyingExpenses', 'monthlyFee', 'size', 'boligType',
            'floor', 'yearBuilt', 'byggeaar', 'energiMaerke', 'otherDetails',
            'address', 'images', 'timeAgo', 'pricePerM2'
        ];

        Object.entries(property).forEach(([key, value]) => {
            if (!handledFields.includes(key) && typeof value === 'string' && value.trim() !== '') {
                details.push({
                    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
                    value: value,
                    subValue: null
                });
            }
        });

        return details;
    };

    const propertyDetails = getPropertyDetails();

    // Generate property schema for SEO
    const generatePropertySchema = () => {
        if (!property) return null;

        return {
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            "name": `${property.address}`,
            "description": `AI-analyse af ${property.address} - ${property.zip_code} ${property.city}. Boliganalyse.ai afslører potentielle risikofaktorer og højdepunkter ved boligen.`,
            "url": `https://boliganalyse.ai/analyse/${id}`,
            "image": property.image_url || '',
            "address": {
                "@type": "PostalAddress",
                "addressLocality": property.city,
                "postalCode": property.zip_code,
                "streetAddress": property.address
            },
            "offers": {
                "@type": "Offer",
                "price": property.price,
                "priceCurrency": "DKK"
            },
            "floorSize": {
                "@type": "QuantitativeValue",
                "value": property.size,
                "unitCode": "MTK"
            }
        };
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {property && (
                <SEO
                    title={`Boliganalyse af ${property.address} - ${property.zip_code} ${property.city}`}
                    description={`AI-analyse af ${property.address}. Identificerer potentielle risikofaktorer og højdepunkter ved boligen. Pris: ${property.price ? property.price.toLocaleString('da-DK') + ' kr.' : 'N/A'}, størrelse: ${property.size} m².`}
                    ogImage={property.image_url || '/og-image.png'}
                    ogType="article"
                    schema={generatePropertySchema()}
                />
            )}

            <div className="container max-w-6xl mx-auto py-6 px-4">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="icon" className="rounded-full">
                            <Link to="/"><ArrowLeft className="h-4 w-4"/></Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">{property.address}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{property.zip_code} {property.city}</span>
                                <span className="text-xs">•</span>
                                <span className="text-xs">Oprettet {timeAgoDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`, '_blank')}>
                            Kart
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleShare}>
                            Del analyse
                        </Button>
                        {originalUrl && (
                            <Button variant="default" size="sm" onClick={() => window.open(originalUrl, '_blank')}>
                                Annonce
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Main Info */}
                    <div className="lg:col-span-2">
                        {/* Main Property Card */}
                        <div className="bg-card text-card-foreground rounded-xl p-6 mb-8">
                            {/* Property Image and Key Info */}
                            <div className="flex gap-6 mb-8">
                                {/* Left side - Image */}
                                <div className="w-1/2">
                                    <img
                                        src={mainImage}
                                        alt={property.address}
                                        className="w-full h-[280px] object-cover rounded-lg"
                                    />
                                </div>
                                {/* Right side - Key Information */}
                                <div className="w-1/2">
                                    <div className="space-y-6">
                                        <div>
                                            <h2 className="text-lg font-semibold mb-3">{property.address}</h2>
                                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                                <span>{property.zip_code} {property.city}</span>
                                            </div>
                                            <h3 className="text-sm text-muted-foreground mb-1">Totalpris</h3>
                                            <p className="text-2xl font-bold text-foreground">{property.price}</p>
                                            {property.pricePerM2 && (
                                                <p className="text-sm text-muted-foreground">{property.pricePerM2} per m²</p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h3 className="text-sm text-muted-foreground mb-1">Boligareal</h3>
                                                <p className="text-xl font-bold text-foreground">{property.size} m²</p>
                                            </div>
                                            <div>
                                                <h3 className="text-sm text-muted-foreground mb-1">Etage</h3>
                                                <p className="text-xl font-bold text-foreground">{property.floor || '2'}</p>
                                            </div>
                                            {property.monthlyFee && (
                                                <div>
                                                    <h3 className="text-sm text-muted-foreground mb-1">Fællesudgift/md</h3>
                                                    <p className="text-xl font-bold text-foreground">{property.monthlyFee}</p>
                                                </div>
                                            )}
                                            {property.energiMaerke && (
                                                <div>
                                                    <h3 className="text-sm text-muted-foreground mb-1">Energimærke</h3>
                                                    <p className="text-xl font-bold text-foreground">{property.energiMaerke}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Property Summary */}
                            {summary && summary.trim() !== '' && (
                                <div className="border-t border-border pt-6 mb-6">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {summary}
                                    </p>
                                </div>
                            )}

                            {/* Quick Overview Grid */}
                            <div className="border-t border-border pt-6">
                                <div className="grid grid-cols-2 gap-8">
                                    {/* Risks Overview */}
                                    <div>
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <span className="text-risk-default text-xl">⚠️</span>
                                            <span className="text-risk-default">Risikoer</span>
                                        </h2>
                                        <div className="flex flex-wrap gap-2">
                                            {risksWithIds.map((risk) => (
                                                <HoverCard key={risk.id} openDelay={100} closeDelay={100}>
                                                    <HoverCardTrigger asChild>
                                                        <div className="bg-risk-default/20 hover:bg-risk-default/30 px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors">
                                                            <div className="flex items-center">
                                                                {getCategoryIcon(risk.category, 4)}
                                                            </div>
                                                            <span className="text-xs font-medium text-risk-default">{risk.title}</span>
                                                            <span className="text-xs text-risk-default/70">▸</span>
                                                        </div>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent className="w-80 p-4 bg-popover text-popover-foreground border-risk-default/20">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getCategoryIcon(risk.category, 5)}
                                                                <h4 className="font-medium text-risk-default">{risk.title}</h4>
                                                            </div>
                                                            <p className="text-sm mb-3">{risk.details || risk.description}</p>
                                                            {risk.excerpt && (
                                                                <blockquote className="mt-2 text-sm italic border-l-2 border-risk-default/20 pl-3 text-muted-foreground">
                                                                    {risk.excerpt}
                                                                </blockquote>
                                                            )}
                                                            {risk.recommendations?.[0] && (
                                                                <div className="mt-3 bg-risk-default/20 rounded-lg p-3">
                                                                    <p className="text-sm font-medium text-risk-default">
                                                                        💬 Spørg mægler: "{risk.recommendations[0].prompt || risk.question}"
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </HoverCardContent>
                                                </HoverCard>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Highlights Overview */}
                                    <div>
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <span className="text-highlight-default text-xl">✨</span>
                                            <span className="text-highlight-default">Højdepunkter</span>
                                        </h2>
                                        <div className="flex flex-wrap gap-2">
                                            {highlightsWithIds.map((highlight) => (
                                                <HoverCard key={highlight.id} openDelay={100} closeDelay={100}>
                                                    <HoverCardTrigger asChild>
                                                        <div className="bg-highlight-default/20 hover:bg-highlight-default/30 px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors">
                                                            <div className="flex items-center">
                                                                {getIconComponent(highlight.icon || 'star', 4)}
                                                            </div>
                                                            <span className="text-xs font-medium text-highlight-default">{highlight.title}</span>
                                                            <span className="text-xs text-highlight-default/70">▸</span>
                                                        </div>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent className="w-80 p-4 bg-popover text-popover-foreground border-highlight-default/20">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getIconComponent(highlight.icon || 'star', 5)}
                                                                <h4 className="font-medium text-highlight-default">{highlight.title}</h4>
                                                            </div>
                                                            <p className="text-sm">{highlight.details}</p>
                                                        </div>
                                                    </HoverCardContent>
                                                </HoverCard>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Risks Section */}
                        <div className="bg-card text-card-foreground rounded-xl p-6 mb-8">
                            <h2 className="text-xl font-semibold mb-6 text-risk-default flex items-center gap-2">
                                <span className="text-2xl">⚠️</span>
                                Uddybende risikovurdering
                            </h2>
                            <div className="space-y-6">
                                {risksWithIds.map((risk) => (
                                    <div key={risk.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {getCategoryIcon(risk.category, 5)}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium mb-2 text-risk-default">{risk.title}</h3>
                                                <p className="text-sm text-muted-foreground">{risk.details || risk.description}</p>
                                                
                                                {risk.excerpt && (
                                                    <blockquote className="mt-3 text-sm italic border-l-2 border-risk-default/20 pl-3 text-muted-foreground">
                                                        {risk.excerpt}
                                                    </blockquote>
                                                )}

                                                {risk.recommendations?.[0] && (
                                                    <div className="mt-4 bg-risk-default/20 rounded-lg p-4">
                                                        <p className="text-sm font-medium text-risk-default">
                                                            💬 Spørg mægler: "{risk.recommendations[0].prompt || risk.question}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detailed Highlights Section */}
                        <div className="bg-card text-card-foreground rounded-xl p-6">
                            <h2 className="text-xl font-semibold mb-6 text-highlight-default flex items-center gap-2">
                                <span className="text-2xl">✨</span>
                                Uddybende højdepunkter
                            </h2>
                            <div className="space-y-6">
                                {highlightsWithIds.map((highlight) => (
                                    <div key={highlight.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {getIconComponent(highlight.icon || 'star', 5)}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium mb-2 text-highlight-default">{highlight.title}</h3>
                                                <p className="text-sm text-muted-foreground">{highlight.details}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Additional Details */}
                    <div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8">
                            <h2 className="text-lg font-semibold mb-4">Detaljer</h2>
                            <div className="space-y-4">
                                {propertyDetails.map((detail, index) => (
                                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                        <span className="text-sm text-muted-foreground">{detail.label}</span>
                                        <span className="text-sm font-medium">{detail.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {property.images && property.images.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4">Billeder</h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {property.images.slice(0, 6).map((image, index) => (
                                        <img
                                            key={index}
                                            src={image}
                                            alt={`${property.address} - ${index + 1}`}
                                            className="w-full h-24 object-cover rounded-lg"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-8 text-center text-sm text-muted-foreground">
                    <p>Boliganalyse.ai er et værktøj til at hjælpe dig med boligkøb, men erstatter ikke professionel rådgivning.</p>
                    <p>Informationen er kun vejledende. Alle købsbeslutninger skal baseres på egen research og besigtigelse.</p>
                </div>
            </div>
        </div>
    );
};

export default AnalysisPage;
