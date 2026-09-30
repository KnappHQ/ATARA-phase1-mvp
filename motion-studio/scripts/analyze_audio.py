#!/usr/bin/env python3
"""Turn a music track into timing cues a composition can animate to.

    .venv/bin/python scripts/analyze_audio.py track.wav --fps 30 -o out/track.cues.json

Writes tempo, beat and onset times (seconds) and a per-video-frame loudness
envelope in 0..1. `render.mjs --cues <file>` exposes the JSON as `window.cues`.
"""

import argparse
import json
from pathlib import Path

import librosa
import numpy as np


def analyze(path: Path, fps: float) -> dict:
    y, sr = librosa.load(path, sr=None, mono=True)
    duration = len(y) / sr

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")

    # RMS on a fine hop, then resampled onto video frame times.
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    frame_times = np.arange(int(round(duration * fps))) / fps
    energy = np.interp(frame_times, rms_times, rms)
    peak = energy.max()
    if peak > 0:
        energy = energy / peak

    return {
        "source": path.name,
        "duration": round(duration, 3),
        "sampleRate": sr,
        "fps": fps,
        "tempo": round(float(np.atleast_1d(tempo)[0]), 2),
        "beats": [round(float(t), 3) for t in beats],
        "onsets": [round(float(t), 3) for t in onsets],
        "energy": [round(float(e), 4) for e in energy],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--fps", type=float, default=30, help="video frame rate for the energy envelope (default 30)")
    parser.add_argument("-o", "--out", type=Path, help="output JSON (default out/<name>.cues.json)")
    args = parser.parse_args()

    cues = analyze(args.audio, args.fps)
    out = args.out or Path("out") / f"{args.audio.stem}.cues.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cues))
    print(f"{cues['tempo']} BPM, {len(cues['beats'])} beats, {len(cues['onsets'])} onsets, "
          f"{cues['duration']}s → {out}")


if __name__ == "__main__":
    main()
