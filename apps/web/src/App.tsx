import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { Landing } from "./pages/Landing";
import { Tools } from "./pages/Tools";
import { ToolPage } from "./pages/ToolPage";
import { Overview } from "./pages/Overview";
import { PlannedPage } from "./pages/PlannedPage";
import { AuthPage } from "./pages/AuthPage";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Landing />} />
        <Route path="tools" element={<Tools />} />
        <Route path="tools/:toolId" element={<ToolPage />} />
        <Route
          path="pricing"
          element={
            <PlannedPage
              title="Pricing"
              milestone="Milestone 6"
              description="Plans and limits will be published once processing costs are measured. Nothing here is a price promise yet."
            />
          }
        />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route
          path="privacy"
          element={<PlannedPage title="Privacy policy" milestone="Before public launch" description="The privacy and data-retention policy will be written and reviewed before anyone outside the team can use the product." />}
        />
        <Route
          path="terms"
          element={<PlannedPage title="Terms of service" milestone="Before public launch" description="Terms and acceptable-use rules will be written and reviewed before public launch." />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="dashboard" element={<Overview />} />
        <Route
          path="projects"
          element={<PlannedPage embedded title="Projects" milestone="Milestone 4" description="Searchable project history needs accounts and private storage, which arrive in Milestone 4." />}
        />
        <Route
          path="dashboard/usage"
          element={<PlannedPage embedded title="Usage" milestone="Milestone 4" description="Usage is measured from real processing records, so it starts once accounts and jobs exist." />}
        />
        <Route
          path="settings"
          element={<PlannedPage embedded title="Settings" milestone="Milestone 4" description="Profile, security, and data export or deletion controls arrive in Milestone 4." />}
        />
      </Route>
    </Routes>
  );
}
