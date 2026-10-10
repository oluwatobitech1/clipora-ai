import { ButtonLink } from "../components/ui";

export function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 text-muted">The page you opened does not exist. It may have moved, or the link may be wrong.</p>
      <div className="mt-8"><ButtonLink to="/">Go to the home page</ButtonLink></div>
    </div>
  );
}
