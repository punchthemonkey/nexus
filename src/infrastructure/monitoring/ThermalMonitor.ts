import { signal, Signal } from '@preact/signals';
import { injectable, inject } from 'tsyringe';
import { IEventBus, OrchestratorEvents } from '@/application/event-bus';
import { SystemMetrics } from './types';

@injectable()
export class ThermalMonitor {
  private metrics = signal<SystemMetrics>({
    thermalState: 'nominal',
    batteryLevel: 1.0,
    isCharging: true,
    networkType: 'unknown',
    gpuMemoryPressure: 'low',
    online: navigator.onLine,
  });

  private interval: number | null = null;
  private gpuAdapter: GPUAdapter | null = null;
  private gpuDevice: GPUDevice | null = null;

  constructor(@inject('EventBus') private eventBus: IEventBus) {
    this.startMonitoring();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => this.updateOnline(true));
    window.addEventListener('offline', () => this.updateOnline(false));
    
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        const update = () => this.updateNetworkType(conn.effectiveType);
        conn.addEventListener('change', update);
        update();
      }
    }

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          this.metrics.value = {
            ...this.metrics.value,
            batteryLevel: battery.level,
            isCharging: battery.charging,
          };
          this.emitUpdate();
        };
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
        update();
      });
    }
  }

  private startMonitoring(): void {
    this.interval = window.setInterval(() => this.estimateThermalState(), 5000);
    this.estimateThermalState();
  }

  private async estimateThermalState(): Promise<void> {
    let state: SystemMetrics['thermalState'] = 'nominal';
    
    if (this.metrics.value.batteryLevel < 0.1 && !this.metrics.value.isCharging) {
      state = 'critical';
    } else if (this.metrics.value.batteryLevel < 0.2) {
      state = 'serious';
    }

    // Fragment 12 fix: cache GPU adapter/device to avoid repeated requests
    if (!this.gpuAdapter) {
      try {
        this.gpuAdapter = await navigator.gpu?.requestAdapter();
        if (this.gpuAdapter) {
          this.gpuDevice = await this.gpuAdapter.requestDevice();
        }
      } catch (e) {
        // WebGPU not available
      }
    }

    if (this.gpuDevice) {
      const maxBufferSize = this.gpuDevice.limits.maxBufferSize;
      const maxBufferMB = maxBufferSize / (1024 * 1024);
      let pressure: SystemMetrics['gpuMemoryPressure'] = 'low';
      if (maxBufferMB < 512) {
        pressure = 'high';
      } else if (maxBufferMB < 1024) {
        pressure = 'moderate';
      }
      this.metrics.value = { ...this.metrics.value, gpuMemoryPressure: pressure };
    }

    this.metrics.value = { ...this.metrics.value, thermalState: state };
    this.emitUpdate();
  }

  private updateOnline(online: boolean): void {
    this.metrics.value = { ...this.metrics.value, online };
    this.emitUpdate();
  }

  private updateNetworkType(type: string): void {
    this.metrics.value = { ...this.metrics.value, networkType: type };
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.eventBus.emit(OrchestratorEvents.METRICS_UPDATED, this.metrics.value);
  }

  getMetrics(): Signal<SystemMetrics> {
    return this.metrics;
  }

  shouldThrottle(): boolean {
    const m = this.metrics.value;
    return m.thermalState === 'critical' || 
           m.batteryLevel < 0.1 || 
           m.gpuMemoryPressure === 'high' ||
           !m.online;
  }

  dispose(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
