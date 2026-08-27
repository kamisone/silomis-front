"use client";

import { useState } from "react";
import { useSectionGenerate } from "./useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import type { OverlayLang } from "./useEntityTranslations";

const TRANSLATE_TEXT = "/next-api/admin/shop/translate/text";
const TRANSLATE_HTML = "/next-api/admin/shop/translate/html";

/**
 * Wires a whole form's worth of BilingualFields to the shared "Generate"
 * endpoint in one call.
 *
 * Every generate button does the same three things — post the English, fan the
 * result out across the six overlay languages, and report whichever languages
 * failed — so the only thing a caller should have to say is which field it is:
 *
 *     const gen = useCopyGenerate(setTranslation);
 *     <BilingualField field="name" … {...gen.field("name", form.name)} />
 *     <BilingualField field="body" richText … {...gen.field("body", form.body, "html")} />
 *
 * State is tracked per field rather than per form, so clicking Generate on the
 * description does not put the name's button into a spinner too.
 */
export function useCopyGenerate(setTranslation: (lang: OverlayLang, field: string, value: string) => void) {
  const text = useSectionGenerate<SectionTranslationOutcome<string>>(TRANSLATE_TEXT);
  const html = useSectionGenerate<SectionTranslationOutcome<string>>(TRANSLATE_HTML);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);

  async function run(field: string, value: string, kind: "text" | "html") {
    const source = value?.trim();
    if (!source) return;
    const gen = kind === "html" ? html : text;
    setActiveField(field);
    setErrorField(null);
    try {
      const outcome = await gen.generate(kind === "html" ? { html: source } : { text: source });
      // A total failure already left its message on the hook; keep whatever the
      // admin had typed rather than blanking the overlay languages.
      if (!outcome) {
        setErrorField(field);
        return;
      }
      for (const [lang, translated] of Object.entries(outcome.result) as [OverlayLang, string][]) {
        if (translated) setTranslation(lang, field, translated);
      }
      const summary = summarizeGenerateErrors(outcome.errors);
      if (summary) {
        gen.setError(summary);
        setErrorField(field);
      }
    } finally {
      setActiveField(null);
    }
  }

  /** Spread onto a BilingualField: `{...gen.field("name", form.name)}`. */
  function field(name: string, value: string, kind: "text" | "html" = "text") {
    const gen = kind === "html" ? html : text;
    return {
      onGenerate: () => run(name, value, kind),
      generating: activeField === name,
      // Scoped to the field that actually failed — one shared hook would
      // otherwise print the description's error under the name.
      generateError: errorField === name ? gen.error : null,
    };
  }

  return { field };
}
