import { BaseCloudAdapter } from '../BaseCloudAdapter';
import { Message, ToolDefinition } from '@/domain/entities';
import { LLMResponse, LLMStreamChunk } from '@/domain/ports/ILLMProvider';
import { IKeychain } from '@/domain/ports/IKeychain';

export class GeminiAdapter extends BaseCloudAdapter {
  private readonly baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

  constructor(keychain: IKeychain) {
    super(keychain);
  }

  private transformForGemini(messages: Message[]): { contents: any[]; systemInstruction?: any } {
    const contents: any[] = [];
    let systemInstruction: string | undefined;
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
        continue;
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: any[] = [{ text: msg.content }];
      if (msg.toolCalls) {
        parts.push(...msg.toolCalls.map((tc) => ({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        })));
      }
      contents.push({ role, parts });
    }
    return { contents, systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined };
  }

  private transformToolsGemini(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools) return undefined;
    return [{
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const apiKey = await this.getApiKey('gemini');
    const { contents, systemInstruction } = this.transformForGemini(messages);
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,  // Fragment 12: use header
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        tools: this.transformToolsGemini(tools),
        generationConfig: { temperature: 0.7 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];
    const text = parts.find((p: any) => p.text)?.text || '';
    const functionCalls = parts.filter((p: any) => p.functionCall).map((fc: any) => ({
      id: crypto.randomUUID(),
      type: 'function',
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args),
      },
    }));
    return {
      id: crypto.randomUUID(),
      choices: [{
        message: {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: text,
          toolCalls: functionCalls.length ? functionCalls : undefined,
          timestamp: Date.now(),
        },
        finish_reason: candidate?.finishReason,
      }],
    };
  }

  async *streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk> {
    const apiKey = await this.getApiKey('gemini');
    const { contents, systemInstruction } = this.transformForGemini(messages);
    const url = `${this.baseURL}?alt=sse&key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        tools: this.transformToolsGemini(tools),
        generationConfig: { temperature: 0.7 },
      }),
    });
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const json = JSON.parse(data);
            const part = json.candidates?.[0]?.content?.parts?.[0];
            if (part?.text) {
              yield { delta: { content: part.text } };
            } else if (part?.functionCall) {
              yield { delta: { toolCalls: [{ id: '0', type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } }] } };
            }
          } catch (e) { /* ignore */ }
        }
      }
    }
  }
}
