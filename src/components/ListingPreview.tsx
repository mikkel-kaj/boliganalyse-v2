import React from 'react';
import { Link } from 'react-router-dom';
import { RiskIcon, HighlightIcon } from '@/components/IconMapper';
import { ImagePlaceholder } from './ImagePlaceholder';

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
      className="property-card bg-card rounded-lg sm:rounded-xl overflow-hidden border border-border hover:border-purple/30 transition-all flex flex-col h-full"
    >
      <div className="relative">
        <ImagePlaceholder
          alt={analysis?.property?.address || "Bolig under analyse"}
          className="w-full h-36 sm:h-40"
        />
        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-[10px] sm:text-xs px-2 py-1 rounded-full">
          {getTimeAgo(listing.created_at)}
        </div>
        {showStatus && !analysis?.property && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-medium text-white bg-purple px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              {listing.status}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <h3 className="font-medium mb-0.5 sm:mb-1 text-sm sm:text-base line-clamp-1">
          {analysis?.property?.address || "Bolig under analyse"}
        </h3>
        <p className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">
          {analysis?.property?.price || "Analyserer..."}
        </p>
        
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
          <span>{analysis?.property?.size}</span>
        </div>
        
        <div className="space-y-2 sm:space-y-3 mt-auto">
          {analysis?.risks && analysis.risks.length > 0 && (
            <div className="space-y-1.5 sm:space-y-2">
              <h4 className="text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">
                RISIKOFAKTORER
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {analysis.risks.slice(0, 3).map((risk: any, idx: number) => (
                  <RiskIcon key={idx} risk={risk} size={3} />
                ))}
              </div>
            </div>
          )}
          
          {analysis?.highlights && analysis.highlights.length > 0 && (
            <div className="space-y-1.5 sm:space-y-2">
              <h4 className="text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">
                HØJDEPUNKTER
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {analysis.highlights.slice(0, 3).map((highlight: any, idx: number) => (
                  <HighlightIcon key={idx} highlight={highlight} size={3} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}; 