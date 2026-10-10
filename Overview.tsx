import { ButtonLink } from "../components/ui";

export function Overview() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <ButtonLink to="/tools/video-to-text">New project</ButtonLink>
      </div>

      <section aria-labelledby="recent" className="mt-8 rounded-2xl border border-line bg-white p-8">
        <h2 id="recent" className="text-lg font-semibold">Recent projects</h2>
        <p className="mt-2 max-w-prose text-muted">
          You have no projects yet. Projects you create will be listed here with their type, date and real processing status.
        </p>
        <div className="mt-5">
          <ButtonLink to="/tools" variant="secondary">Browse the tools</ButtonLink>
        </div>
      </section>

      <section aria-labelledby="usage" className="mt-6 rounded-2xl border border-line bg-white p-8">
        <h2 id="usage" className="text-lg font-semibold">Usage</h2>
        <p className="mt-2 max-w-prose text-muted">
          Your allowance and plan are calculated from stored processing records. They appear once accounts and jobs exist.
        </p>
      </section>
    </div>
  );
}
