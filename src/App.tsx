import { useEffect, useState } from 'preact/hooks';
import { initializeContainer } from '@/application/container';
import { ChatView } from '@/ui/components/ChatView/ChatView';
import { ModelLoader } from '@/ui/components/ModelLoader';
import { DebugOverlay } from '@/ui/components/DebugOverlay/DebugOverlay';
import { useLocalLLM } from '@/ui/hooks/useLocalLLM';
import { container } from '@/application/container';
import { IndexedDBAdapter } from '@/infrastructure/adapters/storage/IndexedDBAdapter';
import { ThermalMonitor } from '@/infrastructure/monitoring/ThermalMonitor';
import { TabCoordinator } from '@/infrastructure/coordination/TabCoordinator';

export function App() {
  const [containerReady, setContainerReady] = useState(false);
  const { status, progress, error, initialize } = useLocalLLM();

  useEffect(() => {
    const init = async () => {
      await initializeContainer();
      setContainerReady(true);
    };
    init().catch(console.error);
  }, []);

  if (!containerReady) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Initializing Nexus...</div>;
  }

  if (status.value !== 'ready') {
    return (
      <ModelLoader
        status={status.value}
        progress={progress.value}
        error={error.value}
        onRetry={initialize}
      />
    );
  }

  return (
    <div class="app">
      <ChatView />
      <DebugOverlay />
    </div>
  );
}
