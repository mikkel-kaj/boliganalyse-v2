import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { corsHeaders } from "../utils/cors.ts";
import { processListingInBackground } from "../services/backgroundProcessor.ts";

/**
 * Handles the listing request - checks for existing listings or creates a new one
 */
export async function handleListing(url: string, normalizedUrl: string): Promise<Response> {
  try {
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
    console.error("Error handling listing:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process listing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
}
