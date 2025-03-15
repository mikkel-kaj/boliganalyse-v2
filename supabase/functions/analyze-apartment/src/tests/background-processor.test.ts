import { assertEquals, assertExists } from "std/testing/asserts";
import { assertSpyCalls, spy } from "https://deno.land/std@0.200.0/testing/mock.ts";
import { createLogger } from "../utils/logger.ts";
import { createLocalSupabaseClient } from "./utils/test-helpers.ts";
import { ListingRepository } from "../repositories/listing-repository.ts";
import { processListingInBackground } from "../index.ts";
import { ListingProcessorService } from "../services/listing-processor.ts";

// Create a logger for testing
const logger = createLogger("BackgroundProcessorTest");

// Test the background processing function
Deno.test({
  name: "processListingInBackground should process a listing correctly",
  async fn() {
    // Create a client for the local Supabase Docker instance
    const supabase = createLocalSupabaseClient();

    // Create a real repository with the local client
    const repository = new ListingRepository(supabase);

    // Create a test listing to use
    const testUrl = `https://www.boligsiden.dk/adresse/birkemosevej-8-8420-knebel-07060147___8_______?udbud=a5d7dc61-6da6-4969-97b6-1be8e8257bce`;
    const normalizedUrl = testUrl;
    const deleteIfExists = await repository.deleteByUrl(normalizedUrl);
    const listing = await repository.createListing(testUrl, normalizedUrl);

    logger.info(`Created test listing with ID: ${listing.id}`);

    // Call the function under test
    await processListingInBackground(
        listing.id,
        normalizedUrl,
        repository
    )
  }
})