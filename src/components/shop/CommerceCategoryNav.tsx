"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import { buildCategoryTree, getAncestorIds, type CategoryNode as BaseCategoryNode } from "@/lib/shop/categoryTree";
import styles from "./CommerceCategoryNav.module.css";

interface RawCategory {
  id: string;
  name: string;
  parentId?: string | null;
  translations?: Record<string, Record<string, string>>;
}
interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}
type CategoryNode = BaseCategoryNode<Category>;

interface Props {
  locale: string;
  className?: string;
}

interface DropdownT {
  expandCategory: string;
  collapseCategory: string;
}

function CategoryDropdownItem({
  node,
  locale,
  activeCategory,
  expanded,
  onToggle,
  onNavigate,
  t,
}: {
  node: CategoryNode;
  locale: string;
  activeCategory: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: () => void;
  t: DropdownT;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isActive = activeCategory === node.id;

  return (
    <li>
      <div className={styles.dropdownRow}>
        <Link
          href={`/${locale}/shop?category=${node.id}`}
          className={`${styles.dropdownLink} ${isActive ? styles.dropdownLinkActive : ""}`}
          onClick={onNavigate}
        >
          {node.name}
        </Link>
        {hasChildren && (
          <button
            type="button"
            className={styles.dropdownToggle}
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? t.collapseCategory : t.expandCategory}
          >
            <ChevronRight size={13} strokeWidth={2.25} className={isOpen ? styles.dropdownToggleIconOpen : ""} />
          </button>
        )}
      </div>
      {hasChildren && (
        <div className={`${styles.dropdownChildren} ${isOpen ? styles.dropdownChildrenOpen : ""}`}>
          <ul className={styles.dropdownSublist}>
            {node.children.map((child) => (
              <CategoryDropdownItem
                key={child.id}
                node={child}
                locale={locale}
                activeCategory={activeCategory}
                expanded={expanded}
                onToggle={onToggle}
                onNavigate={onNavigate}
                t={t}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function CommerceCategoryNav({ locale, className }: Props) {
  const t = getTranslations(locale).shop;
  const [categories, setCategories] = useState<Category[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
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
        }));
        setCategories(resolved);
      })
      .catch(() => {});
  }, [locale]);

  const onShopPage = pathname === `/${locale}/shop`;
  const onCollectionsPage = pathname.startsWith(`/${locale}/collections`);
  const activeCategory = onShopPage ? searchParams.get("category") : null;
  const tree = buildCategoryTree(categories);
  const ancestorIds = new Set(getAncestorIds(categories, activeCategory));

  useEffect(() => {
    const t2 = setTimeout(() => setExpanded(new Set(getAncestorIds(categories, activeCategory))), 0);
    return () => clearTimeout(t2);
  }, [categories, activeCategory]);

  useEffect(() => {
    if (!openId) {
      const t = setTimeout(() => setPos(null), 0);
      return () => clearTimeout(t);
    }
    const update = () => {
      const el = triggerRefs.current.get(openId);
      const rect = el?.getBoundingClientRect();
      if (rect) setPos({ left: rect.left, top: rect.bottom + 8 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
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

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const openNode = openId ? (tree.find((n) => n.id === openId) ?? null) : null;

  // Collections are independent of categories, so the nav still renders when
  // no categories exist — only the category items are skipped.
  const hasCategories = categories.length > 0;

  return (
    <div className={styles.nav} ref={navRef}>
      <Link
        href={`/${locale}/shop`}
        className={`${styles.item} ${className ?? ""} ${onShopPage && !activeCategory ? styles.active : ""}`}
      >
        {t.allProducts}
      </Link>
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
              href={`/${locale}/shop?category=${node.id}`}
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
              href={`/${locale}/shop?category=${node.id}`}
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
        pos &&
        createPortal(
          <div ref={dropdownRef} className={styles.dropdown} style={{ left: pos.left, top: pos.top }} role="menu">
            <ul className={styles.dropdownList}>
              {openNode.children.map((child) => (
                <CategoryDropdownItem
                  key={child.id}
                  node={child}
                  locale={locale}
                  activeCategory={activeCategory}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  onNavigate={() => setOpenId(null)}
                  t={t}
                />
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
