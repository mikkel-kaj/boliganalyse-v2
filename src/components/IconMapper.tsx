import React from 'react';
import { 
  Check, Star, Flag, Heart, ThumbsUp, Home, Key, Search, 
  Lightbulb, Award, Building, Map, PiggyBank, Scale, AlertTriangle 
} from "lucide-react";

/**
 * Maps icon name strings to React components
 * @param iconName The name of the icon to display
 * @param size The size of the icon (defaults to 5)
 * @returns The corresponding React icon component
 */
export const getIconComponent = (iconName: string, size = 5) => {
  const iconMap: Record<string, React.ReactNode> = {
    'check': <Check className={`h-${size} w-${size}`} />,
    'star': <Star className={`h-${size} w-${size}`} />,
    'flag': <Flag className={`h-${size} w-${size}`} />,
    'heart': <Heart className={`h-${size} w-${size}`} />,
    'thumbs-up': <ThumbsUp className={`h-${size} w-${size}`} />,
    'home': <Home className={`h-${size} w-${size}`} />,
    'key': <Key className={`h-${size} w-${size}`} />,
    'search': <Search className={`h-${size} w-${size}`} />,
    'lightbulb': <Lightbulb className={`h-${size} w-${size}`} />,
    'award': <Award className={`h-${size} w-${size}`} />,
    'building': <Building className={`h-${size} w-${size}`} />,
    'map': <Map className={`h-${size} w-${size}`} />,
    'piggy-bank': <PiggyBank className={`h-${size} w-${size}`} />,
    'scale': <Scale className={`h-${size} w-${size}`} />
  };
  
  return iconMap[iconName?.toLowerCase()] || <Lightbulb className={`h-${size} w-${size}`} />;
};

/**
 * Maps risk category names to appropriate icon components
 * @param category The category name
 * @param size The size of the icon (defaults to 4)
 * @returns The corresponding React icon component for the category
 */
export const getCategoryIcon = (category: string, size = 4) => {
  const categoryIcons: Record<string, React.ReactNode> = {
    'Energi': <Lightbulb className={`h-${size} w-${size}`} />,
    'Tilstand': <Home className={`h-${size} w-${size}`} />,
    'Økonomi': <PiggyBank className={`h-${size} w-${size}`} />,
    'Beliggenhed': <Map className={`h-${size} w-${size}`} />,
    'Juridisk': <Scale className={`h-${size} w-${size}`} />,
    'Andet': <AlertTriangle className={`h-${size} w-${size}`} />
  };
  
  return categoryIcons[category] || <AlertTriangle className={`h-${size} w-${size}`} />;
};

/**
 * Renders an icon for highlights
 * @param highlight The highlight object containing icon and title properties
 * @param size The size of the icon (defaults to 4)
 * @returns JSX element with the icon and title
 */
export const HighlightIcon = ({ 
  highlight, 
  size = 4 
}: { 
  highlight: { icon?: string; title: string; }; 
  size?: number; 
}) => (
  <div className="highlight-badge bg-highlight-default/20 text-highlight-default px-2 py-1 rounded-full text-xs inline-flex items-center gap-1">
    {highlight.icon ? getIconComponent(highlight.icon, size) : '✨'} {highlight.title}
  </div>
);

/**
 * Renders an icon for risks
 * @param risk The risk object containing category and title properties
 * @param size The size of the icon (defaults to 4)
 * @returns JSX element with the icon and title
 */
export const RiskIcon = ({ 
  risk, 
  size = 4 
}: { 
  risk: { category: string; title: string; icon?: string; }; 
  size?: number; 
}) => (
  <div className="risk-badge bg-risk-default px-2 py-1 rounded-full text-xs inline-flex items-center gap-1">
    {risk.icon ? 
      getIconComponent(risk.icon, size) : 
      (risk.category ? getCategoryIcon(risk.category, size) : '⚠️')} 
    {risk.title}
  </div>
); 