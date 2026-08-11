#!/usr/bin/env python3
"""
Renders Bandruptcy's tier 1 audio: one song, one stem per band member, plus the
event audio that gets injected into channels at runtime.

Why this exists
---------------
Doc 18.1: the player is mixing real stems with real processing. That means the
band has to be actual recorded audio files, not oscillators wired up at runtime,
because the whole point is that the console is doing something real to something
real. Doc 18.3: one song per tier, and the arrangement grows with the band --
which for tier 1 means three stems that layer, not three separate mixes.

These are stand-ins for DAW bounces. Replacing them is a file swap: keep the
names, the mono channel count, the length and the tempo, and nothing in the game
needs to know. Tempo and structure are duplicated in src/game/content/song.ts,
so if you change SONG below, change that too.

Deliberately mono. Pan is a control the player operates (doc 5.4); a stereo stem
would be pre-panned and the panner would have nothing honest to do.

Usage:  python3 tools/make_audio.py
Needs:  pip install numpy soundfile
"""

from __future__ import annotations

import math
import os
import numpy as np
import soundfile as sf

SR = 44100
BPM = 152.0
BEATS_PER_BAR = 4
SEC_PER_BEAT = 60.0 / BPM
SEC_PER_BAR = SEC_PER_BEAT * BEATS_PER_BAR
STEP = SEC_PER_BAR / 16.0  # one sixteenth

OUT_STEMS = "public/assets/audio/stems"
OUT_SFX = "public/assets/audio/sfx"

RNG = np.random.default_rng(20260811)

# --- Song structure. Mirrored in src/game/content/song.ts -------------------
SONG = [
    ("intro", 8),
    ("verse1", 8),
    ("chorus1", 8),
    ("verse2", 8),
    ("chorus2", 8),
    ("solo", 8),
    ("chorus3", 8),
    ("outro", 4),
]
TOTAL_BARS = sum(b for _, b in SONG)

# E natural minor. Em - C - G - D, because the band only knows the one progression
# and the game is about how badly it goes rather than about the music.
NOTE = {
    "E1": 41.20, "G1": 49.00, "A1": 55.00, "B1": 61.74, "C2": 65.41, "D2": 73.42,
    "E2": 82.41, "F#2": 92.50, "G2": 98.00, "A2": 110.00, "B2": 123.47,
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F#3": 185.00, "G3": 196.00,
    "A3": 220.00, "B3": 246.94, "C4": 261.63, "D4": 293.66, "E4": 329.63,
    "F#4": 369.99, "G4": 392.00, "A4": 440.00, "B4": 493.88, "C5": 523.25,
    "D5": 587.33, "E5": 659.25,
}

PROGRESSION = ["E", "C", "G", "D"]
ROOT_GTR = {"E": "E3", "C": "C4", "G": "G3", "D": "D4"}
ROOT_BASS = {"E": "E2", "C": "C2", "G": "G2", "D": "D2"}


def total_samples() -> int:
    # A little tail so the last crash and the outro chord are not chopped.
    return int((TOTAL_BARS * SEC_PER_BAR + 2.4) * SR)


def add(buf: np.ndarray, sig: np.ndarray, at_sec: float) -> None:
    i = int(at_sec * SR)
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(len(buf), i + len(sig))
    if j <= i:
        return
    buf[i:j] += sig[: j - i]


def env(n: int, attack: float, decay: float, sustain: float = 0.0,
        release: float = 0.02) -> np.ndarray:
    """Percussive-to-sustained envelope in samples."""
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    out = np.zeros(n, dtype=np.float64)
    a = min(a, n)
    out[:a] = np.linspace(0.0, 1.0, a)
    rest = n - a
    if rest <= 0:
        return out
    d = min(d, rest)
    out[a:a + d] = np.linspace(1.0, sustain if sustain > 0 else 0.0, d)
    if sustain > 0 and rest > d:
        tail = rest - d
        hold = max(0, tail - r)
        out[a + d:a + d + hold] = sustain
        if r and tail > hold:
            out[a + d + hold:] = np.linspace(sustain, 0.0, tail - hold)
    return out


