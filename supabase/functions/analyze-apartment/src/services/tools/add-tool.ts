import { createLogger } from "../../utils/logger.ts";
import { ToolDefinition } from "../../types/tool-calling.ts";
import { BaseTool } from "../base-tool.ts";

const logger = createLogger("AddTool");

/**
 * Tool definition for the Add tool
 */
export const ADD_TOOL_DEFINITION: ToolDefinition = {
  name: "add",
  description: "Adds two numbers together and returns their sum. Use this tool when you need to perform addition between two numeric values.",
  input_schema: {
    type: "object",
    properties: {
      a: {
        type: "number",
        description: "First number to add"
      },
      b: {
        type: "number",
        description: "Second number to add"
      }
    },
    required: ["a", "b"]
  }
};

/**
 * Simple calculator tool that adds two numbers
 * Example tool implementation
 */
export class AddTool extends BaseTool {
  constructor() {
    super(ADD_TOOL_DEFINITION);
  }

  /**
   * Implementation of the add operation
   * @param params Parameters with a and b values
   * @returns Sum of a and b
   */
  protected async executeImpl(params: Record<string, any>): Promise<number> {
    const { a, b } = params;
    
    // Convert parameters to numbers (in case they are passed as strings)
    const numA = Number(a);
    const numB = Number(b);
    
    // Validate parameters are actually numbers
    if (isNaN(numA) || isNaN(numB)) {
      throw new Error(`Invalid parameters: a=${a}, b=${b}. Both parameters must be numbers.`);
    }
    
    logger.info(`Adding ${numA} + ${numB}`);
    return numA + numB;
  }
} 