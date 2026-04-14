import { IEventBus, OrchestratorEvents } from '@/application/event-bus';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  protected state: CircuitState = CircuitState.CLOSED;
  protected failureCount = 0;
  protected lastFailureTime = 0;
  protected failureThreshold = 5;
  protected resetTimeout = 30000; // 30 seconds

  constructor(protected name: string, protected eventBus?: IEventBus) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error(`Circuit ${this.name} is OPEN`);
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  protected onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  protected onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.eventBus?.emit(OrchestratorEvents.CIRCUIT_OPENED, { name: this.name, failureCount: this.failureCount });
    }
  }

  getState(): CircuitState { return this.state; }
  getFailureCount(): number { return this.failureCount; }
}

export class SelfEvolutionCircuitBreaker extends CircuitBreaker {
  private dailyCount = 0;
  private lastReset = Date.now();

  constructor(eventBus?: IEventBus) {
    super('self-evolution', eventBus);
    this.failureThreshold = 3;
    this.resetTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (Date.now() - this.lastReset > 24 * 60 * 60 * 1000) {
      this.dailyCount = 0;
      this.lastReset = Date.now();
    }
    if (this.dailyCount >= 3) {
      throw new Error('Daily self-evolution limit reached');
    }
    this.dailyCount++;
    return super.execute(fn);
  }
}