def saw(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    # Band-limited-ish: sum of harmonics up to Nyquist keeps it from aliasing into
    # a mess at this tempo, which a naive ramp absolutely does.
    out = np.zeros(n)
    k = 1
    while freq * k < SR * 0.45 and k <= 24:
        out += np.sin(2 * np.pi * freq * k * t + phase) / k
        k += 1
    return out * 0.55


def square(freq: float, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = 1
    while freq * k < SR * 0.45 and k <= 21:
        out += np.sin(2 * np.pi * freq * k * t) / k
        k += 2
    return out * 0.7


def sine(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t + phase)


def noise(n: int) -> np.ndarray:
    return RNG.uniform(-1.0, 1.0, n)


def onepole_lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    a = math.exp(-2 * math.pi * cutoff / SR)
    out = np.empty_like(x)
    y = 0.0
    for i in range(len(x)):
        y = (1 - a) * x[i] + a * y
        out[i] = y
    return out


def biquad(x: np.ndarray, kind: str, freq: float, q: float = 0.707) -> np.ndarray:
    """Standard RBJ biquad. Slow in Python but these are short buffers."""
    w0 = 2 * math.pi * freq / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2 * q)
    if kind == "lp":
        b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
    elif kind == "hp":
        b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
    elif kind == "bp":
        b0, b1, b2 = alpha, 0.0, -alpha
    else:
        raise ValueError(kind)
    a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
    b0, b1, b2 = b0 / a0, b1 / a0, b2 / a0
    a1, a2 = a1 / a0, a2 / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xi
        y2, y1 = y1, yi
        y[i] = yi
    return y


def fast_lp(x: np.ndarray, cutoff: float, poles: int = 2) -> np.ndarray:
    for _ in range(poles):
        x = onepole_lp(x, cutoff)
    return x


def fast_hp(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - onepole_lp(x, cutoff)


def softclip(x: np.ndarray, drive: float) -> np.ndarray:
    return np.tanh(x * drive) / math.tanh(drive)


# --- Instruments ------------------------------------------------------------

def guitar_note(freq: float, dur: float, gain: float = 1.0, muted: bool = False,
                fifth: bool = True, lead: bool = False) -> np.ndarray:
    """A cheap amp through a cheap cabinet, mic'd close. Doc 8.1b assumes the
    guitar reaches the console through a mic on the cone, so it wants cabinet
    character baked in: no top above ~5k, no bottom below ~90."""
    n = int(max(0.05, dur) * SR)
    body = saw(freq, n) * 0.9 + square(freq, n) * 0.35
    body += saw(freq * 1.005, n) * 0.4  # slight detune, two coils never agree
    if fifth:
        f5 = freq * 2 ** (7 / 12)
        body += saw(f5, n) * 0.75 + saw(f5 * 1.004, n) * 0.3
        body += saw(freq * 2, n) * 0.25
    if lead:
        body += sine(freq * 2, n) * 0.4
    pick = noise(min(n, int(0.006 * SR))) * 1.4
    body[: len(pick)] += pick
    drive = 4.2 if not muted else 3.0
    body = softclip(body, drive)
    if muted:
        e = env(n, 0.002, 0.075, 0.0)
    elif lead:
        e = env(n, 0.006, 0.09, 0.62, 0.09)
    else:
        e = env(n, 0.004, 0.11, 0.5, 0.07)
    body *= e
    body = fast_lp(body, 4700 if not lead else 5600, 2)
    body = fast_hp(body, 105)
    return body * 0.5 * gain


def bass_note(freq: float, dur: float, gain: float = 1.0) -> np.ndarray:
    """Bassist is on a DI (doc 8.1b), so this is deliberately direct and clean:
    no cabinet, no room, and his position on stage is irrelevant to it."""
    n = int(max(0.05, dur) * SR)
    body = saw(freq, n) * 0.7 + sine(freq, n) * 0.9 + sine(freq * 0.5, n) * 0.25
    body += square(freq * 2, n) * 0.12
    body = softclip(body, 1.9)
    body *= env(n, 0.006, 0.1, 0.55, 0.05)
    body = fast_lp(body, 1150, 2)
    body = fast_hp(body, 42)
    return body * 0.55 * gain


def kick() -> np.ndarray:
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    f = 128 * np.exp(-t * 34) + 46
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env(n, 0.001, 0.3)
    click = noise(int(0.006 * SR)) * 0.8
    body[: len(click)] += fast_hp(click, 1500)
    return softclip(body, 1.6) * 0.95


def snare() -> np.ndarray:
    n = int(0.2 * SR)
    tone = (sine(196, n) * 0.5 + sine(288, n) * 0.35) * env(n, 0.001, 0.09)
    rattle = biquad(noise(n), "bp", 1900, 0.8) * env(n, 0.001, 0.16)
    body = tone * 0.5 + rattle * 0.85
    body = fast_hp(body, 190)
    return softclip(body, 1.5) * 0.72


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.26 if open_ else 0.055) * SR)
    body = biquad(noise(n), "hp", 7600, 0.7)
    body *= env(n, 0.0008, 0.25 if open_ else 0.05)
    return body * (0.24 if open_ else 0.3)


