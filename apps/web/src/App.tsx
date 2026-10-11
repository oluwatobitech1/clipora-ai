import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Home } from "./Home";
import { Layout } from "./components/Layout";
import { ToolPage } from "./components/ToolPage";
import { findTool } from "./lib/tools";

const HOME_TITLE = "Video to Audio: convert any video to MP3, WAV or M4A";
const HOME_DESCRIPTION = "Convert any video to MP3, WAV or M4A in seconds. Free, no sign-up, and your file never leaves your device.";

/** Sets the browser tab title and the description Google shows. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}

function HomePage() {
  usePageMeta(HOME_TITLE, HOME_DESCRIPTION);
  return <Home />;
}

function ToolRoute() {
  const { slug } = useParams();
  const tool = findTool(slug);
  usePageMeta(tool?.pageTitle ?? HOME_TITLE, tool?.description ?? HOME_DESCRIPTION);
  if (!tool) return <Navigate to="/" replace />;
  // The two video-to-MP3 pages use the original converter, which has extra audio settings.
  if (tool.engine === "video-audio") {
    return <Home key={tool.slug} heading={tool.heading} accent={tool.accent} lead={tool.lead} initialFormat="mp3" />;
  }
  return <ToolPage tool={tool} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path=":slug" element={<ToolRoute />} />
      </Route>
    </Routes>
  );
}
