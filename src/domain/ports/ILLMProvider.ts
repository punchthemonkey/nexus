import { Message, ToolDefinition } from '../entities';

export interface LLMResponse {
  id: string;
  choices: Array<{
    message: Message;
    finish_reason: string;
  }>;
}

export interface LLMStreamChunk {
  delta: Partial<Message>;
  finish_reason?: string;
}

export interface ILLMProvider {
  chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk>;
}
