
import { ingestHtmlForLink, finalAnalysis } from "./aiAnalyzer.ts";

/**
 * Orchestrates the entire background process with multiple statuses in Danish
 */
export async function processListingInBackground(
  listingId: string,
  originalUrl: string,
  normalizedUrl: string,
  supabase: any,
) {
  console.log(`[${listingId}] Starting background process for URL: ${originalUrl}`);

  try {
    // 1. Update DB: status => "Søger efter salgsopslag"
    console.log(`[${listingId}] Setting status: Søger efter salgsopslag`);
    const { error: statusError } = await supabase
      .from("apartment_listings")
      .update({ status: "Søger efter salgsopslag" })
      .eq("id", listingId);
      
    if (statusError) {
      console.error(`[${listingId}] Failed to update status:`, statusError);
      throw statusError;
    }

    console.log(`[${listingId}] Fetching HTML from: ${originalUrl}`);
    const response = await fetch(originalUrl);
    if (!response.ok) {
      console.error(`[${listingId}] Failed to fetch listing. Status: ${response.status}`);
      throw new Error(`Failed to fetch listing. ${response.status} ${response.statusText}`);
    }

    const firstHtml = await response.text();
    console.log(`[${listingId}] Successfully fetched HTML, length=${firstHtml.length}`);

    // 2. "Opslag fundet!"
    console.log(`[${listingId}] Updating status to: Opslag fundet!`);
    const { error: foundError } = await supabase
      .from("apartment_listings")
      .update({ html_content: firstHtml, status: "Opslag fundet!" })
      .eq("id", listingId);
      
    if (foundError) {
      console.error(`[${listingId}] Failed to update with found status:`, foundError);
      throw foundError;
    }

    // 3. Phase #1: Use AI to extract an "originalLink" from the first HTML
    console.log(`[${listingId}] Starting AI parsing for link extraction...`);
    try {
      const { originalLink, partialAnalysis } = await ingestHtmlForLink(firstHtml);
      console.log(`[${listingId}] AI link extraction complete. Link found: ${originalLink || "none"}`);
      console.log(`[${listingId}] Partial analysis:`, partialAnalysis);
      
      // 4. If we do NOT have an original link, we just do final analysis with the single HTML
      let secondHtml = "";
      if (originalLink) {
        console.log(`[${listingId}] Found original link, updating status...`);
        const { error: searchError } = await supabase
          .from("apartment_listings")
          .update({ status: "Leder efter fejl og mangler.." })
          .eq("id", listingId);
          
        if (searchError) {
          console.error(`[${listingId}] Failed to update search status:`, searchError);
          throw searchError;
        }

        // Make second GET request
        console.log(`[${listingId}] Fetching second HTML from: ${originalLink}`);
        try {
          const secondResponse = await fetch(originalLink);
          if (secondResponse.ok) {
            secondHtml = await secondResponse.text();
            console.log(`[${listingId}] Successfully fetched second HTML, length=${secondHtml.length}`);
          } else {
            console.warn(`[${listingId}] Failed to fetch second HTML. Status: ${secondResponse.status}`);
          }
        } catch (fetchErr) {
          console.error(`[${listingId}] Error fetching second URL:`, fetchErr);
          // Continue with empty secondHtml
        }
      } else {
        console.log(`[${listingId}] No original link found, proceeding with single HTML analysis`);
        const { error: analysisStatusError } = await supabase
          .from("apartment_listings")
          .update({ status: "Leder efter fejl og mangler.." })
          .eq("id", listingId);
          
        if (analysisStatusError) {
          console.error(`[${listingId}] Failed to update analysis status:`, analysisStatusError);
          throw analysisStatusError;
        }
      }

      // 5. Phase #2: Combine first + second HTML in final analysis
      console.log(`[${listingId}] Starting final AI analysis...`);
      try {
        const finalJson = await finalAnalysis(firstHtml, secondHtml);
        console.log(`[${listingId}] Final analysis complete:`, finalJson);

        // 6. Mark DB => "Analyse fuldført" + store the final result
        console.log(`[${listingId}] Updating database with final analysis...`);
        const { error: updateError } = await supabase
          .from("apartment_listings")
          .update({
            status: "Analyse fuldført",
            analysis: finalJson,
            updated_at: new Date().toISOString()
          })
          .eq("id", listingId);

        if (updateError) {
          console.error(`[${listingId}] Failed to update with final analysis:`, updateError);
          throw new Error(`DB update error: ${updateError.message}`);
        }

        console.log(`[${listingId}] Analysis completed successfully!`);
      } catch (finalAnalysisErr) {
        console.error(`[${listingId}] Error in final analysis:`, finalAnalysisErr);
        throw new Error(`Final analysis failed: ${finalAnalysisErr.message}`);
      }
    } catch (aiErr) {
      console.error(`[${listingId}] Error in AI processing:`, aiErr);
      throw new Error(`AI processing failed: ${aiErr.message}`);
    }
  } catch (err) {
    console.error(`[${listingId}] Critical error:`, err);

    // Mark listing as 'Fejl' + record error
    try {
      const { error: finalError } = await supabase
        .from("apartment_listings")
        .update({
          status: "Fejl",
          error_message: String(err),
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);
        
      if (finalError) {
        console.error(`[${listingId}] Failed to set error status:`, finalError);
      }
    } catch (dbErr) {
      console.error(`[${listingId}] Failed to update error status:`, dbErr);
    }
  }
}
