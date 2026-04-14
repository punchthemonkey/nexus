type Task<T = any> = {
  id: string;
  tool: string;
  args: Record<string, any>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class WorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private queue: Task[] = [];
  private maxWorkers: number;
  private workerScript: string;

  constructor(workerScript: string, maxWorkers = 2) {
    this.workerScript = workerScript;
    this.maxWorkers = maxWorkers;
  }

  private createWorker(): Worker {
    const worker = new Worker(this.workerScript, { type: 'module' });
    worker.onmessage = (e) => this.handleMessage(worker, e.data);
    worker.onerror = (e) => this.handleError(worker, new Error(e.message));
    return worker;
  }

  private handleMessage(worker: Worker, data: { id: string; result?: any; error?: string }) {
    const taskIndex = this.queue.findIndex(t => t.id === data.id);
    if (taskIndex === -1) return;
    const [task] = this.queue.splice(taskIndex, 1);
    if (data.error) {
      task.reject(new Error(data.error));
    } else {
      task.resolve(data.result);
    }
    this.releaseWorker(worker);
    this.processQueue();
  }

  private handleError(worker: Worker, error: Error) {
    const index = this.workers.indexOf(worker);
    if (index !== -1) this.workers.splice(index, 1);
    const availIndex = this.available.indexOf(worker);
    if (availIndex !== -1) this.available.splice(availIndex, 1);
    worker.terminate();
    this.processQueue();
  }

  private releaseWorker(worker: Worker) {
    this.available.push(worker);
  }

  private getWorker(): Worker | null {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    if (this.workers.length < this.maxWorkers) {
      const worker = this.createWorker();
      this.workers.push(worker);
      return worker;
    }
    return null;
  }

  private processQueue() {
    while (this.queue.length > 0) {
      const worker = this.getWorker();
      if (!worker) break;
      const task = this.queue.shift()!;
      worker.postMessage({ id: task.id, tool: task.tool, args: task.args });
    }
  }

  execute<T>(tool: string, args: Record<string, any>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.queue.push({ id, tool, args, resolve, reject });
      this.processQueue();
    });
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.available = [];
    this.queue.forEach(t => t.reject(new Error('Worker pool terminated')));
    this.queue = [];
  }
}
