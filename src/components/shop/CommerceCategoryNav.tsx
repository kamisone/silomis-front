"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import { buildCategoryTree, getAncestorIds, type CategoryNode as BaseCategoryNode } from "@/lib/shop/categoryTree";
import styles from "./CommerceCategoryNav.module.css";

interface RawCategory {
  id: string;
  name: string;
  parentId?: string | null;
  imageUrl?: string | null;
  translations?: Record<string, Record<string, string>>;
}
interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  imageUrl: string | null;
}
type CategoryNode = BaseCategoryNode<Category>;

interface Props {
  locale: string;
  className?: string;
}

/**
 * One subcategory inside the panel: its picture, its name as the column
 * heading, and its own children listed beneath.
 *
 * Replaces the old expand/collapse row — the card is wide enough to show both
 * levels at once, so there is nothing left to toggle open.
 */
function MegaColumn({
  node,
  locale,
  activeCategory,
  onNavigate,
}: {
  node: CategoryNode;
  locale: string;
  activeCategory: string | null;
  onNavigate: () => void;
}) {
  const href = (id: string) => `/${locale}/shop?categoryId=${id}`;

  return (
    <div className={styles.column}>
      {/* Picture and heading are one link, so the whole tile is the target. A
          group title that could not be followed would strand the subcategory. */}
      <Link href={href(node.id)} className={styles.columnHead} onClick={onNavigate}>
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className={styles.columnImage} loading="lazy" />
        ) : (
          // A tinted panel rather than a hole in the row, so a category with no
          // picture yet still looks deliberate — same treatment as the home tiles.
          <span className={styles.columnImageFallback} aria-hidden="true" />
        )}
        <span className={`${styles.columnHeading} ${activeCategory === node.id ? styles.columnHeadingActive : ""}`}>{node.name}</span>
      </Link>

      {node.children.length > 0 && (
        <ul className={styles.columnList}>
          {node.children.map((child) => (
            <li key={child.id}>
              <Link
                href={href(child.id)}
                className={`${styles.megaLink} ${activeCategory === child.id ? styles.megaLinkActive : ""}`}
                onClick={onNavigate}
              >
                {child.name}
              </Link>
              {/* Anything deeper is indented under its parent rather than
                  hidden behind a toggle, so no category becomes unreachable
                  just because the tree is four levels deep. */}
              {child.children.length > 0 && (
                <ul className={styles.columnSublist}>
                  {child.children.map((grandchild) => (
                    <li key={grandchild.id}>
                      <Link
                        href={href(grandchild.id)}
                        className={`${styles.megaLink} ${styles.megaLinkDeep} ${activeCategory === grandchild.id ? styles.megaLinkActive : ""}`}
                        onClick={onNavigate}
                      >
                        {grandchild.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CommerceCategoryNav({ locale, className }: Props) {
  const t = getTranslations(locale).shop;
  const [categories, setCategories] = useState<Category[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  // Only the vertical offset is kept now: the card spans the full viewport
  // width, so its horizontal placement no longer depends on which item opened it.
  const [top, setTop] = useState<number | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    fetch("/next-api/public/shop/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RawCategory[]) => {
        const resolved = (Array.isArray(data) ? data : []).map((c) => ({
          id: c.id,
          name: c.translations?.name?.[locale] ?? c.name,
          parentId: c.parentId,
          // Already a full URL from the API — the same picture the home page's
          // category tiles use.
          imageUrl: c.imageUrl ?? null,
        }));
        setCategories(resolved);
      })
      .catch(() => {});
  }, [locale]);

  const onShopPage = pathname === `/${locale}/shop`;
  const onCollectionsPage = pathname.startsWith(`/${locale}/collections`);
  const activeCategory = onShopPage ? searchParams.get("categoryId") : null;
  const tree = buildCategoryTree(categories);
  const ancestorIds = new Set(getAncestorIds(categories, activeCategory));

  useEffect(() => {
    if (!openId) {
      const t = setTimeout(() => setTop(null), 0);
      return () => clearTimeout(t);
    }
    const update = () => {
      // Measured from the header, not the item: a full-width card should sit
      // flush under the whole header rather than under one menu entry.
      const el = navRef.current?.closest("header") ?? triggerRefs.current.get(openId);
      const rect = el?.getBoundingClientRect();
      if (rect) setTop(rect.bottom);
    };
    update();

    // Scrolling the page dismisses the card rather than dragging it along.
    // The header itself moves on scroll (ScrollAwareHeader), so a card that
    // followed it would slide down the page over the content the shopper is
    // scrolling to read.
    const handleScroll = (e: Event) => {
      // Capture phase, so this also sees the panel's own scrollbar — a long
      // category list must stay open while it is being scrolled. Page scroll
      // targets the document, which the panel never contains.
      const target = e.target;
      if (target instanceof Node && dropdownRef.current?.contains(target)) return;
      setOpenId(null);
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpenId(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openId]);

  const openNode = openId ? (tree.find((n) => n.id === openId) ?? null) : null;

  // Collections are independent of categories, so the nav still renders when
  // no categories exist — only the category items are skipped.
  const hasCategories = categories.length > 0;

  return (
    <div className={styles.nav} ref={navRef}>
      <Link href={`/${locale}/collections`} className={`${styles.item} ${className ?? ""} ${onCollectionsPage ? styles.active : ""}`}>
        {t.collectionsTitle}
      </Link>
      {hasCategories && tree.map((node) => {
        const hasChildren = node.children.length > 0;
        const isActive = activeCategory === node.id || ancestorIds.has(node.id);

        if (!hasChildren) {
          return (
            <Link
              key={node.id}
              href={`/${locale}/shop?categoryId=${node.id}`}
              className={`${styles.item} ${className ?? ""} ${activeCategory === node.id ? styles.active : ""}`}
            >
              {node.name}
            </Link>
          );
        }

        const isOpen = openId === node.id;
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) triggerRefs.current.set(node.id, el);
              else triggerRefs.current.delete(node.id);
            }}
            className={styles.dropdownWrap}
          >
            <Link
              href={`/${locale}/shop?categoryId=${node.id}`}
              className={`${styles.item} ${className ?? ""} ${isActive ? styles.active : ""}`}
            >
              {node.name}
            </Link>
            <button
              type="button"
              className={`${styles.caretBtn} ${isOpen ? styles.caretBtnOpen : ""}`}
              onClick={() => setOpenId(isOpen ? null : node.id)}
              aria-expanded={isOpen}
              aria-haspopup="true"
              aria-label={isOpen ? t.collapseCategory : t.expandCategory}
            >
              <ChevronDown size={14} strokeWidth={2.25} />
            </button>
          </div>
        );
      })}

      {openNode &&
        top !== null &&
        createPortal(
          <div ref={dropdownRef} className={styles.dropdown} style={{ top }} aria-label={openNode.name}>
            {/* The card is full-bleed but its contents are not: the inner
                wrapper matches the header's own 1280px container so the columns
                line up with the logo and the menu row above them. */}
            <div className={styles.dropdownInner}>
              {openNode.children.map((child) => (
                <MegaColumn
                  key={child.id}
                  node={child}
                  locale={locale}
                  activeCategory={activeCategory}
                  onNavigate={() => setOpenId(null)}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
