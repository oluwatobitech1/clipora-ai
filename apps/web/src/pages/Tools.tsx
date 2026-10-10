import { Link } from "react-router-dom";
import { TOOLS } from "@framevox/shared";
import { Reveal } from "../components/Reveal";
import { ToolIcon } from "../components/ToolIcon";
import { AvailabilityBadge } from "../components/ui";

export function Tools() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-50 to-white" />
      <div className="relative mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-600">Workspace</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Tools</h1>
        <p className="mt-3 max-w-prose text-lg text-muted">
          Every tool shows its real status. Nothing is marked as ready until it has been tested end to end.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <Reveal as="li" key={tool.id} delay={(i % 3) * 80}>
              <Link
                to={`/tools/${tool.id}`}
                className="card-lift group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition-all duration-300 group-hover:scale-110 group-hover:from-brand-600 group-hover:to-[#7c4dff] group-hover:text-white">
                    <ToolIcon id={tool.id} />
                  </span>
                  <AvailabilityBadge availability={tool.availability} />
                </div>
                <h2 className="text-lg font-bold">{tool.name}</h2>
                <p className="text-sm leading-relaxed text-muted">{tool.summary}</p>
                {tool.availability !== "available" && <p className="mt-auto pt-2 text-xs font-semibold text-muted">Target: {tool.milestone}</p>}
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
