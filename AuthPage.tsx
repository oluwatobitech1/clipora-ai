import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice } from "../components/ui";
import { supabase } from "../lib/supabase";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { session, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const isLogin = mode === "login";

  if (session) return <Navigate to="/tools/video-to-audio" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError("Email or password is not correct.");
      else navigate("/tools/video-to-audio");
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else if (data.session) navigate("/tools/video-to-audio");
      else setCheckEmail(true);
    }
    setBusy(false);
  }

  const field = "mt-1.5 w-full rounded-xl border border-line px-3 py-2.5";
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{isLogin ? "Sign in" : "Create an account"}</h1>
      <p className="mt-2 text-muted">Your files and results are tied to your account, so only you can open them.</p>

      {!configured && (
        <div className="mt-6"><Notice tone="error">Sign-in is not configured yet. Add the Supabase values to the .env file and restart (see the README).</Notice></div>
      )}

      {checkEmail ? (
        <div className="mt-6"><Notice>We sent a confirmation link to {email}. Open it, then come back and sign in.</Notice></div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold">Password</label>
            <input
              id="password" type="password" required minLength={8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} className={field}
            />
            {!isLogin && <p className="mt-1 text-sm text-muted">At least 8 characters.</p>}
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" disabled={busy || !configured} className="w-full">
            {busy ? "Please wait" : isLogin ? "Sign in" : "Create account"}
          </Button>
          <p className="text-sm text-muted">
            {isLogin ? "New here? " : "Already have an account? "}
            <Link to={isLogin ? "/signup" : "/login"} className="font-semibold text-brand-700">
              {isLogin ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
