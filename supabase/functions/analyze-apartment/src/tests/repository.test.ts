import {assertEquals, assertExists} from "std/testing/asserts";
import {ListingRepository} from "../repositories/listing-repository.ts";
import {createLogger} from "../utils/logger.ts";
import {AnalysisStatus} from "../types/status.ts"; // Create a logger for testing

// Create a logger for testing
const logger = createLogger("RepositoryTest");

// Test repository with local Supabase instance
Deno.test({
  name: "Repository should handle database operations correctly",
  async fn() {
    // Create a test repository with the local client
    const repository = new ListingRepository();

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
      assertEquals(
        foundListing?.url,
        testUrl,
        "Found listing should have the correct URL",
      );

      // 3. Test updating status
      const statusUpdated = await repository.updateStatus(
        listing.id,
        AnalysisStatus.GENERATING_INSIGHTS,
      );
      assertEquals(statusUpdated, true, "Status update should succeed");

      // 4. Test updating metadata with just image URL
      const metadataUpdated = await repository.updateListingMetadata(
        listing.id,
        {
          property_image_url: "https://example.com/test-image.jpg",
        },
      );
      assertEquals(metadataUpdated, true, "Metadata update should succeed");

      // 5. Test saving analysis results
      const testAnalysis = {
        price: 2000000,
        size: 100,
        rooms: 4,
        source: "test",
      };

      const analysisSaved = await repository.saveAnalysisResult(
        listing.id,
        testAnalysis,
        AnalysisStatus.COMPLETED,
      );
      assertEquals(analysisSaved, true, "Analysis save should succeed");
    } catch (error) {
      logger.error("Repository test failed", error);
      throw error;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
