/**
 * Pre-generates narration audio into public/audio/<lang>/<clip>.<ext> and writes
 * src/content/audio-manifest.json. Unchanged clips are skipped.
 *
 * Usage: node scripts/generate-audio.ts --provider sarvam|mac [--force]
 * Sarvam needs SARVAM_API_KEY in .env.local (git-ignored).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { narration } from "../src/content/narration.ts";
import { LANGUAGE_CODES, type LanguageCode } from "../src/lib/languages.ts";

type Provider = "sarvam" | "mac";
type Entry = { file: string; hash: string };
type Manifest = {
  provider: Provider | null;
  unsupported: LanguageCode[];
  clips: Record<string, Partial<Record<LanguageCode, Entry>>>;
};

const AUDIO_DIR = "public/audio";
const MANIFEST_PATH = "src/content/audio-manifest.json";

const SARVAM_MODEL = "bulbul:v2";
const SARVAM_SPEAKER = "anushka";
const SARVAM_LANG: Record<LanguageCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  or: "od-IN",
};
// macOS has no Marathi or Odia voice; Lekha reads Devanagari Marathi acceptably.
const MAC_VOICE: Partial<Record<LanguageCode, string>> = {
  en: "Aman",
  hi: "Lekha",
  bn: "Piya",
  ta: "Vani",
  mr: "Lekha",
};

const args = process.argv.slice(2);
const provider = args[args.indexOf("--provider") + 1];
if (provider !== "sarvam" && provider !== "mac") {
  console.error("Usage: node scripts/generate-audio.ts --provider sarvam|mac [--force]");
  process.exit(1);
}
const force = args.includes("--force");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const ext = provider === "sarvam" ? "mp3" : "m4a";
const voiceFor = (lang: LanguageCode) =>
  provider === "sarvam" ? `${SARVAM_MODEL}/${SARVAM_SPEAKER}` : MAC_VOICE[lang];

async function synthSarvam(text: string, lang: LanguageCode): Promise<Buffer> {
  const key = process.env["SARVAM_API_KEY"];
  if (!key) throw new Error("SARVAM_API_KEY is not set — add it to .env.local");
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      language_code: SARVAM_LANG[lang],
      model: SARVAM_MODEL,
      speaker: SARVAM_SPEAKER,
      output_audio_codec: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { audios?: string[] };
  const audio = body.audios?.[0];
  if (!audio) throw new Error("Sarvam returned no audio");
  return Buffer.from(audio, "base64");
}

function synthMac(text: string, voice: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "hunarsetu-say-"));
  try {
    const aiff = join(dir, "clip.aiff");
    const m4a = join(dir, "clip.m4a");
    execFileSync("say", ["-v", voice, "-o", aiff, text]);
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a]);
    return readFileSync(m4a);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const previous: Manifest = existsSync(MANIFEST_PATH)
  ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest)
  : { provider: null, unsupported: [], clips: {} };
const next: Manifest = { provider, unsupported: [], clips: {} };
let made = 0;
let kept = 0;

for (const [clip, texts] of Object.entries(narration)) {
  for (const lang of LANGUAGE_CODES) {
    const voice = voiceFor(lang);
    if (!voice) {
      if (!next.unsupported.includes(lang)) next.unsupported.push(lang);
      continue;
    }
    const text = texts[lang];
    const hash = createHash("sha1").update(`${provider}|${voice}|${text}`).digest("hex");
    const file = `${lang}/${clip}.${ext}`;
    const old = previous.clips[clip]?.[lang];
    (next.clips[clip] ??= {})[lang] = { file, hash };

    if (!force && old?.hash === hash && existsSync(join(AUDIO_DIR, old.file))) {
      kept += 1;
      continue;
    }
    const audio = provider === "sarvam" ? await synthSarvam(text, lang) : synthMac(text, voice);
    mkdirSync(dirname(join(AUDIO_DIR, file)), { recursive: true });
    writeFileSync(join(AUDIO_DIR, file), audio);
    if (old && old.file !== file) rmSync(join(AUDIO_DIR, old.file), { force: true });
    made += 1;
    console.log(`✓ ${file}`);
  }
}

writeFileSync(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Done: ${made} generated, ${kept} unchanged.`);
if (next.unsupported.length > 0) {
  console.warn(`No ${provider} voice for: ${next.unsupported.join(", ")}`);
}
