/**
 * Two-phase AI analysis:
 *  - Phase 1: Ingest initial HTML to discover link to original posting
 *  - Phase 2: After second GET, combine both HTMLs for final AI analysis
 */

const openAiApiUrl = "https://api.openai.com/v1/chat/completions";

/**
 * Phase 1: Identify "original posting" link from the first HTML
 */
export async function ingestHtmlForLink(
  htmlContent: string,
): Promise<{ originalLink?: string; partialAnalysis?: any }> {
  if (!htmlContent) {
    return { originalLink: undefined, partialAnalysis: { error: "No HTML" } };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  // 1) Prompt: find the original posting link
  const prompt = `
    Du modtager første del af HTML fra en boligannonce. 
    Din opgave i denne fase: 
      1) Uddrag alt relevant i tekstform (f.eks. adresse, pris, overskrifter).
      2) Hvis du ser et link til den "originale" boligannonce (f.eks. 'Vis mere info' link), giv mig den URL i feltet "originalLink".
    Returnér JSON:
    {
      "originalLink": "... or null if not found",
      "infoExtract": "...some minimal extracted data..."
    }
    - Svar på dansk.
    - Ingen ekstra tekst udenfor JSON.
    HTML:
    """${htmlContent.substring(0, 15000)}"""
  `;

  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 1500,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error (phase1): ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content?.trim() || "";

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
  } catch (err) {
    parsed = { error: "Invalid JSON from AI", rawText };
  }

  return {
    originalLink: parsed?.originalLink || null,
    partialAnalysis: parsed,
  };
}

/**
 * Phase 2: Once we have the second HTML, produce final AI output
 * Merge the known data from the partial analysis if you want
 */
export async function finalAnalysis(
  firstHtml: string,
  secondHtml: string,
): Promise<any> {
  if (!firstHtml && !secondHtml) {
    return { error: "No HTML to analyze" };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  /**
   * The user wants the final JSON in the shape:
   * {
   *   "property": {
   *     "address": "...",
   *     "price": "...",
   *     "buyingExpenses": "...",
   *     "pricePerM2": "...",
   *     "size": "...",
   *     "boligType": "..."
   *   },
   *   "risks": [...],
   *   "highlights": [...]
   * }
   *
   * We'll instruct GPT to unify data from both HTML documents.
   */
  const prompt = `
    Du har to HTML-dokumenter fra en boligannonce. 
    Saml alle oplysninger fra begge. Returnér JSON:
    {
      "property": {
        "address": "...",
        "price": "...", 
        "buyingExpenses": "...",
        "pricePerM2": "...",
        "size": "...",
        "boligType": "...",
        "anyOtherFieldsYouFind": "..."
      },
      "risks": [
        {
          "category": "...",
          "title": "...",
          "details": "...",
          "excerpt": "...",
          "recommendations": [
            {"promptTitle": "Spørg megler", "prompt": "..."}
          ]
        }
      ],
      "highlights": [
        {
          "icon": "...",
          "title": "...",
          "details": "..."
        }
      ]
    }
    - Inkludér mindst 5 risks og 5 highlights, hvis muligt.
    - Alt skal være på dansk.
    - Hvis data mangler, sæt det til tom streng ("").
    - Ingen tekst udenfor JSON.

    Dokument 1 (første HTML):
    """${firstHtml.substring(0, 12000)}"""

    Dokument 2 (anden HTML):
    """${secondHtml.substring(0, 12000)}"""
  `;

  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 3000,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error (phase2): ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content?.trim() || "";

  // Attempt JSON parse
  try {
    const match =
      rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/\{[\s\S]*\}/);
    const jsonString =
      match && match[1] ? match[1] : match ? match[0] : rawText;
    const finalObj = JSON.parse(jsonString);

    // Attach an analysisDate
    return {
      ...finalObj,
      analysisDate: new Date().toISOString(),
    };
  } catch (err) {
    return {
      error: "Invalid JSON from AI (phase2)",
      rawText,
    };
  }
}
