import {config} from "../config/config.ts";
import {AnalyzerServiceOptions, HTMLParseResult,} from "../types/index.ts";
import {createLogger} from "../utils/logger.ts";

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
    energyRating?: string,
  ): Promise<Record<string, any>> {
    logger.info(
      "Starting analyzeTextForInitialData with text length: " +
        (textContent?.length || 0),
    );

    if (!textContent) {
      logger.warn("No text content provided for initial analysis");
      throw new Error("No text content provided for analysis");
    }

    // Use the exact same prompt as the original implementation
    const prompt = `
    1. Du er en ekspert i boliganalyse, der hjælper potentielle boligkøbere med at identificere skjulte risici og værdifulde fordele. Din opgave er at analysere boligannoncer grundigt med fokus på fakta og proaktiv vurdering, selv med begrænset information.
    
    2. Analyser boligteksten omhyggeligt ud fra disse områder:
    
    **BASAL INFORMATION:**
    - Generelle oplysninger: adresse, pris, boligtype, ejerform, størrelse, antal værelser, etage
    - Bygningsdetaljer: byggeår, renoveringsår, energimærke, tag, vægge, konstruktionsmateriale
    - Økonomi: udbetaling, månedlig ydelse, ejerudgift, boligafgift, grundskyld, fællesudgifter
    - Tilstand: generel stand, vedligeholdelsesniveau, energimærke, rapporter (hvis nævnt)
    - Området: kvarter, transport, institutioner, indkøbsmuligheder, rekreative områder
    - Historik: prisændringer, tid på markedet, tidligere salg
    
    **RISICI:**
    Identificér mindst 8 risici ved boligen baseret på den givne tekst. Hvis data mangler, undgå at nævne "information mangler". Brug i stedet din ekspertise til at:
    - Vurdere sandsynlige risici baseret på boligtype, alder, beliggenhed og andre tilgængelige oplysninger.
    - Komme med realistiske og relevante antagelser, fx om potentielle omkostninger, støjgener eller renoveringsbehov.
    - Angive konkrete anbefalinger til spørgsmål, som køberen bør stille eller områder, der bør undersøges yderligere.
    
    Eksempler på risikokategorier:
    - Energimæssige forhold (fx potentielle høje energiomkostninger)
    - Bygningsmæssige forhold (alder, potentielle skjulte fejl, vedligeholdelsesbehov)
    - Beliggenhed (støj, trafik, kommende byggeri, parkering)
    - Økonomiske forhold (løbende udgifter, boligudgift sammenlignet med markedet)
    - Juridiske forhold (forpligtelser, vedtægter, husdyr, udlejning)
    
    **FORDELE:**
    Identificér mindst 8 fordele, der realistisk kan udledes af teksten. Brug din faglige dømmekraft og understreg styrker, der kan give værdi for køberen.
    
    Eksempler på fordele:
    - Beliggenhed og nærhed til faciliteter
    - Indretning og praktisk planløsning
    - Boligens generelle tilstand
    - Udearealer (have, terrasse, udsigt)
    - Økonomi (pris i forhold til markedet)
    - Energieffektivitet (hvis relevant)
    - Muligheder for personlig tilpasning
    
    2.1 Forsøg at vær kreativ med dine fordele og risici, og tænk ud over det åbenlyse - hvad kan være skjulte fordele og risici - og hvad kan være en potentiel dealbreaker for køberen?
    2.2 Vær opmærksom på, at du skal vurdere boligen ud fra den givne tekst, men du må godt bruge din egen viden og erfaring til at udfylde huller - f.eks, hvis du ved et område er kendt for noget specifikt.
    
    3. Returnér svaret i nedenstående JSON-format (ingen tekst udenfor JSON):
    
    {
      "summary": "Kort og præcis vurdering med vigtigste risici og fordele samt din anbefaling.",
      "property": {
        "address": "...",
        "price": "... kr.",
        "udbetaling": "... kr.",
        "pricePerM2": "... kr. per m²",
        "size": "... m²",
        "værelser": "...",
        "floor": "...",
        "boligType": "...",
        "ejerform": "...",
        "energiMaerke": "...",
        "byggeaar": "...",
        "renoveringsaar": "...",
        "maanedligeUdgift": "... kr."
      },
      "risks": [
        {
          "category": "Energi|Tilstand|Økonomi|Beliggenhed|Juridisk|Andet",
          "title": "Kort, præcis titel på risiko",
          "details": "Grundig vurdering af risikoen (2-3 sætninger)",
          "excerpt": "Relevante tekstdetaljer eller din egen vurdering",
          "recommendations": [
            {"promptTitle": "Spørg mægler", "prompt": "Relevant spørgsmål, der bør stilles mægleren"}
          ]
        }
      ],
      "highlights": [
        {
          "icon": "home|building|map|key|piggy-bank|scale|star|heart|award|lightbulb|thumbs-up|check|flag|search",
          "title": "Kort præcis fordel",
          "details": "Begrundet forklaring af fordelen (2-3 sætninger)"
        }
      ]
    }
    
    **VIGTIGT:**
    - Svar på dansk.
    - Foretag realistiske vurderinger frem for at pege på manglende oplysninger.
    - Vær grundig med både risici og fordele.
    

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
        const jsonStart = rawText.indexOf("{");
        const jsonEnd = rawText.lastIndexOf("}");

        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("Could not find JSON in response");
        }

        const jsonText = rawText.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(jsonText);
        logger.info("Successfully parsed JSON from response");
      } catch (error) {
        const parseError = error as Error;
        throw new Error(
          `Failed to parse response from OpenAI: ${parseError.message}`,
        );
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
    secondaryText: HTMLParseResult | undefined,
  ): Promise<any> {
    try {
      // Combine the texts for analysis
      if (!secondaryText) {
        logger.warn(
          "Secondary text content is missing, analyzing primary text only",
        );

        const analysis = await this.analyzeText(
          `${primaryText.extractedText});`,
        );

        return analysis;
      }

      const combinedText =
        `ORIGINAL ARTICLE FROM BOLIGSIDEN -- > ${primaryText.extractedText}\n\n---\n\n ARTICLE FROM THE ORIGINAL REALESTATE AGENT:\n${secondaryText.extractedText}`;

      // Perform the analysis
      const analysis = await this.analyzeText(combinedText);

      return analysis;
    } catch (error) {
      logger.error("Error analyzing multiple text contents", error);
      throw error;
    }
  }
}
