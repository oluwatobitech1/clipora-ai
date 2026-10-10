import { ButtonLink } from "../components/ui";

interface Props {
  title: string;
  description: string;
  milestone: string;
  embedded?: boolean;
}

/** Honest placeholder: says what the page is and when it ships, with no fake controls. */
export function PlannedPage({ title, description, milestone, embedded = false }: Props) {
  return (
    <div className={embedded ? "" : "mx-auto max-w-2xl px-5 py-20"}>
      <p className="text-sm font-semibold text-brand-700">Planned: {milestone}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-prose text-muted">{description}</p>
      <div className="mt-8">
        <ButtonLink to="/tools" variant="secondary">Browse the tools</ButtonLink>
      </div>
    </div>
  );
}
