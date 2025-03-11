
import { analyzeWithAI } from "./aiAnalyzer.ts";

/**
 * Background job that:
 * 1) fetches the HTML
 * 2) calls AI to parse all data
 * 3) stores the final JSON in the DB
 */
export async function processListingInBackground(
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
