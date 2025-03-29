/**
 * Type definitions for tool calling functionality
 */

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: {
    type: string;
    [key: string]: any;
  };
  properties?: Record<string, ToolProperty>;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

export interface ToolImplementation {
  execute(params: Record<string, any>): Promise<any>;
  getDefinition(): ToolDefinition;
}

export interface ToolCallRequest {
  name: string;
  parameters: Record<string, any>;
  id?: string;
}

export interface ToolCallResponse {
  output: any;
  error?: string;
}

export interface ToolRegistry {
  registerTool(tool: ToolImplementation): void;
  getTool(name: string): ToolImplementation | undefined;
  getToolDefinition(name: string): ToolDefinition | undefined;
  getAllToolDefinitions(): ToolDefinition[];
  executeTool(request: ToolCallRequest): Promise<ToolCallResponse>;
} 