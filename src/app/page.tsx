"use client";

import { useState } from "react";

type Asset = {
  id: string;
  type: "IMAGE";
  publicUrl: string;
  mimeType: string;
};

type Scene = {
  id: string;
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
  assets: Asset[];
};

type Script = {
  id: string;
  title: string;
  hook: string;
  fullScript: string;
  voiceoverText: string;
  scenes: Scene[];
};

type GenerationRun = {
  id: string;
  status:
    | "QUEUED"
    | "PROCESSING_TEXT"
    | "PROCESSING_IMAGES"
    | "COMPLETED"
    | "FAILED";
  prompt: string;
  errorMessage: string | null;
  script: Script | null;
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("educational");
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState<GenerationRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollGeneration = async (id: string) => {
    let done = false;

    while (!done) {
      const response = await fetch(`/api/generations/${id}`, {
        cache: "no-store",
      });

      const data: GenerationRun = await response.json();
      setGeneration(data);

      if (data.status === "COMPLETED" || data.status === "FAILED") {
        done = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setGeneration(null);

    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          style,
          language: "en",
          durationTargetSec: 30,
          imageCount: 4,
          voice: "alloy",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      await pollGeneration(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">
            AI Content Studio
          </h1>
          <p className="mt-3 text-zinc-400">
            Generate a script first, then scene images.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Topic</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 5 surprising facts about sleep for busy professionals"
              className="min-h-32 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Style</label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate content"}
          </button>
        </form>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {generation ? (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="text-sm text-zinc-400">Status</div>
              <div className="mt-1 text-lg font-medium">{generation.status}</div>
              {generation.errorMessage ? (
                <div className="mt-3 text-red-300">{generation.errorMessage}</div>
              ) : null}
            </div>

            {generation.script ? (
              <>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-sm text-zinc-400">Title</div>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {generation.script.title}
                  </h2>

                  <div className="mt-6 text-sm text-zinc-400">Hook</div>
                  <p className="mt-1">{generation.script.hook}</p>

                  <div className="mt-6 text-sm text-zinc-400">Full script</div>
                  <p className="mt-1 whitespace-pre-wrap">
                    {generation.script.fullScript}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-sm text-zinc-400">Scenes</div>
                  <div className="mt-4 space-y-6">
                    {generation.script.scenes.map((scene) => {
                      const image = scene.assets[0];

                      return (
                        <div
                          key={scene.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                        >
                          <div className="font-medium">Scene {scene.sceneNumber}</div>

                          <div className="mt-3 text-sm text-zinc-400">Narration</div>
                          <p className="mt-1">{scene.narration}</p>

                          <div className="mt-3 text-sm text-zinc-400">
                            Image prompt
                          </div>
                          <p className="mt-1">{scene.imagePrompt}</p>

                          <div className="mt-4">
                            {image ? (
                              <img
                                src={image.publicUrl}
                                alt={`Scene ${scene.sceneNumber}`}
                                className="w-full rounded-xl border border-zinc-800"
                              />
                            ) : (
                              <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                                {generation.status === "PROCESSING_IMAGES"
                                  ? "Generating image..."
                                  : "No image yet"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}