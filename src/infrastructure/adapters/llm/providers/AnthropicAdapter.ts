import { BaseCloudAdapter } from '../BaseCloudAdapter';
import { Message, ToolDefinition } from '@/domain/entities';
import { LLMResponse, LLMStreamChunk } from '@/domain/ports/ILLMProvider';
import { IKeychain } from '@/domain/ports/IKeychain';

export class AnthropicAdapter extends BaseCloudAdapter {
  private readonly baseURL = 'https://api.anthropic.com/v1/messages';
  private readonly model = 'claude-3-5-sonnet-20241022';
  private readonly version = '2023-06-01';

  constructor(keychain: IKeychain) {
    super(keychain);
  }

  private transformForAnthropic(messages: Message[]): { role: string; content: string }[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
  }

  private getSystemPrompt(messages: Message[]): string | undefined {
    const sysMsg = messages.find((m) => m.role === 'system');
    return sysMsg?.content;
  }

  private transformToolsAnthropic(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools) return undefined;
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const apiKey = await this.getApiKey('anthropic');
    const system = this.getSystemPrompt(messages);
    const transformedMessages = this.transformForAnthropic(messages);
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.version,
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: transformedMessages,
        tools: this.transformToolsAnthropic(tools),
        max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    return {
      id: data.id,
      choices: [
        {
          message: {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || '',
            toolCalls: data.content?.filter((c: any) => c.type === 'tool_use').map((tc: any) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input),
              },
            })),
            timestamp: Date.now(),
          },
          finish_reason: data.stop_reason,
        },
      ],
    };
  }

  async *streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk> {
    const apiKey = await this.getApiKey('anthropic');
    const system = this.getSystemPrompt(messages);
    const transformedMessages = this.transformForAnthropic(messages);
    
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.version,
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: transformedMessages,
        tools: this.transformToolsAnthropic(tools),
        max_tokens: 4096,
        stream: true,
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
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              yield { delta: { content: json.delta.text } };
            } else if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
              yield { delta: { toolCalls: [{ id: json.content_block.id, type: 'function', function: { name: json.content_block.name, arguments: '' } }] } };
            } else if (json.type === 'content_block_delta' && json.delta?.type === 'input_json_delta') {
              yield { delta: { toolCalls: [{ id: json.index, function: { arguments: json.delta.partial_json } }] } };
            }
          } catch (e) { /* ignore */ }
        }
      }
    }
  }
}
