import { inject, injectable } from 'tsyringe';
import { ILLMProvider, LLMStreamChunk } from '../ports/ILLMProvider';
import { IToolExecutor } from '../ports/IToolExecutor';
import { IMemoryStore } from '../ports/IMemoryStore';
import { IEventBus } from '@/application/event-bus';
import { Message, ToolCall, ToolDefinition, Conversation, Skill } from '../entities';
import { ProviderSelector, SystemMetrics } from './ProviderSelector';

export interface OrchestratorEvent {
  type: 'token' | 'tool_start' | 'tool_result' | 'tool_error' | 'response' | 'error' | 'max_steps';
  content?: string;
  toolCall?: ToolCall;
  result?: any;
  error?: Error;
}

@injectable()
export class Orchestrator {
  private maxSteps = 10;
  private activeSkill: Skill | null = null;

  constructor(
    @inject('ILLMProviderFactory') private llmFactory: (type: string) => ILLMProvider,
    @inject('IToolExecutor') private toolExecutor: IToolExecutor,
    @inject('IMemoryStore') private memoryStore: IMemoryStore,
    @inject('EventBus') private eventBus: IEventBus,
    @inject(ProviderSelector) private providerSelector: ProviderSelector
  ) {}

  setActiveSkill(skill: Skill | null): void {
    this.activeSkill = skill;
  }

  async *run(
    userMessage: string,
    conversationId: string,
    metrics: SystemMetrics
  ): AsyncGenerator<OrchestratorEvent> {
    const conv = await this.memoryStore.getConversation(conversationId);
    const messages: Message[] = this.buildInitialMessages(userMessage, conv);
    
    // Save user message
    const userMsg = messages[messages.length - 1];
    await this.memoryStore.saveMessage(conversationId, userMsg);

    let step = 0;
    const tools = this.getAvailableTools();

    while (step < this.maxSteps) {
      await this.eventBus.emit('orchestrator:reasoning:started', { step, messages });

      try {
        const providerType = await this.providerSelector.select(messages, metrics, this.activeSkill);
        const provider = this.llmFactory(providerType);
        
        const stream = provider.streamChat(messages, tools);
        let assistantMsg: Partial<Message> = { role: 'assistant', content: '', toolCalls: [] };
        let finishReason: string | undefined;

        for await (const chunk of stream) {
          if (chunk.delta.content) {
            assistantMsg.content += chunk.delta.content;
            yield { type: 'token', content: chunk.delta.content };
          }
          if (chunk.delta.toolCalls) {
            assistantMsg.toolCalls = this.mergeToolCalls(assistantMsg.toolCalls, chunk.delta.toolCalls);
          }
          finishReason = chunk.finish_reason;
        }

        // Complete assistant message
        const fullAssistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantMsg.content || '',
          toolCalls: assistantMsg.toolCalls?.length ? assistantMsg.toolCalls as ToolCall[] : undefined,
          timestamp: Date.now(),
        };
        messages.push(fullAssistantMsg);
        await this.memoryStore.saveMessage(conversationId, fullAssistantMsg);

        // If no tool calls, we're done
        if (!fullAssistantMsg.toolCalls || fullAssistantMsg.toolCalls.length === 0) {
          yield { type: 'response', content: fullAssistantMsg.content };
          await this.eventBus.emit('orchestrator:response:completed', { response: fullAssistantMsg });
          return;
        }

        // Execute tool calls
        for (const toolCall of fullAssistantMsg.toolCalls) {
          yield { type: 'tool_start', toolCall };
          await this.eventBus.emit('orchestrator:tool:started', { toolCall });

          try {
            const result = await this.toolExecutor.execute(toolCall);
            const toolMsg: Message = {
              id: crypto.randomUUID(),
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            messages.push(toolMsg);
            await this.memoryStore.saveMessage(conversationId, toolMsg);
            yield { type: 'tool_result', toolCall, result };
            await this.eventBus.emit('orchestrator:tool:completed', { toolCall, result });
          } catch (error: any) {
            const toolMsg: Message = {
              id: crypto.randomUUID(),
              role: 'tool',
              content: `Error: ${error.message}`,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            messages.push(toolMsg);
            await this.memoryStore.saveMessage(conversationId, toolMsg);
            yield { type: 'tool_error', toolCall, error };
            await this.eventBus.emit('orchestrator:tool:failed', { toolCall, error });
            await this.eventBus.emit('orchestrator:struggle:detected', {
              context: 'tool_execution_failed',
              toolCall,
              error: error.message
            });
          }
        }
      } catch (error: any) {
        yield { type: 'error', error };
        await this.eventBus.emit('orchestrator:struggle:detected', { error: error.message });
        throw error;
      }

      step++;
    }

    yield { type: 'max_steps' };
    await this.eventBus.emit('orchestrator:loop:max-steps', { maxSteps: this.maxSteps });
  }

  private buildInitialMessages(userMessage: string, conv: Conversation | null): Message[] {
    const messages: Message[] = [];
    if (this.activeSkill) {
      messages.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: this.activeSkill.systemPrompt,
        timestamp: Date.now(),
      });
    }
    if (conv) {
      messages.push(...conv.messages);
    }
    messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });
    return messages;
  }

  private getAvailableTools(): ToolDefinition[] | undefined {
    const allTools = this.toolExecutor.listTools();
    if (this.activeSkill) {
      const allowed = new Set(this.activeSkill.allowedTools);
      return allTools.filter(t => allowed.has(t.function.name));
    }
    return allTools;
  }

  // Fragment 12 fix: improved merge logic to handle ID collisions
  private mergeToolCalls(existing: ToolCall[] = [], incoming: any[]): ToolCall[] {
    const merged = [...existing];
    for (let i = 0; i < incoming.length; i++) {
      const inc = incoming[i];
      if (inc.id) {
        const existingIndex = merged.findIndex(t => t.id === inc.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = {
            ...merged[existingIndex],
            function: {
              ...merged[existingIndex].function,
              arguments: merged[existingIndex].function.arguments + (inc.function?.arguments || '')
            }
          };
        } else {
          merged.push(inc);
        }
      } else {
        // No ID: append to the last tool call of same index
        if (i < merged.length) {
          merged[i] = {
            ...merged[i],
            function: {
              ...merged[i].function,
              arguments: merged[i].function.arguments + (inc.function?.arguments || '')
            }
          };
        }
      }
    }
    return merged;
  }
}
