import { assertEquals, assertExists } from "std/testing/asserts";
import { assertSpyCalls, spy } from "https://deno.land/std@0.200.0/testing/mock.ts";
import { createLogger } from "../utils/logger.ts";
import { createLocalSupabaseClient } from "./utils/test-helpers.ts";
import { ListingRepository } from "../repositories/listing-repository.ts";
import { ListingProcessorService } from "../services/listing-processor.ts";

// Create a logger for testing
const logger = createLogger("BackgroundProcessorTest");

// Import the function directly from index.ts
// We need to dynamically import since it's not exported by default
async function getProcessListingInBackground() {
  const module = await import("../index.ts");
  // @ts-expect-error - Accessing a function that isn't explicitly exported
  return module.processListingInBackground;
}

// Test the background processing function
Deno.test({
  name: "processListingInBackground should process a listing correctly",
  async fn() {
    // Set up environment variables

    // Get the function to test
    const processListingInBackground = await getProcessListingInBackground();
    
    // Create a client for the local Supabase Docker instance
    const supabase = createLocalSupabaseClient();
    
    // Create a real repository with the local client
    const repository = new ListingRepository(supabase);
    
    // Create a test listing to use
    const testUrl = `https://example.com/background-test-${Date.now()}`;
    const normalizedUrl = testUrl;
    const listing = await repository.createListing(testUrl, normalizedUrl);
    
    logger.info(`Created test listing with ID: ${listing.id}`);
    
    // Create a spy for the processor's processListing method
    // We'll use a real processor but spy on its method
    const processor = new ListingProcessorService(repository);
    const processListingSpy = spy(processor, "processListing");
    
    // Mock the processor creation inside the function
    // This is a bit tricky since we need to replace the class constructor
    const originalListingProcessorService = ListingProcessorService;
    
    try {
      // Replace the ListingProcessorService class with a mock that returns our spied instance
      // @ts-expect-error - Intentionally replacing global class for test
      globalThis.ListingProcessorService = class MockListingProcessorService {
        constructor() {
          return processor;
        }
      };
      
      // Call the function under test
      await processListingInBackground(
        listing.id,
        testUrl,
        normalizedUrl,
        repository
      );
      
      // Assert that processListing was called with the correct parameters
      assertSpyCalls(processListingSpy, 1);
      assertEquals(
        processListingSpy.calls[0].args, 
        [listing.id, testUrl, normalizedUrl],
        "processListing should be called with correct parameters"
      );
      
      // Verify the listing status was updated
      const updatedListing = await repository.findByNormalizedUrl(normalizedUrl);
      assertExists(updatedListing, "Listing should still exist after processing");
      
      // The status might be different based on the processing outcome
      // but it should not contain "Fejl" (error) if successful
      if (updatedListing?.status) {
        assertEquals(
          updatedListing.status.toLowerCase().includes("fejl"),
          false,
          "Listing status should not indicate error"
        );
      }
      
    } catch (error) {
      logger.error("Background processor test failed", error);
      throw error;
    } finally {
      // Restore the original class
      // @ts-expect-error - Restoring global class after test
      globalThis.ListingProcessorService = originalListingProcessorService;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Test error handling in the background processing function
Deno.test({
  name: "processListingInBackground should handle errors gracefully",
  async fn() {
    
    // Get the function to test
    const processListingInBackground = await getProcessListingInBackground();
    
    // Create a client for the local Supabase Docker instance
    const supabase = createLocalSupabaseClient();
    
    // Create a real repository and spy on updateStatus
    const repository = new ListingRepository(supabase);
    const updateStatusSpy = spy(repository, "updateStatus");
    
    // Create a test listing
    const testUrl = `https://example.com/background-error-test-${Date.now()}`;
    const normalizedUrl = testUrl;
    const listing = await repository.createListing(testUrl, normalizedUrl);
    
    logger.info(`Created test listing with ID: ${listing.id}`);
    
    // Create a processor that throws an error
    const errorProcessor = new ListingProcessorService(repository);
    errorProcessor.processListing = () => {
      throw new Error("Test processing error");
    };
    
    // Mock the processor creation
    const originalListingProcessorService = ListingProcessorService;
    
    try {
      // Replace the ListingProcessorService class with a mock that returns our error processor
      // @ts-expect-error - Intentionally replacing global class for test
      globalThis.ListingProcessorService = class MockListingProcessorService {
        constructor() {
          return errorProcessor;
        }
      };
      
      // Call the function under test - it should not throw despite the error
      await processListingInBackground(
        listing.id,
        testUrl,
        normalizedUrl,
        repository
      );
      
      // Assert that updateStatus was called with an error message
      assertSpyCalls(updateStatusSpy, 1);
      assertEquals(
        updateStatusSpy.calls[0].args[0], 
        listing.id,
        "updateStatus should be called with the correct listing ID"
      );
      assertEquals(
        updateStatusSpy.calls[0].args[1],
        "Fejl: Test processing error",
        "updateStatus should be called with the error message"
      );
      
      // Verify the listing has an error status
      const updatedListing = await repository.findByNormalizedUrl(normalizedUrl);
      assertExists(updatedListing, "Listing should still exist after error");
      assertEquals(
        updatedListing?.status?.includes("Fejl"),
        true,
        "Listing status should indicate an error occurred"
      );
      
    } catch (error) {
      logger.error("Background error test failed", error);
      throw error;
    } finally {
      // Restore the original class
      // @ts-expect-error - Restoring global class after test
      globalThis.ListingProcessorService = originalListingProcessorService;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
}); 