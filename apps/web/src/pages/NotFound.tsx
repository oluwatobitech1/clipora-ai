import { ButtonLink } from "../components/ui";

export function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      <p className="text-gradient font-display text-8xl font-extrabold">404</p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">The page you opened does not exist. It may have moved, or the link may be wrong.</p>
      <div className="mt-8 flex justify-center"><ButtonLink to="/">Go to the home page</ButtonLink></div>
    </div>
  );
}
