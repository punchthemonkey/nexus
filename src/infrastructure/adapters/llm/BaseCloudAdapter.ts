import { ILLMProvider, LLMResponse, LLMStreamChunk } from '@/domain/ports/ILLMProvider';
import { Message, ToolDefinition } from '@/domain/entities';
import { IKeychain } from '@/domain/ports/IKeychain';

export abstract class BaseCloudAdapter implements ILLMProvider {
  constructor(protected keychain: IKeychain) {}

  abstract chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk>;

  protected async getApiKey(provider: string): Promise<string> {
    return this.keychain.getKey(provider);
  }

  protected transformMessages(messages: Message[]): any[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls && { tool_calls: m.toolCalls }),
      ...(m.toolCallId && { tool_call_id: m.toolCallId }),
    }));
  }

  protected transformTools(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }
}
