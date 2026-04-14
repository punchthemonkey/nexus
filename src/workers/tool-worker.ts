// Whitelist of allowed globals
const ALLOWED_GLOBALS = new Set([
  'console', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String',
  'Number', 'Boolean', 'Promise', 'Error', 'TypeError', 'RangeError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'fetch'
]);

interface WorkerMessage {
  id: string;
  tool: string;
  args: Record<string, any>;
}

interface WorkerResponse {
  id: string;
  result?: any;
  error?: string;
}

// Built-in tool implementations (js_exec removed per Fragment 12)
const tools: Record<string, (args: any) => Promise<any>> = {
  calculator: async (args) => {
    const expr = args.expression as string;
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      throw new Error('Invalid characters in expression');
    }
    const result = Function('"use strict"; return (' + expr + ')')();
    return { result };
  },
  web_search: async (args) => {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 5;
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    const data = await response.json();
    const results = (data.Results || []).slice(0, maxResults).map((r: any) => ({
      title: r.Text,
      url: r.FirstURL
    }));
    return { query, results };
  },
  fetch_page: async (args) => {
    const url = args.url as string;
    const mode = (args.extractMode as string) || 'text';
    const response = await fetch(url);
    const html = await response.text();
    if (mode === 'html') return { url, content: html };
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { url, content: text.slice(0, 5000) };
  },
  // js_exec removed per Fragment 12 security fix
};

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, tool, args } = event.data;
  try {
    if (!tools[tool]) {
      throw new Error(`Unknown tool: ${tool}`);
    }
    const result = await tools[tool](args);
    self.postMessage({ id, result } as WorkerResponse);
  } catch (error: any) {
    self.postMessage({ id, error: error.message } as WorkerResponse);
  }
});