def crash() -> np.ndarray:
    n = int(1.5 * SR)
    body = biquad(noise(n), "hp", 3600, 0.6)
    body += biquad(noise(n), "bp", 6800, 0.4) * 0.6
    body *= env(n, 0.002, 1.45)
    return body * 0.34


def tom(freq: float) -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = freq * np.exp(-t * 7) * 0.4 + freq
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env(n, 0.001, 0.26)
    body += biquad(noise(n), "bp", freq * 3, 1.1) * env(n, 0.001, 0.05) * 0.3
    return body * 0.65


# --- Arrangement ------------------------------------------------------------

def steps(pattern: str) -> list[int]:
    """'x..x..x.' -> sixteenth indices that fire."""
    return [i for i, c in enumerate(pattern) if c == "x"]


# Guitar rhythms, 16 sixteenths to the bar.
GTR_MUTE = "xxxxxxxxxxxxxxxx"
GTR_VERSE = "x..x..x..x..x.x."
GTR_CHORUS = "x.x.x.x.x.x.x.x."
GTR_STAB = "x......x........"

BASS_VERSE = "x..x..x..x..x.x."
BASS_CHORUS = "x.x.x.x.x.x.x.x."
BASS_DRIVE = "xxxxxxxxxxxxxxxx"

KICK_VERSE = "x.....x...x....."
KICK_CHORUS = "x...x..x.x...x.."
SNARE_BEAT = "....x.......x..."
HAT_EIGHTH = "x.x.x.x.x.x.x.x."
HAT_SIXTEENTH = "xxxxxxxxxxxxxxxx"


def bar_start(bar: int) -> float:
    return bar * SEC_PER_BAR


def section_bars() -> dict[str, tuple[int, int]]:
    out: dict[str, tuple[int, int]] = {}
    bar = 0
    for name, bars in SONG:
        out[name] = (bar, bars)
        bar += bars
    return out


