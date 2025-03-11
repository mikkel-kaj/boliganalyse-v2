
/**
 * analyzeWithAI:
 *  - Takes the entire HTML
 *  - Instructs GPT to parse out property info, plus "risks" and "highlights"
 *  - Returns the final JSON
 */
export async function analyzeWithAI(htmlContent: string): Promise<any> {
  // If empty HTML, nothing to analyze
  if (!htmlContent) {
    return { error: "No HTML content." };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  // Example instruction: ask GPT to parse everything from the raw HTML
  // (address, images, price, size, risks, highlights, etc.)
  const prompt = `
    You are a real-estate AI. You receive full HTML of a property listing. 
    Return a JSON object with the structure:

    {
      "property": {
        "address": "...",
        "price": "...",
        "size": "...",
        "images": ["...", ...],
        "otherDetails": "... any additional fields you want..."
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

    Important:
    - DO NOT include extra commentary or disclaimers.
    - If you see multiple images, put them in the "images" array. 
    - If data is missing, leave it as an empty string or null, do not guess.
    - Provide at least 5 "risks" and 5 "highlights" if possible.

    Listing HTML:
    """${htmlContent.substring(0, 15000)}"""
  `;

  // Use chat completion
  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o", // Using the recommended model
      messages: [{ role: "system", content: prompt }],
      max_tokens: 2000,
      temperature: 0.5,
    }),
  });

  if (!aiResponse.ok) {
    throw new Error(`OpenAI API error: ${aiResponse.statusText}`);
  }

  const aiData = await aiResponse.json();
  const rawText = aiData?.choices?.[0]?.message?.content?.trim() || "";

  try {
    // The model may return direct JSON or "```json ...```" blocks
    // We'll try to parse either
    const possibleJsonMatch =
      rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/\{[\s\S]*\}/);
    const jsonString =
      possibleJsonMatch && possibleJsonMatch[1]
        ? possibleJsonMatch[1]
        : possibleJsonMatch
        ? possibleJsonMatch[0]
        : rawText;

    const analysisObject = JSON.parse(jsonString);

    // Return the final structured object
    return {
      ...analysisObject,
      analysisDate: new Date().toISOString(),
    };
  } catch (jsonError) {
    console.error("Failed to parse JSON from AI. Raw text:", rawText);
    return {
      error: "Invalid JSON from AI",
      rawText,
    };
  }
}
