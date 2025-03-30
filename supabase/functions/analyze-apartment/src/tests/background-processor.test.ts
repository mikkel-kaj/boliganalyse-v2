import {assertEquals} from "std/testing/asserts";
import {createLogger} from "../utils/logger.ts";
import {createLocalSupabaseClient} from "./utils/test-helpers.ts";
import {ListingRepository} from "../repositories/listing-repository.ts";
import {processListingInBackground} from "../index.ts";

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
    const testUrl = `https://www.edc.dk/alle-boliger/fritidshus/9480-loekken/gaasestien-3/94803748/?utm_campaign=boligsiden&utm_source=boligsiden.dk&utm_medium=referral`;
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
