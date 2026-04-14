export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema object
  };
}

export interface ToolHandler {
  (args: Record<string, any>): Promise<any>;
}
