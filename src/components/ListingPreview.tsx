import { Link } from 'react-router-dom';
import { RiskIcon, HighlightIcon } from '@/components/IconMapper';

interface ListingPreviewProps {
  listing: any; // TODO: Add proper typing
  showStatus?: boolean;
}

export const ListingPreview = ({ listing, showStatus = false }: ListingPreviewProps) => {
  const analysis = listing.analysis as any;
  
  // Use property_image_url if available, otherwise fallback
  const imageUrl = listing.property_image_url || '/placeholder.svg';
  
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

  if (!analysis?.property && !showStatus) return null;

  return (
    <Link
      to={`/analyse/${listing.id}`}
      className="property-card bg-card rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all"
    >
      <div className="relative">
        <img 
          src={imageUrl} 
          alt={analysis?.property?.address || "Bolig under analyse"} 
          className="w-full h-40 object-cover"
        />
        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
          {getTimeAgo(listing.created_at)}
        </div>
        {showStatus && !analysis?.property && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-sm font-medium text-white bg-purple px-3 py-1 rounded-full">
              {listing.status}
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
          <span>{analysis?.property?.size}</span>
        </div>
        
        {analysis?.risks && analysis.risks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">RISIKOFAKTORER</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.risks.slice(0, 4).map((risk: any, idx: number) => (
                <RiskIcon key={idx} risk={risk} size={3} />
              ))}
            </div>
          </div>
        )}
        
        {analysis?.highlights && analysis.highlights.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">HØJDEPUNKTER</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.highlights.slice(0, 4).map((highlight: any, idx: number) => (
                <HighlightIcon key={idx} highlight={highlight} size={3} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}; 