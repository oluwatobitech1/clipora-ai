import { Link } from "react-router-dom";
import { TOOLS } from "@clipora/shared";
import { AvailabilityBadge } from "../components/ui";

export function Tools() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Tools</h1>
      <p className="mt-3 max-w-prose text-muted">
        Every tool shows its real status. Nothing is marked as ready until it has been tested end to end.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.id}>
            <Link
              to={`/tools/${tool.id}`}
              className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6 transition-colors hover:border-brand-500"
            >
              <AvailabilityBadge availability={tool.availability} />
              <h2 className="text-lg font-semibold">{tool.name}</h2>
              <p className="text-sm text-muted">{tool.summary}</p>
              <p className="mt-auto pt-2 text-xs font-semibold text-muted">Target: {tool.milestone}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
