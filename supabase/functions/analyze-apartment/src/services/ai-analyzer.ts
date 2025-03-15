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
   * Analyze HTML content for listings - first phase to extract original link
   * @param htmlContent HTML content to analyze
   * @returns Result with original link and partial analysis
   */
  async ingestHtmlForLink(
    htmlContent: string,
    energyRating?: string
  ): Promise<{ originalLink?: string; partialAnalysis?: Record<string, any> }> {
    logger.info("Starting ingestHtmlForLink with HTML length: " + (htmlContent?.length || 0));
    
    if (!htmlContent) {
      logger.warn("No HTML content provided to ingestHtmlForLink");
      return { originalLink: undefined, partialAnalysis: { error: "No HTML" } };
    }

    // Extract readable text content from HTML
    const textContent = await this.extractTextFromHtml(htmlContent);
    logger.info("Extracted text content length for initial analysis: " + textContent.length);

    // 1) Prompt: find the original posting link - use exact same prompt as original
    const prompt = `
    1. Du er en ekspert i boliganalyse, der hjælper potentielle boligkøbere med at identificere skjulte risici og værdifulde fordele.
    
    Din opgave er at analysere boligannoncer grundigt og identificere både risici og fordele for en potentiel køber.
    
    Analysér omhyggeligt teksten med fokus på:

    1) BASAL INFORMATION: Vær opmærksom på følgende områder:
      - Generelle oplysninger: adresse, pris, boligtype, ejerform, størrelse, antal værelser, etage
      - Bygningsdetaljer: byggeår, renoveringsår, energimærke, tag, vægge, konstruktionsmateriale
      - Økonomi: udbetaling, månedlig ydelse, ejerudgift, boligafgift, grundskyld, fællesudgifter
      - Tilstand: stand, energimærke, vedligeholdelsesrapport, tilstandsrapport, el-rapport
      - Området: beskrivelse af kvarteret, afstand til transport, institutioner, indkøb
      - Historik: tidligere priser, tid på markedet, prisændringer, tidligere salg
      
    2) RISICI: Find og detaljer mindst 8-10 potentielle risici ved boligen. Vær grundig og kritisk!
      - Prishistorik (mange prisfald?)
      - Bygningens alder og stand
      - Energimærkning (dårlig = højere varmeudgifter)
      - Renoveringsbehov
      - Område/beliggenhed (trafik, støj, fremtidig udvikling)
      - Månedlige udgifter (høje fællesudgifter?)
      - Juridiske forhold (andel: bestyrelsens økonomi?, forpligtelser?)
      - Tid på markedet (lang tid = potentielle problemer?)
      - For hver risiko, inkluder konkrete handlingsanbefalinger (hvad køber bør spørge om/undersøge)
    
    3) FORDELE: Fremhæv 8-10 positive aspekter ved boligen:
      - Beliggenhed og område
      - Indretning og planløsning
      - Potentiale og muligheder
      - Energieffektivitet og bæredygtighed
      - Stand og kvalitet
      - Økonomi og værdi
      - Vælg passende ikoner fra listen i output-skabelonen

    4) ORIGINALLINK: Hvis du ser et link til den "originale" boligannonce (f.eks. 'Vis mere info' link), giv mig den URL.
    
    Returnér JSON i dette format:
    {
      "originalLink": "...",
      "summary": "Kort beskrivelse af din analyse på vegne af en potentiel boligkøber, lav en kort beskrivelse af hvad du har fundet, hvad du mener og hvad du anbefaler.",
      "property": {
        "address": "...",
        "price": "...", 
        "udbetaling": "...",
        "pricePerM2": "...",
        "size": "...",
        "værelser": "...", 
        "floor": "...",
        "boligType": "...",
        "ejerform": "...",
        "energiMaerke": "${energyRating || '...'}",
        "byggeaar": "...",
        "renoveringsaar": "...",
        "maanedligeUdgift": "..."
      },
      "risks": [
        {
          "category": "Energi|Tilstand|Økonomi|Beliggenhed|Juridisk|Andet",
          "title": "Kort præcis titel",
          "details": "Uddybet forklaring af risikoen (2-3 sætninger)",
          "excerpt": "Tekstuddrag fra annoncen der understøtter dette (ellers inkluder din egen forklaring)",
          "recommendations": [
            {"promptTitle": "Spørg megler", "prompt": "Specifikt spørgsmål til ejendomsmægleren"}
          ]
        }
      ],
      "highlights": [
        {
          "icon": "home|building|map|key|piggy-bank|scale|star|heart|award|lightbulb|thumbs-up|check|flag|search",
          "title": "Kort præcis fordel",
          "details": "Uddybet forklaring (2-3 sætninger)"
        }
      ]
    }
    
    VIGTIG VEJLEDNING:
    - Svar på dansk.
    - Være grundig og fokuser på fakta frem for salgssprog.
    - Vær grundig med RISICI - dette er den vigtigste del! Medtag også mindre risici.
    - FORDELE skal fremhæve det positive, men må ikke ignorere sandheden.
    - Udtræk så mange relevante informationer som muligt.
    - Hvis data mangler, brug tom streng ("").
    - Ingen tekst udenfor JSON.

    Annonce tekst:
    """${textContent}"""
    `;

    try {
      logger.info("Making request to OpenAI API for initial analysis...");
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-2024-07-18", // Using the exact model from original implementation
          messages: [{ role: "system", content: prompt }],
          max_tokens: 4096,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OpenAI API error: ${response.status}`, errorText);
        
        // Add more detailed error information
        let errorDetails = `Status: ${response.status}, ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorDetails += `. Message: ${errorJson.error.message || 'Unknown error'}`;
            logger.error("Detailed OpenAI error:", errorJson.error);
          }
        } catch (e) {
          // If JSON parsing fails, use the raw error text
          errorDetails += `. Raw error: ${errorText}`;
        }
        
        throw new Error(`OpenAI error (phase1): ${errorDetails}`);
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim() || "";
      
      // Attempt to parse JSON
      let parsed: Record<string, any> = {};
      try {
        // Extract JSON from the response - exact same code as original
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("Could not find JSON in response");
        }
        
        const jsonText = rawText.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(jsonText);
        
        logger.info("Successfully parsed JSON from response");
      } catch (error) {
        const parseError = error as Error;
        logger.error("Error parsing JSON from response:", parseError);
        throw new Error(`Failed to parse response from OpenAI: ${parseError.message}`);
      }
      
      return {
        originalLink: parsed.originalLink,
        partialAnalysis: parsed
      };
    } catch (error) {
      logger.error("Error ingesting HTML for link:", error);
      throw error;
    }
  }
  
  /**
   * Analyze HTML content for listings
   * @param htmlContent HTML content to analyze
   * @param partialAnalysis Any partial analysis already done
   * @returns Analysis result
   */
  async analyzeHtmlContent(
    htmlContent: string,
    partialAnalysis?: Record<string, any>
  ): Promise<AnalysisResult> {
    try {
      const extractedText = await this.extractTextFromHtml(htmlContent);
      
      // If there's a partial analysis already, use the finalAnalysis method to get
      // a proper result in the correct format
      if (partialAnalysis && Object.keys(partialAnalysis).length > 0) {
        // If we have just one HTML source, analyze it directly with our partial analysis
        return this.convertToAnalysisResult(partialAnalysis);
      }
      
      // Otherwise we'll do a full analysis from scratch
      // First get initial analysis
      const initial = await this.ingestHtmlForLink(htmlContent);
      return this.convertToAnalysisResult(initial.partialAnalysis || {});
    } catch (error) {
      logger.error("Error analyzing HTML content", error);
      throw error;
    }
  }
  
  /**
   * Analyze two HTML contents to extract more complete information
   * This is the finalAnalysis from the original implementation
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
    try {
      // Extract text from both HTML sources
      const firstText = await this.extractTextFromHtml(firstHtml);
      const secondText = await this.extractTextFromHtml(secondHtml);
      
      // Combine them for the analysis
      const combinedText = `${firstText}\n\n---\n\nORIGINAL LISTING CONTENT:\n${secondText}`;
      
      // Reuse our partial analysis if available
      if (partialAnalysis && Object.keys(partialAnalysis).length > 0) {
        return this.convertToAnalysisResult(partialAnalysis);
      }
      
      // Otherwise get initial link analysis first
      const initial = await this.ingestHtmlForLink(combinedText);
      return this.convertToAnalysisResult(initial.partialAnalysis || {});
    } catch (error) {
      logger.error("Error analyzing multiple HTML contents", error);
      throw error;
    }
  }
  
  /**
   * Convert the partial/full analysis to our AnalysisResult type
   * @param analysisData Any analysis data to convert
   * @returns Standardized analysis result
   */
  private convertToAnalysisResult(analysisData: Record<string, any>): AnalysisResult {
    // Extract core property data from the analysis
    const property = analysisData.property || {};
    
    const result: AnalysisResult = {
      address: property.address || "",
      price: property.price ? Number(property.price.toString().replace(/\D/g, '')) : undefined,
      area: property.size ? Number(property.size.toString().replace(/\D/g, '')) : undefined,
      rooms: property.værelser ? Number(property.værelser) : undefined,
      energyRating: property.energiMaerke || "",
      constructionYear: property.byggeaar ? Number(property.byggeaar) : undefined,
      monthlyExpenses: property.maanedligeUdgift ? Number(property.maanedligeUdgift.toString().replace(/\D/g, '')) : undefined,
      description: analysisData.summary || "",
      type: property.boligType || "",
    };
    
    // Include all other data fields as-is
    return {
      ...result,
      rawAnalysis: analysisData // Include the full raw analysis for reference
    };
  }
} 