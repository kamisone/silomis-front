import Link from "next/link";
import type { getTranslations } from "@/lib/i18n";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

export interface HomePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  readingTimeMinutes: number;
  categories: { id: string; name: string }[];
}

/**
 * Latest articles. Sits below the commercial sections on purpose: it is an SEO
 * and engagement surface, not a conversion one, and should never outrank the
 * product rails for attention.
 */
export default function BlogTeasers({
  posts,
  locale,
  t,
  title,
  href,
  tinted = false,
}: {
  posts: HomePost[];
  locale: string;
  t: ReturnType<typeof getTranslations>;
  /** Admin overrides; absent means this section's own built-in wording and
   *  destination. */
  title?: string;
  href?: string;
  tinted?: boolean;
}) {
  if (posts.length === 0) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        {/* No fallback to /blog: there is no index to send anyone to. The link
            shows only where an admin has pointed this section somewhere. */}
        <SectionHead title={title || t.shop.homeBlogTitle} href={href} linkLabel={t.shop.homeViewAll} />
        <div className={styles.blogGrid}>
          {posts.map((post) => (
            <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className={styles.blogCard}>
              <div className={styles.blogMedia}>
                {post.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.featuredImageUrl} alt="" className={styles.blogImage} loading="lazy" />
                ) : (
                  <div className={styles.blogImageFallback} aria-hidden="true" />
                )}
              </div>
              <div className={styles.blogBody}>
                {post.categories.length > 0 && <span className={styles.blogMeta}>{post.categories[0].name}</span>}
                <h3 className={styles.blogTitle}>{post.title}</h3>
                {post.excerpt && <p className={styles.blogExcerpt}>{post.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
