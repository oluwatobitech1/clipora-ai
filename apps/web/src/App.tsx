import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Home } from "./Home";
import { VideoAudioPage } from "./VideoAudioPage";
import { BRAND } from "./lib/brand";
import { Layout } from "./components/Layout";
import { Directory } from "./components/Directory";
import { ToolPage } from "./components/ToolPage";
import { findCategory } from "./lib/catalog";
import { findTool } from "./lib/tools";

const HOME_TITLE = `${BRAND.name}: ${BRAND.tagline} for video, audio, images and documents`;
const HOME_DESCRIPTION = BRAND.description;

/** Sets the browser tab title and the description Google shows. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}

function HomePage() {
  usePageMeta(HOME_TITLE, HOME_DESCRIPTION);
  return <Home />;
}

function ToolsPage() {
  usePageMeta("All tools", "Browse every Clipora AI tool for video, audio, images and files.");
  return <Directory />;
}

function CategoryPage() {
  const { id } = useParams();
  const category = findCategory(id);
  usePageMeta(category?.name ?? "Tools", category ? `${category.name}: ${category.blurb}.` : HOME_DESCRIPTION);
  if (!category) return <Navigate to="/tools" replace />;
  return <Directory key={category.id} categoryId={category.id} />;
}

function ToolRoute() {
  const { slug } = useParams();
  const tool = findTool(slug);
  usePageMeta(tool?.pageTitle ?? HOME_TITLE, tool?.description ?? HOME_DESCRIPTION);
  if (!tool) return <Navigate to="/" replace />;
  // The two video-to-MP3 pages use the original converter, which has extra audio settings.
  if (tool.engine === "video-audio") {
    return <VideoAudioPage key={tool.slug} slug={tool.slug} heading={tool.heading} accent={tool.accent} lead={tool.lead} initialFormat="mp3" />;
  }
  return <ToolPage tool={tool} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="category/:id" element={<CategoryPage />} />
        <Route path=":slug" element={<ToolRoute />} />
      </Route>
    </Routes>
  );
}
