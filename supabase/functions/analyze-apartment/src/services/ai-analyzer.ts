import { config } from "../config/config.ts";
import { AnalysisResult, AnalyzerServiceOptions } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("AIAnalyzer");

/**
 * Service for performing AI analysis on real estate listings
 */
export class AIAnalyzerService {
  private apiKey: string;
  private apiEndpoint: string;
  private model: string;
  
  /**
   * Create a new AI analyzer service
   * @param options Configuration options
   */
  constructor(options: AnalyzerServiceOptions) {
    this.apiKey = options.apiKey;
    this.apiEndpoint = options.apiEndpoint || config.openai.endpoint;
    this.model = options.model || config.openai.model;
    
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
  }
  
  /**
   * Analyze HTML content for listings
   * @param htmlContent HTML content to analyze
   * @param extractedStructuredData Any structured data already extracted to assist the AI
   * @returns Analysis result
   */
  async analyzeHtmlContent(
    htmlContent: string,
    extractedStructuredData?: Record<string, any>
  ): Promise<AnalysisResult> {
    try {
      // Prepare context for the AI by extracting relevant text content
      let context = "";
      
      // If we have structured data, include it as context
      if (extractedStructuredData && Object.keys(extractedStructuredData).length > 0) {
        context += "### Extracted Structured Data\n";
        Object.entries(extractedStructuredData).forEach(([key, value]) => {
          context += `${key}: ${value}\n`;
        });
        context += "\n";
      }
      
      // Prepare the HTML for analysis - extract only relevant text
      // We'll prepare a DOMParser extraction in a separate utility
      
      // For now, let's use a simple regex to extract text and remove excessive whitespace
      const extractedText = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      // Let's use a prompt that asks the AI to extract structured information
      const messages = [
        {
          role: "system",
          content: `Du er en specialiseret AI til at analysere boligannoncer fra danske boligportaler. 
Din opgave er at analysere HTML-indholdet og ekstrahere strukturerede data. 
Vær så præcis som muligt med priser, areal, antal rum, etc. 
Hvis du er usikker på et svar, så angiv det som "ukendt" i stedet for at gætte.
Returner dataene i følgende JSON-format:
{
  "address": "Fuld adresse inkl. postnummer og by",
  "price": pris i danske kroner (numerisk værdi uden punktum som tusindtalsseparator),
  "area": areal i kvadratmeter (numerisk værdi),
  "rooms": antal værelser (numerisk værdi),
  "energyRating": "Energimærke (A, B, C, D, E, F eller G)",
  "constructionYear": byggeår (numerisk værdi),
  "monthlyExpenses": månedlige udgifter (numerisk værdi),
  "type": "boligtype (Lejlighed, Villa, Rækkehus, etc.)",
  "description": "Kort beskrivelse af boligen (max 100 ord)",
  "features": ["Liste", "af", "nøglefunktioner"]
}`
        },
        {
          role: "user",
          content: `Analysér følgende boligannonce og uddrag de angivne felter i JSON-format:
${context}\n
### Uddrag fra boligannoncen:\n${extractedText.slice(0, 15000)}` // limit to avoid token issues
        }
      ];
      
      // Call OpenAI API
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: config.openai.temperature,
          max_tokens: config.openai.maxTokens
        })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        logger.error("OpenAI API error", responseData);
        throw new Error(`OpenAI API error: ${responseData.error?.message || JSON.stringify(responseData)}`);
      }
      
      // Extract the AI's response
      const assistantMessage = responseData.choices?.[0]?.message?.content;
      
      if (!assistantMessage) {
        throw new Error("No response content from OpenAI");
      }
      
      // Try to extract the JSON from the response
      const jsonMatch = assistantMessage.match(/```json\s*({[\s\S]*?})\s*```/) || 
                        assistantMessage.match(/{[\s\S]*?}/);
                        
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from OpenAI response");
      }
      
      // Parse the JSON
      const analysisResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      
      // Convert numeric values to numbers
      if (analysisResult.price && typeof analysisResult.price === 'string') {
        analysisResult.price = Number(analysisResult.price.replace(/\./g, '').replace(/,/g, '.'));
      }
      
      if (analysisResult.area && typeof analysisResult.area === 'string') {
        analysisResult.area = Number(analysisResult.area.replace(/,/g, '.'));
      }
      
      if (analysisResult.rooms && typeof analysisResult.rooms === 'string') {
        analysisResult.rooms = Number(analysisResult.rooms);
      }
      
      if (analysisResult.constructionYear && typeof analysisResult.constructionYear === 'string') {
        analysisResult.constructionYear = Number(analysisResult.constructionYear);
      }
      
      if (analysisResult.monthlyExpenses && typeof analysisResult.monthlyExpenses === 'string') {
        analysisResult.monthlyExpenses = Number(
          analysisResult.monthlyExpenses.replace(/\./g, '').replace(/,/g, '.')
        );
      }
      
      return analysisResult;
    } catch (error) {
      logger.error("Error analyzing HTML content", error);
      throw error;
    }
  }
  
  /**
   * Analyze two HTML contents to extract more complete information
   * Useful when dealing with multiple pages of a listing
   * @param firstHtml First HTML content
   * @param secondHtml Second HTML content
   * @param partialAnalysis Any partial analysis already done
   * @returns Complete analysis result
   */
  async analyzeMultipleContents(
    firstHtml: string,
    secondHtml: string,
    partialAnalysis?: Record<string, any>
  ): Promise<AnalysisResult> {
    // Similar implementation to analyzeHtmlContent but combines both HTML sources
    // This is useful when we have content from both an aggregator and original source
    try {
      // For the multi-content case, we'll use a simplified approach for now
      // In a real implementation, you'd want to merge both HTML contents intelligently
      
      // First, try to analyze with any partial analysis we already have
      return await this.analyzeHtmlContent(firstHtml + "\n\n" + secondHtml, partialAnalysis);
    } catch (error) {
      logger.error("Error analyzing multiple HTML contents", error);
      throw error;
    }
  }
} 