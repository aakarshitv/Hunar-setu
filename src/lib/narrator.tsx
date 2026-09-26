import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import manifestJson from "@/content/audio-manifest.json";
import { narration, type ClipId } from "@/content/narration";
import { resolveClip, type AudioManifest } from "@/lib/audio";
import { useKala } from "@/lib/kala-store";
import { SPEECH_TAGS, type LanguageCode } from "@/lib/languages";

const manifest = manifestJson as AudioManifest;

type NarratorValue = {
  play: (clips: ClipId[]) => void;
  stop: () => void;
  /** `queueKey` of the clips currently playing, or null. */
  playingKey: string | null;
};

const NarratorContext = createContext<NarratorValue | null>(null);

export const queueKey = (clips: ClipId[]) => clips.join("|");

function speakFallback(clip: ClipId, lang: LanguageCode, done: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return done();
  const utterance = new SpeechSynthesisUtterance(narration[clip][lang]);
  utterance.lang = SPEECH_TAGS[lang];
  utterance.onend = done;
  utterance.onerror = done;
  window.speechSynthesis.speak(utterance);
}

export function NarratorProvider({ children }: { children: ReactNode }) {
  const { language } = useKala();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<ClipId[]>([]);
  // Bumped on every stop; callbacks from an older queue see a stale token and bail out.
  const tokenRef = useRef(0);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    queueRef.current = [];
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingKey(null);
  }, []);

  const playNext = useCallback(
    (token: number) => {
      if (token !== tokenRef.current) return;
      const clip = queueRef.current.shift();
      if (!clip) {
        setPlayingKey(null);
        return;
      }
      let settled = false;
      let fellBack = false;
      const done = () => {
        if (settled) return;
        settled = true;
        playNext(token);
      };
      const fallback = () => {
        if (fellBack || settled || token !== tokenRef.current) return;
        fellBack = true;
        speakFallback(clip, language, done);
      };
      const src = resolveClip(manifest, clip, language);
      if (!src) return fallback();
      const audio = audioRef.current ?? (audioRef.current = new Audio());
      audio.onended = done;
      audio.onerror = fallback;
      audio.src = src;
      audio.play().catch(fallback);
    },
    [language],
  );

  const play = useCallback(
    (clips: ClipId[]) => {
      stop();
      queueRef.current = [...clips];
      setPlayingKey(queueKey(clips));
      playNext(tokenRef.current);
    },
    [stop, playNext],
  );

  // Stop when the language changes or the user moves to another screen.
  useEffect(() => stop, [language, pathname, stop]);

  const value = useMemo(() => ({ play, stop, playingKey }), [play, stop, playingKey]);
  return <NarratorContext.Provider value={value}>{children}</NarratorContext.Provider>;
}

export function useNarrator() {
  const ctx = useContext(NarratorContext);
  if (!ctx) throw new Error("useNarrator must be used inside NarratorProvider");
  return ctx;
}
