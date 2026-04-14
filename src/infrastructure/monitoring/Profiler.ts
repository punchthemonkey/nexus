import { injectable } from 'tsyringe';

@injectable()
export class Profiler {
  start(label: string): void {}
  end(label: string): number { return 0; }
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
