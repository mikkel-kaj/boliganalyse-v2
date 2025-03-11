// deno-lint-ignore-file no-explicit-any
/**
 * Two-phase AI analysis:
 *  - Phase 1: Ingest initial HTML to discover link to original posting
 *  - Phase 2: After second GET, combine both HTMLs for final AI analysis
 */

// Add Deno types reference for development environment
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const openAiApiUrl = "https://api.openai.com/v1/chat/completions";

/**
 * Phase 1: Identify "original posting" link from the first HTML
 */
export async function ingestHtmlForLink(
  htmlContent: string,
): Promise<{ originalLink?: string; partialAnalysis?: any }> {
  console.log("Starting ingestHtmlForLink with HTML length:", htmlContent?.length);
  
  if (!htmlContent) {
    console.warn("No HTML content provided to ingestHtmlForLink");
    return { originalLink: undefined, partialAnalysis: { error: "No HTML" } };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    console.error("Missing OPENAI_API_KEY in environment");
    throw new Error("Missing OPENAI_API_KEY");
  }

  // 1) Prompt: find the original posting link
  console.log("Preparing prompt for OpenAI...");
  const prompt = `
    Du modtager første del af HTML fra en boligannonce. 
    Din opgave i denne fase er at uddrage så meget relevant information som muligt:

    1) Uddrag ALLE relevante detaljer om boligen:
      - Generelle oplysninger: adresse, pris, boligtype, ejerform, størrelse, antal værelser, etage
      - Bygningsdetaljer: byggeår, renoveringsår, energimærke, tag, vægge, konstruktionsmateriale
      - Økonomi: udbetaling, månedlig ydelse, ejerudgift, boligafgift, grundskyld, fællesudgifter
      - Tilstand: stand, energimærke, vedligeholdelsesrapport, tilstandsrapport, el-rapport
      - Området: beskrivelse af kvarteret, afstand til transport, institutioner, indkøb
      - Historik: tidligere priser, tid på markedet, prisændringer, tidligere salg
      - Plantegninger: information om rumfordeling
      - Ejendomsmægler: navn, kontaktinfo, webside, "vis mere info" links

    2) Originallink: Hvis du ser et link til den "originale" boligannonce (f.eks. 'Vis mere info' link), giv mig den URL.

    3) Risici: Identificer potentielle bekymringspunkter ud fra:
      - Prishistorik (mange prisfald?)
      - Bygningens alder og stand
      - Energimærkning (dårlig = højere varmeudgifter)
      - Renoveringsbehov
      - Område/beliggenhed (trafik, støj, fremtidig udvikling)
      - Månedlige udgifter (høje fællesudgifter?)
      - Juridiske forhold (andel: bestyrelsens økonomi?, forpligtelser?)
      - Tid på markedet (lang tid = potentielle problemer?)
      
    4) Billeder: Find links til boligens billeder og særligt plantegninger
      
    Returnér JSON:
    {
      "originalLink": "... or null if not found",
      "fact": [
        {
          "label": "...",
          "value": "..."
        },
      ],
      "potentialRisks": ["Liste af potentielle risikoemner du har bemærket i teksten"],
      "images": [
        {
          "type": "exterior/interior/floorplan",
          "url": "..."
        },
        ...
      ]
    }
    - Svar på dansk.
    - Være grundig og fokuser på fakta frem for salgssprog.
    - Udtræk så mange relevante informationer som muligt.
    - Ingen ekstra tekst udenfor JSON.
    
    HTML:
    """${htmlContent.substring(0, 10000)}"""
  `;

  console.log("Making request to OpenAI API...");
  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 1500,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    
    // Add more detailed error information
    let errorDetails = `Status: ${response.status}, ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorDetails += `. Message: ${errorJson.error.message || 'Unknown error'}`;
        console.error("Detailed OpenAI error:", errorJson.error);
      }
    } catch (e) {
      // If JSON parsing fails, use the raw error text
      errorDetails += `. Raw error: ${errorText}`;
    }
    
    throw new Error(`OpenAI error (phase1): ${errorDetails}`);
  }

  const data = await response.json();
  console.log("Received response from OpenAI:", data);
  
  const rawText = data?.choices?.[0]?.message?.content?.trim() || "";
  console.log("Raw text from OpenAI:", rawText);

  // Attempt to parse JSON
  let parsed: any;
  try {
    const match =
      rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/\{[\s\S]*\}/);
    const jsonString =
      match && match[1]
        ? match[1]
        : match
        ? match[0]
        : rawText;
    parsed = JSON.parse(jsonString);
    console.log("Successfully parsed JSON response:", parsed);
  } catch (err) {
    console.error("Failed to parse OpenAI response:", err);
    parsed = { error: "Invalid JSON from AI", rawText };
  }

  return {
    originalLink: parsed?.originalLink || null,
    partialAnalysis: parsed,
  };
}

/**
 * Phase 2: Once we have the second HTML, produce final AI output
 */
export async function finalAnalysis(
  firstHtml: string,
  secondHtml: string,
  partialAnalysis?: any
): Promise<any> {
  console.log("Starting finalAnalysis with HTML lengths:", 
    firstHtml?.length, secondHtml?.length);
  
  if (!firstHtml && !secondHtml) {
    console.warn("No HTML content provided to finalAnalysis");
    return { error: "No HTML to analyze" };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    console.error("Missing OPENAI_API_KEY in environment");
    throw new Error("Missing OPENAI_API_KEY");
  }

  console.log("Preparing prompt for final analysis...");
  const prompt = `
    Du er en ekspert i boliganalyse, der hjælper potentielle boligkøbere med at identificere skjulte risici og værdifulde fordele.
    
    Du har modtaget HTML fra en eller to boligannoncer (samme bolig).
    ${partialAnalysis ? `
    
    Jeg har allerede udført en indledende analyse, som du kan bruge som reference:
    ${JSON.stringify(partialAnalysis, null, 2)}
    ` : ''}
    
    Analysér omhyggeligt HTML-indholdet med fokus på:
    
    1. RISICI: Find og detaljer mindst 8-10 potentielle risici ved boligen. Vær grundig og kritisk!
       - Tænk på forhold som tilstandsrapport, energimærke, vedligeholdelse, økonomi, beliggenhed, juridiske forhold, osv.
       - Inkluder konkrete handlingsanbefalinger for hver risiko (hvad køber bør spørge om/undersøge)
    
    2. FORDELE: Fremhæv 8-10 positive aspekter ved boligen.
       - Fokuser på væsentlige fordele som beliggenhed, indretning, potentiale, energieffektivitet, stand, osv.
       - Vælg passende ikoner fra listen i output-skabelonen
    
    Returnér JSON i dette format:
    {
      "property": {
        "address": "...",
        "price": "...", 
        "buyingExpenses": "...",
        "pricePerM2": "...",
        "size": "...",
        "boligType": "...",
        "energiMaerke": "...",
        "byggeaar": "...",
        "anyOtherFieldsYouFind": "..."
      },
      "risks": [
        {
          "category": "Energi|Tilstand|Økonomi|Beliggenhed|Juridisk|Andet",
          "title": "Kort præcis titel",
          "details": "Uddybet forklaring af risikoen (2-3 sætninger)",
          "excerpt": "Kort tekstuddrag fra annoncen der understøtter dette (hvis relevant)",
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
    - Vær grundig med RISICI - dette er den vigtigste del! Medtag også mindre risici.
    - FORDELE skal fremhæve det positive, men må ikke ignorere sandheden.
    - Alt skal være på dansk.
    - Hvis data mangler, brug tom streng ("").
    - Ingen tekst udenfor JSON.


    ${secondHtml ? `Dokument 2 (anden HTML):
    """${secondHtml}"""` : ''}
  `;

  console.log("Making request to OpenAI API for final analysis...");
  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 3500,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error in final analysis:", response.status, errorText);
    
    // Add more detailed error information
    let errorDetails = `Status: ${response.status}, ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorDetails += `. Message: ${errorJson.error.message || 'Unknown error'}`;
        console.error("Detailed OpenAI error in final analysis:", errorJson.error);
      }
    } catch (e) {
      // If JSON parsing fails, use the raw error text
      errorDetails += `. Raw error: ${errorText}`;
    }
    
    throw new Error(`OpenAI error (phase2): ${errorDetails}`);
  }

  const data = await response.json();
  console.log("Received response from OpenAI for final analysis:", data);
  
  const rawText = data?.choices?.[0]?.message?.content?.trim() || "";
  console.log("Raw text from OpenAI final analysis:", rawText);

  // Attempt JSON parse
  try {
    const match =
      rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/\{[\s\S]*\}/);
    const jsonString =
      match && match[1] ? match[1] : match ? match[0] : rawText;
    const finalObj = JSON.parse(jsonString);
    console.log("Successfully parsed final analysis JSON:", finalObj);

    // Attach an analysisDate
    return {
      ...finalObj,
      analysisDate: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to parse OpenAI final analysis response:", err);
    return {
      error: "Invalid JSON from AI (phase2)",
      rawText,
    };
  }
}
