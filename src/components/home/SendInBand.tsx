import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import { localized, type HomeSectionConfig } from "./sectionTypes";
import styles from "./Home.module.css";

/**
 * "Embroider something you already own", given a band of its own.
 *
 * A header link cannot sell this. The offer needs three sentences to land — you
 * keep your own cap, you design on a photo of it, it comes back stitched — and a
 * shop's home page is the only place there is room for them. So the band carries
 * the promise, the three steps, and one way in.
 *
 * Every field falls back to the service's own copy in `t.sendIn`, which is
 * already translated into all seven languages. That matters more than it looks:
 * a section whose defaults are blank is a section that ships empty, and the
 * admin who adds it is not necessarily the person who writes the copy.
 *
 * The image is optional by design — see `imageKey` in sectionTypes. Without one
 * the copy takes the full width rather than sitting beside a hole.
 */
export default function SendInBand({
  config,
  locale,
  tinted = false,
}: {
  config: HomeSectionConfig;
  locale: Locale;
  tinted?: boolean;
}) {
  const t = getTranslations(locale);
  const c = t.sendIn;

  const eyebrow = localized(config.eyebrow, locale) || c.eyebrow;
  const heading = localized(config.heading, locale) || c.title;
  const body = localized(config.body, locale) || c.intro;
  const image = config.imageUrl ?? null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <div className={`${styles.sendIn} ${image ? "" : styles.sendInNoImage}`}>
          {image && (
            <div className={styles.sendInImage}>
              {/* A `media/` object: a stable public URL, so it is optimised like
                  any other catalogue picture. `alt=""` because the heading
                  beside it already names the thing — a second description would
                  only be read out twice. */}
              <Image src={image} alt="" fill sizes="(max-width: 899px) 100vw, 46vw" className={styles.sendInImageFit} />
            </div>
          )}

          <div className={styles.sendInCopy}>
            <span className={styles.sendInEyebrow}>{eyebrow}</span>
            <h2 className={styles.sendInTitle}>{heading}</h2>
            <p className={styles.sendInBody}>{body}</p>

            {/* Numbered, because the order is the point: the design is done
                before the item is posted, which is the part people expect to be
                the other way round. */}
            <ol className={styles.sendInSteps}>
              {c.how.map((step, i) => (
                <li key={step} className={styles.sendInStep}>
                  <span className={styles.sendInStepNo} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <Link href={`/${locale}/embroider-my-item`} className={styles.sendInCta}>
              {c.toDesign}
              <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
