// Using full URL imports instead of import maps
import {serve} from "https://deno.land/std@0.168.0/http/server.ts";
import {createClient} from "@supabase/supabase-js";
import {config, validateConfig} from "./config/config.ts";
import {normalizeUrl} from "./utils/url.ts";
import {createCorsPreflightResponse, createErrorResponse, createSuccessResponse,} from "./utils/http.ts";
import {ListingRepository} from "./repositories/listing-repository.ts";
import {ListingProcessorService} from "./services/listing-processor.ts";
import {validateListingUrl} from "./utils/validation.ts";
import {createLogger} from "./utils/logger.ts";
import {AnalysisStatus, statusFromString} from "./types/status.ts";

const logger = createLogger("Main");

// Validate critical configuration
const missingConfig = validateConfig();
if (missingConfig.length > 0) {
  logger.error(`Missing required configuration: ${missingConfig.join(", ")}`);
}

// Define the background processor function
export async function processListingInBackground(
  listingId: string,
  url: string,
  repository: ListingRepository,
) {
    // Create the processor service
  const processor = new ListingProcessorService(repository);

  // Process the listing
  await processor.processListing(listingId, url);

}

/**
 * Main HTTP handler for this Edge Function.
 * This preserves the original functionality while using the new architecture.
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return createCorsPreflightResponse();
  }

  try {
    // Parse the request body - expecting { url }
    const { url } = await req.json();
    logger.info(`Received request to analyze URL: ${url}`);

    if (!url) {
      return createErrorResponse("URL is required", null, 400);
    }

    // Validate URL format
    const urlValidation = validateListingUrl(url);
    if (!urlValidation.valid) {
      logger.error(`Invalid URL: ${url}. Error: ${urlValidation.error}`);
      return createErrorResponse(
        "Invalid URL",
        urlValidation.error,
        400,
        "INVALID_URL",
      );
    }

    const normalizedUrl = normalizeUrl(url);

    const repository = new ListingRepository();

    // Check if this listing already exists
    const existingListing = await repository.findByNormalizedUrl(normalizedUrl);

    // Check if the status indicates an error - if so, allow reanalysis
    const hasError = existingListing && existingListing.status && 
      statusFromString(existingListing.status) === AnalysisStatus.ERROR;

    if (existingListing && !hasError) {
      logger.info(`Listing already in DB: ${existingListing.id}`);
      return createSuccessResponse({
        message: "Listing found in database",
        listing: existingListing,
        isExisting: true,
      });
    }

    // Create a new listing if it doesn't exist
    let listing = existingListing;
    if (!listing) {
      listing = await repository.createListing(url, normalizedUrl);
      logger.info(`Created new listing: ${listing.id}`);
    } else {
      // Reset the status for re-analysis if it had an error
      await repository.updateStatus(listing.id, AnalysisStatus.QUEUED);
    }

    // Start background processing
    try {
      // @ts-expect-error - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(
        processListingInBackground(listing.id, url, repository),
      );
      logger.info(`Background processing started for listing: ${listing.id}`);
    } catch (bgError) {
      logger.error(`Failed to start background processing`, bgError);
    }

    // Return the listing immediately
    return createSuccessResponse({
      message: "Analysis started",
      listing,
      isExisting: false,
    });

  } catch (error) {
    logger.error("Error processing request", error);
    return createErrorResponse(
      "Internal server error",
      error instanceof Error ? error.message : String(error),
      500,
    );
  }
});
