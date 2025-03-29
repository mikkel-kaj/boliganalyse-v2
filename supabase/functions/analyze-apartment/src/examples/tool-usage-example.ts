import { AIAnalyzerService } from "../services/ai-analyzer.ts";
import { AnalyzerServiceOptions } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { config } from "../config/config.ts";

const logger = createLogger("ToolUsageExample");

/**
 * Example of how to use the tool calling functionality
 * This demonstrates using the "add" tool through the AIAnalyzerService
 */
export async function toolUsageExample(): Promise<void> {
  try {
    // Create analyzer options using config
    const options: AnalyzerServiceOptions = {
      apiKey: config.claude.apiKey,
      initializeTools: true // Auto-initialize tools
    };
    
    // Create the AI analyzer with auto-initialized tools
    const analyzer = new AIAnalyzerService(options);
    
    // Example 1: Use the addNumbers convenience method
    const a = 23;
    const b = 45;
    logger.info(`Calculating ${a} + ${b} using addNumbers method...`);
    const sum = await analyzer.addNumbers(a, b);
    logger.info(`The sum is: ${sum}`);
    
    // Example 2: Direct tool usage with analyzeWithTools
    const prompt = `
      I need to solve a mathematical problem. 
      What is 17 + 29? Please use the "add" tool for the calculation.
    `;
    
    logger.info("Direct tool usage with custom prompt...");
    const result = await analyzer.analyzeWithTools(prompt);
    logger.info("Analysis result:", result);
    
  } catch (error) {
    logger.error("Error in tool usage example:", error);
  }
}

// If this file is executed directly, run the example
if (import.meta.main) {
  await toolUsageExample();
} 