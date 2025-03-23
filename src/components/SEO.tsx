import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  schema?: Record<string, any>;
}

const SEO = ({
  title = 'Boliganalyse.ai | AI til boligkøb',
  description = 'Analyser boligannoncer med AI og undgå overraskelser ved boligkøb. Kunstig intelligens afslører skjulte risikofaktorer og spørgsmål du bør stille til fremvisning.',
  canonicalPath = '',
  ogImage = '/og-image.png',
  ogType = 'website',
  schema,
}: SEOProps) => {
  const location = useLocation();
  const fullTitle = title.includes('Boliganalyse.ai') ? title : `${title} | Boliganalyse.ai`;
  
  useEffect(() => {
    // Update document title
    document.title = fullTitle;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      metaDescription.setAttribute('content', description);
      document.head.appendChild(metaDescription);
    }
    
    // Update Open Graph tags
    const updateMetaTag = (property: string, content: string) => {
      let metaTag = document.querySelector(`meta[property="${property}"]`);
      if (metaTag) {
        metaTag.setAttribute('content', content);
      } else {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('property', property);
        metaTag.setAttribute('content', content);
        document.head.appendChild(metaTag);
      }
    };
    
    updateMetaTag('og:title', fullTitle);
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', ogImage);
    updateMetaTag('og:url', `https://boliganalyse.ai${location.pathname}`);
    updateMetaTag('og:type', ogType);
    
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    
    // Update canonical URL
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = `https://boliganalyse.ai${canonicalPath || location.pathname}`;
    
    if (canonicalTag) {
      canonicalTag.setAttribute('href', canonicalUrl);
    } else {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      canonicalTag.setAttribute('href', canonicalUrl);
      document.head.appendChild(canonicalTag);
    }
    
    // Add schema markup if provided
    if (schema) {
      let scriptTag = document.querySelector('script[type="application/ld+json"]');
      if (scriptTag) {
        scriptTag.textContent = JSON.stringify(schema);
      } else {
        scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'application/ld+json');
        scriptTag.textContent = JSON.stringify(schema);
        document.head.appendChild(scriptTag);
      }
    }
    
    // Cleanup function
    return () => {
      // Not removing tags as they might be needed by other pages
    };
  }, [fullTitle, description, canonicalPath, ogImage, ogType, schema, location.pathname]);
  
  return null; // This component doesn't render anything
};

export default SEO; 