import type { MutableRefObject, SyntheticEvent } from "react";

export function Player({ url, video, mediaRef, onTime }: {
  url: string;
  video: boolean;
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  onTime?: (e: SyntheticEvent<HTMLMediaElement>) => void;
}) {
  const set = (el: HTMLMediaElement | null) => { mediaRef.current = el; };
  return video
    ? <video ref={set} controls src={url} onTimeUpdate={onTime} className="w-full rounded-xl bg-black" />
    : <audio ref={set} controls src={url} onTimeUpdate={onTime} className="w-full" />;
}
