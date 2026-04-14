import { injectable } from 'tsyringe';
import { IToolExecutor } from '@/domain/ports/IToolExecutor';
import { ToolCall, ToolDefinition, ToolHandler } from '@/domain/entities';
import { WorkerPool } from '@/infrastructure/workers/worker-pool';
import { builtinTools } from './builtin-tools/definitions';

@injectable()
export class ToolExecutorAdapter implements IToolExecutor {
  private tools: Map<string, { definition: ToolDefinition; handler?: ToolHandler }> = new Map();
  private workerPool: WorkerPool;

  constructor() {
    this.workerPool = new WorkerPool(new URL('@/workers/tool-worker.ts', import.meta.url).href, 2);
    // Register built-in tools
    builtinTools.forEach(t => this.registerTool(t));
  }

  registerTool(definition: ToolDefinition, handler?: ToolHandler): void {
    this.tools.set(definition.function.name, { definition, handler });
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async execute(toolCall: ToolCall): Promise<any> {
    const toolName = toolCall.function.name;
    const toolEntry = this.tools.get(toolName);
    if (!toolEntry) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const args = JSON.parse(toolCall.function.arguments);
    
    // If handler exists and tool is not js_exec (which requires sandbox), use it directly
    // js_exec removed per Fragment 12
    if (toolEntry.handler) {
      return toolEntry.handler(args);
    }

    // Otherwise execute in worker sandbox
    return this.workerPool.execute(toolName, args);
  }

  dispose(): void {
    this.workerPool.terminate();
  }
}
