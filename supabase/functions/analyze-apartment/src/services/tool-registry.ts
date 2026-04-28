import { createLogger } from "../utils/logger.ts";
import { 
  ToolCallRequest, 
  ToolCallResponse, 
  ToolDefinition, 
  ToolImplementation, 
  ToolRegistry 
} from "../types/tool-calling.ts";
import {
  GetSubjectsTool,
  GetTablesTool,
  GetTableInfoTool,
  GetDataTool
} from "./tools/dst-api-tools.ts";
import { config } from "../config/config.ts";

const logger = createLogger("ToolRegistry");

/**
 * Registry for managing AI tools
 * Provides functionality to register, retrieve, and execute tools
 */
export class ToolRegistryService implements ToolRegistry {
  private tools: Map<string, ToolImplementation> = new Map();
  private definitions: Map<string, ToolDefinition> = new Map();

  /**
   * Create a new ToolRegistryService with optional initialization
   * @param initialize Whether to initialize tools immediately
   */
  constructor(initialize = false) {
    if (initialize) {
      this.initializeTools();
    }
  }

  /**
   * Initialize all available tools
   * Register each tool with its definition in the registry
   */
  initializeTools(): void {
    logger.info("Initializing tools...");

    if (config.features.enableDstTools) {
      this.registerTool(new GetSubjectsTool());
      this.registerTool(new GetTablesTool());
      this.registerTool(new GetTableInfoTool());
      this.registerTool(new GetDataTool());
      logger.info("DST tools registered");
    } else {
      logger.info("DST tools disabled (ENABLE_DST_TOOLS != true)");
    }

    logger.info("Tool initialization complete");
  }

  /**
   * Register a new tool with its definition
   * @param tool The tool implementation
   */
  registerTool(tool: ToolImplementation): void {
    const definition = tool.getDefinition();
    
    if (this.tools.has(definition.name)) {
      logger.warn(`Tool with name ${definition.name} already exists and will be overwritten`);
    }
    
    this.tools.set(definition.name, tool);
    this.definitions.set(definition.name, definition);
    logger.info(`Registered tool: ${definition.name}`);
  }

  /**
   * Get a tool implementation by name
   * @param name The name of the tool
   * @returns The tool implementation or undefined if not found
   */
  getTool(name: string): ToolImplementation | undefined {
    return this.tools.get(name);
  }

  /**
   * Get a tool definition by name
   * @param name The name of the tool
   * @returns The tool definition or undefined if not found
   */
  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Get all registered tool definitions
   * @returns Array of all tool definitions
   */
  getAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Execute a tool by name with provided parameters
   * @param request The tool call request
   * @returns Result of the tool execution
   */
  async executeTool(request: ToolCallRequest): Promise<ToolCallResponse> {
    const { name, parameters, id } = request;
    const tool = this.tools.get(name);
    
    if (!tool) {
      logger.error(`Tool not found: ${name}`);
      return {
        output: null,
        error: `Tool not found: ${name}`
      };
    }

    try {
      logger.info(`Executing tool: ${name} with parameters: ${JSON.stringify(parameters)}`);
      const output = await tool.execute(parameters);
      
      // Validate output - Claude API requires tool results to be strings or content blocks
      if (output !== null && output !== undefined) {
        return { output };
      } else {
        return { output: null, error: "Tool returned null or undefined result" };
      }
    } catch (error) {
      logger.error(`Error executing tool ${name}:`, error);
      return {
        output: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 