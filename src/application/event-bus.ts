type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface IEventBus {
  on<T>(event: string, handler: EventHandler<T>): () => void;
  emit<T>(event: string, payload: T): Promise<void>;
  once<T>(event: string, handler: EventHandler<T>): () => void;
  removeAllListeners(event?: string): void;
}

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.handlers.get(event)?.delete(handler as EventHandler);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    const promises = Array.from(handlers).map((h) => Promise.resolve(h(payload)));
    await Promise.all(promises);
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler<T> = (payload) => {
      handler(payload);
      this.handlers.get(event)?.delete(wrapper);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

// Event constants
export const OrchestratorEvents = {
  REASONING_STARTED: 'orchestrator:reasoning:started',
  REASONING_STREAM: 'orchestrator:reasoning:stream',
  TOOL_STARTED: 'orchestrator:tool:started',
  TOOL_COMPLETED: 'orchestrator:tool:completed',
  TOOL_FAILED: 'orchestrator:tool:failed',
  STRUGGLE_DETECTED: 'orchestrator:struggle:detected',
  LOOP_MAX_STEPS: 'orchestrator:loop:max-steps',
  RESPONSE_COMPLETED: 'orchestrator:response:completed',
  MEMORY_SYNC_COMPLETED: 'memory:sync:completed',
  CIRCUIT_OPENED: 'circuit:opened',
  METRICS_UPDATED: 'metrics:updated',
  SELF_EVOLUTION_TRIGGERED: 'self-evolution:triggered',
} as const;
