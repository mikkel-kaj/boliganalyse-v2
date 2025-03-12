import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { corsHeaders } from "../utils/cors.ts";
import { processListingInBackground } from "../services/backgroundProcessor.ts";
import { validateBoligsideUrl } from "../utils/validation.ts";

/**
 * Handles the listing request - checks for existing listings or creates a new one
 */
export async function handleListing(url: string, normalizedUrl: string): Promise<Response> {
  try {
    // Validate the URL before processing
    const urlValidation = validateBoligsideUrl(url);
    if (!urlValidation.valid) {
      console.error(`Invalid URL: ${url}. Error: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ 
          error: "Invalid URL", 
          details: urlValidation.error,
          code: "INVALID_URL"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Check if listing already exists
    const { data: existingListing, error: lookupError } = await supabase
      .from("apartment_listings")
      .select("*")
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up existing listing:", lookupError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing listing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    if (existingListing) {
      // If found, don't reprocess
      console.log("Listing already in DB:", existingListing.id);
      return new Response(
        JSON.stringify({
          message: "Listing found in database",
          listing: existingListing,
          isExisting: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Insert new row with initial status = "Starter analyse"
    const { data: newListing, error: insertError } = await supabase
      .from("apartment_listings")
      .insert([
        {
          url,
          normalized_url: normalizedUrl,
          // Danish statuses:
          status: "Starter analyse"
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

    // Enable real-time updates for this table (only needs to be done once, but safe to call multiple times)
    try {
      await supabase.rpc('alter_table_set_realtime_publication', {
        table_name: 'apartment_listings',
        enable: true
      }).then((result) => {
        console.log("Real-time publication result:", result);
      });
    } catch (rtError) {
      console.error("Failed to enable real-time updates, continuing anyway:", rtError);
    }

    // Add error handling for background job
    try {
      // Kick off background job
      EdgeRuntime.waitUntil(
        processListingInBackground(newListing.id, normalizedUrl, supabase),
      );
      console.log(`Background processing started for listing: ${newListing.id}`);
    } catch (bgError) {
      console.error(`Failed to start background processing: ${bgError}`);
      // Still return success to client, since we created the listing entry
    }

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
      JSON.stringify({ error: "Failed to process listing", details: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
}
