import { Worker } from "bullmq";
import { prisma } from "@/lib/db";
import {
  GENERATION_QUEUE_NAME,
  redisConnection,
  type GenerationJobData,
} from "@/lib/queue";
import { OpenAITextProvider } from "@/lib/modules/text/openai-text-provider";
import { OpenAIImageProvider } from "@/lib/modules/image/openai-image-provider";

console.log("Worker process booting");

const textProvider = new OpenAITextProvider();
const imageProvider = new OpenAIImageProvider();

const worker = new Worker<GenerationJobData>(
  GENERATION_QUEUE_NAME,
  async (job) => {
    console.log("Picked up job", job.id, job.data);

    const { generationRunId } = job.data;

    await prisma.generationRun.update({
      where: { id: generationRunId },
      data: { status: "PROCESSING_TEXT", errorMessage: null },
    });

    await prisma.job.updateMany({
      where: { generationRunId, type: "GENERATE_CONTENT" },
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

    console.log("Calling text provider");
    const manifest = await textProvider.generateScript({
      prompt: generationRun.prompt,
      style: generationRun.style ?? undefined,
      language: generationRun.language,
      durationTargetSec: generationRun.durationTargetSec,
      imageCount: generationRun.imageCount,
    });

    console.log("Saving script and scenes");
    const script = await prisma.script.create({
      data: {
        generationRunId,
        title: manifest.title,
        hook: manifest.hook,
        fullScript: manifest.fullScript,
        voiceoverText: manifest.voiceoverText,
        rawJson: manifest,
      },
    });

    for (const scene of manifest.scenes) {
      await prisma.scene.create({
        data: {
          scriptId: script.id,
          sceneNumber: scene.sceneNumber,
          narration: scene.narration,
          imagePrompt: scene.imagePrompt,
        },
      });
    }

    await prisma.generationRun.update({
      where: { id: generationRunId },
      data: { status: "PROCESSING_IMAGES" },
    });

    const savedScript = await prisma.script.findUnique({
      where: { id: script.id },
      include: {
        scenes: {
          orderBy: { sceneNumber: "asc" },
        },
      },
    });

    if (!savedScript) {
      throw new Error(`Script ${script.id} not found after creation`);
    }

    console.log("Generating scene images");
    for (const scene of savedScript.scenes) {
      const image = await imageProvider.generateSceneImage({
        generationRunId,
        sceneNumber: scene.sceneNumber,
        prompt: scene.imagePrompt,
      });

      await prisma.asset.create({
        data: {
          generationRunId,
          sceneId: scene.id,
          type: "IMAGE",
          storagePath: image.storagePath,
          publicUrl: image.publicUrl,
          mimeType: image.mimeType,
        },
      });

      console.log("Saved image for scene", scene.sceneNumber);
    }

    await prisma.generationRun.update({
      where: { id: generationRunId },
      data: { status: "COMPLETED" },
    });

    await prisma.job.updateMany({
      where: { generationRunId, type: "GENERATE_CONTENT" },
      data: { status: "COMPLETED" },
    });

    console.log("Job finished", job.id);
    return { ok: true };
  },
  {
    connection: redisConnection,
    concurrency: 2,
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
    where: { generationRunId, type: "GENERATE_CONTENT" },
    data: {
      status: "FAILED",
      errorMessage: error.message,
    },
  });
});

console.log("BullMQ worker started");

const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  await prisma.$disconnect();
  await redisConnection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);