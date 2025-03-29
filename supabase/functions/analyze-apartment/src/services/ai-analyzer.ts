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

// Sleep function to delay between API calls
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  private apiDelay: number = 6000; // 3 seconds delay between API calls

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
   Du er ekspert i boliganalyser på det danske marked, og bruger idag din erfaring til at hjælpe fremtidige boligejere med at identificere skjulte risici og værdifulde fordele.
       
   Din opgave er at lave en grundig analyse af en boligannonce
     
   Forsøg at vær kreativ med dine fordele og risici, og tænk ud over det åbenlyse - hvad kan være skjulte fordele og risici - og hvad kan være en potentiel dealbreaker for køberen?
       
   Vær opmærksom på, at du skal vurdere boligen ud fra den givne tekst, men du må godt bruge din egen viden og erfaring til at udfylde huller, hvis du ved et område/materiale/boligtype eller noget fjerde,
        er kendt for noget specifikt.
      
   Sørg ALTID for at have en reference, til hvad du har brugt til at komme frem til dit svar, og inkluder det i feltet "excerpt" i JSON-formatet.
    
   Udover at identificere risici og fordele, skal du også give afgive en kort rapport om boligen, og de kommunale forhold, som kan have indflydelse på boligens værdi.
   
   Det er vigtigt, at du fokusere på ting, der er vigtige for køberen.
   
   Køberen er et par i 30'erne, med et barn på 3 år. De er begge i arbejde, og har en samlet indkomst på 1.000.000 kr. om året.
   Køberen er interesseret i at vide, om boligen er et godt køb, og om der er noget, der kan påvirke boligens værdi.
   Køberen er også interesseret i at vide, om boligen er et godt sted at bo, og om der er noget, der kan påvirke boligens værdi.
   
   
   **OPGAVE 1**    
   
    Du skal forsøge at perskektivere boligen i forhold til Danmarks Statistik, og lave en grundig analyse af boligen udfra data i Danmarks statistik.
    
    Vælg et par fokusområder, som du vil undersøge nærmere med Danmarks Statistik, som er relevant for din købers profil og boligopslaget.
    
    DU har adgang til Danmarks Statistik, vha. tool_calls.
    
    Her er nogle regler du skal følge:
    
    - Først, brug get_subjects uden parametre for at få de gyldige top-level subject codes
    - Brug derefter get_tables med subject code for at få de gyldige table codes
    - Brug derefter get_table_info med table code for at få de gyldige variable
    - Brug til sidst get_data med table code og de variable, du vil have data for
    
    Vær OBS på at bruge de rigtige parametre til funktionerne.
    

    **OPGAVE 2**
    1. Analyser boligannoncens detaljer, sammen med dine kommunale observationer. Du kan overveje at inkludere disse områder:
    
    **BASAL INFORMATION:**
    - Generelle oplysninger: adresse, pris, boligtype, ejerform, størrelse, antal værelser, etage
    - Bygningsdetaljer: byggeår, renoveringsår, energimærke, tag, vægge, konstruktionsmateriale
    - Økonomi: udbetaling, månedlig ydelse, ejerudgift, boligafgift, grundskyld, fællesudgifter
    - Tilstand: generel stand, vedligeholdelsesniveau, energimærke, rapporter (hvis nævnt)
    - Området: kvarter, transport, institutioner, indkøbsmuligheder, rekreative områder
    - Historik: prisændringer, tid på markedet, tidligere salg
    - Energimæssige forhold (fx potentielle høje energiomkostninger)
    - Bygningsmæssige forhold (alder, potentielle skjulte fejl, vedligeholdelsesbehov)
    - Beliggenhed (støj, trafik, kommende byggeri, parkering)
    - Økonomiske forhold (løbende udgifter, boligudgift sammenlignet med markedet)
    - Juridiske forhold (forpligtelser, vedtægter, husdyr, udlejning)

    
    **RISICI:**
    Identificér mindst 8 risici ved boligen baseret på den givne tekst. Brug din ekspertise til at:
    - Vurdere sandsynlige risici baseret på boligtype, alder, beliggenhed og andre tilgængelige oplysninger.
    - Komme med realistiske og relevante antagelser, fx om potentielle omkostninger, støjgener eller renoveringsbehov.
    - Angive konkrete anbefalinger til spørgsmål, som køberen bør stille eller områder, der bør undersøges yderligere.

    
    **FORDELE:**
    Identificér mindst 8 fordele, der realistisk kan udledes af teksten. Brug din faglige dømmekraft og understreg styrker, der kan give værdi for køberen.
   
   ** Boligannonce: **
   ${textContent}
   
   
    4. Returnér svaret i nedenstående JSON-format:
    
    {
      "summary": "Dine vigtigeste konklusioner fra din grundige analyse af kommunen, lokalområdet, og boligopslaget",
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
          "recommendations": [ // Liste af anbefalinger til køberne
            {"promptTitle": "Spørg mægler/Undersøg nærmere", "prompt": "Relevant spørgsmål, der bør stilles mægleren"}
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

        console.log("tool result:" + resultContent);

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
    retryCount: number = 0,
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

    if (!response.ok && response.status == 429 && retryCount < 3) {
      logger.warn("Rate limited by Claude API, retrying in 30 seconds");
      await sleep(60000);
      return await this.makeClaudeRequest(messages, tools, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log(response.toString());
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
