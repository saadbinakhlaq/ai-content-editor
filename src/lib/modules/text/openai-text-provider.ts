import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai";
import {
  scriptManifestSchema,
  type ScriptManifest,
} from "@/lib/modules/text/schema";

export type GenerateScriptInput = {
  prompt: string;
  style?: string;
  language: string;
  durationTargetSec: number;
  imageCount: number;
};

export class OpenAITextProvider {
  async generateScript(input: GenerateScriptInput): Promise<ScriptManifest> {
    const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";

    const response = await openai.responses.parse({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You generate short-form video content manifests.",
                "Return a tight script for a short video.",
                "Keep the output concise, clear, and ready for voiceover.",
                "Generate exactly the requested number of scenes.",
                "Each scene must contain narration and a visually specific image prompt.",
                "Do not include markdown.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Topic: ${input.prompt}`,
                `Style: ${input.style ?? "educational"}`,
                `Language: ${input.language}`,
                `Target duration in seconds: ${input.durationTargetSec}`,
                `Number of scenes: ${input.imageCount}`,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(scriptManifestSchema, "script_manifest"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI did not return a parsed script manifest");
    }

    return response.output_parsed;
  }
}
