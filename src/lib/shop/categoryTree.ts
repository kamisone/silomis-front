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
