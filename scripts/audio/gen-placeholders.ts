/**
 * Generates clearly-labelled PLACEHOLDER audio so the slice is playable before real voice work
 * (06 §2, 07 §8). Never overwrites a clip whose review status is beyond `placeholder`.
 *
 * - English voice: ffmpeg's `flite` synthesizer (robotic; not for release).
 * - Arabic voice: there is no Arabic synthesizer here, and a wrong pronunciation would teach the
 *   wrong word, so Arabic clips are a soft tone timed to the line's length. The app shows the
 *   caption whenever a placeholder clip plays.
 * - SFX: synthesized tones.
 *
 * Usage: tsx scripts/audio/gen-placeholders.ts [--force]   (--force regenerates existing placeholders)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AudioManifest } from '../../src/content/schema';
import { PUBLIC_DIR, readJson, writeJson } from '../content/lib';
import { writeRuntimeManifests } from '../content/write-runtime';

const force = process.argv.includes('--force');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-audio-'));

const SFX: Record<string, { expr: string; d: number }> = {
  'sfx.tap': { expr: '0.5*sin(2*PI*880*t)*exp(-40*t)', d: 0.12 },
  'sfx.pop': { expr: '0.5*sin(2*PI*(300+1800*t)*t)*exp(-22*t)', d: 0.18 },
  'sfx.sparkle': {
    expr: '0.3*(sin(2*PI*1320*t)*exp(-6*t)+between(t,0.08,1)*sin(2*PI*1760*t)*exp(-6*(t-0.08))+between(t,0.16,1)*sin(2*PI*2093*t)*exp(-6*(t-0.16)))',
    d: 0.7,
  },
  'sfx.boop': { expr: '0.4*sin(2*PI*(260-90*t)*t)*exp(-7*t)', d: 0.32 },
  'sfx.chime': { expr: '0.25*(sin(2*PI*660*t)+sin(2*PI*990*t))*exp(-4*t)', d: 0.9 },
  'sfx.record_start': { expr: '0.35*(lt(t,0.1)*sin(2*PI*523*t)+gte(t,0.1)*sin(2*PI*784*t))*exp(-6*t)', d: 0.3 },
  'sfx.record_stop': { expr: '0.35*(lt(t,0.1)*sin(2*PI*784*t)+gte(t,0.1)*sin(2*PI*523*t))*exp(-6*t)', d: 0.3 },
  'sfx.celebrate': {
    expr: '0.28*(lt(t,0.18)*sin(2*PI*523*t)+between(t,0.18,0.36)*sin(2*PI*659*t)+between(t,0.36,0.54)*sin(2*PI*784*t)+gte(t,0.54)*sin(2*PI*1047*t)*exp(-3*(t-0.54)))',
    d: 1.3,
  },
  'sfx.page': { expr: '0.15*(random(0)*2-1)*exp(-14*t)', d: 0.25 },
  // Animal-sound stand-ins (07: real sounds are licensed or recorded): a rising-falling "meow"
  // glide and two short low "woof" bursts.
  'sfx.animal_cat': { expr: '0.35*sin(2*PI*(520+500*sin(PI*t/0.7))*t)*sin(PI*t/0.7)', d: 0.7 },
  'sfx.animal_dog': {
    expr: '0.45*(lt(t,0.18)*sin(2*PI*(220-200*t)*t)*sin(PI*t/0.18)+between(t,0.3,0.48)*sin(2*PI*(220-200*(t-0.3))*(t-0.3))*sin(PI*(t-0.3)/0.18))',
    d: 0.55,
  },
  // A long low "moo" and two nasal "quack" bursts.
  'sfx.animal_cow': { expr: '0.45*sin(2*PI*(140+30*sin(PI*t/1.1))*t)*sin(PI*t/1.1)*(0.8+0.2*sin(2*PI*5*t))', d: 1.1 },
  'sfx.animal_duck': {
    expr: '0.3*(lt(t,0.16)*sgn(sin(2*PI*480*t))*sin(PI*t/0.16)+between(t,0.26,0.42)*sgn(sin(2*PI*460*t))*sin(PI*(t-0.26)/0.16))',
    d: 0.45,
  },
};

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

function durationMs(file: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Math.round(parseFloat(out.toString()) * 1000);
}

const VOICE_FILTER = 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100';

function englishVoice(text: string, out: string) {
  const txt = path.join(tmp, 'line.txt');
  fs.writeFileSync(txt, text);
  ffmpeg(['-f', 'lavfi', '-i', `flite=textfile=${txt}:voice=slt`, '-af', VOICE_FILTER, '-ac', '1', '-b:a', '64k', out]);
}

function arabicTone(text: string, out: string) {
  const d = Math.min(4.5, Math.max(0.6, [...text].length * 0.075)).toFixed(2);
  const expr = '0.22*sin(2*PI*392*t)*(0.55+0.45*sin(2*PI*4*t))';
  ffmpeg([
    '-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':d=${d}:s=44100`,
    '-af', `afade=t=in:d=0.05,afade=t=out:st=${(Number(d) - 0.15).toFixed(2)}:d=0.15`,
    '-ac', '1', '-b:a', '64k', out,
  ]);
}

function sfx(id: string, out: string) {
  const s = SFX[id];
  if (!s) throw new Error(`No SFX recipe for ${id}`);
  ffmpeg([
    '-f', 'lavfi', '-i', `aevalsrc=exprs='${s.expr}':d=${s.d}:s=44100`,
    '-af', `afade=t=out:st=${(s.d - 0.05).toFixed(2)}:d=0.05`,
    '-ac', '1', '-b:a', '96k', out,
  ]);
}

const manifest = readJson<AudioManifest>('audio-manifest.json');
let made = 0;
for (const clip of manifest.clips) {
  for (const slot of ['ar', 'en', 'common'] as const) {
    const rel = clip.files[slot];
    const review = clip.review[slot];
    if (!rel || !review) continue;
    const regenerate = review.status === 'planned' || (force && review.status === 'placeholder');
    if (!regenerate) continue;

    const out = path.join(PUBLIC_DIR, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (slot === 'common') sfx(clip.id, out);
    else {
      const text = clip.transcript[slot];
      if (!text) {
        console.warn(`skip ${clip.id} (${slot}): no transcript`);
        continue;
      }
      if (slot === 'en') englishVoice(text, out);
      else arabicTone(text, out);
    }
    clip.review[slot] = {
      status: 'placeholder',
      by: null,
      date: null,
      notes:
        slot === 'en' ? 'Generated with flite; replace with reviewed voice.' : slot === 'ar' ? 'Tone stand-in; no Arabic voice yet.' : 'Synthesized SFX.',
    };
    clip.durationMs = { ...clip.durationMs, [slot]: durationMs(out) };
    clip.source = slot === 'common' ? 'placeholder:synth' : 'placeholder:generated';
    clip.licence = 'project-generated';
    made++;
  }
}
writeJson('audio-manifest.json', manifest);
writeRuntimeManifests();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`audio: generated ${made} placeholder file(s)`);
