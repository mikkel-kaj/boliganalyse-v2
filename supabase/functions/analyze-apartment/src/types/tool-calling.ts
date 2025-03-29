/**
 * Type definitions for tool calling functionality
 */

export interface ToolCallParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolCallParam[];
}

export interface ToolImplementation {
  execute(params: Record<string, any>): Promise<any>;
}

export interface ToolCallRequest {
  name: string;
  parameters: Record<string, any>;
}

export interface ToolCallResponse {
  output: any;
  error?: string;
}

export interface ToolRegistry {
  registerTool(tool: ToolImplementation, definition: ToolDefinition): void;
  getTool(name: string): ToolImplementation | undefined;
  getToolDefinition(name: string): ToolDefinition | undefined;
  getAllToolDefinitions(): ToolDefinition[];
  executeTool(request: ToolCallRequest): Promise<ToolCallResponse>;
} 