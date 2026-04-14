import { injectable, inject } from 'tsyringe';
import { ThermalMonitor } from './ThermalMonitor';

@injectable()
export class AdaptiveScheduler {
  constructor(@inject(ThermalMonitor) private monitor: ThermalMonitor) {}
  
  async schedule<T>(task: () => Promise<T>): Promise<T> {
    // Placeholder: direct execution
    return task();
  }
  
  getQueueLength(): number {
    return 0;
  }
}
