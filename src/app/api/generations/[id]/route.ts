import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const generationRun = await prisma.generationRun.findUnique({
      where: { id },
      include: {
        script: {
          include: {
            scenes: {
              orderBy: { sceneNumber: "asc" },
              include: {
                assets: {
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        },
        jobs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!generationRun) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(generationRun);
  } catch (error) {
    console.error("GET /api/generations/[id] failed", error);

    return NextResponse.json(
      { error: "Failed to fetch generation" },
      { status: 500 },
    );
  }
}