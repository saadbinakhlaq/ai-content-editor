import { z } from "zod";

export const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  narration: z.string().min(1),
  imagePrompt: z.string().min(1),
});

export const scriptManifestSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  fullScript: z.string().min(1),
  voiceoverText: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
});

export type ScriptManifest = z.infer<typeof scriptManifestSchema>;
