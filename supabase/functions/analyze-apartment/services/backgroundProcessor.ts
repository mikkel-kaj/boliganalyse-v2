
import { ingestHtmlForLink, finalAnalysis } from "./aiAnalyzer.ts";

// Helper function to update listing status with proper update timestamp
async function updateListingStatus(
  supabase: any,
  listingId: string,
  status: string,
  additionalFields: Record<string, any> = {}
) {
  console.log(`[${listingId}] Updating status to: ${status}`);
  const { error } = await supabase
    .from("apartment_listings")
    .update({ 
      status, 
      updated_at: new Date().toISOString(),
      ...additionalFields
    })
    .eq("id", listingId);
    
  if (error) {
    console.error(`[${listingId}] Failed to update status to ${status}:`, error);
    throw error;
  }
  
  return { success: true };
}

/**
 * Orchestrates the entire background process with multiple statuses in Danish
 */
export async function processListingInBackground(
  listingId: string,
  normalizedUrl: string,
  supabase: any,
) {
  console.log(`[${listingId}] Starting background process for URL: ${normalizedUrl}`);

  try {
    // 1. Update DB: status => "Søger efter salgsopslag"
    await updateListingStatus(supabase, listingId, "Søger efter salgsopslag");

    console.log(`[${listingId}] Fetching HTML from: ${normalizedUrl}`);
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      console.error(`[${listingId}] Failed to fetch listing. Status: ${response.status}`);
      throw new Error(`Failed to fetch listing. ${response.status} ${response.statusText}`);
    }

    const firstHtml = await response.text();
    console.log(`[${listingId}] Successfully fetched HTML, length=${firstHtml.length}`);

    // 2. "Opslag fundet!"
    await updateListingStatus(supabase, listingId, "Opslag fundet!", { html_content: firstHtml });

    // 3. Phase #1: Use AI to extract an "originalLink" from the first HTML
    console.log(`[${listingId}] Starting AI parsing for link extraction...`);
    try {
      const { originalLink, partialAnalysis } = await ingestHtmlForLink(firstHtml);
      console.log(`[${listingId}] AI link extraction complete. Link found: ${originalLink || "none"}`);
      console.log(`[${listingId}] Partial analysis:`, partialAnalysis);
      
      // Store the partial analysis for debugging purposes
      await updateListingStatus(supabase, listingId, "Første fase analyse gennemført", {
        partial_analysis: partialAnalysis
      });
      
      // 4. If we do NOT have an original link, we just do final analysis with the single HTML
      let secondHtml = "";
      if (originalLink) {
        await updateListingStatus(supabase, listingId, "Leder efter fejl og mangler..");

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
        await updateListingStatus(supabase, listingId, "Leder efter fejl og mangler..");
      }

      // 5. Phase #2: Combine first + second HTML in final analysis
      console.log(`[${listingId}] Starting final AI analysis...`);
      try {
        const finalJson = await finalAnalysis(firstHtml, secondHtml, partialAnalysis);
        console.log(`[${listingId}] Final analysis complete:`, finalJson);

        // 6. Mark DB => "Analyse fuldført" + store the final result
        console.log(`[${listingId}] Updating database with final analysis...`);
        await updateListingStatus(supabase, listingId, "Analyse fuldført", {
          analysis: finalJson,
          // Clear any error message if it exists
          error_message: null
        });

        console.log(`[${listingId}] Analysis completed successfully!`);
      } catch (finalAnalysisErr) {
        console.error(`[${listingId}] Error in final analysis:`, finalAnalysisErr);
        await updateListingStatus(supabase, listingId, "Fejl", {
          error_message: `Final analysis failed: ${finalAnalysisErr.message}`
        });
        throw new Error(`Final analysis failed: ${finalAnalysisErr.message}`);
      }
    } catch (aiErr) {
      console.error(`[${listingId}] Error in AI processing:`, aiErr);
      await updateListingStatus(supabase, listingId, "Fejl", {
        error_message: `AI processing failed: ${aiErr.message}`
      });
      throw new Error(`AI processing failed: ${aiErr.message}`);
    }
  } catch (err) {
    console.error(`[${listingId}] Critical error:`, err);

    // Mark listing as 'Fejl' + record error
    try {
      await updateListingStatus(supabase, listingId, "Fejl", {
        error_message: String(err)
        // The partial_analysis field will be preserved if it exists
      });
    } catch (dbErr) {
      console.error(`[${listingId}] Failed to update error status:`, dbErr);
    }
  }
}
