import { prisma } from '../db/client.js';

interface JobDefinition {
  type: string;
  intervalMs: number;
  handler: () => Promise<void>;
}

export class JobRunner {
  private jobs: JobDefinition[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private running = false;

  register(job: JobDefinition) {
    this.jobs.push(job);
  }

  start() {
    if (this.running) return;
    this.running = true;

    for (const job of this.jobs) {
      // Run immediately on start, then on interval
      this.runJob(job);
      const interval = setInterval(() => this.runJob(job), job.intervalMs);
      this.intervals.push(interval);
    }

    console.log(`Job runner started: ${this.jobs.map(j => j.type).join(', ')}`);
  }

  stop() {
    this.running = false;
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  private async runJob(job: JobDefinition) {
    try {
      await job.handler();
      await prisma.backgroundJob.upsert({
        where: { type: job.type },
        create: { type: job.type, status: 'idle', last_run_at: new Date() },
        update: { status: 'idle', last_run_at: new Date(), error: null },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Job ${job.type} failed:`, errorMsg);
      await prisma.backgroundJob.upsert({
        where: { type: job.type },
        create: { type: job.type, status: 'failed', last_run_at: new Date(), error: errorMsg },
        update: { status: 'failed', last_run_at: new Date(), error: errorMsg },
      }).catch(() => {});  // don't fail on logging failure
    }
  }
}
