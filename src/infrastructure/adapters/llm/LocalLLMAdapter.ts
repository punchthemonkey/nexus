import { injectable } from 'tsyringe';
import * as webllm from '@mlc-ai/web-llm';
import { ILLMProvider, LLMResponse, LLMStreamChunk } from '@/domain/ports/ILLMProvider';
import { Message, ToolDefinition } from '@/domain/entities';

export interface LocalLLMConfig {
  modelId: string;
  maxConcurrentRequests?: number;
}

@injectable()
export class LocalLLMAdapter implements ILLMProvider {
  private engine: webllm.MLCEngine | null = null;
  private modelId: string;
  private maxConcurrentRequests: number;
  private initPromise: Promise<void> | null = null;

  constructor(config?: LocalLLMConfig) {
    this.modelId = config?.modelId ?? 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
    this.maxConcurrentRequests = config?.maxConcurrentRequests ?? 1;
  }

  async initialize(onProgress?: (report: webllm.InitProgressReport) => void): Promise<void> {
    if (this.engine) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.engine = await webllm.CreateMLCEngine(this.modelId, {
        initProgressCallback: onProgress,
        logLevel: 'WARN',
        maxConcurrentRequests: this.maxConcurrentRequests,
      });
    })();
    return this.initPromise;
  }

  private ensureEngine(): webllm.MLCEngine {
    if (!this.engine) throw new Error('Local LLM not initialized. Call initialize() first.');
    return this.engine;
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const engine = this.ensureEngine();
    const response = await engine.chat.completions.create({
      messages: messages as any,
      tools: tools as any,
      temperature: 0.7,
      max_tokens: 2048,
    });
    return this.transformResponse(response);
  }

  async *streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<LLMStreamChunk> {
    const engine = this.ensureEngine();
    const stream = await engine.chat.completions.create({
      messages: messages as any,
      tools: tools as any,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });
    for await (const chunk of stream) {
      yield this.transformStreamChunk(chunk);
    }
  }

  private transformResponse(response: any): LLMResponse {
    return {
      id: response.id,
      choices: response.choices.map((c: any) => ({
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

  private transformStreamChunk(chunk: any): LLMStreamChunk {
    const delta = chunk.choices[0]?.delta;
    return {
      delta: {
        role: delta?.role,
        content: delta?.content,
        toolCalls: delta?.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function?.name,
            arguments: tc.function?.arguments,
          },
        })),
      },
      finish_reason: chunk.choices[0]?.finish_reason,
    };
  }

  isReady(): boolean {
    return this.engine !== null;
  }
}
