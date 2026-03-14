import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generationQueue } from "@/lib/queue";

const createGenerationSchema = z.object({
  prompt: z.string().min(3).max(500),
  style: z.string().min(1).max(100).optional(),
  language: z.string().min(2).max(20).default("en"),
  durationTargetSec: z.number().int().min(10).max(180).default(30),
  imageCount: z.number().int().min(1).max(8).default(4),
  voice: z.string().min(1).max(50).default("alloy"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createGenerationSchema.parse(body);

    const generationRun = await prisma.generationRun.create({
      data: {
        prompt: input.prompt,
        style: input.style,
        language: input.language,
        durationTargetSec: input.durationTargetSec,
        imageCount: input.imageCount,
        voice: input.voice,
        status: "QUEUED",
        jobs: {
          create: {
            type: "GENERATE_CONTENT",
            status: "QUEUED",
          },
        },
      },
    });

    await generationQueue.add(
      "generate-content",
      { generationRunId: generationRun.id },
      {
        jobId: generationRun.id,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    console.log("Enqueued generation job", generationRun.id);

    return NextResponse.json(
      {
        id: generationRun.id,
        status: generationRun.status,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/generations failed", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create generation" },
      { status: 500 },
    );
  }
}