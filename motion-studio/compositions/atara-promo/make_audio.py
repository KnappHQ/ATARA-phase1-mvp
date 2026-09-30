#!/usr/bin/env python3
"""Synthesizes the soundtrack for the ATARA launch film (music bed + sound effects).

    .venv/bin/python compositions/atara-promo/make_audio.py [out.wav]

No samples, no network: numpy only. Timings mirror the T/SC tables in script.js
(tap, confirmation, send, receive, orb, scan, sign, final); keep the two in sync.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
DUR = 46.5
BPM = 100
BEAT = 60 / BPM
BEAT0 = 3.6
BAR = BEAT * 4
T = dict(tap=7.4, ok=7.75, send=16.6, coin0=16.75, recv=18.45, orb0=25.4, orb1=29.6, scan=37.2, sign=38.1, final=41.0)

rng = np.random.default_rng(11)
N = int((DUR + 1.0) * SR)
music = np.zeros((2, N))
sfx = np.zeros((2, N))
verb = np.zeros((2, N))  # reverb send bus


def sec(x):
    return int(round(x * SR))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(bus, sig, t0, gain=1.0, pan=0.0, send=0.0):
    """Mix mono `sig` into stereo `bus` at t0 seconds. pan -1..1; send = amount to the reverb bus."""
    i = sec(t0)
    if i >= N or i + len(sig) <= 0:
        return
    a, b = max(i, 0), min(i + len(sig), N)
    seg = sig[a - i:b - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    bus[0, a:b] += seg * gain * l
    bus[1, a:b] += seg * gain * r
    if send:
        verb[0, a:b] += seg * send * l
        verb[1, a:b] += seg * send * r


def tt(d):
    return np.arange(sec(d)) / SR


def fft_filter(x, response):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * response(f), len(x))


def lp(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / (1 + (f / fc) ** (2 * order)))


def hp(x, fc, order=2):
    return fft_filter(x, lambda f: 1 - 1 / (1 + (f / fc) ** (2 * order)))


def bp(x, lo, hi):
    return hp(lp(x, hi), lo)


def noise(d):
    return rng.standard_normal(sec(d))


def decay(d, rate):
    return np.exp(-tt(d) * rate)


def fade(x, a=0.005, r=0.02):
    n = len(x)
    e = np.ones(n)
    na, nr = min(sec(a), n), min(sec(r), n)
    e[:na] = np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return x * e


def sine(f, d, ph=0.0):
    return np.sin(2 * np.pi * f * tt(d) + ph)


def saw(f, d):
    p = (tt(d) * f) % 1.0
    return 2 * p - 1


def bell(f, d=1.2, bright=1.0):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + 0.45 * bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6.0) \
        + 0.25 * bright * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 11.0)
    return fade(s, 0.002, 0.05)


def pluck(f, d=0.28):
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 14)
    return fade(s, 0.002, 0.03)


def chirp(f0, f1, d, curve=2.0):
    t = tt(d)
    p = t / d
    f = f0 * (f1 / f0) ** (p ** (1 / curve)) if f0 > 0 else f1 * p
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def whoosh(t0, d, peak=0.5, pan=0.0, lo=300, hi=6000, gain=0.5, down=False):
    """Noise sweep whose loudness peaks at `peak` (0..1 of its length)."""
    n = noise(d)
    p = tt(d) / d
    env = np.where(p < peak, (p / peak) ** 2, ((1 - p) / (1 - peak)) ** 1.5)
    # three bands crossfaded over time approximate a moving filter
    bands = [bp(n, lo * k, hi * k / 4) for k in (1.0, 2.0, 4.0)]
    w = [np.clip(1 - np.abs(p * 2 - c), 0, 1) for c in (0.0, 1.0, 2.0)] if not down else [np.clip(1 - np.abs(p * 2 - c), 0, 1) for c in (2.0, 1.0, 0.0)]
    s = sum(b * ww for b, ww in zip(bands, w)) * env
    s /= max(np.abs(s).max(), 1e-9)
    add(sfx, fade(s, 0.01, 0.05) * gain, t0, 1.0, pan, send=0.25)


def thump(t0, f=70, d=0.6, gain=0.8):
    t = tt(d)
    s = np.sin(2 * np.pi * (f + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 6)
    add(sfx, fade(s, 0.001, 0.05) * gain, t0, 1.0, 0.0, send=0.1)


def click(t0, gain=0.4, pan=0.0, f=3000):
    s = hp(noise(0.03), f) * decay(0.03, 160)
    s /= max(np.abs(s).max(), 1e-9)
    add(sfx, s * gain, t0, 1.0, pan)


def ease_io(x):
    x = np.clip(x, 0, 1)
    return np.where(x < .5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)


# ---------------------------------------------------------------- music
CHORDS = [  # (bass midi, chord midi)
    (33, [57, 60, 64]),  # Am
    (29, [53, 57, 60]),  # F
    (36, [55, 60, 64]),  # C
    (31, [55, 59, 62]),  # G
]


def section_gain(t):
    return 1.0


def bar_chord(t):
    return CHORDS[int(t // BAR) % 4]


kick_times = [BEAT0 + BEAT * k for k in range(int((40.8 - BEAT0) / BEAT) + 1)]
kick_times = [k for k in kick_times if not (32.3 <= k < 35.3)]
duck = np.ones(N)
for kt in kick_times:
    i = sec(kt)
    n = min(sec(0.45), N - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.65 * np.exp(-np.arange(n) / SR / 0.11))

# Pad: detuned saws per bar, swells in at the start and fades out at the end
pad = np.zeros((2, N))
for bar in range(int((DUR + BAR) // BAR)):
    t0 = bar * BAR
    _, notes = CHORDS[bar % 4]
    d = BAR + 0.9
    body = np.zeros(sec(d))
    for m in notes:
        for det, side in ((-0.06, 0), (0.06, 1)):
            body += saw(midi(m + det), d) * 0.18
    body = lp(body, 1500 + 500 * (bar % 2))
    t = tt(d)
    env = np.minimum(t / 0.5, 1) * np.minimum(np.maximum(BAR + 0.9 - t, 0) / 0.9, 1)
    body *= env
    add(pad, body, t0, 0.5, 0.0, send=0.0)
    add(pad, np.roll(body, sec(0.012)), t0, 0.5, 0.6)
pad_env = np.ones(N)
tl = np.arange(N) / SR
pad_env *= np.interp(tl, [0, 3.4, 3.6, 12, 31, 32.3, 33.5, 35.4, 36.2, 40.6, 41.0, 45.0, 46.5], [.15, .75, .55, .55, .55, .4, .3, .3, .5, .55, .8, .8, .0])
music += pad * pad_env * duck

# Bass: rolling eighths on the root
for k in range(int((40.8 - BEAT0) / (BEAT / 2))):
    t0 = BEAT0 + k * BEAT / 2
    if 32.3 <= t0 < 35.3 or t0 > 40.8:
        continue
    root, _ = bar_chord(t0)
    d = 0.3
    s = (np.sin(2 * np.pi * midi(root) * tt(d)) + 0.25 * np.sin(2 * np.pi * midi(root + 12) * tt(d))) * decay(d, 6)
    add(music, fade(s, 0.004, 0.03), t0, 0.5 if k % 2 == 0 else 0.3, 0.0)

# Kick
for kt in kick_times:
    d = 0.42
    t = tt(d)
    f = 48 + 110 * np.exp(-t * 34)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
    s += hp(noise(0.01), 2500)[:sec(0.01)].mean() * 0  # keep shape; click below
    add(music, fade(s, 0.001, 0.03), kt, 0.95)
    add(music, hp(noise(0.012), 3000) * decay(0.012, 300) * 0.25, kt, 1.0)

# Clap on 2 and 4 from the "send" scene onwards
for k in range(int((40.6 - BEAT0) / BEAT)):
    if k % 2 == 1:
        t0 = BEAT0 + k * BEAT
        if t0 < 12.8 or 32.3 <= t0 < 35.3:
            continue
        s = bp(noise(0.3), 1200, 5000) * decay(0.3, 16)
        s /= max(np.abs(s).max(), 1e-9)
        add(music, s, t0, 0.32, 0.05, send=0.25)

# Hats: offbeat eighths, sixteenths in the blockchain scene
hat_step = BEAT / 4
for k in range(int((40.6 - BEAT0) / hat_step)):
    t0 = BEAT0 + k * hat_step
    if 32.3 <= t0 < 35.3:
        continue
    eighth_off = (k % 4 == 2)
    sixteenth = (21.9 <= t0 < 31.0) and (k % 2 == 1)
    if eighth_off or sixteenth:
        s = hp(noise(0.06), 7000) * decay(0.06, 70)
        s /= max(np.abs(s).max(), 1e-9)
        add(music, s, t0, 0.17 if eighth_off else 0.08, 0.25 if (k // 2) % 2 else -0.25)

# Arpeggio: sixteenths on chord tones from the blockchain scene to the end of the key scene
arp_step = BEAT / 4
pattern = [0, 1, 2, 1, 0, 2, 1, 2]
for k in range(int((40.6 - 21.9) / arp_step)):
    t0 = 21.9 + k * arp_step
    _, notes = bar_chord(t0)
    m = notes[pattern[k % len(pattern)]] + 12
    g = 0.11 if not (32.3 <= t0 < 35.3) else 0.07
    add(music, pluck(midi(m)), t0, g, -0.5 + (k % 8) / 8, send=0.3)

# Closing pad + shimmer after the final hit
for m in (57, 60, 64, 67, 71, 76):
    d = DUR + 1 - T['final']
    t = tt(d)
    env = np.minimum(t / 0.05, 1) * np.exp(-t * 0.35)
    add(music, (np.sin(2 * np.pi * midi(m) * t) * 0.6 + np.sin(2 * np.pi * midi(m) * 1.004 * t) * 0.4) * env, T['final'], 0.07, 0.0, send=0.35)

# ---------------------------------------------------------------- sound effects
# Logo hit
thump(0.5, 52, 1.6, 0.9)
for i, m in enumerate((76, 81, 88)):
    add(sfx, bell(midi(m), 1.6, 0.8), 0.55 + i * 0.09, 0.14, -0.3 + i * 0.3, send=0.5)
whoosh(3.0, 0.9, 0.85, 0.0, 400, 8000, 0.45)  # sweep A

# Payment at the store
whoosh(4.8, 0.5, 0.5, -0.3, 500, 3000, 0.18)  # phone out of the pocket
for i, f in enumerate((1800, 2400)):  # NFC beep-beep
    s = fade(sine(f, 0.07), 0.003, 0.02) * 0.5
    add(sfx, s, T['tap'] + i * 0.1, 1.0, 0.3)
thump(T['tap'], 90, 0.25, 0.5)
for i, m in enumerate((84, 88, 91, 96)):  # confirmation chime
    add(sfx, bell(midi(m), 1.4), T['ok'] + i * 0.07, 0.3, -0.2 + i * 0.15, send=0.45)
thump(T['ok'], 62, 0.8, 0.7)
for k in range(10):  # confetti sparkles
    add(sfx, bell(midi(96 + int(rng.integers(0, 12))), 0.5) * 0.5, T['ok'] + 0.25 + k * 0.05, 0.05, float(rng.uniform(-.8, .8)), send=0.4)

# Cube turn S1 -> S2
whoosh(12.6, 1.0, 0.55, 0.0, 300, 7000, 0.5)
thump(13.6, 80, 0.5, 0.55)
whoosh(13.45, 0.5, 0.5, -0.5, 600, 4000, 0.22)
whoosh(13.65, 0.5, 0.5, 0.5, 600, 4000, 0.22)

# Send
add(sfx, fade(chirp(300, 1800, 0.35), 0.01, 0.1) * decay(0.35, 4) * 0.4, T['send'] - 0.05, 1.0, -0.4, send=0.3)
click(T['send'], 0.5, -0.4)
thump(T['send'] + 0.05, 75, 0.35, 0.4)
add(sfx, bell(midi(84), 1.0) * 0.6, T['send'] + 0.08, 0.14, -0.4, send=0.4)
# Coin flight: sparkles sweeping left to right
for k in range(26):
    p = k / 25
    t0 = T['coin0'] + p * (T['recv'] - T['coin0'] - 0.1)
    add(sfx, bell(midi(84 + [0, 4, 7, 12, 7, 4][k % 6] + int(p * 6)), 0.6, 0.6), t0, 0.07 * (1 - 0.3 * abs(p - .5)), -0.8 + 1.6 * p, send=0.45)
whoosh(T['coin0'], T['recv'] - T['coin0'] - 0.1, 0.55, 0.0, 800, 9000, 0.18)
# Receive
for i, m in enumerate((79, 84)):
    add(sfx, bell(midi(m), 1.6), T['recv'] + i * 0.12, 0.36, 0.5, send=0.5)
thump(T['recv'], 65, 0.7, 0.6)

# Zoom-through S2 -> S3
whoosh(21.4, 1.4, 0.65, 0.0, 250, 9000, 0.45)
thump(22.2, 55, 1.1, 0.75)

# Blockchain: cubes pop in, orb pings each cube in a rising A-minor pentatonic
for i in range(5):
    add(sfx, fade(sine(300 + 70 * i, 0.12), 0.002, 0.06) * decay(0.12, 12), 22.7 + i * 0.2, 0.3, -0.6 + 0.3 * i)
xs = np.linspace(T['orb0'], T['orb1'], 4000)
orbx = -660 + 1320 * ease_io((xs - T['orb0']) / (T['orb1'] - T['orb0']))
for i, m in enumerate((69, 72, 76, 79, 81)):
    cx = (i - 2) * 330
    idx = int(np.argmin(np.abs(orbx - cx)))
    add(sfx, bell(midi(m), 1.2), float(xs[idx]), 0.3, -0.6 + 0.3 * i, send=0.4)
    thump(float(xs[idx]), 60 + 6 * i, 0.3, 0.3)
whoosh(T['orb0'] - 0.05, T['orb1'] - T['orb0'], 0.5, 0.0, 600, 7000, 0.12)
for i, m in enumerate((81, 84, 88, 93)):  # arrival chord
    add(sfx, bell(midi(m), 2.0), T['orb1'] + 0.05 + i * 0.05, 0.25, 0.0, send=0.55)
for i, at in enumerate((25.6, 25.95, 26.3)):  # stat chips
    whoosh(at, 0.45, 0.4, -0.5 + i * 0.5, 500, 4000, 0.16)
    click(at + 0.3, 0.35, -0.5 + i * 0.5)

# Blinds S3 -> S4
whoosh(30.85, 0.9, 0.6, 0.0, 400, 8000, 0.4)
for i in range(12):
    click(31.0 + i * 0.045, 0.5, -0.8 + i * 0.145, 2500)
thump(31.4, 68, 0.6, 0.6)

# Holders: three thuds, then the zeros lock in
for i, at in enumerate((32.6, 32.9, 33.2)):
    thump(at, 55 + 8 * i, 0.8, 0.75)
    whoosh(at - 0.35, 0.6, 0.7, -0.6 + 0.6 * i, 300, 3500, 0.2)
for i, at in enumerate((33.6, 33.88, 34.16)):
    click(at, 0.6, -0.6 + 0.6 * i, 1800)
    thump(at, 120, 0.2, 0.4)
    add(sfx, bell(midi(81 + 3 * i), 1.3), at + 0.02, 0.2, -0.6 + 0.6 * i, send=0.4)
whoosh(34.9, 0.9, 0.5, 0.0, 300, 6000, 0.35, down=True)

# Phone + key
whoosh(35.4, 0.8, 0.6, 0.3, 400, 6000, 0.3)
for i, m in enumerate((88, 93, 97)):
    add(sfx, bell(midi(m), 0.9, 0.7), 35.75 + i * 0.07, 0.12, -0.3 + 0.3 * i, send=0.4)
add(sfx, fade(chirp(260, 1300, T['scan'] - 36.55), 0.05, 0.1) * 0.22, 36.55, 1.0, 0.2, send=0.25)
# key inserted: metal click + low thump, then the scan pulse
click(T['scan'], 0.8, 0.3, 1200)
thump(T['scan'], 70, 0.6, 0.8)
t = tt(0.9)
scan = np.sin(2 * np.pi * np.cumsum(500 + 900 * (t / 0.9)) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t)) * np.exp(-t * 2.2)
add(sfx, fade(scan, 0.01, 0.1) * 0.22, T['scan'], 1.0, 0.3, send=0.3)
for i, (at, m) in enumerate(((36.9, 88), (37.6, 91), (38.35, 95))):
    add(sfx, bell(midi(m), 0.9), at, 0.2, -0.6, send=0.35)
# Signature and flight to Base
for i, m in enumerate((72, 79, 84)):
    add(sfx, bell(midi(m), 1.3), T['sign'] + i * 0.08, 0.28, 0.3, send=0.45)
click(T['sign'], 0.6, 0.3)
whoosh(T['sign'] + 0.05, 1.2, 0.5, 0.0, 500, 7000, 0.25)
for i, m in enumerate((76, 81, 84, 88)):
    add(sfx, bell(midi(m), 1.8), T['sign'] + 1.2 + i * 0.06, 0.26, -0.5, send=0.5)
thump(T['sign'] + 1.2, 60, 0.6, 0.6)

# Sweep E + final hit
whoosh(40.1, 1.2, 0.72, 0.0, 300, 9000, 0.5)
thump(T['final'], 48, 2.2, 1.0)
add(sfx, hp(noise(1.6), 2500) * decay(1.6, 2.6) * 0.3, T['final'], 1.0, 0.0, send=0.3)
for i, m in enumerate((81, 88, 93, 100)):
    add(sfx, bell(midi(m), 2.6, 0.9), T['final'] + 0.04 + i * 0.09, 0.22, -0.4 + 0.27 * i, send=0.6)
for i, at in enumerate((43.0, 43.25, 43.5)):  # tags
    add(sfx, bell(midi(91 + 2 * i), 0.8, 0.6), at + 0.1, 0.1, -0.5 + 0.5 * i, send=0.4)

# ---------------------------------------------------------------- reverb + master
ir_len = sec(2.4)
ir = rng.standard_normal((2, ir_len)) * np.exp(-np.arange(ir_len) / SR * 2.6)
ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
ir[:, :sec(0.02)] *= np.linspace(0, 1, sec(0.02))
wet = np.zeros((2, N))
for c in range(2):
    wet[c] = np.fft.irfft(np.fft.rfft(verb[c], N + ir_len) * np.fft.rfft(ir[c], N + ir_len), N + ir_len)[:N] * 0.06

# Dip the music under the key sound effects so they read clearly
dip = np.ones(N)
for at, length in ((T['tap'], .4), (T['ok'], .7), (T['send'], .45), (T['recv'], .7), (T['scan'], .5), (T['sign'], .7), (T['sign'] + 1.2, .8)):
    i = sec(at - 0.03)
    n = min(sec(length + 0.03), N - i)
    x = np.arange(n) / SR
    dip[i:i + n] = np.minimum(dip[i:i + n], 1 - 0.42 * np.minimum(x / 0.03, 1) * np.exp(-np.maximum(x - 0.03, 0) / (length / 2.5)))
mix = music * dip * 0.9 + sfx + wet
mix = np.tanh(mix * 0.9) / np.tanh(0.9)  # gentle saturation as a limiter
fade_out = np.clip((DUR + 0.5 - np.arange(N) / SR) / 1.6, 0, 1)
mix *= fade_out
mix = mix[:, :sec(DUR + 0.5)]
mix /= max(np.abs(mix).max(), 1e-9) / 0.89

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'out/atara-promo.wav')
out.parent.mkdir(parents=True, exist_ok=True)
raw = out.with_suffix('.raw.wav')
sf.write(raw, mix.T, SR, subtype='PCM_16')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', 'loudnorm=I=-15:TP=-1.5:LRA=9', '-ar', str(SR), str(out)], check=True)
raw.unlink()
print(f'{out} · {DUR + 0.5:.1f}s · {BPM} BPM')
