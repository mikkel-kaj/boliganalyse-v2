import {config} from "../config/config.ts";
import {AnalyzerServiceOptions, HTMLParseResult} from "../types/index.ts";
import {createLogger} from "../utils/logger.ts";
import {
  ClaudeMessage,
  ClaudeResponse,
  TextContentBlock,
  ToolCallRequest,
  ToolRegistry,
  ToolUseContentBlock,
} from "../types/tool-calling.ts";
import {ToolRegistryService} from "./tool-registry.ts";

const logger = createLogger("AIAnalyzer");

/**
 * Service for performing AI analysis on text from real estate listings
 * This service ONLY handles text analysis, not HTML parsing
 */
export class AIAnalyzerService {
  private apiKey: string;
  private apiEndpoint: string;
  private model: string;
  private apiVersion: string;
  private toolRegistry: ToolRegistry;

  /**
   * Create a new AI analyzer service
   * @param options Configuration options
   */
  constructor(options: AnalyzerServiceOptions) {
    this.apiKey = config.claude.apiKey;
    this.apiEndpoint = config.claude.endpoint;
    this.model = config.claude.model;
    this.apiVersion = config.claude.apiVersion;

    const shouldInitializeTools = options.initializeTools ?? true;
    this.toolRegistry = new ToolRegistryService(shouldInitializeTools);

    if (!this.apiKey) {
      throw new Error("Claude API key is required");
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
      `Starting analyzeText with text length: ${textContent?.length || 0}`,
    );

    if (!textContent) {
      throw new Error("No text content provided for analysis");
    }

    try {
      const prompt = this.createAnalysisPrompt(textContent);
      const response = await this.analyzeWithTools(prompt);

      if (response.stop_reason && response.stop_reason !== "end_turn") {
        throw new Error(`Claude API error: ${response.stop_reason}`);
      }

      const rawText = response
        .content[response.content.length - 1] as TextContentBlock;

      return this.extractJsonFromResponse(rawText.text);
    } catch (error) {
      logger.error("Error analyzing text:", error);
      throw error;
    }
  }

  private extractJsonFromResponse(rawText: string): Record<string, any> {
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Could not find JSON in response");
    }

