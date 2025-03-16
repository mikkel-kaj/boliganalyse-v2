import { config } from "../config/config.ts";
import {AnalysisResult, AnalyzerServiceOptions, HTMLParseResult} from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("AIAnalyzer");

/**
 * Service for performing AI analysis on text from real estate listings
 * This service ONLY handles text analysis, not HTML parsing
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
   * Analyze plain text to extract initial information including original link
   * @param textContent Plain text content to analyze
   * @param energyRating Optional energy rating to include in the prompt
   * @returns Analysis with original link and partial data
   */
  async analyzeText(
    textContent: string,
    energyRating?: string
  ): Promise<Record<string, any>> {
    logger.info("Starting analyzeTextForInitialData with text length: " + (textContent?.length || 0));
    
    if (!textContent) {
      logger.warn("No text content provided for initial analysis");
      throw new Error("No text content provided for analysis");
    }

    // Use the exact same prompt as the original implementation
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
    
    Returnér JSON i dette format:
    {
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
            {"promptTitle": "Spørg mægler", "prompt": "Specifikt spørgsmål til ejendomsmægleren"}
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
      logger.info("Making request to OpenAI API for text analysis...");
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model, // Using the exact model from original implementation
          messages: [{ role: "system", content: prompt }],
          max_tokens: 12000,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error (phase1): ${errorText}`);
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
        throw new Error(`Failed to parse response from OpenAI: ${parseError.message}`);
      }
      
      return parsed;
    } catch (error) {
      logger.error("Error analyzing text for initial data:", error);
      throw error;
    }
  }
  
  /**
   * Analyze multiple text contents
   * @param primaryText Primary text content
   * @param secondaryText Secondary text content 
   * @param partialAnalysis Any partial analysis already done
   * @returns Analysis result
   */
  async analyzeMultipleTexts(
    primaryText: HTMLParseResult,
    secondaryText: HTMLParseResult | undefined
  ): Promise<any> {
    try {
      // Combine the texts for analysis
      if (!secondaryText) {
        logger.warn("Secondary text content is missing, analyzing primary text only");

        const analysis = await this.analyzeText(`${primaryText});`);

        return this.convertToAnalysisResult(analysis);
      }

      const combinedText = `${primaryText.extractedText}\n\n---\n\nORIGINAL LISTING CONTENT:\n${secondaryText.extractedText}`;
      
      // Perform the analysis
      const analysis = await this.analyzeText(combinedText);

      return analysis
    } catch (error) {
      logger.error("Error analyzing multiple text contents", error);
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