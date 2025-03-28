import { config } from "../config/config.ts";
import { AnalyzerServiceOptions, HTMLParseResult } from "../types/index.ts";
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
  private apiVersion: string;

  /**
   * Create a new AI analyzer service
   * @param options Configuration options
   */
  constructor(options: AnalyzerServiceOptions) {
    this.apiKey = config.claude.apiKey;
    this.apiEndpoint = config.claude.endpoint;
    this.model = config.claude.model;
    this.apiVersion = config.claude.apiVersion;
    console.log(this.apiKey)

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
      "Starting analyzeText with text length: " +
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

    Følgende regler gælder for energimærkninger I Danmark:

    # Regler for energimærkninger

    ##    En familiehuse og række/kædehuse mv.

    Det er lovpligtigt at fremlægge en gyldig energimærkning, når et fritliggende enfamiliehus på 60 m2 eller derover skal sælges. For række-, kæde- og dobbelthuse betragtes hver boligenhed som én bygning.

    Sælger har ansvar for energimærkningen
    Det er sælgers pligt at sørge for, at køber får udleveret energimærkningen. Hvis salget sker via ejendomsmægler, skal sælger fremlægge et gyldigt energimærke til ejendomsmægleren inden bygningen sættes til salg.

    Ved række-, kæde- og dobbelthuse, hvor boligejerne er organiseret i en ejerforening eller andels/anpartsforening, er det den enkelte ejer/andelshavers pligt at få udarbejdet et energimærke for boligen.

    Mærket skal være synligt ved annoncering
    Energimærket skal altid være synligt ved annoncering i kommercielle medier, uanset om det gælder salg, udleje eller overdragelse af en bygning eller bygningsenhed. Energimærkningen skal derfor være udarbejdet ved annonceringstidspunktet.

    Nye bygninger
    Nye bygninger på 60 m2 eller derover skal energimærkes. Energimærkningen skal indsendes til kommunen, inden bygningen bliver meldt færdig eller tages i brug. Formålet er at kontrollere, at bygningen overholder energikravene i byggetilladelsen.

    Bygherre har ansvar for energimærkningen
    Det er bygherren, som skal sørge for at stille den første energimærkning af ejendommen  til rådighed for de kommende ejere. Nyopførte bygninger får energimærke A2015 eller A2020. Tallet angiver, om bygningen lever op til de energimæssige krav i det gældende bygningsreglement (BR15) eller den frivillige lavenergiklasse 2020.

    ## Ejerlejlighed

    Det er lovpligtigt at fremlægge et energimærke, når en ejerlejlighed skal sælges. Energimærkning skal udarbejdes for hele ejendommen, hvis der er tale om en etageejendom. Energimærket er gyldigt i ti år. Det vil sige, at det kan genbruges, når andre lejligheder i bygningen sælges i gyldighedsperioden.

    Sælger skal sørge for udlevering af energimærke til køber
    Det er sælgers pligt at sørge for, at køber får udleveret ejendommens energimærke. Mærkningen skal fremlægges for køber, inden der bliver indgået en aftale om salg. Hvis salget sker via ejendomsmægler, skal sælger fremlægge energimærkning for ejendomsmægleren inden lejligheden annonceres til salg. Energimærket skal altid være synligt ved annoncering i kommercielle medier uanset om det gælder salg, udleje eller overdragelse.

    Ejerforeningen skal stille energimærkning til rådighed
    Ejerforeningen har pligt til at stille et gyldig energimærke til rådighed for sælgeren. Ejer man en lejlighed, kan man derfor kræve, at ejerforeningen stiller en gyldig energimærkning til rådighed uden beregning, når lejligheden skal sælges. Ejerforeningen har derefter 60 dage til at stille energimærkningen til rådighed.

    En ejerforening, der undlader at lade energimærkningen udarbejde, eller som ikke overholder de angivne frister, kan få et påbud fra Energistyrelsen. Det vil være muligt at straffe foreningen med bøde.

    Se mere under afsnittet "Sanktioner" nedenfor.

    ##Andelslejligheder

    Ved overdragelse af andel, anpart eller aktie i et boligfællesskab er der krav om energimærkning. Ved overdragelse af andele/anparter i en etageejendom, skal hele ejendommen energimærkes.

    Overdrager har ansvar for energimærkningen
    Det er overdragers pligt at sørge for, at køber får udleveret en energimærkning. Hvis overdragelsen af andel, anpart eller aktie i boligfællesskab sker via ejendomsmægler, skal overdrager fremlægge energimærkning af bygningen for ejendomsmægleren forud for annoncering af bygningen. Energimærket skal altid være synligt ved annoncering i kommercielle medier uanset om det gælder salg, udleje eller overdragelse.

    Foreningen skal stille energimærkning til rådighed
    Andels/anpartsforeningen har pligt til at stille et gyldigt energimærke til rådighed uden beregning, når en bolig skal overdrages. Det gælder dog kun, hvis andelen/anparten er en lejlighed i en etageejendom. For parcelhuse samt række-, kæde- og dobbelthuse er det den enkelte andels/anpartshavers pligt at få udarbejdet et energimærke for boligen. 
            
    ## Sommerhuse og fritidsboliger

    Sommerhuse/fritidsboliger skal ikke energimærkes.

    # Regler for energimærkninger SLUT


    2.1 Forsøg at vær kreativ med dine fordele og risici, og tænk ud over det åbenlyse - hvad kan være skjulte fordele og risici - og hvad kan være en potentiel dealbreaker for køberen?
    2.2 Vær opmærksom på, at du skal vurdere boligen ud fra den givne tekst, men du må godt bruge din egen viden og erfaring til at udfylde huller - f.eks, hvis du ved et område er kendt for noget specifikt.
    
    3. Sørg ALTID for at have en reference, til hvad du har brugt til at komme frem til dit svar, og inkluder det i feltet "excerpt" i JSON-formatet.

    4. Returnér svaret i nedenstående JSON-format (ingen tekst udenfor JSON):
    
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
    

    """${textContent}"""
    `;

    try {
      logger.info("Making request to Claude API for text analysis...");
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: config.claude.maxTokens,
          temperature: config.claude.temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${errorText}`);
      }

      const data = await response.json();
      const rawText = data?.content?.[0]?.text || "";

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
          `Failed to parse response from Claude: ${parseError.message}`
        );
      }

      return parsed;
    } catch (error) {
      logger.error("Error analyzing text:", error);
      throw error;
    }
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
      // Combine the texts for analysis
      if (!secondaryText) {
        logger.warn(
          "Secondary text content is missing, analyzing primary text only"
        );

        const analysis = await this.analyzeText(
          primaryText.extractedText || ""
        );

        return analysis;
      }

      const combinedText =
        `ORIGINAL ARTICLE FROM BOLIGSIDEN -- > ${primaryText.extractedText || ""}\n\n---\n\n ARTICLE FROM THE ORIGINAL REALESTATE AGENT:\n${secondaryText.extractedText || ""}`;

      // Perform the analysis
      const analysis = await this.analyzeText(combinedText);

      return analysis;
    } catch (error) {
      logger.error("Error analyzing multiple text contents", error);
      throw error;
    }
  }
}
