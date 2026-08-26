"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import type { LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";

/** The six languages stored as translation rows on top of an entity's own
 *  English columns. English is never a row — it is the column itself. */
export const OVERLAY_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

interface TranslationRow {
  id: string;
  field: string;
  lang: string;
  value: string;
}

type ByField = Record<string, Partial<Record<Locale, string>>>;

/**
 * Per-field translation editing for an entity that stores English on its own
 * columns and the other six languages in the translations table.
 *
 * `useEntityTranslations` covers the form-with-a-Save-button case: it holds
 * every field in memory and flushes them all at once. This one is for pages
 * that save as you leave a field — it persists one field at a time, so a
 * hero slide's subtitle can be written and stored without touching its title.
 */
export function useLocalizedEntity(entityType: string, entityId: string) {
  const [values, setValues] = useState<ByField>({});
  const [ids, setIds] = useState<ByField>({});
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    const res = await fetch(`/next-api/translations/${entityType}/${entityId}`);
    if (!res.ok) return;
    const rows = (await res.json()) as TranslationRow[];
    const nextValues: ByField = {};
    const nextIds: ByField = {};
    for (const row of rows) {
      if (!(LOCALES as readonly string[]).includes(row.lang)) continue;
      const lang = row.lang as Locale;
      (nextValues[row.field] ??= {})[lang] = row.value;
      (nextIds[row.field] ??= {})[lang] = row.id;
    }
    setValues(nextValues);
    setIds(nextIds);
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    // Deferred a tick rather than run in the effect body — the same shape
    // useEntityTranslations uses, and what keeps the fetch's setState out of
    // the render that scheduled it.
    const t = setTimeout(() => {
      fetchRows()
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fetchRows]);

  /** The whole seven-language map for one field: English off the entity's own
   *  column, the rest out of the translation rows. */
  const mapFor = useCallback(
    (field: string, base: string | null | undefined): LocalizedTextMap => ({
      ...values[field],
      ...(base?.trim() ? { [DEFAULT_LOCALE]: base } : {}),
    }),
    [values],
  );

  /**
   * Writes the six overlay languages for one field. English is the caller's
   * job — it lives on the entity, not here.
   *
   * Rows are re-read afterwards rather than guessed at: a newly upserted row's
   * id comes back from the server, and without it a later "clear this
   * language" would have nothing to delete.
   */
  const saveField = useCallback(
    async (field: string, map: LocalizedTextMap): Promise<void> => {
      const upserts = OVERLAY_LOCALES.filter((l) => {
        const next = map[l]?.trim() ?? "";
        return next && next !== (values[field]?.[l] ?? "");
      }).map((l) => ({ entityType, entityId, field, lang: l, value: map[l]!.trim() }));

      const removals = OVERLAY_LOCALES.filter((l) => !map[l]?.trim() && ids[field]?.[l]).map(
        (l) => ids[field]![l]!,
      );

      if (!upserts.length && !removals.length) return;

      await Promise.all([
        upserts.length
          ? fetch("/next-api/translations/bulk", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: upserts }),
            })
          : Promise.resolve(),
        ...removals.map((rowId) => fetch(`/next-api/translations/entry/${rowId}`, { method: "DELETE" })),
      ]);

      await fetchRows();
    },
    [entityType, entityId, values, ids, fetchRows],
  );

  return { mapFor, saveField, loading };
}