def render_guitar() -> np.ndarray:
    buf = np.zeros(total_samples())
    sec = section_bars()

    def play_bar(bar: int, chord: str, pattern: str, muted=False, gain=1.0,
                 octave=1.0, fifth=True):
        root = NOTE[ROOT_GTR[chord]] * octave
        hits = steps(pattern)
        for si, s in enumerate(hits):
            nxt = hits[si + 1] if si + 1 < len(hits) else 16
            dur = (nxt - s) * STEP * (0.95 if muted else 1.25)
            add(buf, guitar_note(root, dur, gain, muted, fifth), bar_start(bar) + s * STEP)

    # Intro: four bars of one palm-muted chord, because he starts before the others
    # are ready. Then the progression arrives.
    start, bars = sec["intro"]
    for b in range(4):
        play_bar(start + b, "E", GTR_MUTE, muted=True, gain=0.62)
    for b in range(4, bars):
        play_bar(start + b, PROGRESSION[(b - 4) % 4], GTR_CHORUS, gain=0.95)

    for name in ("verse1", "verse2"):
        start, bars = sec[name]
        for b in range(bars):
            chord = PROGRESSION[b % 4]
            pattern = GTR_VERSE if b < bars - 1 else GTR_CHORUS
            play_bar(start + b, chord, pattern, gain=0.86)

    for name in ("chorus1", "chorus2", "chorus3"):
        start, bars = sec[name]
        for b in range(bars):
            play_bar(start + b, PROGRESSION[b % 4], GTR_CHORUS, gain=1.0)

    # Solo: rhythm drops to stabs and a lead line goes over the top. The lead is
    # what the doc's solo section is for -- the guitar has to be exposed somewhere,
    # so a fader mistake during the solo is felt rather than reasoned about.
    start, bars = sec["solo"]
    lead = [
        ("E4", 0, 2), ("G4", 2, 2), ("B4", 4, 3), ("A4", 7, 2), ("G4", 9, 3),
        ("E4", 12, 4),
        ("C5", 0, 3), ("B4", 3, 2), ("G4", 5, 3), ("A4", 8, 4), ("G4", 12, 4),
        ("B4", 0, 2), ("D5", 2, 2), ("E5", 4, 4), ("D5", 8, 2), ("B4", 10, 6),
        ("A4", 0, 4), ("G4", 4, 2), ("F#4", 6, 2), ("E4", 8, 8),
    ]
    per_bar = [lead[0:6], lead[6:11], lead[11:16], lead[16:20]]
    for b in range(bars):
        play_bar(start + b, PROGRESSION[b % 4], GTR_STAB, gain=0.6)
        phrase = per_bar[b % 4]
        for note, s, length in phrase:
            add(
                buf,
                guitar_note(NOTE[note], length * STEP * 1.15, 0.72, False, False, True),
                bar_start(start + b) + s * STEP,
            )

    # Outro: one hit per chord, then the E5 left ringing while somebody's amp buzzes.
    start, bars = sec["outro"]
    for b in range(bars):
        chord = PROGRESSION[b % 4]
        if b < bars - 1:
            play_bar(start + b, chord, GTR_STAB, gain=1.05)
        else:
            add(buf, guitar_note(NOTE["E3"], 2.6, 1.1), bar_start(start + b))
    return buf


def render_bass() -> np.ndarray:
    buf = np.zeros(total_samples())
    sec = section_bars()

    def play_bar(bar: int, chord: str, pattern: str, gain=1.0, walk=None):
        root = NOTE[ROOT_BASS[chord]]
        hits = steps(pattern)
        for si, s in enumerate(hits):
            nxt = hits[si + 1] if si + 1 < len(hits) else 16
            dur = (nxt - s) * STEP * 1.1
            freq = root
            if walk and si in walk:
                freq = NOTE[walk[si]]
            add(buf, bass_note(freq, dur, gain), bar_start(bar) + s * STEP)

    start, bars = sec["intro"]
    # He comes in halfway through the intro, having been outside.
    for b in range(4, bars):
        play_bar(start + b, PROGRESSION[(b - 4) % 4], BASS_CHORUS, 0.85)

    for name in ("verse1", "verse2"):
        start, bars = sec[name]
        for b in range(bars):
            play_bar(start + b, PROGRESSION[b % 4], BASS_VERSE, 0.9)

    for name in ("chorus1", "chorus2", "chorus3"):
        start, bars = sec[name]
        for b in range(bars):
            play_bar(start + b, PROGRESSION[b % 4], BASS_CHORUS, 1.0)

    start, bars = sec["solo"]
    walks = [
        {5: "F#2", 6: "G2"},
        {5: "D2", 6: "E2"},
        {5: "A2", 6: "B2"},
        {5: "C3", 6: "B2"},
    ]
    for b in range(bars):
        play_bar(start + b, PROGRESSION[b % 4], BASS_DRIVE, 0.95, walks[b % 4])

    start, bars = sec["outro"]
    for b in range(bars):
        chord = PROGRESSION[b % 4]
        if b < bars - 1:
            play_bar(start + b, chord, GTR_STAB, 1.05)
        else:
            add(buf, bass_note(NOTE["E2"], 2.4, 1.1), bar_start(start + b))
    return buf


