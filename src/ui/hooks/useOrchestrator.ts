import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { container } from '@/application/container';
import { Orchestrator } from '@/domain/orchestrator/Orchestrator';
import { Message } from '@/domain/entities';
import { IMemoryStore } from '@/domain/ports/IMemoryStore';
import { ThermalMonitor } from '@/infrastructure/monitoring/ThermalMonitor';
import { SkillRegistry } from '@/domain/skills/SkillRegistry';

export function useOrchestrator(conversationId: string) {
  const messages = useSignal<Message[]>([]);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);

  const orchestrator = container.resolve(Orchestrator);
  const memoryStore = container.resolve<IMemoryStore>('IMemoryStore');
  const thermalMonitor = container.resolve(ThermalMonitor);
  const skillRegistry = container.resolve(SkillRegistry);

  // Load existing conversation
  useEffect(() => {
    const loadConv = async () => {
      const conv = await memoryStore.getConversation(conversationId);
      if (conv) messages.value = conv.messages;
    };
    loadConv();
  }, [conversationId]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading.value) return;
    isLoading.value = true;
    error.value = null;

    // Set active skill in orchestrator
    const activeSkill = skillRegistry.getActiveSkill();
    orchestrator.setActiveSkill(activeSkill);

    // Add user message optimistically
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    messages.value = [...messages.value, userMsg];

    // Create placeholder for assistant response
    const assistantId = crypto.randomUUID();
    messages.value = [...messages.value, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }];

    try {
      const metrics = thermalMonitor.getMetrics().value;
      const stream = orchestrator.run(content, conversationId, metrics);
      let accumulated = '';
      for await (const event of stream) {
        if (event.type === 'token' && event.content) {
          accumulated += event.content;
          // Update assistant message with accumulated content
          messages.value = messages.value.map(msg =>
            msg.id === assistantId ? { ...msg, content: accumulated } : msg
          );
        } else if (event.type === 'tool_start') {
          // Optionally add a system message for tool visibility
          const toolMsg: Message = {
            id: crypto.randomUUID(),
            role: 'system',
            content: `🔧 Using tool: ${event.toolCall?.function.name}`,
            timestamp: Date.now(),
          };
          messages.value = [...messages.value, toolMsg];
        } else if (event.type === 'error') {
          throw event.error;
        }
      }
    } catch (e: any) {
      error.value = e.message;
      messages.value = messages.value.map(msg =>
        msg.id === assistantId ? { ...msg, content: 'Sorry, an error occurred.' } : msg
      );
    } finally {
      isLoading.value = false;
    }
  };

  return { messages, sendMessage, isLoading, error };
}
