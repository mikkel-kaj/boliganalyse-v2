import React from 'react';

interface ImagePlaceholderProps {
  alt: string;
  className?: string;
}

export const ImagePlaceholder: React.FC<ImagePlaceholderProps> = ({ alt, className = '' }) => {
  return (
    <div className={`relative bg-muted rounded-lg overflow-hidden ${className}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 mb-4 rounded-full bg-purple/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-purple"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          Billede ikke tilgængeligt
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Af hensyn til ophavsret kan billedet ikke vises
        </p>
      </div>
    </div>
  );
}; 