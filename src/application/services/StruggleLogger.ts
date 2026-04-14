import { injectable, inject } from 'tsyringe';
import { IEventBus, OrchestratorEvents } from '@/application/event-bus';
import { StruggleLog } from '@/domain/entities/StruggleLog';
import { IMemoryStore } from '@/domain/ports/IMemoryStore';

@injectable()
export class StruggleLogger {
  private logs: StruggleLog[] = [];
  private readonly THRESHOLD = 3;

  constructor(
    @inject('EventBus') private eventBus: IEventBus,
    @inject('IMemoryStore') private memoryStore: IMemoryStore
  ) {
    this.subscribeToEvents();
  }

  async initialize(): Promise<void> {
    // Fragment 12: rehydrate from persistent store
    const stored = await this.memoryStore.getStruggleLogs();
    this.logs = stored.filter(l => !l.resolved);
  }

  private subscribeToEvents(): void {
    this.eventBus.on(OrchestratorEvents.STRUGGLE_DETECTED, async (payload: any) => {
      await this.logStruggle(payload);
    });
    this.eventBus.on(OrchestratorEvents.TOOL_FAILED, async (payload: any) => {
      await this.logStruggle({
        errorType: 'ToolExecutionError',
        context: `Tool ${payload.toolCall.function.name} failed: ${payload.error}`,
        stackTrace: payload.error?.stack,
      });
    });
  }

  async logStruggle(data: {
    errorType: string;
    context: string;
    stackTrace?: string;
    codeContext?: string;
  }): Promise<void> {
    const log: StruggleLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      errorType: data.errorType,
      context: data.context,
      stackTrace: data.stackTrace,
      codeContext: data.codeContext,
      resolved: false,
    };
    this.logs.push(log);
    await this.memoryStore.saveStruggleLog(log);

    const unresolved = this.logs.filter(l => !l.resolved).length;
    if (unresolved >= this.THRESHOLD) {
      await this.eventBus.emit(OrchestratorEvents.SELF_EVOLUTION_TRIGGERED, { count: unresolved });
    }
  }

  async getUnresolvedLogs(limit?: number): Promise<StruggleLog[]> {
    return this.logs.filter(l => !l.resolved).slice(0, limit);
  }

  async markResolved(logIds: string[]): Promise<void> {
    for (const id of logIds) {
      const log = this.logs.find(l => l.id === id);
      if (log) log.resolved = true;
    }
    // Optionally persist updated resolved status
  }
}
