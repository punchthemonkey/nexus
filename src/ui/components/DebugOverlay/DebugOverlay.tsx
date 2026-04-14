import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { container } from '@/application/container';
import { ThermalMonitor } from '@/infrastructure/monitoring/ThermalMonitor';
import { AdaptiveScheduler } from '@/infrastructure/monitoring/AdaptiveScheduler';
import { TabCoordinator } from '@/infrastructure/coordination/TabCoordinator';
import { CircuitBreaker } from '@/infrastructure/monitoring/CircuitBreaker';
import './DebugOverlay.css';

export function DebugOverlay() {
  const visible = useSignal(false);
  const metrics = container.resolve(ThermalMonitor).getMetrics();
  const scheduler = container.resolve(AdaptiveScheduler);
  const coordinator = container.resolve(TabCoordinator);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    visible.value = params.has('debug');
    
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        visible.value = !visible.value;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!visible.value) return null;

  return (
    <div class="debug-overlay">
      <div class="debug-section">
        <h4>System</h4>
        <div>Thermal: {metrics.value.thermalState}</div>
        <div>Battery: {(metrics.value.batteryLevel * 100).toFixed(0)}% {metrics.value.isCharging ? '⚡' : '🔋'}</div>
        <div>Network: {metrics.value.networkType} {metrics.value.online ? '🟢' : '🔴'}</div>
        <div>GPU Pressure: {metrics.value.gpuMemoryPressure}</div>
      </div>
      <div class="debug-section">
        <h4>Coordination</h4>
        <div>Tab: {coordinator.isLeaderTab() ? 'Leader' : 'Follower'}</div>
        <div>Queue: {scheduler.getQueueLength()}</div>
      </div>
      <button onClick={() => visible.value = false}>Close</button>
    </div>
  );
}