def render_drums() -> np.ndarray:
    buf = np.zeros(total_samples())
    sec = section_bars()
    K, S, H, HO, C = kick(), snare(), hat(False), hat(True), crash()
    T1, T2 = tom(180), tom(130)

    def lay(bar: int, pattern: str, sample: np.ndarray, gain=1.0):
        for s in steps(pattern):
            add(buf, sample * gain, bar_start(bar) + s * STEP)

    start, bars = sec["intro"]
    for b in range(4):
        lay(start + b, HAT_EIGHTH, H, 0.7)
        lay(start + b, "x...............", K, 0.9)
    for b in range(4, bars):
        lay(start + b, KICK_VERSE, K)
        lay(start + b, SNARE_BEAT, S)
        lay(start + b, HAT_EIGHTH, H, 0.85)
        if b == 4:
            add(buf, C, bar_start(start + b))

    for name in ("verse1", "verse2"):
        start, bars = sec[name]
        for b in range(bars):
            if b == bars - 1:
                # Fill into the chorus. The drummer's one good idea, used every time.
                lay(start + b, "x.......", K)
                add(buf, S * 0.9, bar_start(start + b) + 8 * STEP)
                add(buf, T1 * 0.9, bar_start(start + b) + 10 * STEP)
                add(buf, T1 * 0.9, bar_start(start + b) + 11 * STEP)
                add(buf, T2 * 0.95, bar_start(start + b) + 12 * STEP)
                add(buf, T2 * 0.95, bar_start(start + b) + 14 * STEP)
                lay(start + b, "x.x.x...........", H, 0.7)
            else:
                lay(start + b, KICK_VERSE, K)
                lay(start + b, SNARE_BEAT, S)
                lay(start + b, HAT_EIGHTH, H, 0.8)

    for name in ("chorus1", "chorus2", "chorus3"):
        start, bars = sec[name]
        for b in range(bars):
            lay(start + b, KICK_CHORUS, K)
            lay(start + b, SNARE_BEAT, S)
            lay(start + b, HAT_EIGHTH, HO if b % 2 == 0 else H, 0.7)
            if b == 0:
                add(buf, C, bar_start(start + b))

    start, bars = sec["solo"]
    for b in range(bars):
        lay(start + b, KICK_CHORUS, K, 0.95)
        lay(start + b, SNARE_BEAT, S, 0.95)
        lay(start + b, HAT_SIXTEENTH, H, 0.5)
        if b == 0:
            add(buf, C * 0.8, bar_start(start + b))

    start, bars = sec["outro"]
    for b in range(bars):
        if b < bars - 1:
            add(buf, K, bar_start(start + b))
            add(buf, C * 0.9, bar_start(start + b))
            add(buf, S * 0.8, bar_start(start + b) + 8 * STEP)
        else:
            add(buf, K * 1.1, bar_start(start + b))
            add(buf, C * 1.1, bar_start(start + b))
            add(buf, S, bar_start(start + b))
    return buf


# --- Event audio ------------------------------------------------------------
# Doc 2.4: sound problems are never subtle, and the audio must instantly name its
# own channel. These are all loops except where noted, and every one is routed at
# runtime into the channel whose microphone would really have heard it (doc 18.2).

def sfx_snore() -> np.ndarray:
    """Drummer asleep on the snare, snoring into the overheads. Two full breaths,
    loops seamlessly. Comically loud on purpose: it has to survive a full mix."""
    dur = 3.6
    n = int(dur * SR)
    out = np.zeros(n)
    for cycle in range(2):
        t0 = cycle * (dur / 2)
        # Inhale: rattling low rumble, rising.
        ln = int(0.9 * SR)
        t = np.arange(ln) / SR
        rumble = np.sin(2 * np.pi * (58 + 26 * t) * t) * 0.6
        rumble += np.sin(2 * np.pi * (92 + 30 * t) * t) * 0.3
        flutter = 0.5 + 0.5 * np.sin(2 * np.pi * 27 * t)
        rumble *= flutter
        rumble += biquad(noise(ln), "bp", 420, 0.7) * 0.25 * flutter
        rumble *= env(ln, 0.18, 0.45, 0.5, 0.25)
        add(out, fast_lp(rumble, 1400, 2) * 0.85, t0)
        # Exhale: a whistle through the nose, because of course it is.
        en = int(0.55 * SR)
        te = np.arange(en) / SR
        whistle = np.sin(2 * np.pi * (740 - 120 * te) * te) * 0.22
        whistle += biquad(noise(en), "bp", 1600, 2.5) * 0.16
        whistle *= env(en, 0.06, 0.42, 0.3, 0.1)
        add(out, whistle, t0 + 1.0)
    return out * 0.9


