/// <reference lib="webworker" />
import { pipeline, env, type ProgressInfo } from "@huggingface/transformers";

// Translates in the visitor's browser with free Opus-MT models. Each model downloads once and is cached by the browser.
env.allowLocalModels = false;

type Translator = (input: string[], opts: { max_new_tokens: number }) => Promise<TranslationOut | TranslationOut[]>;
type TranslationOut = { translation_text?: string };

const cache = new Map<string, Translator>();
const BATCH = 6;

async function getModel(id: string, step: number, steps: number): Promise<Translator> {
  const hit = cache.get(id);
  if (hit) return hit;
  const files = new Map<string, { loaded: number; total: number }>();
  const t = (await pipeline("translation", id, {
    progress_callback: (p: ProgressInfo) => {
      if (p.status === "progress" && p.file && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let l = 0, tot = 0;
        files.forEach((f) => { l += f.loaded; tot += f.total; });
        self.postMessage({ type: "download", pct: tot ? l / tot : 0, step, steps });
      }
    },
  })) as unknown as Translator;
  cache.set(id, t);
  return t;
}

self.onmessage = async (e: MessageEvent<{ units: string[]; models: string[] }>) => {
  try {
    const { models } = e.data;
    let current = e.data.units;
    for (let i = 0; i < models.length; i++) {
      const t = await getModel(models[i], i, models.length);
      const out: string[] = [];
      for (let j = 0; j < current.length; j += BATCH) {
        const res = await t(current.slice(j, j + BATCH), { max_new_tokens: 400 });
        const arr = Array.isArray(res) ? res : [res];
        out.push(...arr.map((r) => String(r.translation_text ?? "").trim()));
        self.postMessage({ type: "progress", pct: (i + Math.min(1, (j + BATCH) / current.length)) / models.length });
      }
      current = out;
    }
    self.postMessage({ type: "result", units: current });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
