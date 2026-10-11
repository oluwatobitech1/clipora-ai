import { SUPPORTED_EXTENSIONS_LABEL } from "@framevox/shared";
import type { AudioOutputFormat } from "@framevox/shared";
import { Converter } from "./components/Converter";
import { ToolShell } from "./components/ToolShell";

const faqs = [
  { q: "Is my video uploaded anywhere?", a: "No. The conversion runs inside your browser, on your own phone or computer. Your video never leaves your device." },
  { q: "Which format should I choose?", a: "MP3 plays on almost everything, so it is the safe choice. M4A is the fastest and works great on iPhone and Mac. WAV is uncompressed, which is best for editing but makes a much bigger file." },
  { q: "Which videos can I convert?", a: `${SUPPORTED_EXTENSIONS_LABEL}. If your file has no sound, you will be told straight away.` },
  { q: "Why is a long video slow on my phone?", a: "Everything happens on your device, so long videos take longer on phones than on computers. Keep the page open until it finishes, or try a shorter video." },
  { q: "Is it really free?", a: "Yes. There is no sign-up, no watermark and no limit on the number of videos." },
] as const;


export function VideoAudioPage({
  slug,
  heading = "Turn any video into ",
  accent = "clean audio",
  lead = "Get MP3, WAV or M4A in seconds. Free, no sign-up, and your video never leaves your device.",
  initialFormat = "mp3",
}: {
  slug: string;
  heading?: string;
  accent?: string;
  lead?: string;
  initialFormat?: AudioOutputFormat;
}) {
  return (
    <ToolShell
      slug={slug}
      heading={`${heading}${accent}`}
      lead={lead}
      faq={[...faqs]}
      facts={[
        { label: "Accepts", value: SUPPORTED_EXTENSIONS_LABEL },
        { label: "Creates", value: "MP3, WAV, M4A" },
        { label: "Extras", value: "Bitrate, volume, fades, trim" },
        { label: "Price", value: "Free, no sign-up" },
      ]}
      steps={[
        { title: "Choose your video", text: "Pick a file from your phone or computer, or drag it in." },
        { title: "Pick a format", text: "MP3 for everything, M4A for speed, WAV for editing." },
        { title: "Download", text: "Play it to check, then save the audio file." },
      ]}
    >
      <Converter initialFormat={initialFormat} />
    </ToolShell>
  );
}
