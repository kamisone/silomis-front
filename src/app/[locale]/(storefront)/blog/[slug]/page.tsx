import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import styles from "./post.module.css";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface Category { id: string; name: string; color: string | null; }
interface Tag { id: string; name: string; }

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
    title: `${post.seoTitle || post.title} — Silomis`,
    description: post.seoDescription || post.excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const post = await fetchPost(slug, locale);
  if (!post) notFound();

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

      {post.tags.length > 0 && (
        <div className={styles.tags}>
          {post.tags.map((t) => <span key={t.id} className={styles.tag}>#{t.name}</span>)}
        </div>
      )}
    </article>
  );
}
