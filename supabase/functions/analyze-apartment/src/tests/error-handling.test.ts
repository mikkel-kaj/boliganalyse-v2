// Using full URL imports instead of import maps
import { assertEquals } from "std/testing/asserts";
import { createLogger } from "../utils/logger.ts";

// Test suite for error handling
Deno.test("Logger should properly format different types of errors", () => {
  // Create test logger that captures output
  const originalConsoleError = console.error;
  let capturedOutput = "";
  
  console.error = (...args) => {
    capturedOutput = args.join(" ");
  };
  
  const logger = createLogger("TestLogger");
  
  // Test case 1: Error object
  capturedOutput = "";
  logger.error("Test with Error object", new Error("Test error message"));
  assertEquals(capturedOutput.includes("Test error message"), true, 
               "Error message should be included in log output");
  assertEquals(capturedOutput.includes("[object Object]"), false,
               "Log should not contain [object Object]");
  
  // Test case 2: Object with message property (like Supabase errors)
  capturedOutput = "";
  logger.error("Test with object error", { message: "Error in object form" });
  assertEquals(capturedOutput.includes("Error in object form"), true,
               "Object error's message property should be extracted");
  assertEquals(capturedOutput.includes("[object Object]"), false,
               "Log should not contain [object Object]");
               
  // Test case 3: Nested error object (like Supabase API errors)
  capturedOutput = "";
  logger.error("Test with nested error", { 
    error: { message: "Nested error message" } 
  });
  assertEquals(capturedOutput.includes("Nested error message"), true,
               "Nested error message should be extracted");
  assertEquals(capturedOutput.includes("[object Object]"), false,
               "Log should not contain [object Object]");
  
  // Test case 4: Complex object with no message property
  capturedOutput = "";
  const complexObj = { a: 1, b: { c: 2, d: [3, 4] } };
  logger.error("Test with complex object", complexObj);
  assertEquals(capturedOutput.includes("[object Object]"), false,
               "Even complex objects should not log as [object Object]");
  assertEquals(
    capturedOutput.includes('{"a":1,"b":{"c":2,"d":[3,4]}}') || 
    capturedOutput.includes(JSON.stringify(complexObj)),
    true,
    "Complex objects should be JSON stringified"
  );
  
  // Restore console.error
  console.error = originalConsoleError;
}); 