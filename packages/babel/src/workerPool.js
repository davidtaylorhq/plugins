import { Worker } from 'worker_threads';

import os from 'os';

class WorkerPool {
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.nextTaskId = 0;
    this.pendingTasks = new Map();
    this.isTerminating = false;
  }

  initialize() {
    if (this.workers.length > 0) {
      return;
    }

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript);

      worker.on('message', (message) => {
        const { id, result, error } = message;
        const pendingTask = this.pendingTasks.get(id);

        if (pendingTask) {
          this.pendingTasks.delete(id);

          if (error) {
            const err = new Error(error.message);
            err.name = error.name;
            err.stack = error.stack;
            pendingTask.reject(err);
          } else {
            pendingTask.resolve(result);
          }

          // Worker is now available for the next task
          this.availableWorkers.push(worker);
          this.processQueue();
        }
      });

      worker.on('error', (error) => {
        // Handle worker errors
        console.error('Worker error:', error);
      });

      worker.on('exit', (code) => {
        if (code !== 0 && !this.isTerminating) {
          console.error(`Worker stopped with exit code ${code}`);
        }
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const worker = this.availableWorkers.shift();

      worker.postMessage({
        id: task.id,
        inputCode: task.inputCode,
        babelOptions: task.babelOptions
      });
    }
  }

  runTask(inputCode, babelOptions) {
    this.initialize();

    return new Promise((resolve, reject) => {
      const taskId = this.nextTaskId++;

      this.pendingTasks.set(taskId, { resolve, reject });

      const task = {
        id: taskId,
        inputCode,
        babelOptions
      };

      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.shift();
        worker.postMessage({
          id: task.id,
          inputCode: task.inputCode,
          babelOptions: task.babelOptions
        });
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  async terminate() {
    this.isTerminating = true;

    // Reject all pending tasks
    for (const [id, { reject }] of this.pendingTasks.entries()) {
      reject(new Error('Worker pool is terminating'));
    }
    this.pendingTasks.clear();

    // Clear the task queue
    this.taskQueue = [];

    // Terminate all workers
    const terminatePromises = this.workers.map((worker) =>
      worker.terminate().catch((err) => {
        console.error('Error terminating worker:', err);
      })
    );

    await Promise.all(terminatePromises);

    this.workers = [];
    this.availableWorkers = [];
  }
}

// Create a singleton worker pool instance
let pool = null;

export function getWorkerPool() {
  if (!pool) {
    const workerScript = import.meta.url.replace('file://', '');
    pool = new WorkerPool(workerScript);
  }
  return pool;
}

export async function terminateWorkerPool() {
  if (pool) {
    await pool.terminate();
    pool = null;
  }
}
