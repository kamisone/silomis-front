/**
 * Shared helpers for building a parent/child category tree from the flat
 * list returned by GET /next-api/public/shop/categories.
 */

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

export type CategoryNode<T extends Category = Category> = T & { children: CategoryNode<T>[] };

export function buildCategoryTree<T extends Category>(categories: T[]): CategoryNode<T>[] {
  const nodes = new Map<string, CategoryNode<T>>();
  categories.forEach((c) => nodes.set(c.id, { ...c, children: [] }));

  const roots: CategoryNode<T>[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

export function getAncestorIds(categories: Category[], categoryId?: string | null): string[] {
  if (!categoryId) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ancestors: string[] = [];
  let current = byId.get(categoryId);
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = byId.get(current.parentId);
  }
  return ancestors;
}

/** The shape `visibleRows` needs: a depth-first row that knows its own depth
 *  and whether anything hangs beneath it. */
export interface CollapsibleRow {
  id: string;
  depth: number;
  childCount: number;
}

/**
 * Hides the rows sitting under a collapsed parent, at any depth.
 *
 * A depth-first flattening emits each subtree as a contiguous run of rows
 * deeper than its parent, so collapsing is skipping that run. Tracking one
 * depth rather than walking every row's ancestry is what makes this behave
 * identically for a sub-sub-category and a top-level one.
 */
export function visibleRows<T extends CollapsibleRow>(rows: T[], expanded: Set<string>): T[] {
  const out: T[] = [];
  let hiddenBelowDepth: number | null = null;

  for (const row of rows) {
    if (hiddenBelowDepth !== null && row.depth > hiddenBelowDepth) continue;
    // Back at or above the collapsed parent's level: that subtree has ended.
    hiddenBelowDepth = null;
    out.push(row);
    if (row.childCount > 0 && !expanded.has(row.id)) hiddenBelowDepth = row.depth;
  }

  return out;
}
