import { useParams } from 'react-router-dom';
import { StatusProvider, useStatus } from '@/contexts/StatusContext';
import AnalysisProgressView from "@/components/AnalysisProgressView";
import AnalysisDetailsView from "@/components/AnalysisDetailsView";
import AnalysisInitialLoading from "@/components/AnalysisInitialLoading";
import { AnalysisStatus, isErrorStatus } from "@/lib/status";
import { useToast } from "@/hooks/use-toast.ts";
import { SurveyDialog } from "@/components/SurveyDialog";

const AnalysisPage = () => {
    const { id } = useParams();
    
    return (
        <StatusProvider initialListingId={id || null}>
            <AnalysisPageContent />
        </StatusProvider>
    );
};

const AnalysisPageContent = () => {
    const { 
        status, 
        isLoading, 
        error,
        listing
    } = useStatus();
    const { toast } = useToast();

    const placeholderImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80";

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            title: "Link kopieret",
            description: "Analyselinket er kopieret til udklipsholderen.",
            duration: 3000,
        });
    };
    
    const getTimeAgo = (date) => {
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
    
    const getPropertyDetails = (propertyData) => {
        if (!propertyData) return [];
        
        const details = [];
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
            if (propertyData[key]) {
                details.push({
                    label,
                    value: propertyData[key],
                    subValue: null
                });
            }
        });

        if (propertyData.otherDetails && typeof propertyData.otherDetails === 'object') {
            Object.entries(propertyData.otherDetails).forEach(([key, value]) => {
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

    if (isLoading) {
        return <AnalysisInitialLoading error={error} />;
    }

    const analysisData = listing?.analysis || {};
    const property = analysisData.property || {};
    const summary = analysisData.summary || "";
    const risks = analysisData.risks || [];
    const highlights = analysisData.highlights || [];

    if (isErrorStatus(status)) {
        return (
            <AnalysisProgressView
                status={status}
                propertyImageUrl={listing?.property_image_url || placeholderImage}
                address={property?.address || listing?.url?.split('/').pop() || "Boligadresse"}
                errorMessage={error || undefined}
            />
        );
    }

    const isCompleted = status === AnalysisStatus.COMPLETED;
    const hasPropertyData = property && typeof property === 'object' && Object.keys(property).length > 0;
    
    // If status is COMPLETED but we don't have property data, that's an error condition
    if (isCompleted && !hasPropertyData) {
        return (
            <AnalysisProgressView
                status={AnalysisStatus.ERROR}
                propertyImageUrl={listing?.property_image_url || placeholderImage}
                address={listing?.url?.split('/').pop() || "Boligadresse"}
                errorMessage="Analysen er afsluttet, men der mangler data om boligen."
            />
        );
    }
    
    // If not completed, show progress view
    if (!isCompleted) {
        const address = property?.address || listing?.url?.split('/').pop() || "Boligadresse";
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
        <>
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
                propertyId={listing?.id || ""}
            />
            <SurveyDialog isAnalysisComplete={isCompleted} />
        </>
    );
};

export default AnalysisPage;