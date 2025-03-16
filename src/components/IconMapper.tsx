import React from 'react';
import { 
  Check, Star, Flag, Heart, ThumbsUp, Home, Key, Search, 
  Lightbulb, Award, Building, Map, PiggyBank, Scale, AlertTriangle 
} from "lucide-react";

import { cn } from "@/lib/utils";

// Styled icon wrapper component
const StyledIcon = ({ 
  icon: Icon, 
  size = 5,
  className,
  gradient,
  solid,
}: { 
  icon: React.ElementType;
  size?: number;
  className?: string;
  gradient?: string;
  solid?: string;
}) => {
  if (gradient) {
    return (
      <div className={cn(
        `relative flex items-center justify-center`,
        `h-${size} w-${size}`,
        className
      )}>
        <div className={cn(
          "absolute inset-0 rounded-md opacity-20",
          gradient
        )} />
        <Icon className={`h-${size} w-${size} relative`} />
      </div>
    );
  }

  if (solid) {
    return (
      <div className={cn(
        `flex items-center justify-center rounded-md`,
        `h-${size} w-${size}`,
        solid,
        className
      )}>
        <Icon className={`h-${size-1} w-${size-1} text-white`} />
      </div>
    );
  }

  return <Icon className={cn(`h-${size} w-${size}`, className)} />;
};

/**
 * Maps icon name strings to React components
 * @param iconName The name of the icon to display
 * @param size The size of the icon (defaults to 5)
 * @returns The corresponding React icon component
 */
export const getIconComponent = (iconName: string, size = 5) => {
  const iconEmojis: Record<string, string> = {
    'star': '⭐',
    'check': '✅',
    'heart': '❤️',
    'thumbs-up': '👍',
    'home': '🏠',
    'key': '🔑',
    'search': '🔍',
    'lightbulb': '💡',
    'award': '🏆',
    'building': '🏢',
    'map': '🗺️',
    'piggy-bank': '🐷',
    'scale': '⚖️',
    'flag': '🚩',
    // Additional highlight-specific emojis
    'location': '📍',
    'transport': '🚇',
    'kitchen': '🍳',
    'bathroom': '🚿',
    'outdoor': '🌳',
    'interior': '🛋️',
    'parking': '🅿️',
    'storage': '📦',
    'view': '🌅',
    'quiet': '🤫',
    'bright': '☀️',
    'modern': '✨',
    'renovated': '🔨',
    'spacious': '📐',
    'balcony': '🏗️',
    'garden': '🌺',
    'security': '🔒',
    'elevator': '🛗',
    'windows': '🪟',
    'heating': '🌡️',
    'cooling': '❄️',
    'internet': '📶',
    'furnished': '🪑',
    'laundry': '🧺',
    'gym': '💪',
    'pool': '🏊‍♂️',
    'playground': '🎡',
    'bike': '🚲'
  };

  return (
    <span className="text-lg" style={{ fontSize: `${size * 4}px` }}>
      {iconEmojis[iconName?.toLowerCase()] || '⭐'}
    </span>
  );
};

/**
 * Maps risk category names to appropriate icon components with gradients
 * @param category The category name
 * @param size The size of the icon (defaults to 4)
 * @returns The corresponding React icon component for the category
 */
export const getCategoryIcon = (category: string, size = 4) => {
  const categoryEmojis: Record<string, string> = {
    'Energi': '⚡',
    'Tilstand': '🏠',
    'Økonomi': '💰',
    'Beliggenhed': '📍',
    'Juridisk': '⚖️',
    'Andet': '⚠️',
    'Building': '🏗️',
    'Technical': '🔧',
    'Safety': '🚨',
    'Transport': '🚇',
    'Kitchen': '🍳',
    'Bathroom': '🚿',
    'Outdoor': '🌳',
    'Interior': '🛋️',
    'Parking': '🅿️',
    'Storage': '📦'
  };

  return (
    <span className="text-lg" style={{ fontSize: `${size * 4}px` }}>
      {categoryEmojis[category] || '⚠️'}
    </span>
  );
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
  <div className="risk-badge bg-risk-default/20 text-risk-default px-2 py-1 rounded-full text-xs inline-flex items-center gap-1">
    {risk.icon ? 
      getIconComponent(risk.icon, size) : 
      (risk.category ? getCategoryIcon(risk.category, size) : '⚠️')} 
    {risk.title}
  </div>
); 