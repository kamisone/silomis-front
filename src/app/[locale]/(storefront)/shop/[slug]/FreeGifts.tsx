"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import ImageLightbox from "@/components/shop/ImageLightbox";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

interface FreeGiftItem {
  id: string;
  label?: string | null;
  valueCents?: number | null;
  url: string;
  isActive?: boolean;
}

interface Props {
  locale: Locale;
  items: FreeGiftItem[];
}

/**
 * "Free gifts included" — under the Klarna line, where the price is read, so
 * the extras count in the buying decision. On when the admin has added at
 * least one active gift photo. Each gift shows what it is worth on its own
 * (struck through) next to "Free"; the header adds those values up. A photo
 * opens full size in the shared lightbox.
 */
export default function FreeGifts({ locale, items }: Props) {
  const t = getTranslations(locale).shop;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const gifts = items.filter((g) => g.isActive !== false && g.url);

  if (!gifts.length) return null;

  const money = (cents: number) => (cents / 100).toLocaleString(toBcp47(locale), { style: "currency", currency: "EUR" });
  const totalValue = gifts.reduce((sum, g) => sum + (g.valueCents ?? 0), 0);
  const single = gifts.length === 1;
  const title = single ? t.freeGiftTitleOne : t.freeGiftsTitle;

  return (
    <>
      <section className={`${styles.giftsCard} ${single ? styles.giftsCardSingle : ""}`} aria-label={title}>
        <header className={styles.giftsHead}>
          <span className={styles.giftsIcon} aria-hidden="true">
            <Gift size={18} strokeWidth={2.2} />
          </span>
          <span className={styles.giftsHeadText}>
            <span className={styles.giftsTitle}>{title}</span>
            <span className={styles.giftsSubtitle}>{t.freeGiftsSubtitle}</span>
          </span>
          {totalValue > 0 && <span className={styles.giftsWorth}>{t.freeGiftsWorth.replace("{amount}", money(totalValue))}</span>}
        </header>

        <ul className={styles.giftsList}>
          {gifts.map((gift, i) => {
            const name = gift.label?.trim();
            return (
              <li key={gift.id} className={styles.giftItem}>
                <button type="button" className={styles.giftThumb} onClick={() => setOpenIndex(i)} aria-label={name || title}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gift.url} alt="" loading="lazy" decoding="async" draggable={false} className={styles.giftThumbImg} />
                  <span className={styles.giftRibbon}>{t.freeGiftBadge}</span>
                </button>
                {(name || gift.valueCents) && (
                  <span className={styles.giftInfo}>
                    {name && <span className={styles.giftName}>{name}</span>}
                    {!!gift.valueCents && (
                      <span className={styles.giftPrice}>
                        <s>{money(gift.valueCents)}</s>
                        <strong>{t.freeGiftBadge}</strong>
                      </span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {openIndex !== null && (
        <ImageLightbox
          images={gifts.map((g) => ({ id: g.id, url: g.url, title: g.label ?? undefined }))}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          ariaLabel={title}
        />
      )}
    </>
  );
}
