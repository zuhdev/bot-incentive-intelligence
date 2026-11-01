/**
 * Scheduler abstraction.
 *
 * Spec asks for Redis + BullMQ where appropriate. This environment may not
 * have Redis, so the queue is pluggable:
 *  - MemoryScheduler (default): setInterval-based, single instance, always works.
 *  - BullMQScheduler: activated when REDIS_URL is configured (dynamically
 *    imported; the dependency must be installed in the deployment image).
 *
 * Workers call `registerJob` with a name + interval + async fn.
 */
import env from "@/lib/env";

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

export interface Scheduler {
  register(job: ScheduledJob): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class MemoryScheduler implements Scheduler {
  private jobs: ScheduledJob[] = [];
  private timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();

  register(job: ScheduledJob) {
    this.jobs.push(job);
  }

  async start() {
    for (const job of this.jobs) {
      const timer = setInterval(async () => {
        if (this.running.has(job.name)) return; // no overlapping runs
        this.running.add(job.name);
        try {
          await job.run();
        } catch (err) {
          console.error(`[scheduler:${job.name}]`, err instanceof Error ? err.message : err);
        } finally {
          this.running.delete(job.name);
        }
      }, job.intervalMs);
      this.timers.push(timer);
      console.log(`[scheduler] registered ${job.name} every ${Math.round(job.intervalMs / 1000)}s`);
    }
  }

  async stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}

/** Redis-backed repeating jobs for the separately deployed production worker. */
export class BullMQScheduler implements Scheduler {
  private readonly jobs = new Map<string, ScheduledJob>();
  private queue: import("bullmq").Queue | null = null;
  private worker: import("bullmq").Worker | null = null;
  private connection: import("ioredis").Redis | null = null;

  register(job: ScheduledJob) {
    this.jobs.set(job.name, job);
  }

  async start() {
    if (!env.REDIS_URL) throw new Error("REDIS_URL is required for BullMQ");
    const [{ Queue, Worker }, RedisModule] = await Promise.all([import("bullmq"), import("ioredis")]);
    const Redis = RedisModule.default;
    this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue("bot-incentive-ingestion", {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    this.worker = new Worker(
      "bot-incentive-ingestion",
      async (job) => {
        const configured = this.jobs.get(job.name);
        if (!configured) throw new Error(`No handler registered for job ${job.name}`);
        await configured.run();
      },
      { connection: this.connection },
    );
    this.worker.on("failed", (job, error) => {
      console.error(`[bullmq:${job?.name ?? "unknown"}]`, error.message);
    });

    for (const job of this.jobs.values()) {
      await this.queue.upsertJobScheduler(
        job.name,
        { every: job.intervalMs },
        { name: job.name, data: {} },
      );
      console.log(`[scheduler] registered BullMQ ${job.name} every ${Math.round(job.intervalMs / 1000)}s`);
    }
  }

  async stop() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}

export function createScheduler(): Scheduler {
  if (env.REDIS_URL) {
    console.log("[scheduler] using BullMQ (REDIS_URL configured)");
    return new BullMQScheduler();
  }
  return new MemoryScheduler();
}
