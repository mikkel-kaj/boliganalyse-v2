import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ArrowLeft, Share2, MessageSquare, ChevronDown } from "lucide-react";
import { getCategoryIcon, getIconComponent } from "@/components/IconMapper";
import SEO from "@/components/SEO";
import FeedbackForm from "@/components/FeedbackForm";
import DetailedCommercial from "@/components/DetailedCommercial";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ImagePlaceholder } from './ImagePlaceholder';
import { Expandable, ExpandableTrigger, ExpandableContent } from "@/components/ui/expandable";

interface PropertyDetail {
    label: string;
    value: string;
    subValue: string | null;
}

interface AnalysisDetailsViewProps {
    property: any;
    listing: any;
    risks: any[];
    highlights: any[];
    summary: string;
    timeAgoDisplay: string;
    propertyDetails: PropertyDetail[];
    onShare: () => void;
    originalUrl: string;
    propertyId: string;
}

const AnalysisDetailsView: React.FC<AnalysisDetailsViewProps> = ({
    property,
    listing,
    risks,
    highlights,
    summary,
    timeAgoDisplay,
    propertyDetails,
    onShare,
    originalUrl,
    propertyId
}) => {
    // Add unique IDs to risks and highlights for mapping
    const risksWithIds = risks.map((risk, index) => ({
        ...risk,
        id: risk.id || `risk-${index}`,
    }));

    const highlightsWithIds = highlights.map((highlight, index) => ({
        ...highlight,
        id: highlight.id || `highlight-${index}`,
    }));

    // Generate property schema for SEO
    const generatePropertySchema = () => {
        return {
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            "name": `${property.address}`,
            "description": `AI-analyse af ${property.address} - ${property.zip_code} ${property.city}. Boliganalyse.ai afslører potentielle risikofaktorer og højdepunkter ved boligen.`,
            "url": window.location.href,
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
        <div className="min-h-screen bg-background">
            <SEO
                title={`Boliganalyse af ${property.address} - ${property.zip_code} ${property.city}`}
                description={`AI-analyse af ${property.address}. Identificerer potentielle risikofaktorer og højdepunkter ved boligen. Pris: ${property.price ? property.price.toLocaleString('da-DK') + ' kr.' : 'N/A'}, størrelse: ${property.size} m².`}
                ogImage={property.image_url || '/og-image.png'}
                ogType="article"
                schema={generatePropertySchema()}
            />

            <div className="container max-w-6xl mx-auto py-4 px-4 sm:py-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="icon" className="rounded-full">
                            <Link to="/"><ArrowLeft className="h-4 w-4"/></Link>
                        </Button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold">{property.address}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="text-sm">{property.zip_code} {property.city}</span>
                                <span className="text-xs">•</span>
                                <span className="text-xs">Oprettet {timeAgoDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`, '_blank')}>
                            Kort
                        </Button>
                        <Button variant="outline" size="sm" onClick={onShare}>
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
                            <div className="flex flex-col md:flex-row gap-6 mb-8">
                                {/* Key Information - Will be full width on mobile, half width on desktop */}
                                <div className="w-full md:w-1/2 order-1 md:order-2">
                                    <div className="space-y-6">
                                        <div>
                                            <h2 className="text-lg font-semibold mb-3">{property.address}</h2>
                                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                                <span>{property.zip_code} {property.city}</span>
                                            </div>
                                            <h3 className="text-sm text-muted-foreground mb-1">Totalpris</h3>
                                            <p className="text-2xl font-bold text-foreground">{property.price}</p>
                                            {property.pricePerM2 && (
                                                <p className="text-sm text-muted-foreground">{property.pricePerM2}</p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h3 className="text-sm text-muted-foreground mb-1">Boligareal</h3>
                                                <p className="text-xl font-bold text-foreground">{property.size}</p>
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

                                {/* Image - Will be full width on mobile, half width on desktop */}
                                <div className="w-full md:w-1/2 order-2 md:order-1">
                                    <ImagePlaceholder
                                        alt={property.address}
                                        className="w-full h-[280px]"
                                    />
                                </div>
                            </div>

                            {/* Property Summary */}
                            {summary && summary.trim() !== '' && (
                                <div className="border-t border-border pt-6 mb-6">
                                    <div className="bg-muted/50 rounded-lg p-6 relative overflow-hidden">
                                        {/* Gradient effect in the background */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple/5 to-transparent" />
                                        
                                        <div className="relative">  {/* Added relative to keep content above gradient */}
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="bg-purple/10 rounded-full p-2.5 ring-1 ring-purple/20">
                                                    <span className="text-xl">✨</span>
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-semibold">AI-genereret opsummering</h2>
                                                    <p className="text-sm text-muted-foreground">Analyseret af vores AI-assistent</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {summary}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick Overview Grid using risksWithIds and highlightsWithIds*/}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-6">
                                {/* Risks Section */}
                                <div className="space-y-3">
                                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <span className="text-risk-default text-xl">⚠️</span>
                                                <span className="text-risk-default">Risikoer</span>
                                    </h2>
                                    <div className="space-y-2">
                                        {risksWithIds.map((risk) => (
                                            <HoverCard key={risk.id} openDelay={100} closeDelay={100}>
                                                <Expandable expandDirection="vertical" expandBehavior="replace">
                                                    <HoverCardTrigger asChild>
                                                        <ExpandableTrigger>
                                                            <div className="bg-risk-default/20 hover:bg-risk-default/30 px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors group">
                                                                <div className="flex items-center">
                                                                    {getCategoryIcon(risk.category, 4)}
                                                                </div>
                                                                <span className="text-xs font-medium text-risk-default">{risk.title}</span>
                                                                <div className="ml-auto flex items-center gap-1">
                                                                    <ChevronDown className="h-3 w-3 text-risk-default/70 transition-transform group-data-[state=open]:rotate-180" />
                                                                </div>
                                                            </div>
                                                        </ExpandableTrigger>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent side="right" className="w-80 p-4 bg-popover text-popover-foreground border-risk-default/20">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getCategoryIcon(risk.category, 5)}
                                                                <h4 className="font-medium text-risk-default">{risk.title}</h4>
                                                            </div>
                                                            <p className="text-sm">{risk.details || risk.description}</p>
                                                        </div>
                                                    </HoverCardContent>
                                                    <ExpandableContent>
                                                        <div className="bg-card border border-border rounded-lg p-4 mt-2">
                                                            <p className="text-sm">{risk.details || risk.description}</p>
                                                            {risk.excerpt && (
                                                                <blockquote className="mt-3 text-sm italic border-l-2 border-risk-default/20 pl-3 text-muted-foreground">
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
                                                    </ExpandableContent>
                                                </Expandable>
                                            </HoverCard>
                                        ))}
                                    </div>
                                </div>

                                {/* Highlights Section */}
                                <div className="space-y-3">
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <span className="text-highlight-default text-xl">✨</span>
                                            <span className="text-highlight-default">Højdepunkter</span>
                                        </h2>
                                    <div className="space-y-2">
                                        {highlightsWithIds.map((highlight) => (
                                            <HoverCard key={highlight.id} openDelay={100} closeDelay={100}>
                                                <Expandable expandDirection="vertical" expandBehavior="replace">
                                                    <HoverCardTrigger asChild>
                                                        <ExpandableTrigger>
                                                            <div className="bg-highlight-default/10 hover:bg-highlight-default/20 px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors group">
                                                                <div className="flex items-center">
                                                                    {getIconComponent(highlight.icon || 'star', 4)}
                                                                </div>
                                                                <span className="text-xs font-medium text-highlight-default">{highlight.title}</span>
                                                                <div className="ml-auto flex items-center gap-1">
                                                                    <ChevronDown className="h-3 w-3 text-highlight-default/70 transition-transform group-data-[state=open]:rotate-180" />
                                                                </div>
                                                            </div>
                                                        </ExpandableTrigger>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent side="right" className="w-80 p-4 bg-popover text-popover-foreground border-highlight-default/20">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getIconComponent(highlight.icon || 'star', 5)}
                                                                <h4 className="font-medium text-highlight-default">{highlight.title}</h4>
                                                            </div>
                                                            <p className="text-sm">{highlight.details}</p>
                                                        </div>
                                                    </HoverCardContent>
                                                    <ExpandableContent>
                                                        <div className="bg-card border border-border rounded-lg p-4 mt-2">
                                                            <p className="text-sm">{highlight.details}</p>
                                                            {highlight.excerpt && (
                                                                <blockquote className="mt-3 text-sm italic border-l-2 border-highlight-default/20 pl-3 text-muted-foreground">
                                                                    {highlight.excerpt}
                                                                </blockquote>
                                                            )}
                                                        </div>
                                                    </ExpandableContent>
                                                </Expandable>
                                            </HoverCard>
                                        ))}
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
                                                <p className="text-sm">{risk.details || risk.description}</p>
                                                
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
                        <div className="bg-card text-card-foreground rounded-xl p-6 mb-8">
                            <h2 className="text-lg font-semibold mb-4">Detaljer</h2>
                            <div className="space-y-4">
                                {propertyDetails.map((detail, index) => (
                                    <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                                        <span className="text-sm text-muted-foreground">{detail.label}</span>
                                        <span className="text-sm font-medium">{detail.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {property.images && property.images.length > 0 && (
                            <div className="bg-card text-card-foreground rounded-xl p-6 mb-8">
                                <h2 className="text-lg font-semibold mb-4">Billeder</h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {property.images.slice(0, 6).map((_, index) => (
                                        <ImagePlaceholder
                                            key={index}
                                            alt={`${property.address} - ${index + 1}`}
                                            className="w-full h-24"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Move FeedbackForm here */}
                        <div className="bg-card text-card-foreground rounded-xl p-6">
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <Button variant="outline" className="w-full flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        <span>Giv feedback på analysen</span>
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-4">
                                    <FeedbackForm 
                                        propertyId={propertyId}
                                        propertyAddress={property.address}
                                    />
                                </CollapsibleContent>
                            </Collapsible>
                            <DetailedCommercial />
                        </div>
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

export default AnalysisDetailsView; 