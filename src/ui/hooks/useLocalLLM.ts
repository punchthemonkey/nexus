import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { container } from '@/application/container';
import { LocalLLMAdapter } from '@/infrastructure/adapters/llm/LocalLLMAdapter';

export function useLocalLLM() {
  const status = useSignal<'uninitialized' | 'loading' | 'ready' | 'error'>('uninitialized');
  const progress = useSignal(0);
  const error = useSignal<string | null>(null);

  const initialize = async () => {
    const adapter = container.resolve<LocalLLMAdapter>('LocalLLMAdapter');
    if (adapter.isReady()) {
      status.value = 'ready';
      return;
    }
    try {
      status.value = 'loading';
      await adapter.initialize((report) => {
        progress.value = report.progress;
      });
      status.value = 'ready';
    } catch (e: any) {
      status.value = 'error';
      error.value = e.message;
    }
  };

  useEffect(() => {
    // Auto-initialize when hook mounts
    initialize();
  }, []);

  return { status, progress, error, initialize };
}
