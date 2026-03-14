import { Worker } from "bullmq";
import { prisma } from "@/lib/db";
import {
  GENERATION_QUEUE_NAME,
  redisConnection,
  type GenerationJobData,
} from "@/lib/queue";
import { OpenAITextProvider } from "@/lib/modules/text/openai-text-provider";

const textProvider = new OpenAITextProvider();

const worker = new Worker<GenerationJobData>(
  GENERATION_QUEUE_NAME,
  async (job) => {
    const { generationRunId } = job.data;

    await prisma.generationRun.update({
      where: { id: generationRunId },
      data: { status: "PROCESSING", errorMessage: null },
    });

    await prisma.job.updateMany({
      where: { generationRunId, type: "GENERATE_SCRIPT" },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        errorMessage: null,
      },
    });

    const generationRun = await prisma.generationRun.findUnique({
      where: { id: generationRunId },
    });

    if (!generationRun) {
      throw new Error(`GenerationRun ${generationRunId} not found`);
    }

    const manifest = await textProvider.generateScript({
      prompt: generationRun.prompt,
      style: generationRun.style ?? undefined,
      language: generationRun.language,
      durationTargetSec: generationRun.durationTargetSec,
      imageCount: generationRun.imageCount,
    });

    await prisma.$transaction(async (tx) => {
      const script = await tx.script.create({
        data: {
          generationRunId,
          title: manifest.title,
          hook: manifest.hook,
          fullScript: manifest.fullScript,
          voiceoverText: manifest.voiceoverText,
          rawJson: manifest,
        },
      });

      await tx.scene.createMany({
        data: manifest.scenes.map((scene) => ({
          scriptId: script.id,
          sceneNumber: scene.sceneNumber,
          narration: scene.narration,
          imagePrompt: scene.imagePrompt,
        })),
      });

      await tx.generationRun.update({
        where: { id: generationRunId },
        data: { status: "COMPLETED" },
      });

      await tx.job.updateMany({
        where: { generationRunId, type: "GENERATE_SCRIPT" },
        data: { status: "COMPLETED" },
      });
    });

    return { ok: true };
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", async (job, error) => {
  console.error(`Job ${job?.id} failed`, error);

  const generationRunId = job?.data?.generationRunId;
  if (!generationRunId) return;

  await prisma.generationRun.update({
    where: { id: generationRunId },
    data: {
      status: "FAILED",
      errorMessage: error.message,
    },
  });

  await prisma.job.updateMany({
    where: { generationRunId, type: "GENERATE_SCRIPT" },
    data: {
      status: "FAILED",
      errorMessage: error.message,
    },
  });
});

const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  await prisma.$disconnect();
  await redisConnection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Generation worker started");