    try {
      const jsonText = rawText.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(
        `Failed to parse response from Claude: ${(error as Error).message}`,
      );
    }
  }

  private createAnalysisPrompt(textContent: string): string {
    return `
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
    
    3. Sørg ALTID for at have en reference, til hvad du har brugt til at komme frem til dit svar, og inkluder det i feltet "excerpt" i JSON-formatet.

    4. Returnér svaret i nedenstående JSON-format:
    
    {
      "summary": "Dine opsamlede tanker, baggrund, og konklusioner på boligen, inklusiv perspektiver der ikke passer til højdepunkter/risici",
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
        "energiMaerke": "...", // Kun hvis huset ikke er en fritidsbolig
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
    
  Du har adgang til Danmarks Statistiks API gennem værktøjer og skal hjælpe brugeren med at finde og analysere data. Du kan max lave 3 API-kald.
    
    Tilgængelige værktøjer:
    1. get_subjects - Find emner eller underkategorier i Danmarks Statistik
    2. get_tables - Find relevante tabeller, evt. filtreret på emner
    3. get_table_info - Få metadata om en specifik tabel (variabler, værdikoder, osv.)
    4. get_data - Hent data fra en tabel, evt. filtreret på variabler
    
    Processen for at hjælpe brugeren:
    // ALWAYS start by getting table information
    get_table_info({
      "lang": "da",
      "table_id": "EJ56"
    })
    1. Find relevante emner med get_subjects
    2. Find relevante tabeller med get_tables
    3. Undersøg metadata for de mest relevante tabeller med get_table_info
    4. Hent data med get_data
    5. Analyser data og giv brugeren et klart, koncist svar på dansk
    
    EKSEMPEL PÅ SVAR I "SUMMARY" feltet:
    
    Baseret på data fra Danmarks Statistik har jeg lavet en grundig analyse af boligen på Violvænget 1 i Strøby Egede. Her er mine vigtigste konklusioner:
    
    Demografiske forhold i [...]
    
    Kommunen har [...] indbyggere med en [...]
    Dette demografiske billede [...]
    
    Boligmarkedet i området
    
    Gennemsnitsprisen [...]
    Prisindekset [...]
    Der er bygget relativt flere [...]
    Etc.
    
    
    Vurdering af boligen
    
    
    Med en pris på [...] ligger boligen [...] området
    Kvadratmeterprisen [...] er cirka [...] det typiske niveau i regionen
    Etc.
    
    Fordele ved boligen
    
    A2015 energimærke sikrer lave driftsomkostninger og fremtidssikring
    Havudsigt og stor grund (1374 m²) er sjældne kvaliteter, der opretholder værdi
    Nybyggeri fra 2023 betyder minimal vedligeholdelse og moderne løsninger
    Etc.
    
    Risici ved købet
    
    Pris i forhold til [...]
    Demografisk udvikling [...]
    Beliggenhed [...]
    Etc.
    
    
    Ud fra et statistisk perspektiv [...]

    """${textContent}"""
    `;
  }

  /**
   * Analyze text with tool calling capabilities
   * @param prompt The prompt to send to Claude
   * @returns Analysis result with tool usage
   */
  async analyzeWithTools(prompt: string): Promise<ClaudeResponse> {
    logger.info("Starting analyzeWithTools");

    if (!prompt) {
      throw new Error("No prompt provided for analysis");
    }

    const tools = this.toolRegistry.getAllToolDefinitions();
    const messages: ClaudeMessage[] = [{ role: "user", content: prompt }];
    const finalResult: ClaudeResponse = { content: [] };

    try {
      let data = await this.makeClaudeRequest(messages, tools);

      while (data.content?.length > 0) {
        // Process text content
        for (const content of data.content) {
          if (content.type === "text") {
            console.log("AI thought:", (content as TextContentBlock).text);
            finalResult.content.push(content as TextContentBlock);
          }
        }

        // Find any tool calls
        const toolCall = data.content.find((c) => c.type === "tool_use") as
          | ToolUseContentBlock
          | undefined;

        // If no tool calls, we're done
        if (!toolCall) break;

        // Execute the tool
        logger.info(`Executing tool: ${toolCall.name}`);
        const toolRequest: ToolCallRequest = {
          name: toolCall.name,
          parameters: toolCall.input,
          id: toolCall.id,
        };

        const toolResponse = await this.toolRegistry.executeTool(toolRequest);
        const resultContent = toolResponse.error
          ? toolResponse.error
          : String(toolResponse.output);

        // Update conversation with assistant message and tool result
        messages.push({ role: "assistant", content: data.content });
        messages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: resultContent,
          }],
        });

        // Continue conversation
        data = await this.makeClaudeRequest(messages, tools);
      }

      return {
        id: data.id,
        model: data.model,
        role: data.role,
        stop_reason: data.stop_reason,
        content: finalResult.content,
      };
    } catch (error) {
      logger.error("Error analyzing with tools:", error);
      throw error;
    }
  }

  private async makeClaudeRequest(
    messages: ClaudeMessage[],
    tools?: any[],
  ): Promise<ClaudeResponse> {
    logger.info("Making request to Claude API");
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: {
        "anthropic-beta": "token-efficient-tools-2025-02-19",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        max_tokens: config.claude.maxTokens,
        temperature: config.claude.temperature,
        tools: tools,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${errorText}`);
    }

    return await response.json() as ClaudeResponse;
  }

  /**
   * Analyze multiple text contents
   * @param primaryText Primary text content
   * @param secondaryText Secondary text content
   * @returns Analysis result
   */
  async analyzeMultipleTexts(
    primaryText: HTMLParseResult,
    secondaryText: HTMLParseResult | undefined,
  ): Promise<any> {
    try {
      if (!secondaryText) {
        logger.warn(
          "Secondary text content is missing, analyzing primary text only",
        );
        return await this.analyzeText(primaryText.extractedText || "");
      }

      const combinedText = `ORIGINAL ARTICLE FROM BOLIGSIDEN -- > ${
        primaryText.extractedText || ""
      }\n\n---\n\n ARTICLE FROM THE ORIGINAL REALESTATE AGENT:\n${
        secondaryText.extractedText || ""
      }`;

      return await this.analyzeText(combinedText);
    } catch (error) {
      logger.error("Error analyzing multiple text contents", error);
      throw error;
    }
  }
}
