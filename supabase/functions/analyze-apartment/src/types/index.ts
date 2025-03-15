/**
 * Type definitions for the analyze-apartment function
 */

export interface ListingData {
  id: string;
  url: string;
  normalized_url: string;
  status: string;
  original_source_url?: string;
  property_image_url?: string;
  analysis_result?: AnalysisResult;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ProviderInfo {
  name: string;
  canHandle: (url: string) => boolean;
  extractSourceUrl: (htmlContent: string) => Promise<string | undefined>;
}

export interface HTMLParseResult {
  originalLink?: string;
  energyRating?: string;
  property_image_url?: string;
  extractedText?: string;
  partialAnalysis?: Record<string, any>;
}

export interface AnalysisResult {
  address?: string;
  price?: number;
  area?: number;
  rooms?: number;
  energyRating?: string;
  constructionYear?: number;
  monthlyExpenses?: number;
  description?: string;
  type?: string;
  source?: string;
  [key: string]: any; // Allow for flexible fields
}

export interface AnalysisOptions {
  includePartialAnalysis?: boolean;
  forceReanalysis?: boolean;
}

export interface AnalyzerServiceOptions {
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
} 