def sfx_tuning() -> np.ndarray:
    """Guitarist tuning mid-song without muting. Doc 8.8: tuning looks exactly like
    playing at this resolution, so the audio has to be the thing that lands -- a
    note bending, obviously wrong, obviously his channel."""
    dur = 4.2
    out = np.zeros(int(dur * SR))
    plucks = [(0.0, 1.11), (0.85, 1.07), (1.7, 0.94), (2.5, 0.97), (3.3, 1.0)]
    for at, ratio in plucks:
        n = int(0.9 * SR)
        base = NOTE["A3"] * ratio
        t = np.arange(n) / SR
        # A tuning peg being turned: the pitch actually moves while it rings.
        drift = base * (1 + (1 / ratio - 1) * np.clip(t / 0.7, 0, 1) * 0.55)
        ph = 2 * np.pi * np.cumsum(drift) / SR
        body = np.sin(ph) * 0.7 + np.sin(2 * ph) * 0.28 + np.sin(3 * ph) * 0.12
        body = softclip(body, 2.6) * env(n, 0.004, 0.5, 0.25, 0.2)
        body = fast_lp(body, 4200, 2)
        add(out, body * 0.55, at)
    return out


def sfx_crackle() -> np.ndarray:
    """Bass jack going intermittent. Doc 2.4 names this one directly: a crackling
    jack is whichever instrument just went intermittent."""
    dur = 2.6
    n = int(dur * SR)
    out = np.zeros(n)
    t = 0.0
    while t < dur - 0.1:
        burst = RNG.uniform(0.01, 0.07)
        bn = int(burst * SR)
        seg = noise(bn) * RNG.uniform(0.35, 1.0)
        seg = biquad(seg, "hp", 700, 0.7) * env(bn, 0.0005, burst * 0.9)
        add(out, seg * 0.55, t)
        # A dying hum between the crackles, so it reads as a bad connection rather
        # than as static.
        hn = int(0.1 * SR)
        add(out, sine(100, hn) * 0.06 * env(hn, 0.01, 0.09), t + burst)
        t += RNG.uniform(0.06, 0.28)
    return out


def sfx_cymbal_rattle() -> np.ndarray:
    """A knocked cymbal resting against the overhead mic. Metal on metal, in time
    with nothing."""
    dur = 2.4
    out = np.zeros(int(dur * SR))
    t = 0.0
    while t < dur - 0.15:
        n = int(RNG.uniform(0.05, 0.14) * SR)
        seg = biquad(noise(n), "bp", RNG.uniform(2600, 5200), 1.6)
        seg += biquad(noise(n), "hp", 7000, 0.8) * 0.5
        seg *= env(n, 0.001, 0.9 * n / SR)
        add(out, seg * RNG.uniform(0.3, 0.62), t)
        t += RNG.uniform(0.07, 0.2)
    return out * 0.8


def sfx_bark() -> np.ndarray:
    """One-shot. The dog is the agent and the joke; the pedal is the information
    (doc 6.4.3). This is flavour, not the cue."""
    out = np.zeros(int(1.3 * SR))
    for at, pitch in ((0.0, 1.0), (0.42, 1.12), (1.0, 0.92)):
        n = int(0.26 * SR)
        t = np.arange(n) / SR
        f = 300 * pitch * np.exp(-t * 9) + 130 * pitch
        ph = 2 * np.pi * np.cumsum(f) / SR
        body = np.sin(ph) * 0.7 + np.sin(ph * 2.02) * 0.3
        body += biquad(noise(n), "bp", 1100, 1.2) * 0.35
        body = softclip(body, 2.2) * env(n, 0.006, 0.2)
        add(out, fast_lp(body, 3800, 1) * 0.6, at)
    return out


