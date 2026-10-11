import { ToolConverter } from "./ToolConverter";
import { ToolShell, type Fact } from "./ToolShell";
import type { ToolDef } from "../lib/tools";

const HIDDEN_EXTS = ["qt", "markdown", "htm", "aif", "oga", "3g2"];

/** A page for one of the live converters, wrapped in the shared tool workspace. */
export function ToolPage({ tool }: { tool: ToolDef }) {
  const accepts = tool.exts.filter((e) => !HIDDEN_EXTS.includes(e)).map((e) => e.toUpperCase()).join(", ");
  const facts: Fact[] = [
    { label: "Accepts", value: accepts },
    { label: "Creates", value: tool.outputs.map((o) => o.label).join(", ") },
    { label: "Files at once", value: tool.multiple ? "Many" : "One" },
    { label: "Price", value: "Free, no sign-up" },
  ];
  return (
    <ToolShell slug={tool.slug} heading={`${tool.heading}${tool.accent}`} lead={tool.lead} facts={facts} faq={tool.faq}>
      <ToolConverter key={tool.slug} tool={tool} />
    </ToolShell>
  );
}
