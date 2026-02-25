export type JobHandler = () => Promise<void> | void;

const jobs = new Map<string, JobHandler>();

export function registerJob(name: string, handler: JobHandler) {
  jobs.set(name, handler);
}

export async function runJob(name: string) {
  const job = jobs.get(name);
  if (!job) throw new Error('JOB_NOT_FOUND');
  await job();
}