def sfx_amp_die() -> np.ndarray:
    """One-shot. The amp goes in a puff of smoke and he has to borrow a DI box."""
    out = np.zeros(int(2.0 * SR))
    n = int(0.05 * SR)
    add(out, softclip(noise(n) * 2.0, 3.0) * env(n, 0.001, 0.045) * 0.8, 0.0)
    hn = int(1.6 * SR)
    t = np.arange(hn) / SR
    hum = np.sin(2 * np.pi * 100 * t) * 0.5 + np.sin(2 * np.pi * 150 * t) * 0.2
    hum *= np.exp(-t * 2.4)
    add(out, hum * 0.6, 0.03)
    fizz = biquad(noise(int(0.9 * SR)), "bp", 2400, 0.8)
    fizz *= env(len(fizz), 0.01, 0.85)
    add(out, fizz * 0.25, 0.05)
    return out


def sfx_beer_spill() -> np.ndarray:
    """One-shot, plays on the master rather than a channel: it happens at the desk,
    not on stage (doc 9.1), so no microphone is involved."""
    out = np.zeros(int(1.4 * SR))
    n = int(0.9 * SR)
    splash = biquad(noise(n), "bp", 2200, 0.6) * env(n, 0.003, 0.8)
    add(out, splash * 0.5, 0.0)
    glass = sine(1750, int(0.4 * SR)) * env(int(0.4 * SR), 0.001, 0.38) * 0.2
    add(out, glass, 0.0)
    drips = np.zeros(int(0.6 * SR))
    for _ in range(7):
        dn = int(0.05 * SR)
        seg = sine(RNG.uniform(900, 2200), dn) * env(dn, 0.001, 0.045)
        add(drips, seg * 0.25, RNG.uniform(0.05, 0.5))
    add(out, drips, 0.35)
    return out


# --- Write ------------------------------------------------------------------

def normalise(x: np.ndarray, peak: float) -> np.ndarray:
    m = float(np.max(np.abs(x)))
    if m < 1e-9:
        return x
    return x / m * peak


def write(path: str, data: np.ndarray, peak: float = 0.89) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = normalise(data, peak).astype(np.float32)
    fmt = "MP3" if path.endswith(".mp3") else "WAV"
    kwargs = {"format": fmt}
    if fmt == "MP3":
        kwargs["compression_level"] = 0.28
    sf.write(path, out, SR, **kwargs)
    size = os.path.getsize(path) / 1024
    print(f"  {path}  {len(out) / SR:5.1f}s  {size:6.0f} KB")


def main() -> None:
    print(f"tier 1 song: {TOTAL_BARS} bars at {BPM:.0f} bpm "
          f"= {TOTAL_BARS * SEC_PER_BAR:.1f}s")
    print("stems (mono, one per band member):")
    write(f"{OUT_STEMS}/t1-guitar.mp3", render_guitar(), 0.86)
    write(f"{OUT_STEMS}/t1-drums.mp3", render_drums(), 0.9)
    write(f"{OUT_STEMS}/t1-bass.mp3", render_bass(), 0.84)
    print("event audio:")
    write(f"{OUT_SFX}/snore.mp3", sfx_snore(), 0.85)
    write(f"{OUT_SFX}/tuning.mp3", sfx_tuning(), 0.8)
    write(f"{OUT_SFX}/crackle.mp3", sfx_crackle(), 0.8)
    write(f"{OUT_SFX}/cymbal-rattle.mp3", sfx_cymbal_rattle(), 0.78)
    write(f"{OUT_SFX}/bark.mp3", sfx_bark(), 0.8)
    write(f"{OUT_SFX}/amp-die.mp3", sfx_amp_die(), 0.85)
    write(f"{OUT_SFX}/beer-spill.mp3", sfx_beer_spill(), 0.8)


if __name__ == "__main__":
    main()
