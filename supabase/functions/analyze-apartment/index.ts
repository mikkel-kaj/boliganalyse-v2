
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { normalizeUrl } from "./utils/url.ts";
import { handleListing } from "./handlers/listingHandler.ts";

/**
 * Main HTTP handler for this Edge Function.
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The request body is expected to contain { url }
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

    // Delegate to the listingHandler to check or create a new listing
    return await handleListing(url, normalizedUrl);
    
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
