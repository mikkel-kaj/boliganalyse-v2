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
  console.log(`Listing ${listingId}: Starting background process.`);

  try {
    // 1. Update DB: status => "Søger efter salgsopslag"
    await supabase
      .from("apartment_listings")
      .update({ status: "Søger efter salgsopslag" })
      .eq("id", listingId);

    console.log(`Listing ${listingId}: GET ${originalUrl}`);
    const response = await fetch(originalUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch listing. ${response.status} ${response.statusText}`);
    }

    const firstHtml = await response.text();
    console.log(`Listing ${listingId}: Fetched first HTML, length=${firstHtml.length}`);

    // 2. "Opslag fundet!"
    await supabase
      .from("apartment_listings")
      .update({ html_content: firstHtml, status: "Opslag fundet!" })
      .eq("id", listingId);

    // 3. Phase #1: Use AI to extract an "originalLink" from the first HTML
    const { originalLink, partialAnalysis } = await ingestHtmlForLink(firstHtml);
    console.log(`Listing ${listingId}: partial AI parse => link=${originalLink || "null"}`);

    // 4. If we do NOT have an original link, we just do final analysis with the single HTML
    let secondHtml = "";
    if (originalLink) {
      // Update DB => "Leder efter fejl og mangler.."
      await supabase
        .from("apartment_listings")
        .update({ status: "Leder efter fejl og mangler.." })
        .eq("id", listingId);

      // Make second GET request
      console.log(`Listing ${listingId}: Doing second GET => ${originalLink}`);
      const secondResponse = await fetch(originalLink);
      if (secondResponse.ok) {
        secondHtml = await secondResponse.text();
        console.log(`Listing ${listingId}: second HTML length=${secondHtml.length}`);
      } else {
        console.warn(`Listing ${listingId}: second GET failed, code=${secondResponse.status}`);
      }
    } else {
      // If no second link was found, we still proceed with final analysis on the single HTML
      await supabase
        .from("apartment_listings")
        .update({ status: "Leder efter fejl og mangler.." })
        .eq("id", listingId);
    }

    // 5. Phase #2: Combine first + second HTML in final analysis
    const finalJson = await finalAnalysis(firstHtml, secondHtml);
    console.log(`Listing ${listingId}: final analysis done.`);

    // 6. Mark DB => "Analyse fuldført" + store the final result
    const { error: updateError } = await supabase
      .from("apartment_listings")
      .update({
        status: "Analyse fuldført",
        analysis: finalJson, // store the final JSON
        updated_at: new Date().toISOString()
      })
      .eq("id", listingId);

    if (updateError) {
      throw new Error(`DB update error: ${updateError.message}`);
    }

    console.log(`Listing ${listingId}: Completed successfully!`);
  } catch (err) {
    console.error(`Listing ${listingId}: Error =>`, err);

    // Mark listing as 'Fejl' + record error
    try {
      await supabase
        .from("apartment_listings")
        .update({
          status: "Fejl",
          error_message: String(err),
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);
    } catch (dbErr) {
      console.error(`Listing ${listingId}: failed to set error status =>`, dbErr);
    }
  }
}
