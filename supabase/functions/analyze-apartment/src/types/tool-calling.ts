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

/**
 * Claude API Types
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type ContentBlock = TextContentBlock | ToolUseContentBlock | ToolResultContentBlock;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ClaudeResponse {
  id?: string;
  content: ContentBlock[];
  model?: string;
  role?: string;
  stop_reason?: string;
  type?: string;
  [key: string]: any;
} 