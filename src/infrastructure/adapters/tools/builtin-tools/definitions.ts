import { ToolDefinition } from '@/domain/entities/ToolDefinition';

export const calculatorTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculator',
    description: 'Evaluate a mathematical expression safely',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression (e.g., "2 + 3 * 4")' }
      },
      required: ['expression']
    }
  }
};

export const webSearchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', default: 5 }
      },
      required: ['query']
    }
  }
};

export const fetchPageTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'fetch_page',
    description: 'Fetch and extract text content from a URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        extractMode: { type: 'string', enum: ['text', 'accessibility', 'html'], default: 'text' }
      },
      required: ['url']
    }
  }
};

// jsExecTool removed per Fragment 12
export const builtinTools: ToolDefinition[] = [
  calculatorTool,
  webSearchTool,
  fetchPageTool,
];
