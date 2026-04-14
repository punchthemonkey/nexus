import { ToolCall, ToolDefinition, ToolHandler } from '../entities';

export interface IToolExecutor {
  execute(toolCall: ToolCall): Promise<unknown>;
  registerTool(definition: ToolDefinition, handler: ToolHandler): void;
  listTools(): ToolDefinition[];
}
