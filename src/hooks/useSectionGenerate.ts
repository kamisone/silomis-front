"use client";

import { useState } from "react";

/** Drives a single "Generate" action: POSTs an English source to a section-translate
 *  endpoint and returns the parsed per-language result, tracking loading/error state. */
export function useSectionGenerate<TResponse>(endpoint: string) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(body: unknown): Promise<TResponse | null> {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("request_failed");
      return (await res.json()) as TResponse;
    } catch {
      setError("Generation failed — try again.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  function setCustomError(message: string) {
    setError(message);
  }

  return { generate, generating, error, setError: setCustomError, clearError: () => setError(null) };
}
