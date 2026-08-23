"use client";

import { useCallback, useEffect, useState } from "react";

// Overlay languages stored in the translations table on top of the English base entity fields.
export const OVERLAY_LANGS = ["fr", "es", "it", "de", "nl", "pl"] as const;
export type OverlayLang = typeof OVERLAY_LANGS[number];

interface Translation {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  lang: string;
  value: string;
}

type ValuesByLang = Record<OverlayLang, Record<string, string>>;
type IdsByLang = Record<OverlayLang, Record<string, string>>;

function emptyByLang<T>(): Record<OverlayLang, Record<string, T>> {
  return Object.fromEntries(OVERLAY_LANGS.map(l => [l, {}])) as Record<OverlayLang, Record<string, T>>;
}

interface UseEntityTranslationsReturn {
  translations: ValuesByLang;
  setTranslation: (lang: OverlayLang, field: string, value: string) => void;
  loading: boolean;
  saveTranslations: (entityId: string, fields: string[]) => Promise<void>;
}

export function useEntityTranslations(
  entityType: string,
  entityId: string | null,
): UseEntityTranslationsReturn {
  const [translations, setTranslations] = useState<ValuesByLang>(emptyByLang);
  const [ids, setIds] = useState<IdsByLang>(emptyByLang);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!entityId) {
        // No entity to load translations for (e.g. a "create new" form) — clear
        // any leftover values from a previously-edited entity instead of leaving
        // them stale in the overlay-language fields.
        setTranslations(emptyByLang());
        setIds(emptyByLang());
        return;
      }
      setLoading(true);
      fetch(`/next-api/translations/${entityType}/${entityId}`)
        .then(r => r.ok ? r.json() as Promise<Translation[]> : [])
        .then(rows => {
          const vals = emptyByLang<string>();
          const rowIds = emptyByLang<string>();
          for (const row of rows) {
            if ((OVERLAY_LANGS as readonly string[]).includes(row.lang)) {
              const lang = row.lang as OverlayLang;
              vals[lang][row.field] = row.value;
              rowIds[lang][row.field] = row.id;
            }
          }
          setTranslations(vals);
          setIds(rowIds);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [entityType, entityId]);

  const setTranslation = useCallback((lang: OverlayLang, field: string, value: string) => {
    setTranslations(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));
  }, []);

  const saveTranslations = useCallback(async (id: string, fields: string[]) => {
    const toUpsert = OVERLAY_LANGS.flatMap(lang =>
      fields
        .filter(f => translations[lang][f]?.trim())
        .map(f => ({ entityType, entityId: id, field: f, lang, value: translations[lang][f].trim() })),
    );

    const toDelete = OVERLAY_LANGS.flatMap(lang =>
      fields
        .filter(f => !translations[lang][f]?.trim() && ids[lang][f])
        .map(f => ids[lang][f]),
    );

    await Promise.all([
      toUpsert.length > 0
        ? fetch('/next-api/translations/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: toUpsert }),
          })
        : Promise.resolve(),
      ...toDelete.map(rowId =>
        fetch(`/next-api/translations/entry/${rowId}`, { method: 'DELETE' }),
      ),
    ]);
  }, [entityType, translations, ids]);

  return { translations, setTranslation, loading, saveTranslations };
}
