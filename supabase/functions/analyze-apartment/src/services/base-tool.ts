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
    const requiredParams = this.definition.input_schema.required || [];
    for (const required of requiredParams) {
      if (params[required] === undefined || params[required] === null) {
        throw new Error(`Missing required parameter: ${required}`);
      }
    }

    // Check for type validation
    const properties = this.definition.input_schema.properties;
    for (const [key, value] of Object.entries(params)) {
      const propDef = properties[key];
      if (propDef) {
        // Validate type
        const expectedType = propDef.type;
        let isValid = true;

        if (expectedType === 'string' && typeof value !== 'string') {
          isValid = false;
        } else if (expectedType === 'number' && typeof value !== 'number') {
          isValid = false;
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          isValid = false;
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          isValid = false;
        } else if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
          isValid = false;
        }

        if (!isValid) {
          throw new Error(`Parameter ${key} is of type ${typeof value}, expected ${expectedType}`);
        }

        // Validate enum values
        if (propDef.enum && !propDef.enum.includes(value)) {
          throw new Error(`Parameter ${key} value "${value}" is not one of the allowed enum values: ${propDef.enum.join(', ')}`);
        }
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