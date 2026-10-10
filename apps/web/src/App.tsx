import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { Landing } from "./pages/Landing";
import { Tools } from "./pages/Tools";
import { ToolPage } from "./pages/ToolPage";
import { AuthPage } from "./pages/AuthPage";
import { Pricing, Privacy, Terms } from "./pages/Legal";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Landing />} />
        <Route path="tools" element={<Tools />} />
        <Route path="tools/:toolId" element={<ToolPage />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Account-style pages do not exist in this version: send old links to the tools. */}
      {["dashboard", "dashboard/usage", "projects", "settings"].map((path) => (
        <Route key={path} path={path} element={<Navigate to="/tools" replace />} />
      ))}
    </Routes>
  );
}
