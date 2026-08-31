import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./blog.module.css";
import { localeAlternates } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface Category { id: string; name: string; color: string | null; }

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  readingTimeMinutes: number;
  publishedAt: string | null;
  categories: Category[];
}

interface ListResult { items: Post[]; total: number; }

async function fetchPosts(locale: string): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts?limit=24&lang=${locale}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data: ListResult = await res.json();
    return data.items;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Blog",
    description: "Guides, care tips and news from Silomis.",
    alternates: localeAlternates(locale as Locale, "/blog"),
  };
}

export default async function BlogIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const posts = await fetchPosts(locale);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Blog</h1>
      </div>

      {posts.length === 0 ? (
        <p className={styles.empty}>No articles yet — check back soon.</p>
      ) : (
        <div className={styles.grid}>
          {posts.map((post) => (
            <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className={styles.card}>
              <div className={styles.cardMedia}>
                {post.featuredImageUrl ? (
                  <Image src={post.featuredImageUrl} alt={post.featuredImageAlt ?? post.title} fill sizes="(max-width: 640px) 100vw, 33vw" className={styles.cardImg} />
                ) : (
                  <div className={styles.cardImgPlaceholder} />
                )}
              </div>
              <div className={styles.cardBody}>
                {post.categories.length > 0 && (
                  <div className={styles.cardCats}>
                    {post.categories.slice(0, 2).map((c) => (
                      <span key={c.id} className={styles.cardCat} style={c.color ? { color: c.color } : undefined}>{c.name}</span>
                    ))}
                  </div>
                )}
                <h2 className={styles.cardTitle}>{post.title}</h2>
                {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
                <div className={styles.cardMeta}>
                  {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString(locale)}</span>}
                  <span>·</span>
                  <span>{post.readingTimeMinutes} min read</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
