// Import works at runtime via deno.json import maps
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ListingRepository } from "../repositories/listing-repository.ts";
import { createLogger } from "../utils/logger.ts";
import { createLocalSupabaseClient } from "./utils/test-helpers.ts";

// Create a logger for testing
const logger = createLogger("RepositoryTest");

// Test repository with local Supabase instance
Deno.test({
  name: "Repository should handle database operations correctly",
  async fn() {
    // Create a client for the local Supabase Docker instance
    const supabase = createLocalSupabaseClient();
    
    // Create a test repository with the local client
    const repository = new ListingRepository(supabase);
    
    // Create a unique test listing
    const testUrl = `https://example.com/test-${Date.now()}`;
    const normalizedUrl = testUrl;
    
    try {
      // 1. Test creating a new listing
      const listing = await repository.createListing(testUrl, normalizedUrl);
      assertExists(listing.id, "Created listing should have an ID");
      logger.info(`Created test listing with ID: ${listing.id}`);
      
      // 2. Test finding the listing
      const foundListing = await repository.findByNormalizedUrl(normalizedUrl);
      assertExists(foundListing, "Should find the listing by normalized URL");
      assertEquals(foundListing?.url, testUrl, "Found listing should have the correct URL");
      
      // 3. Test updating status
      const statusUpdated = await repository.updateStatus(listing.id, "Testing status");
      assertEquals(statusUpdated, true, "Status update should succeed");
      
      // 4. Test updating metadata
      const metadataUpdated = await repository.updateListingMetadata(
        listing.id, 
        "A", 
        "https://example.com/test-image.jpg"
      );
      assertEquals(metadataUpdated, true, "Metadata update should succeed");
      
      // 5. Test saving analysis results
      const testAnalysis = {
        price: 2000000,
        size: 100,
        rooms: 4,
        source: "test"
      };
      
      const analysisSaved = await repository.saveAnalysisResult(
        listing.id,
        testAnalysis,
        "Test complete"
      );
      assertEquals(analysisSaved, true, "Analysis save should succeed");
      
      // Error handling test: Try to update with invalid data
      try {
        // This should cause an error due to invalid data type
        // @ts-ignore - Intentionally passing invalid data for testing
        await repository.updateListingMetadata(listing.id, { invalid: "object" }, null);
      } catch (error) {
        // This is expected to fail, but should properly format the error
        logger.info("Caught expected error from invalid data test");
      }
      
    } catch (error) {
      logger.error("Repository test failed", error);
      throw error;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
}); 