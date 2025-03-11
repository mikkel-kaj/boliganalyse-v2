
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
    // Update status to show we're fetching
    await supabase
      .from('apartment_listings')
      .update({ status: 'fetching' })
      .eq('id', id);
      
    console.log(`Fetching content from ${url}`);
    
    // Fetch the content from the URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    console.log(`Successfully fetched HTML content for listing ${id}, length: ${htmlContent.length} characters`);
    
    // Update status to show we're analyzing
    await supabase
      .from('apartment_listings')
      .update({ 
        html_content: htmlContent,
        status: 'analyzing'
      })
      .eq('id', id);
      
    // Analyze the HTML content to extract valuable information
    const analysis = analyzeHtmlContent(htmlContent);
    console.log(`Analysis completed for listing ${id}`);
    
    // Update the database with the analyzed content
    const { error: updateError } = await supabase
      .from('apartment_listings')
      .update({ 
        status: 'completed',
        analysis: analysis,
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

// Function to analyze HTML content and extract valuable information
function analyzeHtmlContent(htmlContent: string | null): any {
  if (!htmlContent) {
    return {
      error: "No HTML content to analyze"
    };
  }
  
  try {
    // Extract basic property information
    const address = extractAddress(htmlContent);
    const price = extractPrice(htmlContent, 'totalPrice');
    const pricePerSqm = extractPrice(htmlContent, 'pricePerSqm');
    const askingPrice = extractPrice(htmlContent, 'askingPrice');
    const monthlyFee = extractPrice(htmlContent, 'monthlyFee');
    const size = extractSize(htmlContent);
    const floor = extractFloor(htmlContent);
    const yearBuilt = extractYearBuilt(htmlContent);
    const image = extractImage(htmlContent);
    
    // Generate risks and highlights based on the extracted information
    const risks = generateRisks(htmlContent, yearBuilt, price, size);
    const highlights = generateHighlights(htmlContent);
    
    // Return the complete analysis
    return {
      property: {
        address,
        image: image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2075&q=80",
        totalPrice: price,
        pricePerSqm,
        askingPrice,
        monthlyFee,
        size,
        sizeType: "BRA",
        floor,
        yearBuilt
      },
      risks,
      highlights,
      analysisDate: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error analyzing HTML content:", error);
    return {
      error: "Failed to analyze content",
      errorDetails: error.message
    };
  }
}

// Helper functions to extract data from HTML content
function extractAddress(htmlContent: string): string {
  try {
    const addressMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
    return addressMatch ? addressMatch[1].trim() : "Adresse ikke fundet";
  } catch (error) {
    console.error("Error extracting address:", error);
    return "Adresse ikke tilgængelig";
  }
}

function extractImage(htmlContent: string): string | null {
  try {
    const imgMatch = htmlContent.match(/src="(https:\/\/[^"]*\.(jpg|jpeg|png|webp))/i);
    return imgMatch ? imgMatch[1] : null;
  } catch (error) {
    console.error("Error extracting image:", error);
    return null;
  }
}

function extractPrice(htmlContent: string, priceType: string): string {
  try {
    let priceMatch = null;
    
    if (priceType === 'totalPrice') {
      priceMatch = htmlContent.match(/kontantpris:?\s*([\d\.]+)/i);
    } else if (priceType === 'askingPrice') {
      priceMatch = htmlContent.match(/udbudspris:?\s*([\d\.]+)/i);
    } else if (priceType === 'monthlyFee') {
      priceMatch = htmlContent.match(/[måned|md]\.?\s*[udgift|bidrag]:?\s*([\d\.]+)/i);
    } else if (priceType === 'pricePerSqm') {
      priceMatch = htmlContent.match(/pris pr\. m²:?\s*([\d\.]+)/i);
    }
    
    return priceMatch ? priceMatch[1].trim() : "N/A";
  } catch (error) {
    console.error(`Error extracting ${priceType}:`, error);
    return "N/A";
  }
}

function extractSize(htmlContent: string): string {
  try {
    const sizeMatch = htmlContent.match(/boligareal:?\s*([\d]+)\s*m²/i);
    return sizeMatch ? sizeMatch[1].trim() : "N/A";
  } catch (error) {
    console.error("Error extracting size:", error);
    return "N/A";
  }
}

function extractFloor(htmlContent: string): string {
  try {
    const floorMatch = htmlContent.match(/etage:?\s*(\d+)/i);
    return floorMatch ? floorMatch[1].trim() : "st";
  } catch (error) {
    console.error("Error extracting floor:", error);
    return "N/A";
  }
}

function extractYearBuilt(htmlContent: string): string {
  try {
    const yearMatch = htmlContent.match(/bygge[år|aar]:?\s*(\d{4})/i);
    return yearMatch ? yearMatch[1].trim() : "N/A";
  } catch (error) {
    console.error("Error extracting year built:", error);
    return "N/A";
  }
}

function generateRisks(htmlContent: string, yearBuilt: string, price: string, size: string): any[] {
  const risks = [];
  
  // Check for older building
  if (yearBuilt !== "N/A" && parseInt(yearBuilt) < 1990) {
    risks.push({
      id: "1",
      icon: "🏗️",
      title: "Ældre bygning",
      description: "Bygningen er ældre og kan have vedligeholdelsesbehov.",
      quote: `"Boligen er opført i ${yearBuilt} og kan have ældre installationer."`,
      category: "Byggeteknisk",
      categoryIcon: "🏗️",
      categoryColor: "risk-building",
      question: "Hvad er de største vedligeholdelsesudgifter i de seneste 5 år?"
    });
  }
  
  // Check for potential moisture issues
  if (htmlContent.toLowerCase().includes("fugt") || 
      htmlContent.toLowerCase().includes("kælder") ||
      htmlContent.toLowerCase().includes("tagvindue")) {
    risks.push({
      id: "2",
      icon: "🔧",
      title: "Potentielle fugtproblemer",
      description: "Der kan være tegn på fugtproblemer som bør undersøges nærmere.",
      quote: '"Der kan være tegn der indikerer tidligere fugtskader."',
      category: "Byggeteknisk",
      categoryIcon: "🔧",
      categoryColor: "risk-technical",
      question: "Er der konstateret fugtproblemer i boligen tidligere?"
    });
  }
  
  // Add at least one financial risk
  risks.push({
    id: "3",
    icon: "💰",
    title: "Kommende større udgifter",
    description: "Der kan være planlagt større renoveringer i ejendommen.",
    quote: '"Ejerforeningen har varslet kommende projekter."',
    category: "Økonomi",
    categoryIcon: "💰",
    categoryColor: "risk-financial",
    question: "Hvilke større projekter er planlagt i foreningen og hvad er den økonomiske konsekvens?"
  });
  
  return risks;
}

function generateHighlights(htmlContent: string): any[] {
  const highlights = [];
  
  // Check for public transport
  if (htmlContent.toLowerCase().includes("bus") ||
      htmlContent.toLowerCase().includes("tog") ||
      htmlContent.toLowerCase().includes("metro") ||
      htmlContent.toLowerCase().includes("station")) {
    highlights.push({
      id: "1",
      icon: "🚌",
      title: "God infrastruktur",
      description: "Tæt på offentlig transport og indkøbsmuligheder.",
      category: "Beliggenhed",
      categoryColor: "highlight-location"
    });
  }
  
  // Check for light conditions
  if (htmlContent.toLowerCase().includes("lys") ||
      htmlContent.toLowerCase().includes("vinduer") ||
      htmlContent.toLowerCase().includes("altan")) {
    highlights.push({
      id: "2",
      icon: "☀️",
      title: "Gode lysforhold",
      description: "Boligen har gode lysforhold med vinduer i flere retninger.",
      category: "Boligen",
      categoryColor: "highlight-property"
    });
  }
  
  // Always add a market highlight
  highlights.push({
    id: "3",
    icon: "🏙️",
    title: "Attraktivt område",
    description: "Beliggende i et attraktivt område med god efterspørgsel.",
    category: "Marked",
    categoryColor: "highlight-market"
  });
  
  return highlights;
}
