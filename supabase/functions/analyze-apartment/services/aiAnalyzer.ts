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

// @ts-ignore - deno-dom is configured in deno.json imports
import { DOMParser, Element } from "deno-dom";

const openAiApiUrl = "https://api.openai.com/v1/chat/completions";

/**
 * Extract energy rating from the HTML
 * This helps provide information that LLMs can't analyze directly
 */
async function extractEnergyRating(htmlContent: string): Promise<string | undefined> {
  if (!htmlContent) return undefined;
  
  try {
    // Parse HTML using deno-dom
    const document = new DOMParser().parseFromString(htmlContent, "text/html");
    if (!document) {
      throw new Error("Failed to parse HTML");
    }
    
    // Look for SVG title elements that might contain energy rating
    const svgTitles = document.querySelectorAll("svg title");
    
    for (const title of svgTitles) {
      const titleText = title.textContent;
      
      // Check if title contains "Energimærke X" pattern
      const match = /Energimærke\s+([A-G])/i.exec(titleText);
      if (match && match[1]) {
        const energyRating = match[1];
        console.log(`Extracted energy rating: ${energyRating}`);
        return energyRating;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error("Error extracting energy rating from HTML:", error);
    return undefined;
  }
}

/**
 * Extract readable text content from HTML
 * This helps filter out boilerplate code, scripts, styles, etc.
 */
async function extractTextFromHtml(htmlContent: string): Promise<string> {
  if (!htmlContent) return "";
  
  try {
    // Parse HTML using deno-dom
    const document = new DOMParser().parseFromString(htmlContent, "text/html");
    if (!document) {
      throw new Error("Failed to parse HTML");
    }
    
    // Remove non-content elements
    const elementsToRemove = ["script", "style", "iframe", "noscript", "svg", "path"];
    elementsToRemove.forEach(tag => {
      const elements = document.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
    
    // Get all text content from body
    let textContent = document.body?.textContent || "";
    
    // Clean up whitespace
    textContent = textContent.replace(/\s+/g, " ").trim();
    console.log(textContent)
    return textContent;
  } catch (error) {
    console.error("Error extracting text from HTML:", error);
    throw error;
  }
}

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

  // Extract readable text content from HTML
  const textContent = await extractTextFromHtml(htmlContent);
  console.log(textContent)
  console.log("Extracted text content length for initial analysis:", textContent.length);
  
  // Extract energy rating
  const energyRating = await extractEnergyRating(htmlContent);

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    console.error("Missing OPENAI_API_KEY in environment");
    throw new Error("Missing OPENAI_API_KEY");
  }

  // 1) Prompt: find the original posting link
  console.log("Preparing prompt for OpenAI...");
  const prompt = `
    Du modtager første del af tekst fra en boligannonce. 
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
      
    Returnér JSON:
    {
      "originalLink": "... or null if not found",
      "fact": [
        {
          "label": "...",
          "value": "..."
        },
        ...
      ],
      "potentialRisks": ["Liste af potentielle risikoemner du har bemærket i teksten"]
    }
    - Svar på dansk.
    - Være grundig og fokuser på fakta frem for salgssprog.
    - Udtræk så mange relevante informationer som muligt.
    - Ingen ekstra tekst udenfor JSON.
    ${energyRating ? `\n    - Bemærk: Jeg har identificeret energimærke ${energyRating} i annoncen.` : ''}
    
    Annoncetekst:
    """${textContent}"""
  `;

  console.log("Making request to OpenAI API...");
  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 4096,
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
    
    // Add energy rating if found but not in the AI response
    if (energyRating) {
      const hasEnergyRating = parsed.fact?.some((f: any) => 
        f.label.toLowerCase().includes("energimærke") || 
        f.label.toLowerCase().includes("energimaerke")
      );
      
      if (!hasEnergyRating) {
        if (!parsed.fact) parsed.fact = [];
        parsed.fact.push({
          label: "Energimærke",
          value: energyRating
        });
      }
    }
  } catch (err) {
    console.error("Failed to parse OpenAI response:", err);
    parsed = { 
      error: "Invalid JSON from AI", 
      rawText,
      fact: energyRating ? [{
        label: "Energimærke",
        value: energyRating
      }] : []
    };
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

  // Extract readable text content from HTML
  const firstText = await extractTextFromHtml(firstHtml);
  const secondText = secondHtml ? await extractTextFromHtml(secondHtml) : "";
  
  console.log("Extracted text content lengths:", firstText.length, secondText.length);

  // Extract energy rating from both HTML sources
  const firstEnergyRating = await extractEnergyRating(firstHtml);
  const secondEnergyRating = secondHtml ? await extractEnergyRating(secondHtml) : undefined;
  
  // Take the energy rating from either source, prioritizing the first one
  const energyRating = firstEnergyRating || secondEnergyRating;

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    console.error("Missing OPENAI_API_KEY in environment");
    throw new Error("Missing OPENAI_API_KEY");
  }

  console.log("Preparing prompt for final analysis...");
  const prompt = `
    Du er en ekspert i boliganalyse, der hjælper potentielle boligkøbere med at identificere skjulte risici og værdifulde fordele.
    
    Du har modtaget tekst fra en eller to boligannoncer (samme bolig).
    ${partialAnalysis ? `
    
    Jeg har allerede udført en indledende analyse, som du skal bruge som udgangspunkt:
    ${JSON.stringify(partialAnalysis, null, 2)}
    ` : ''}
    ${energyRating ? `\n    Energimærke: ${energyRating}` : ''}
    
    Din opgave er at analysere boligannoncer grundigt og identificere både risici og fordele for en potentiel køber.
    
    Analysér omhyggeligt teksten med fokus på:

    1) BASAL INFORMATION: Bekræft/opdater følgende områder fra den indledende analyse:
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
        "monthlyExpenses": "..."
      },
      "risks": [
        {
          "category": "Energi|Tilstand|Økonomi|Beliggenhed|Juridisk|Andet",
          "title": "Kort præcis titel",
          "details": "Uddybet forklaring af risikoen (2-3 sætninger)",
          "excerpt": "Kort tekstuddrag fra annoncen der understøtter dette (ellers inkluder din egen forklaring)",
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

    Dokument 1 (første annonce):
    """${firstText}"""

    ${secondText ? `Dokument 2 (anden annonce):
    """${secondText}"""` : ''}
  `;

  console.log("Making request to OpenAI API for final analysis...");
  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 4096,
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
    
    if (energyRating && (!finalObj.property.energiMaerke || finalObj.property.energiMaerke === '...')) {
      finalObj.property.energiMaerke = energyRating;
    }

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
      energyRating
    };
  }
}
