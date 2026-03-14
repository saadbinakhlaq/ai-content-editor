import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection";
import type { GenerationJobData } from "./types";

export const GENERATION_QUEUE_NAME = "generation-jobs";

export const generationQueue = new Queue<GenerationJobData>(
  GENERATION_QUEUE_NAME,
  {
    connection: redisConnection,
  },
);

export const generationQueueEvents = new QueueEvents(GENERATION_QUEUE_NAME, {
  connection: redisConnection,
});
