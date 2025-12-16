import { Worker } from 'worker_threads';

import os from 'os';

export default class WorkerPool {
  workers = [];
  availableWorkers = [];

  pendingTasks = [];
  runningTasks = new Map();

  nextTaskId = 0;

  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
  }

  createWorker() {
    const worker = new Worker(this.workerScript);

    worker.on('message', (message) => {
      const { result, error } = message;
      const runningTask = this.runningTasks.get(worker);

      if (runningTask) {
        this.runningTasks.delete(worker);

        if (error) {
          const err = new Error(error.message);
          err.name = error.name;
          err.stack = error.stack;
          runningTask.reject(err);
        } else {
          runningTask.resolve(result);
        }

        this.availableWorkers.push(worker);
        this.processQueue();
      }
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.isTerminating) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });

    this.workers.push(worker);
    return worker;
  }

  getAvailableWorker() {
    if (this.availableWorkers.length > 0) {
      return this.availableWorkers.shift();
    }
    if (this.workers.length < this.poolSize) {
      return this.createWorker();
    }
    return null;
  }

  processQueue() {
    while (this.pendingTasks.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) break;

      const task = this.pendingTasks.shift();

      this.runningTasks.set(worker, task);

      worker.postMessage(task.opts);
    }
  }

  async runTask(opts) {
    const taskPromise = new Promise((resolve, reject) => {
      this.pendingTasks.push({
        resolve,
        reject,
        opts
      });
    });

    this.processQueue();

    return taskPromise;
  }

  async terminate() {
    this.isTerminating = true;
    for (const [, { reject }] of this.runningTasks.entries()) {
      reject(new Error('Worker pool is terminating'));
    }
    this.runningTasks.clear();
    this.pendingTasks.length = 0;

    const terminatePromises = this.workers.map((worker) =>
      worker.terminate().catch((err) => {
        console.error('Error terminating worker:', err);
      })
    );

    await Promise.all(terminatePromises);

    this.workers.length = 0;
    this.availableWorkers.length = 0;
  }
}
