import { createLogger } from "../utils/logger.ts";
import { ToolDefinition, ToolImplementation } from "../types/tool-calling.ts";

const logger = createLogger("BaseTool");

/**
 * Base class for all tool implementations
 * Provides common functionality and type safety for tools
 */
export abstract class BaseTool implements ToolImplementation {
  protected readonly definition: ToolDefinition;

  /**
   * Create a new tool implementation
   * @param definition The tool definition
   */
  constructor(definition: ToolDefinition) {
    this.definition = definition;
  }

  /**
   * Get the tool definition
   * @returns The tool definition
   */
  getDefinition(): ToolDefinition {
    return this.definition;
  }

  /**
   * Validate that the provided parameters match the definition
   * @param params Parameters to validate
   * @returns True if valid, throws error if invalid
   */
  protected validateParameters(params: Record<string, any>): boolean {
    // Check for required parameters
    for (const paramDef of this.definition.input_schema) {
      if (paramDef.required && (params[paramDef.name] === undefined || params[paramDef.name] === null)) {
        throw new Error(`Missing required parameter: ${paramDef.name}`);
      }
    }
    return true;
  }

  /**
   * Execute the tool with the provided parameters
   * @param params Parameters for the tool execution
   * @returns Result of the execution
   */
  async execute(params: Record<string, any>): Promise<any> {
    try {
      this.validateParameters(params);
      return await this.executeImpl(params);
    } catch (error) {
      logger.error(`Error executing tool ${this.definition.name}:`, error);
      throw error;
    }
  }

  /**
   * Implementation of the tool execution
   * Must be implemented by subclasses
   * @param params Parameters for execution
   */
  protected abstract executeImpl(params: Record<string, any>): Promise<any>;
} 