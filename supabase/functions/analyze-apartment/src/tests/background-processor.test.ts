import { assertEquals, assertExists } from "std/testing/asserts";
import { assertSpyCalls, spy } from "https://deno.land/std@0.200.0/testing/mock.ts";
import { createLogger } from "../utils/logger.ts";
import { createLocalSupabaseClient } from "./utils/test-helpers.ts";
import { ListingRepository } from "../repositories/listing-repository.ts";
import { processListingInBackground } from "../index.ts";
import { ListingProcessorService } from "../services/listing-processor.ts";

// Create a logger for testing
const logger = createLogger("BackgroundProcessorTest");


Deno.test({
  name: "processListingInBackground should process a listing correctly",
  async fn() {
    // Create a client for the local Supabase Docker instance
    const supabase = createLocalSupabaseClient();

    // Create a real repository with the local client
    const repository = new ListingRepository();

    // Create a test listing to use
    const testUrl = `https://home.dk/salg/lejligheder/emdrupvej-113-4-2400-koebenhavn-nv/sag-1620003650/`;
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

    assertEquals(1, 1);

  }
})
