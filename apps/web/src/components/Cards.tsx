import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { entriesIn, findCategory, type Category, type CatalogEntry } from "../lib/catalog";
import { IconTile } from "./Icon";

/** One tool, as a card. Used in the directory, categories, popular tools and related lists. */
export function ToolCard({ tool, showCategory = false }: { tool: CatalogEntry; showCategory?: boolean }) {
  const c = findCategory(tool.category)!;
  return (
    <Link
      to={`/${tool.slug}`}
      className="group flex h-full items-start gap-3.5 rounded-2xl border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-lift)]"
    >
      <IconTile name={tool.icon} hue={c.hue} />
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold leading-tight">{tool.label}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{tool.short}</span>
        {showCategory && <span className="mt-2 block text-xs font-medium" style={{ color: c.hue }}>{c.name}</span>}
      </span>
      <ArrowUpRight size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-line transition-colors group-hover:text-brand-600" />
    </Link>
  );
}

/** A category, as a larger tile with a peek at its tools. */
export function CategoryTile({ category }: { category: Category }) {
  const items = entriesIn(category.id);
  return (
    <Link
      to={`/category/${category.id}`}
      className="group flex h-full flex-col rounded-3xl border border-line bg-white p-5 transition-all duration-200 hover:border-brand-200 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start justify-between gap-3">
        <IconTile name={category.icon} hue={category.hue} size={48} iconSize={24} />
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">{items.length} tools</span>
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold leading-tight">{category.name}</h3>
      <p className="mt-1 text-[0.95rem] leading-snug text-muted">{category.blurb}</p>
      <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        {items.slice(0, 3).map((t) => (
          <li key={t.slug} className="flex items-center gap-2 text-ink/80">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: category.hue }} />
            <span className="truncate">{t.label}</span>
          </li>
        ))}
        {items.length > 3 && <li className="text-muted">and {items.length - 3} more</li>}
      </ul>
    </Link>
  );
}
