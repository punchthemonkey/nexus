import { ToolHandler } from '@/domain/entities/ToolDefinition';

export const calculatorHandler: ToolHandler = async (args) => {
  const expr = args.expression as string;
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    throw new Error('Invalid characters in expression');
  }
  const result = Function('"use strict"; return (' + expr + ')')();
  return { result };
};

export const webSearchHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  const maxResults = (args.maxResults as number) || 5;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
  const response = await fetch(url);
  const data = await response.json();
  const results = (data.Results || []).slice(0, maxResults).map((r: any) => ({
    title: r.Text,
    url: r.FirstURL
  }));
  return { query, results };
};

export const fetchPageHandler: ToolHandler = async (args) => {
  const url = args.url as string;
  const mode = (args.extractMode as string) || 'text';
  const response = await fetch(url);
  const html = await response.text();
  if (mode === 'html') return { url, content: html };
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return { url, content: text.slice(0, 5000) };
};
