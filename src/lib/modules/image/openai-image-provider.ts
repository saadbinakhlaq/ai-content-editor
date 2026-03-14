import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openai } from "@/lib/openai";

export type GenerateSceneImageInput = {
  generationRunId: string;
  sceneNumber: number;
  prompt: string;
};

export type GenerateSceneImageOutput = {
  storagePath: string;
  publicUrl: string;
  mimeType: string;
};

export class OpenAIImageProvider {
  async generateSceneImage(
    input: GenerateSceneImageInput,
  ): Promise<GenerateSceneImageOutput> {
    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
    const size =
      (process.env.OPENAI_IMAGE_SIZE as
        | "1024x1024"
        | "1024x1536"
        | "1536x1024") ?? "1024x1536";

    const result = await openai.images.generate({
      model,
      prompt: input.prompt,
      size,
    });

    const image = result.data?.[0];
    const b64 = image?.b64_json;

    if (!b64) {
      throw new Error("OpenAI image generation returned no image data");
    }

    const buffer = Buffer.from(b64, "base64");

    const relativeDir = path.join("generated", input.generationRunId);
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);

    await mkdir(absoluteDir, { recursive: true });

    const fileName = `scene-${String(input.sceneNumber).padStart(2, "0")}.png`;
    const absolutePath = path.join(absoluteDir, fileName);

    await writeFile(absolutePath, buffer);

    return {
      storagePath: path.join(relativeDir, fileName),
      publicUrl: `/${relativeDir}/${fileName}`,
      mimeType: "image/png",
    };
  }
}
