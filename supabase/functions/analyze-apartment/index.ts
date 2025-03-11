import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

/**
 * Adjust these CORS headers if needed.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Main HTTP handler for this Edge Function.
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log("Received request to analyze URL:", url);

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Normalize URL by removing query parameters
    const normalizedUrl = normalizeUrl(url);
    console.log("Normalized URL:", normalizedUrl);

    // Initialize Supabase client using env variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if listing already exists
    const { data: existingListing, error: lookupError } = await supabase
      .from("apartment_listings")
      .select("*")
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up existing listing:", lookupError);
      return new Response(
        JSON.stringify({ error: "Failed to check for existing listing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    if (existingListing) {
      // If found, return immediately
      console.log("Found existing listing:", existingListing.id);
      return new Response(
        JSON.stringify({
          message: "Listing found in database",
          listing: existingListing,
          isExisting: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Otherwise, create a new DB row
    const { data: newListing, error: insertError } = await supabase
      .from("apartment_listings")
      .insert([
        {
          url,
          normalized_url: normalizedUrl,
          status: "fetching",
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting new listing:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create new listing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    console.log("Created new listing:", newListing.id);

    // Launch background job to fetch & analyze
    EdgeRuntime.waitUntil(
      processListingInBackground(newListing.id, url, normalizedUrl, supabase),
    );

    // Return quickly to the caller
    return new Response(
      JSON.stringify({
        message: "Analysis started",
        listing: newListing,
        isExisting: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

/**
 * Remove query params etc. from the URL so duplicates are recognized
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    console.error("Error normalizing URL:", error);
    return url; // fallback
  }
}

/**
 * Background job that:
 * 1) fetches the HTML
 * 2) calls AI to parse all data
 * 3) stores the final JSON in the DB
 */
async function processListingInBackground(
  listingId: string,
  originalUrl: string,
  normalizedUrl: string,
  supabase: any,
) {
  console.log(`Starting background processing for listing ${listingId}`);

  try {
    // Update DB: status => 'fetching'
    await supabase
      .from("apartment_listings")
      .update({ status: "fetching" })
      .eq("id", listingId);

    console.log(`Fetching content from ${originalUrl}`);
    const response = await fetch(originalUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const htmlContent = await response.text();
    console.log(
      `Successfully fetched HTML (length: ${htmlContent.length}) for listing ${listingId}`,
    );

    // Update DB: status => 'analyzing'
    await supabase
      .from("apartment_listings")
      .update({ html_content: htmlContent, status: "analyzing" })
      .eq("id", listingId);

    // -----------
    // AI Analysis
    // -----------
    const analysisJson = await analyzeWithAI(htmlContent);
    console.log(`AI analysis completed for listing ${listingId}`);

    // Update DB: store analysis JSON & mark completed
    const { error: updateError } = await supabase
      .from("apartment_listings")
      .update({
        status: "completed",
        analysis_json: analysisJson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    if (updateError) {
      throw new Error(`Failed to update listing: ${updateError.message}`);
    }

    console.log(`Listing ${listingId} fully processed & completed.`);
  } catch (error) {
    console.error(`Error in background processing for listing ${listingId}:`, error);

    // Mark listing as 'error' + record the error message
    try {
      await supabase
        .from("apartment_listings")
        .update({
          status: "error",
          error_message: `${error}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);
    } catch (updateError) {
      console.error(
        `Failed to update listing ${listingId} status to error:`,
        updateError,
      );
    }
  }
}

/**
 * analyzeWithAI:
 *  - Takes the entire HTML
 *  - Instructs GPT to parse out property info, plus "risks" and "highlights"
 *  - Returns the final JSON
 */
async function analyzeWithAI(htmlContent: string): Promise<any> {
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
    - Provide at least 3 "risks" and 3 "highlights" if possible.

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
      model: "gpt-4", // or "gpt-3.5-turbo"
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
