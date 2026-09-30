#!/usr/bin/env node
// End-to-end toolchain check: synthesize a 120 BPM click track with ffmpeg,
// analyze it with librosa, render the hello composition to it through
// Playwright + ffmpeg, then probe the result.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with code ${r.status}`);
  return r.stdout;
}

const python = existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3';
const dir = 'out/smoke';
mkdirSync(dir, { recursive: true });

console.log('1/4 click track: 120 BPM, 4 s');
run('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'lavfi',
  '-i', 'aevalsrc=0.8*sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03):s=44100:d=4',
  `${dir}/click.wav`,
]);

console.log('2/4 audio analysis');
process.stdout.write(run(python, ['scripts/analyze_audio.py', `${dir}/click.wav`, '--fps', '30', '-o', `${dir}/click.cues.json`]));
const cues = JSON.parse(readFileSync(`${dir}/click.cues.json`, 'utf8'));
assert.ok(Math.abs(cues.tempo - 120) < 3, `expected ~120 BPM, got ${cues.tempo}`);
assert.equal(cues.energy.length, 120);

console.log('3/4 render with audio + cues');
process.stdout.write(run(process.execPath, [
  'scripts/render.mjs', 'compositions/hello/index.html',
  '--width', '640', '--height', '360',
  '--audio', `${dir}/click.wav`, '--cues', `${dir}/click.cues.json`,
  '-o', `${dir}/hello.mp4`,
]));

console.log('4/4 probe');
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', `${dir}/hello.mp4`]));
const video = probe.streams.find((s) => s.codec_type === 'video');
const audio = probe.streams.find((s) => s.codec_type === 'audio');
assert.equal(video?.codec_name, 'h264');
assert.equal(`${video.width}x${video.height}`, '640x360');
assert.equal(Number(video.nb_read_frames), 120);
assert.equal(audio?.codec_name, 'aac');
assert.ok(existsSync(`${dir}/hello.sheet.jpg`), 'contact sheet missing');

console.log(`smoke ok → ${dir}/hello.mp4, ${dir}/hello.sheet.jpg`);
