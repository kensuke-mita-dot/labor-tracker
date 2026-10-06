import { Category } from '../types';

export interface CategoryGroup {
  /** 親カテゴリ、または単独カテゴリ */
  category: Category;
  /** 子カテゴリ（単独カテゴリの場合は空） */
  children: Category[];
}

/** 指定のカテゴリ構成（親 → 子）。子が空のものは単独カテゴリ */
export const DEFAULT_CATEGORY_STRUCTURE: { name: string; children: string[] }[] = [
  { name: 'ホテル事業', children: ['BHJ', 'BHKK', 'MAHT', 'MAHB', 'MAHNM'] },
  { name: 'BOOK事業', children: ['BOOK婚', 'ぶくとも。', 'BOOKキャリ'] },
  { name: '本部', children: [] },
];

/** カテゴリを親子の階層に整理する（トップレベルの登録順を維持） */
export function buildCategoryGroups(categories: Category[]): CategoryGroup[] {
  const ids = new Set(categories.map((c) => c.id));
  // 親が存在しない子は単独カテゴリとして扱う
  const isTopLevel = (c: Category) => !c.parentId || !ids.has(c.parentId);
  return categories.filter(isTopLevel).map((category) => ({
    category,
    children: categories.filter((c) => c.parentId === category.id && !isTopLevel(c)),
  }));
}

/** 時間入力の対象となるカテゴリ（子カテゴリ・単独カテゴリ）。表示順で返す */
export function getLeafCategories(categories: Category[]): Category[] {
  return buildCategoryGroups(categories).flatMap((g) =>
    g.children.length > 0 ? g.children : [g.category],
  );
}

/**
 * 既存カテゴリを指定構成に置き換える。
 * 同名の既存カテゴリはIDを引き継ぐため、入力済みデータは保持される。
 * 構成に含まれない既存カテゴリも削除せず、単独カテゴリとして末尾に残す（過去データを表示し続けるため）。
 */
export function applyDefaultStructure(
  existing: Category[],
  generateId: () => string,
): Category[] {
  const byName = new Map(existing.map((c) => [c.name, c]));
  const result: Category[] = [];
  for (const def of DEFAULT_CATEGORY_STRUCTURE) {
    const parentId = byName.get(def.name)?.id ?? generateId();
    result.push({ id: parentId, name: def.name });
    for (const childName of def.children) {
      result.push({ id: byName.get(childName)?.id ?? generateId(), name: childName, parentId });
    }
  }
  const used = new Set(result.map((c) => c.id));
  for (const c of existing) {
    if (used.has(c.id)) continue;
    const { parentId: _old, ...rest } = c;
    result.push(rest);
  }
  return result;
}
