import { BaseCloudAdapter } from '../BaseCloudAdapter';
import { Message, ToolDefinition } from '@/domain/entities';
import { LLMResponse, LLMStreamChunk } from '@/domain/ports/ILLMProvider';
import { IKeychain } from '@/domain/ports/IKeychain';

export class OpenAIAdapter extends BaseCloudAdapter {
  private readonly baseURL = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4o';

  constructor(keychain: IKeychain) {
    super(keychain);
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const apiKey = await this.getApiKey('openai');
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.transformMessages(messages),
        tools: this.transformTools(tools),
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    return {
      id: data.id,
      choices: data.choices.map((c: any) => ({
        message: {
          id: crypto.randomUUID(),
          role: c.message.role,
          content: c.message.content || '',
          toolCalls: c.message.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
          timestamp: Date.now(),
        },
        finish_reason: c.finish_reason,
      })),
    };
  }

  async *streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk> {
    const apiKey = await this.getApiKey('openai');
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.transformMessages(messages),
        tools: this.transformTools(tools),
        temperature: 0.7,
        stream: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
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
          if (data === '[DONE]') return;
          try {
            const json = JSON.parse(data);
            yield {
              delta: {
                role: json.choices[0]?.delta?.role,
                content: json.choices[0]?.delta?.content,
                toolCalls: json.choices[0]?.delta?.tool_calls,
              },
              finish_reason: json.choices[0]?.finish_reason,
            };
          } catch (e) {
            // ignore malformed JSON
          }
        }
      }
    }
  }
}
