import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./post.module.css";
import { localeAlternates } from "@/lib/seo";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface Category { id: string; name: string; color: string | null; }
interface Tag { id: string; name: string; }

/** Editorial product link — the backend already drops unpublished/deleted products. */
interface ProductRef {
  referenceId: string;
  label: string | null;
  product: ProductListItem;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  readingTimeMinutes: number;
  publishedAt: string | null;
  authorName: string | null;
  categories: Category[];
  tags: Tag[];
  productRefs: ProductRef[];
}

async function fetchPost(slug: string, locale: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts/slug/${slug}?lang=${locale}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = await fetchPost(slug, locale);
  if (!post) return {};
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    alternates: localeAlternates(locale as Locale, `/blog/${slug}`),
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || undefined,
      images: post.featuredImageUrl ? [{ url: post.featuredImageUrl }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const post = await fetchPost(slug, locale);
  if (!post) notFound();

  const t = getTranslations(locale);
  const productRefs = post.productRefs ?? [];

  return (
    <article className={styles.page}>
      <div className={styles.header}>
        {post.categories.length > 0 && (
          <div className={styles.cats}>
            {post.categories.map((c) => (
              <span key={c.id} className={styles.cat} style={c.color ? { color: c.color } : undefined}>{c.name}</span>
            ))}
          </div>
        )}
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.meta}>
          {post.authorName && <span>{post.authorName}</span>}
          {post.authorName && post.publishedAt && <span>·</span>}
          {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" })}</span>}
          <span>·</span>
          <span>{post.readingTimeMinutes} min read</span>
        </div>
      </div>

      {post.featuredImageUrl && (
        <div className={styles.hero}>
          <Image src={post.featuredImageUrl} alt={post.featuredImageAlt ?? post.title} fill sizes="100vw" className={styles.heroImg} priority />
        </div>
      )}

      {post.content && <div className={styles.body} dangerouslySetInnerHTML={{ __html: post.content }} />}

      {productRefs.length > 0 && (
        <section className={styles.featured}>
          <h2 className={styles.featuredTitle}>{t.blog.featuredProducts}</h2>
          <div className={styles.featuredGrid}>
            {productRefs.map((ref) => (
              <div key={ref.referenceId} className={styles.featuredItem}>
                <ProductCard product={ref.product} promotion={null} locale={locale as Locale} t={t} />
                {ref.label && <p className={styles.featuredLabel}>{ref.label}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {post.tags.length > 0 && (
        <div className={styles.tags}>
          {post.tags.map((tag) => <span key={tag.id} className={styles.tag}>#{tag.name}</span>)}
        </div>
      )}
    </article>
  );
}
