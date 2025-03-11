import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { url } = await req.json();
    console.log("Received request to analyze URL:", url);
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Normalize URL by removing query parameters
    const normalizedUrl = normalizeUrl(url);
    console.log("Normalized URL:", normalizedUrl);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if we already have this listing in our database
    const { data: existingListing, error: lookupError } = await supabase
      .from('apartment_listings')
      .select('*')
      .eq('normalized_url', normalizedUrl)
      .maybeSingle();
    
    if (lookupError) {
      console.error("Error looking up existing listing:", lookupError);
      return new Response(
        JSON.stringify({ error: "Failed to check for existing listing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // If we already have the listing, return it immediately
    if (existingListing) {
      console.log("Found existing listing:", existingListing.id);
      return new Response(
        JSON.stringify({ 
          message: "Listing found in database", 
          listing: existingListing,
          isExisting: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Otherwise, create a new entry in the database
    const { data: newListing, error: insertError } = await supabase
      .from('apartment_listings')
      .insert([
        { 
          url: url, 
          normalized_url: normalizedUrl,
          status: 'fetching'
        }
      ])
      .select()
      .single();
    
    if (insertError) {
      console.error("Error inserting new listing:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create new listing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    console.log("Created new listing:", newListing.id);
    
    // Start background processing
    EdgeRuntime.waitUntil(processListingInBackground(newListing.id, url, normalizedUrl, supabase));
    
    return new Response(
      JSON.stringify({ 
        message: "Analysis started", 
        listing: newListing,
        isExisting: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Function to normalize URL by removing query parameters
function normalizeUrl(url: string): string {
  try {
    // Parse the URL and extract the path
    const urlObj = new URL(url);
    // For boligsiden.dk, we'll keep everything before the query string
    return urlObj.origin + urlObj.pathname;
  } catch (error) {
    console.error("Error normalizing URL:", error);
    return url;
  }
}

// Background processing function
async function processListingInBackground(id: string, url: string, normalizedUrl: string, supabase: any) {
  console.log(`Starting background processing for listing ${id}`);
  
  try {
    // Wait 10 seconds as requested
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`Waited 10 seconds for listing ${id}`);
    
    // Fetch the content from the URL
    console.log(`Fetching content from ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    // Update the database with the fetched content
    const { error: updateError } = await supabase
      .from('apartment_listings')
      .update({ 
        html_content: htmlContent,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      throw new Error(`Failed to update listing: ${updateError.message}`);
    }
    
    console.log(`Successfully completed background processing for listing ${id}`);
  } catch (error) {
    console.error(`Error in background processing for listing ${id}:`, error);
    
    // Update the listing status to 'error'
    try {
      await supabase
        .from('apartment_listings')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    } catch (updateError) {
      console.error(`Failed to update listing status to error: ${updateError}`);
    }
  }
}
