// Tiny worker pool so the experiments use every core. The script passed in is both the main program
// and the worker: when it runs as a worker it should call serveJobs(handler).
import os from "node:os";
import { Worker, parentPort, isMainThread } from "node:worker_threads";

export { isMainThread };

export function runPool(scriptUrl, jobs, threads = Math.max(1, os.cpus().length - 1), onDone = () => {}) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0;
    const n = Math.min(threads, jobs.length);
    if (n === 0) return resolve(results);
    for (let i = 0; i < n; i++) {
      const w = new Worker(scriptUrl);
      const feed = () => {
        if (next < jobs.length) { const id = next++; w.postMessage({ id, job: jobs[id] }); }
        else w.terminate();
      };
      w.on("message", ({ id, result }) => { results[id] = result; done++; onDone(done, jobs.length); if (done === jobs.length) resolve(results); feed(); });
      w.on("error", reject);
      feed();
    }
  });
}

export function serveJobs(handler) {
  parentPort.on("message", ({ id, job }) => parentPort.postMessage({ id, result: handler(job) }));
}
