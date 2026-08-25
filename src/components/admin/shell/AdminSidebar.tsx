"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, BarChart2, BarChart3, FlaskConical, Heart,
  TrendingUp, LineChart, Search,
  Layers, Package, FolderOpen, LayoutGrid, SlidersHorizontal,
  Warehouse, Star, Images,
  ShoppingBag, FileText, Undo2, GitBranch, ShoppingCart,
  Users, User, Wallet, MapPin, History,
  Truck, Box, ClipboardCheck, Flag,
  CreditCard, Receipt, ArrowLeftRight, Zap, AlertCircle,
  Tag, Send, Percent, Hash, Ticket, Home,
  Settings, Coins, Landmark, Mail, Target, Headphones,
  FileEdit, BookOpen,
  ChevronRight, ChevronLeft, ChevronDown,
} from "lucide-react";
import styles from "./AdminSidebar.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  icon:  LucideIcon;
  label: string;
}

interface NavCategory {
  label: string;
  icon:  LucideIcon;
  items: NavItem[];
}

interface NavGroup {
  label:       string;
  items?:      NavItem[];
  categories?: NavCategory[];
}

// ── Nav data ──────────────────────────────────────────────────────────────────
// Mirrors vitecamio's admin sidebar shape (groups = static section headers,
// categories = collapsible subsections) scoped to silomis's own shop-only
// feature set — no fleet/rental/marketplace/vendor items.

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/marketing/newsletters", icon: Mail,      label: "Newsletters"     },
      { href: "/admin/marketing/campaigns",   icon: Send,      label: "Campaigns"       },
      { href: "/admin/marketing/subscribers", icon: Users,     label: "Subscribers"     },
      { href: "/admin/marketing/analytics",   icon: BarChart3, label: "Email Analytics" },
      { href: "/admin/marketing/pixels",      icon: Target,    label: "Pixels"          },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/support",  icon: Headphones, label: "Support"  },
      { href: "/admin/contacts", icon: Mail,        label: "Contact" },
    ],
  },
  {
    label: "Commerce",
    categories: [
      {
        label: "Catalog",
        icon:  Layers,
        items: [
          { href: "/admin/shop/products",           icon: Package,           label: "Products"                },
          { href: "/admin/shop/categories",         icon: FolderOpen,        label: "Categories"              },
          { href: "/admin/shop/collections",        icon: LayoutGrid,        label: "Collections"             },
          { href: "/admin/shop/variant-attributes", icon: SlidersHorizontal, label: "Variations & Attributes" },
          { href: "/admin/shop/inventory",          icon: Warehouse,         label: "Inventory"               },
          { href: "/admin/shop/reviews",            icon: Star,              label: "Product Reviews"         },
          { href: "/admin/shop/media",              icon: Images,            label: "Media Library"           },
        ],
      },
      {
        label: "Orders",
        icon:  ShoppingBag,
        items: [
          { href: "/admin/shop/orders",            icon: ShoppingBag,  label: "All Orders"        },
          { href: "/admin/shop/orders/drafts",     icon: FileText,     label: "Draft Orders"      },
          { href: "/admin/shop/returns",           icon: Undo2,        label: "Returns & Refunds" },
          { href: "/admin/shop/order-status-refs", icon: GitBranch,    label: "Order Statuses"    },
          { href: "/admin/shop/carts",             icon: ShoppingCart, label: "Abandoned Carts"   },
        ],
      },
      {
        label: "Customers",
        icon:  Users,
        items: [
          { href: "/admin/shop/customers",           icon: User,    label: "Customers"             },
          { href: "/admin/shop/customers/groups",    icon: Users,   label: "Customer Groups"       },
          { href: "/admin/shop/customers/addresses", icon: MapPin,  label: "Addresses"             },
          { href: "/admin/shop/payment-methods",     icon: Wallet,  label: "Saved Payment Methods" },
          { href: "/admin/shop/customers/activity",  icon: History, label: "Customer Activity"     },
        ],
      },
      {
        label: "Shipping",
        icon:  Truck,
        items: [
          { href: "/admin/shop/shipping",                icon: Truck,          label: "Shipping Config"      },
          { href: "/admin/shop/shipping/delivery-rules", icon: ClipboardCheck, label: "Delivery Rules"       },
          { href: "/admin/shop/shipments",               icon: Box,            label: "Fulfillment Tracking" },
          { href: "/admin/shop/countries",               icon: Flag,           label: "Countries"             },
        ],
      },
      {
        label: "Payments",
        icon:  CreditCard,
        items: [
          { href: "/admin/shop/transactions",               icon: Receipt,        label: "Transactions"     },
          { href: "/admin/shop/payment-types",              icon: CreditCard,     label: "Payment Types"    },
          { href: "/admin/shop/transactions/refunds",       icon: ArrowLeftRight, label: "Refunds"          },
          { href: "/admin/shop/transactions/stripe-events", icon: Zap,            label: "Stripe Events"    },
          { href: "/admin/shop/transactions/failures",      icon: AlertCircle,    label: "Payment Failures" },
        ],
      },
      {
        label: "Analytics",
        icon:  BarChart2,
        items: [
          { href: "/admin/shop/analytics",               icon: BarChart3,    label: "Dashboard"             },
          { href: "/admin/shop/analytics/revenue",       icon: TrendingUp,   label: "Revenue Analytics"    },
          { href: "/admin/shop/analytics/products",      icon: LineChart,    label: "Product Performance"  },
          { href: "/admin/shop/analytics/conversion",    icon: BarChart3,    label: "Conversion Metrics"   },
          { href: "/admin/shop/analytics/test-products", icon: FlaskConical, label: "Test Products"        },
          { href: "/admin/shop/analytics/search",        icon: Search,       label: "Search Insights"      },
          { href: "/admin/shop/analytics/wishlists",     icon: Heart,        label: "Wishlist Insights"    },
          { href: "/admin/shop/analytics/customers",     icon: Users,        label: "Customer Insights"    },
          { href: "/admin/shop/analytics/promotions",    icon: Percent,      label: "Promotion Performance" },
          { href: "/admin/shop/analytics/inventory",     icon: Warehouse,    label: "Inventory Analytics"  },
        ],
      },
      {
        label: "Promotions",
        icon:  Percent,
        items: [
          { href: "/admin/shop/promotions",           icon: Percent,   label: "Promotions"         },
          { href: "/admin/shop/coupons",               icon: Ticket,    label: "Coupons"            },
          { href: "/admin/shop/analytics/promotions", icon: BarChart3, label: "Discount Analytics" },
        ],
      },
      {
        label: "Merchandising",
        icon:  Tag,
        items: [
          { href: "/admin/shop/home",        icon: Home, label: "Home Page"   },
          { href: "/admin/shop/campaigns",   icon: Send, label: "Campaigns"   },
          { href: "/admin/shop/price-rules", icon: Tag,  label: "Price Rules" },
          { href: "/admin/shop/tags",        icon: Hash, label: "Tags"        },
        ],
      },
      {
        label: "Settings",
        icon:  Settings,
        items: [
          { href: "/admin/shop/tax",                      icon: Landmark,          label: "Taxes & VAT"            },
          { href: "/admin/shop/currency",                 icon: Coins,             label: "Currency Settings"      },
          { href: "/admin/shop/settings/config",          icon: SlidersHorizontal, label: "Commerce Configuration" },
          { href: "/admin/shop/settings/notifications",   icon: Mail,              label: "Admin Notifications"    },
          { href: "/admin/shop/settings/checkout",        icon: ShoppingCart,      label: "Checkout Settings"      },
        ],
      },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/blog",            icon: FileEdit, label: "Articles"   },
      { href: "/admin/blog/categories", icon: Tag,      label: "Categories" },
      { href: "/admin/blog/tags",       icon: Hash,     label: "Tags"       },
      { href: "/admin/content",         icon: BookOpen, label: "Policies"   },
    ],
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES_KEY = "admin-sidebar-open-categories";

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryHasActive(category: NavCategory, activeHref: string | null): boolean {
  if (!activeHref) return false;
  return category.items.some((item) => item.href === activeHref);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  collapsed?:        boolean;
  mobileOpen?:       boolean;
  onToggleCollapse?: () => void;
  onMobileClose?:    () => void;
}

// ── Icon renderer ─────────────────────────────────────────────────────────────

function Icon({ icon: I, className }: { icon: LucideIcon; className?: string }) {
  return <I size={16} strokeWidth={1.75} className={className} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSidebar({
  collapsed        = false,
  mobileOpen       = false,
  onToggleCollapse,
  onMobileClose,
}: Props) {
  const pathname = usePathname();

  // Longest href among all nav items that matches the current pathname, so a
  // sibling route that's also a URL-prefix of another item (e.g.
  // "/admin/shop/orders/drafts" vs "/admin/shop/orders") doesn't light up two
  // items at once.
  const activeHref = useMemo(() => {
    const allHrefs: string[] = [];
    for (const group of NAV_GROUPS) {
      (group.items ?? []).forEach((item) => allHrefs.push(item.href));
      (group.categories ?? []).forEach((cat) => cat.items.forEach((item) => allHrefs.push(item.href)));
    }
    const matches = allHrefs.filter(
      (href) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/")),
    );
    if (!matches.length) return null;
    return matches.reduce((a, b) => (a.length >= b.length ? a : b));
  }, [pathname]);

  // ── Category open state ──────────────────────────────────────────────────

  const [userOpenedCategories, setUserOpenedCategories] = useState<Set<string>>(new Set());
  const skipPersist    = useRef(true);
  const skipRouteReset = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(CATEGORIES_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setUserOpenedCategories(new Set<string>(arr));
        }
      } catch {
        /* ignore — falls back to the auto-open-on-active-route behavior below */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(Array.from(userOpenedCategories)));
    } catch {
      /* ignore */
    }
  }, [userOpenedCategories]);

  useEffect(() => {
    if (skipRouteReset.current) {
      skipRouteReset.current = false;
      return;
    }
    setUserOpenedCategories(new Set());
  }, [pathname]);

  const toggleCategory = useCallback((label: string, isRouteActive: boolean) => {
    if (isRouteActive) return;
    setUserOpenedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const cls = [styles.sidebar, collapsed ? styles.sidebarCollapsed : "", mobileOpen ? styles.sidebarMobileOpen : ""]
    .filter(Boolean)
    .join(" ");

  function renderItem(item: NavItem) {
    const active = item.href === activeHref;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
        title={collapsed ? item.label : undefined}
        onClick={onMobileClose}
      >
        <Icon icon={item.icon} className={styles.navIcon} />
        <span className={styles.navLabel}>{item.label}</span>
        {active && <span className={styles.navActiveBar} />}
      </Link>
    );
  }

  function renderCategory(cat: NavCategory) {
    const hasActive = categoryHasActive(cat, activeHref);
    const isOpen    = hasActive || userOpenedCategories.has(cat.label);

    return (
      <div key={cat.label} className={styles.category}>
        <button
          type="button"
          className={`${styles.categoryHeader} ${hasActive ? styles.categoryHeaderActive : ""}`}
          onClick={() => toggleCategory(cat.label, hasActive)}
          aria-expanded={isOpen}
        >
          <Icon icon={cat.icon} className={styles.categoryIcon} />
          <span className={styles.categoryLabel}>{cat.label}</span>
          <ChevronDown
            size={13}
            strokeWidth={2.25}
            className={`${styles.categoryChevron} ${isOpen ? styles.categoryChevronOpen : ""}`}
          />
        </button>

        <div className={`${styles.categoryItems} ${isOpen ? styles.categoryItemsOpen : ""}`}>
          <div className={styles.categoryItemsInner}>{cat.items.map((item) => renderItem(item))}</div>
        </div>
      </div>
    );
  }

  return (
    <aside className={cls}>
      {/* ── Brand + collapse toggle ── */}
      <div className={styles.brand}>
        <div className={styles.brandText}>
          <p className={styles.brandName}>Silomis</p>
          <p className={styles.brandSub}>Administration</p>
        </div>
        <button
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={1.75} /> : <ChevronLeft size={16} strokeWidth={1.75} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            {group.categories ? group.categories.map((cat) => renderCategory(cat)) : group.items!.map((item) => renderItem(item))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
