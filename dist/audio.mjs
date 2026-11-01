const BUS_NAMES = Object.freeze(["master", "effects", "ambience", "music"]);
const ROOM_TONES = Object.freeze({
  intake: { root: 43, overtone: 86, air: 330, caption: "A low ventilation hum vibrates through Reception." },
  surgery: { root: 38, overtone: 76, air: 280, caption: "Fluorescent ballast and distant metal strain fill Ward 06." },
  theatre: { root: 47, overtone: 94, air: 410, caption: "Surgical lamps buzz over the silent operating table." },
  generator: { root: 34, overtone: 68, air: 220, caption: "The generator turns with an uneven mechanical pulse." },
  stairwell: { root: 52, overtone: 104, air: 520, caption: "Wind and emergency power breathe through the stairwell." }
});
const UI_CAPTIONS = Object.freeze({
  click: "Interface selection.",
  success: "Confirmation tone.",
  error: "Warning tone.",
  vote: "Audience vote registered."
});

const SCORE_TONES = Object.freeze({
  intake: { root: 43, minor: 51, air: 380, label: "Reception" },
  surgery: { root: 38, minor: 45, air: 310, label: "Ward 06" },
  theatre: { root: 47, minor: 56, air: 460, label: "Operating Theatre" },
  generator: { root: 34, minor: 40, air: 250, label: "Generator Room" },
  stairwell: { root: 52, minor: 62, air: 590, label: "Stairwell" }
});

const ACTION_CUES = Object.freeze({
  "search-desk": {
    caption: "Paper scrapes across the records desk as the intake file is uncovered.",
    sequence: [
      { kind: "noise", offset: 0, duration: .22, gain: .026, frequency: 1700 },
      { kind: "oscillator", offset: .12, frequency: 620, gain: .022, duration: .09 }
    ]
  },
  "open-locker": {
    caption: "The medication locker latch clicks and its metal door groans open.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 880, type: "square", gain: .022, duration: .045 },
      { kind: "noise", offset: .07, duration: .3, gain: .045, frequency: 520 },
      { kind: "oscillator", offset: .18, frequency: 104, type: "triangle", gain: .055, duration: .26 }
    ]
  },
  "reconstruct-file": {
    caption: "Torn paper edges align; the intake record is reconstructed.",
    sequence: [
      { kind: "noise", offset: 0, duration: .28, gain: .022, frequency: 2100 },
      { kind: "oscillator", offset: .22, frequency: 392, gain: .032, duration: .12 },
      { kind: "oscillator", offset: .3, frequency: 523, gain: .028, duration: .16 }
    ]
  },
  "identify-subject-06": {
    caption: "The evidence resolves into Subject 06's identity.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 196, type: "triangle", gain: .035, duration: .2 },
      { kind: "oscillator", offset: .14, frequency: 293.66, gain: .035, duration: .24 },
      { kind: "oscillator", offset: .28, frequency: 392, gain: .04, duration: .34 }
    ]
  },
  "inspect-gurney": {
    caption: "Leather restraints creak against the steel gurney.",
    sequence: [
      { kind: "noise", offset: 0, duration: .24, gain: .035, frequency: 640 },
      { kind: "oscillator", offset: .1, frequency: 82, type: "sawtooth", gain: .026, duration: .3 }
    ]
  },
  "listen-intercom": {
    caption: "The intercom crackles through a repeating three-beat cadence.",
    sequence: [
      { kind: "noise", offset: 0, duration: .34, gain: .032, frequency: 1150 },
      { kind: "oscillator", offset: .05, frequency: 246.94, gain: .024, duration: .07 },
      { kind: "oscillator", offset: .17, frequency: 246.94, gain: .024, duration: .07 },
      { kind: "oscillator", offset: .29, frequency: 196, gain: .03, duration: .1 }
    ]
  },
  "force-door": {
    caption: "The isolation latch retracts, bolts hammer back, and the steel door scrapes open.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 740, type: "square", gain: .028, duration: .06 },
      { kind: "oscillator", offset: .18, frequency: 128, type: "triangle", gain: .075, duration: .2 },
      { kind: "noise", offset: .42, duration: .58, gain: .072, frequency: 720 },
      { kind: "oscillator", offset: .72, frequency: 58, type: "sine", gain: .1, duration: .55, release: .36 }
    ]
  },
  "open-theatre-route": {
    caption: "The theatre route unlocks with a heavy magnetic release.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 144, type: "triangle", gain: .065, duration: .3 },
      { kind: "noise", offset: .16, duration: .26, gain: .04, frequency: 520 }
    ]
  },
  "align-lamps": {
    caption: "Surgical lamp arms swing into position and their ballasts ignite.",
    sequence: [
      { kind: "noise", offset: 0, duration: .26, gain: .028, frequency: 880 },
      { kind: "oscillator", offset: .22, frequency: 120, type: "sawtooth", gain: .025, duration: .42 },
      { kind: "oscillator", offset: .38, frequency: 480, gain: .035, duration: .3 }
    ]
  },
  "play-tape": {
    caption: "Magnetic tape catches; Dr. Vale's distorted confession begins.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 96, type: "square", gain: .02, duration: .05 },
      { kind: "noise", offset: .08, duration: .7, gain: .026, frequency: 1350 },
      { kind: "oscillator", offset: .16, frequency: 174, type: "sawtooth", gain: .02, duration: .62 }
    ]
  },
  "counter-warden": {
    caption: "The countermeasure discharges; the Warden recoils through the surgical curtain.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 680, type: "sawtooth", gain: .07, duration: .18 },
      { kind: "noise", offset: .04, duration: .4, gain: .08, frequency: 980 },
      { kind: "oscillator", offset: .2, frequency: 54, type: "sine", gain: .12, duration: .8, release: .55 }
    ]
  },
  "breaker-1": {
    caption: "Breaker one snaps into place.",
    sequence: [{ kind: "oscillator", offset: 0, frequency: 210, type: "square", gain: .055, duration: .075 }]
  },
  "breaker-2": {
    caption: "Breaker two snaps into place.",
    sequence: [{ kind: "oscillator", offset: 0, frequency: 236, type: "square", gain: .055, duration: .075 }]
  },
  "breaker-3": {
    caption: "Breaker three snaps into place.",
    sequence: [{ kind: "oscillator", offset: 0, frequency: 264, type: "square", gain: .055, duration: .075 }]
  },
  "reroute-power": {
    caption: "Contactors slam shut and emergency power rolls through the exit grid.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 110, type: "square", gain: .06, duration: .1 },
      { kind: "oscillator", offset: .12, frequency: 55, type: "sawtooth", gain: .07, duration: .7, release: .4 },
      { kind: "oscillator", offset: .34, frequency: 220, type: "sine", gain: .035, duration: .5 }
    ]
  },
  "seal-warden": {
    caption: "The binding sigil resonates and seals around the Warden.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 73.42, type: "sine", gain: .08, duration: .9, release: .55 },
      { kind: "oscillator", offset: .16, frequency: 146.83, type: "triangle", gain: .045, duration: .72 },
      { kind: "oscillator", offset: .36, frequency: 293.66, type: "sine", gain: .035, duration: .5 }
    ]
  },
  "open-roof": {
    caption: "The roof door opens; rain, wind, and distant dawn spill into the stairwell.",
    sequence: [
      { kind: "noise", offset: 0, duration: .8, gain: .045, frequency: 1800 },
      { kind: "oscillator", offset: .22, frequency: 261.63, gain: .035, duration: .7, release: .45 }
    ]
  },
  "open-tunnel": {
    caption: "The ambulance tunnel gate rises over grinding chain and concrete echo.",
    sequence: [
      { kind: "noise", offset: 0, duration: .72, gain: .06, frequency: 520 },
      { kind: "oscillator", offset: .16, frequency: 61.74, type: "triangle", gain: .085, duration: .82, release: .46 }
    ]
  }
});

const ITEM_CUES = Object.freeze({
  "Trauma kit": {
    caption: "A trauma kit seals the wound; the vital monitor steadies.",
    sequence: [
      { kind: "noise", offset: 0, duration: .18, gain: .018, frequency: 2200 },
      { kind: "oscillator", offset: .14, frequency: 440, gain: .028, duration: .12 },
      { kind: "oscillator", offset: .24, frequency: 554.37, gain: .028, duration: .16 }
    ]
  },
  "Sedative ampoule": {
    caption: "The sedative injector hisses; breathing and fear settle.",
    sequence: [
      { kind: "noise", offset: 0, duration: .3, gain: .022, frequency: 1500 },
      { kind: "oscillator", offset: .12, frequency: 196, gain: .026, duration: .38, release: .24 }
    ]
  },
  "Stabilized trauma kit": {
    caption: "The stabilized trauma kit seals the wound and slows the panic response.",
    sequence: [
      { kind: "noise", offset: 0, duration: .2, gain: .02, frequency: 2100 },
      { kind: "oscillator", offset: .12, frequency: 392, gain: .03, duration: .15 },
      { kind: "oscillator", offset: .24, frequency: 523.25, gain: .032, duration: .25 }
    ]
  },
  "Subscriber flare": {
    caption: "The flare ignites with a sharp hiss; the Warden recoils from its light.",
    sequence: [
      { kind: "noise", offset: 0, duration: .48, gain: .055, frequency: 2400 },
      { kind: "oscillator", offset: .05, frequency: 760, type: "sawtooth", gain: .04, duration: .35 }
    ]
  },
  "Audience shield": {
    caption: "Audience energy condenses into a resonant protective shield.",
    sequence: [
      { kind: "oscillator", offset: 0, frequency: 329.63, gain: .03, duration: .3 },
      { kind: "oscillator", offset: .12, frequency: 493.88, gain: .035, duration: .38 },
      { kind: "oscillator", offset: .24, frequency: 659.25, gain: .025, duration: .44 }
    ]
  }
});

const WARDEN_PHASES = Object.freeze({
  dormant: { caption: "The Warden recedes beyond hearing.", base: 42, noise: false },
  distant: { caption: "A distant dragging step echoes somewhere beyond the Ward.", base: 46, noise: true },
  warning: { caption: "Heavy footsteps scrape behind surgical plastic.", base: 40, noise: true },
  approaching: { caption: "The Warden's breathing closes in from the corridor.", base: 35, noise: true },
  striking: { caption: "The Warden lunges with a violent metallic shriek.", base: 29, noise: true },
  passing: { caption: "Dragging footsteps pass the hiding place and begin to fade.", base: 44, noise: true },
  repelled: { caption: "The Warden howls, recoils, and tears backward through the dark.", base: 58, noise: true },
  retreating: { caption: "The Warden retreats; its low breathing dissolves into the ventilation hum.", base: 52, noise: false },
  sealed: { caption: "The binding closes with one final pulse; the Warden falls silent.", base: 73.42, noise: false }
});

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : min;
}

function makeDetailEvent(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, "detail", { configurable: false, enumerable: true, value: detail });
  return event;
}

function setParam(param, value, at) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, at);
  else param.value = value;
}

function rampParam(param, value, at) {
  if (!param) return;
  if (typeof param.linearRampToValueAtTime === "function") param.linearRampToValueAtTime(value, at);
  else param.value = value;
}

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // A disconnected Web Audio node is already safe.
  }
}

function safeStop(node, at) {
  try {
    node?.stop?.(at);
  } catch {
    // Stopping an already-ended source is intentionally idempotent.
  }
}

/**
 * Gesture-gated procedural soundscape for NightShift Live.
 *
 * Construction never creates or resumes an AudioContext. Call unlock({userGesture:true})
 * directly from a trusted click/key handler, then startAmbience(). Every public cue emits
 * a caption event even when Web Audio is unavailable, muted, or still locked.
 */
export class NightShiftAudio extends EventTarget {
  constructor({
    contextFactory,
    onCaption,
    seed = 0x6e696768,
    volumes = {},
    reducedEffects = false
  } = {}) {
    super();
    this.contextFactory = contextFactory || (() => {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      return AudioContextClass ? new AudioContextClass({ latencyHint: "interactive" }) : null;
    });
    this.onCaption = typeof onCaption === "function" ? onCaption : null;
    this.seed = (Number(seed) >>> 0) || 1;
    this.state = "locked";
    this.context = null;
    this.buses = {};
    this.compressor = null;
    this.activeSources = new Set();
    this.ambience = null;
    this.score = null;
    this.scoreRequest = null;
    this.tension = 0;
    this.captionLog = [];
    this.reducedEffects = Boolean(reducedEffects);
    this.volumes = {
      master: clamp(volumes.master ?? .78),
      effects: clamp(volumes.effects ?? .82),
      ambience: clamp(volumes.ambience ?? .46),
      music: clamp(volumes.music ?? .34)
    };
    this.muted = { master: false, effects: false, ambience: false, music: false };
  }

  get unlocked() {
    return this.state === "unlocked";
  }

  get closed() {
    return this.state === "closed";
  }

  async unlock({ userGesture = false } = {}) {
    if (this.closed) return { unlocked: false, reason: "Audio system is closed" };
    if (!userGesture) return { unlocked: false, reason: "A trusted user gesture is required" };
    if (this.unlocked) {
      await this.context?.resume?.();
      return { unlocked: true, reused: true };
    }

    let context;
    try {
      context = this.contextFactory();
    } catch (error) {
      const reason = error?.message || "AudioContext creation failed";
      this._caption("audio-unavailable", `Audio is unavailable: ${reason}. Visual captions remain active.`);
      return { unlocked: false, reason };
    }
    if (!context) {
      this._caption("audio-unavailable", "Audio is unavailable; visual captions remain active.");
      return { unlocked: false, reason: "Web Audio is unavailable" };
    }

    try {
      this.context = context;
      this._createBuses();
      await context.resume?.();
    } catch (error) {
      for (const bus of Object.values(this.buses)) safeDisconnect(bus);
      safeDisconnect(this.compressor);
      await context.close?.().catch?.(() => {});
      this.buses = {};
      this.compressor = null;
      this.context = null;
      const reason = error?.message || "AudioContext could not start";
      this._caption("audio-unavailable", `Audio is unavailable: ${reason}. Visual captions remain active.`);
      return { unlocked: false, reason };
    }
    this.state = "unlocked";
    this._caption("audio-ready", "Soundscape enabled.");
    if (this.scoreRequest) {
      const pending = { ...this.scoreRequest };
      this.startScore(pending.roomId, { tension: pending.tension, caption: false });
    }
    return { unlocked: true, reused: false };
  }

  _createBuses() {
    const context = this.context;
    const master = context.createGain();
    const effects = context.createGain();
    const ambience = context.createGain();
    const music = context.createGain();
    effects.connect(master);
    ambience.connect(master);
    music.connect(master);
    let compressor = null;
    if (typeof context.createDynamicsCompressor === "function") {
      try {
        compressor = context.createDynamicsCompressor();
        setParam(compressor.threshold, -18, context.currentTime || 0);
        setParam(compressor.knee, 12, context.currentTime || 0);
        setParam(compressor.ratio, 8, context.currentTime || 0);
        setParam(compressor.attack, .003, context.currentTime || 0);
        setParam(compressor.release, .25, context.currentTime || 0);
        master.connect(compressor);
        compressor.connect(context.destination);
      } catch {
        safeDisconnect(compressor);
        compressor = null;
      }
    }
    if (!compressor) master.connect(context.destination);
    this.compressor = compressor;
    this.buses = { master, effects, ambience, music };
    for (const bus of BUS_NAMES) this._applyBus(bus);
  }

  _applyBus(bus) {
    const gain = this.buses[bus]?.gain;
    if (!gain || !this.context) return;
    const target = this.muted[bus] ? 0 : this.volumes[bus];
    const at = this.context.currentTime || 0;
    gain.cancelScheduledValues?.(at);
    setParam(gain, gain.value ?? target, at);
    rampParam(gain, target, at + .035);
  }

  setVolume(bus, value) {
    if (!BUS_NAMES.includes(bus)) throw new RangeError(`Unknown audio bus: ${bus}`);
    this.volumes[bus] = clamp(value);
    this._applyBus(bus);
    return this.volumes[bus];
  }

  setMuted(bus, muted = true) {
    if (!BUS_NAMES.includes(bus)) throw new RangeError(`Unknown audio bus: ${bus}`);
    this.muted[bus] = Boolean(muted);
    this._applyBus(bus);
    return this.muted[bus];
  }

  toggleMuted(bus) {
    return this.setMuted(bus, !this.muted[bus]);
  }

  setReducedEffects(enabled = true) {
    this.reducedEffects = Boolean(enabled);
    this._applyScoreDynamics();
    return this.reducedEffects;
  }

  getSettings() {
    return {
      state: this.state,
      reducedEffects: this.reducedEffects,
      tension: this.tension,
      compressor: Boolean(this.compressor),
      volumes: { ...this.volumes },
      muted: { ...this.muted }
    };
  }

  getCaptionLog() {
    return this.captionLog.map(entry => ({ ...entry }));
  }

  _caption(cue, text, meta = {}) {
    const detail = Object.freeze({
      cue,
      text,
      at: Date.now(),
      ...meta
    });
    this.captionLog.push(detail);
    this.captionLog = this.captionLog.slice(-64);
    try {
      this.onCaption?.(detail);
    } catch {
      // Caption renderer failures must never interrupt game or audio state.
    }
    this.dispatchEvent(makeDetailEvent("caption", detail));
    return detail;
  }

  _nextRandom() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  _track(source, attached = []) {
    if (!source) return source;
    const record = { source, attached, ended: false };
    this.activeSources.add(record);
    const cleanup = () => {
      if (record.ended) return;
      record.ended = true;
      safeDisconnect(source);
      for (const node of attached) safeDisconnect(node);
      this.activeSources.delete(record);
    };
    source.onended = cleanup;
    record.cleanup = cleanup;
    return source;
  }

  _makePanner(pan, at) {
    if (!this.context || typeof this.context.createStereoPanner !== "function") return null;
    try {
      const panner = this.context.createStereoPanner();
      setParam(panner.pan, clamp(pan, -1, 1), at);
      return panner;
    } catch {
      return null;
    }
  }

  _oscillator({
    frequency,
    type = "sine",
    gain = .1,
    attack = .012,
    duration = .16,
    release = .08,
    bus = "effects",
    detune = 0,
    pan = 0,
    startAt
  }) {
    if (!this.unlocked || !this.context || this.muted.master || this.muted[bus]) return null;
    const context = this.context;
    const at = startAt ?? context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    setParam(oscillator.frequency, frequency, at);
    setParam(oscillator.detune, detune, at);
    setParam(envelope.gain, 0, at);
    rampParam(envelope.gain, gain, at + attack);
    rampParam(envelope.gain, gain * .72, at + Math.max(attack, duration - release));
    rampParam(envelope.gain, 0, at + duration);
    oscillator.connect(envelope);
    const panner = this._makePanner(pan, at);
    if (panner) {
      envelope.connect(panner);
      panner.connect(this.buses[bus]);
    } else envelope.connect(this.buses[bus]);
    this._track(oscillator, panner ? [envelope, panner] : [envelope]);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
    return oscillator;
  }

  _noise({
    duration = .18,
    gain = .035,
    frequency = 520,
    bus = "effects",
    pan = 0,
    startAt
  } = {}) {
    if (!this.unlocked || !this.context || this.muted.master || this.muted[bus]) return null;
    const context = this.context;
    if (typeof context.createBuffer !== "function" || typeof context.createBufferSource !== "function") return null;
    const at = startAt ?? context.currentTime;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index++) data[index] = this._nextRandom() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    setParam(filter.frequency, frequency, at);
    setParam(envelope.gain, 0, at);
    rampParam(envelope.gain, gain, at + Math.min(.025, duration * .2));
    rampParam(envelope.gain, 0, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    const panner = this._makePanner(pan, at);
    if (panner) {
      envelope.connect(panner);
      panner.connect(this.buses[bus]);
    } else envelope.connect(this.buses[bus]);
    this._track(source, panner ? [filter, envelope, panner] : [filter, envelope]);
    source.start(at);
    source.stop(at + duration + .02);
    return source;
  }

  _playSequence(sequence = [], { bus = "effects", startAt, pan = 0 } = {}) {
    if (!this.unlocked || !this.context || !Array.isArray(sequence)) return [];
    const targetBus = BUS_NAMES.includes(bus) ? bus : "effects";
    const at = startAt ?? this.context.currentTime;
    return sequence.map(step => {
      const { kind = "oscillator", offset = 0, ...spec } = step || {};
      const options = {
        ...spec,
        bus: BUS_NAMES.includes(spec.bus) ? spec.bus : targetBus,
        pan: spec.pan ?? pan,
        startAt: at + Math.max(0, Number(offset) || 0)
      };
      return kind === "noise" ? this._noise(options) : this._oscillator(options);
    }).filter(Boolean);
  }

  _tensionStage(value = this.tension) {
    if (value >= .78) return "critical";
    if (value >= .42) return "rising";
    return "restrained";
  }

  _applyScoreDynamics() {
    if (!this.score || !this.context) return false;
    const at = this.context.currentTime || 0;
    const gain = (.035 + this.tension * .095) * (this.reducedEffects ? .62 : 1);
    this.score.output.gain?.cancelScheduledValues?.(at);
    setParam(this.score.output.gain, this.score.output.gain?.value ?? gain, at);
    rampParam(this.score.output.gain, gain, at + .18);
    const tone = SCORE_TONES[this.score.roomId] || SCORE_TONES.intake;
    this.score.lowpass.frequency?.cancelScheduledValues?.(at);
    rampParam(this.score.lowpass.frequency, tone.air + this.tension * 1150, at + .28);
    this.score.oscillators.forEach(({ oscillator }, index) => {
      const base = index ? tone.minor : tone.root;
      oscillator.frequency?.cancelScheduledValues?.(at);
      rampParam(oscillator.frequency, base * (1 + this.tension * (index ? .018 : .009)), at + .35);
    });
    return true;
  }

  startScore(roomId = "intake", { tension = this.tension, caption = true } = {}) {
    if (roomId && typeof roomId === "object") {
      const options = roomId;
      roomId = options.roomId || "intake";
      tension = options.tension ?? this.tension;
      caption = options.caption ?? true;
    }
    const tone = SCORE_TONES[roomId] || SCORE_TONES.intake;
    const normalizedRoom = SCORE_TONES[roomId] ? roomId : "intake";
    this.tension = clamp(tension);
    this.scoreRequest = { roomId: normalizedRoom, tension: this.tension };
    const detail = caption
      ? this._caption("score-start", `A ${this._tensionStage()} pulse enters beneath ${tone.label}.`, {
        roomId: normalizedRoom,
        tension: this.tension,
        loop: true
      })
      : null;
    if (!this.unlocked || !this.context) return { played: false, caption: detail, roomId: normalizedRoom, tension: this.tension };
    if (this.score?.roomId === normalizedRoom) {
      this._applyScoreDynamics();
      return { played: !this.muted.master && !this.muted.music, reused: true, caption: detail, roomId: normalizedRoom, tension: this.tension };
    }

    this.stopScore({ caption: false, clearRequest: false });
    const at = this.context.currentTime;
    const output = this.context.createGain();
    const lowpass = this.context.createBiquadFilter();
    setParam(output.gain, 0, at);
    lowpass.type = "lowpass";
    setParam(lowpass.frequency, tone.air, at);
    output.connect(lowpass);
    lowpass.connect(this.buses.music);
    const oscillators = [
      { frequency: tone.root, type: "sine", gain: 1 },
      { frequency: tone.minor, type: "triangle", gain: .24, detune: -6 }
    ].map(spec => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = spec.type;
      setParam(oscillator.frequency, spec.frequency, at);
      setParam(oscillator.detune, spec.detune || 0, at);
      setParam(gain.gain, spec.gain, at);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.start(at);
      return { oscillator, gain };
    });
    this.score = { roomId: normalizedRoom, output, lowpass, oscillators };
    this._applyScoreDynamics();
    return { played: !this.muted.master && !this.muted.music, reused: false, caption: detail, roomId: normalizedRoom, tension: this.tension };
  }

  setTension(value, { caption = true } = {}) {
    const previousStage = this._tensionStage();
    this.tension = clamp(value);
    if (this.scoreRequest) this.scoreRequest.tension = this.tension;
    const stage = this._tensionStage();
    const text = {
      restrained: "The score settles into a restrained investigative pulse.",
      rising: "The score tightens as danger rises through the Ward.",
      critical: "The score reaches a critical chase pulse."
    }[stage];
    const detail = caption && stage !== previousStage
      ? this._caption(`score-${stage}`, text, { tension: this.tension, stage })
      : null;
    const applied = this._applyScoreDynamics();
    return { tension: this.tension, stage, played: applied && !this.muted.master && !this.muted.music, caption: detail };
  }

  stopScore({ caption = false, clearRequest = true } = {}) {
    if (caption) this._caption("score-stop", "The adaptive score falls away.", { loop: false });
    if (clearRequest) this.scoreRequest = null;
    const score = this.score;
    if (!score) return false;
    const at = this.context?.currentTime || 0;
    score.output.gain?.cancelScheduledValues?.(at);
    rampParam(score.output.gain, 0, at + .16);
    for (const { oscillator, gain } of score.oscillators) {
      safeStop(oscillator, at + .18);
      setTimeout(() => {
        safeDisconnect(oscillator);
        safeDisconnect(gain);
      }, 220);
    }
    setTimeout(() => {
      safeDisconnect(score.output);
      safeDisconnect(score.lowpass);
    }, 220);
    this.score = null;
    return true;
  }

  startAmbience(roomId = "intake") {
    const room = ROOM_TONES[roomId] || ROOM_TONES.intake;
    const caption = this._caption("ambience", room.caption, { roomId, loop: true });
    if (!this.unlocked || !this.context) return { played: false, caption };
    if (this.ambience?.roomId === roomId) return { played: true, reused: true, caption };
    this.stopAmbience({ caption: false });

    const at = this.context.currentTime;
    const output = this.context.createGain();
    const lowpass = this.context.createBiquadFilter();
    setParam(output.gain, 0, at);
    rampParam(output.gain, this.reducedEffects ? .13 : .22, at + .7);
    lowpass.type = "lowpass";
    setParam(lowpass.frequency, room.air, at);
    output.connect(lowpass);
    lowpass.connect(this.buses.ambience);

    const oscillators = [
      { frequency: room.root, type: "sine", gain: 1 },
      { frequency: room.overtone, type: "triangle", gain: .17, detune: -7 }
    ].map(spec => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = spec.type;
      setParam(oscillator.frequency, spec.frequency, at);
      setParam(oscillator.detune, spec.detune || 0, at);
      setParam(gain.gain, spec.gain, at);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.start(at);
      return { oscillator, gain };
    });

    let noise = null;
    if (!this.reducedEffects) {
      const source = this.context.createBufferSource();
      const frames = Math.max(1, Math.floor(this.context.sampleRate * 2));
      const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frames; index++) data[index] = (this._nextRandom() * 2 - 1) * .14;
      source.buffer = buffer;
      source.loop = true;
      const gain = this.context.createGain();
      setParam(gain.gain, .05, at);
      source.connect(gain);
      gain.connect(output);
      source.start(at);
      noise = { source, gain };
    }

    this.ambience = { roomId, output, lowpass, oscillators, noise };
    return { played: true, reused: false, caption };
  }

  stopAmbience({ caption = true } = {}) {
    if (caption) this._caption("ambience-stop", "The room tone falls silent.", { loop: false });
    const ambience = this.ambience;
    if (!ambience) return false;
    const at = this.context?.currentTime || 0;
    ambience.output.gain?.cancelScheduledValues?.(at);
    rampParam(ambience.output.gain, 0, at + .12);
    for (const { oscillator, gain } of ambience.oscillators) {
      safeStop(oscillator, at + .14);
      setTimeout(() => {
        safeDisconnect(oscillator);
        safeDisconnect(gain);
      }, 180);
    }
    if (ambience.noise) {
      safeStop(ambience.noise.source, at + .14);
      setTimeout(() => {
        safeDisconnect(ambience.noise.source);
        safeDisconnect(ambience.noise.gain);
      }, 180);
    }
    setTimeout(() => {
      safeDisconnect(ambience.output);
      safeDisconnect(ambience.lowpass);
    }, 180);
    this.ambience = null;
    return true;
  }

  _adaptSequence(sequence, { fallbackFrequency = 330 } = {}) {
    if (!this.reducedEffects) return sequence;
    const softened = sequence
      .filter(step => step.kind !== "noise")
      .map(step => ({
        ...step,
        gain: typeof step.gain === "number" ? step.gain * .55 : step.gain,
        duration: typeof step.duration === "number" ? Math.min(step.duration, .32) : step.duration,
        release: typeof step.release === "number" ? Math.min(step.release, .16) : step.release
      }));
    return softened.length ? softened : [{ kind: "oscillator", frequency: fallbackFrequency, gain: .018, duration: .08 }];
  }

  playAction(action, {
    accepted = true,
    reason = "",
    effect = "",
    roomId = "unknown",
    pan = 0,
    startAt
  } = {}) {
    const cue = ACTION_CUES[action] || {
      caption: "The action changes the physical state of the Ward.",
      sequence: [{ kind: "oscillator", frequency: 440, gain: .03, duration: .12 }]
    };
    const label = String(action || "action").replaceAll("-", " ");
    const text = accepted
      ? `${cue.caption}${effect ? ` ${effect}` : ""}`
      : `${label} is blocked; ${reason || "nothing in the Ward changes"}.`;
    const caption = this._caption(accepted ? `action-${action || "unknown"}` : "action-blocked", text, {
      action: action || "unknown",
      accepted: Boolean(accepted),
      roomId,
      effect,
      reason
    });
    const sequence = accepted
      ? cue.sequence
      : [{ kind: "oscillator", frequency: 148, type: "triangle", gain: .05, duration: .16 }];
    const sources = this._playSequence(this._adaptSequence(sequence, { fallbackFrequency: accepted ? 440 : 148 }), {
      bus: "effects",
      startAt,
      pan
    });
    return { played: sources.length > 0, softened: this.reducedEffects, caption, sources, action: action || "unknown", accepted: Boolean(accepted) };
  }

  playItem(item, {
    accepted = true,
    reason = "",
    effect = "",
    pan = 0,
    startAt
  } = {}) {
    const cue = ITEM_CUES[item] || {
      caption: `${item || "The item"} takes effect.`,
      sequence: [{ kind: "oscillator", frequency: 493.88, gain: .028, duration: .14 }]
    };
    const text = accepted
      ? `${cue.caption}${effect ? ` ${effect}` : ""}`
      : `${item || "The item"} remains unused; ${reason || "it would have no effect"}.`;
    const caption = this._caption(accepted ? "item-used" : "item-blocked", text, {
      item: item || "unknown",
      accepted: Boolean(accepted),
      effect,
      reason
    });
    const sequence = accepted
      ? cue.sequence
      : [{ kind: "oscillator", frequency: 164.81, type: "triangle", gain: .04, duration: .14 }];
    const sources = this._playSequence(this._adaptSequence(sequence, { fallbackFrequency: accepted ? 493.88 : 164.81 }), {
      bus: "effects",
      startAt,
      pan
    });
    return { played: sources.length > 0, softened: this.reducedEffects, caption, sources, item: item || "unknown", accepted: Boolean(accepted) };
  }

  playAudienceResult({
    label = "Audience choice",
    faction = "neutral",
    effect = "The Ward changes.",
    accepted = true,
    startAt
  } = {}) {
    const normalizedFaction = faction === "chaos" ? "chaos" : faction === "guardian" ? "guardian" : "neutral";
    const text = accepted
      ? `Audience consequence: ${label}. ${effect}`
      : `Audience input rejected: ${effect}`;
    const caption = this._caption(accepted ? "audience-result" : "audience-rejected", text, {
      label,
      faction: normalizedFaction,
      effect,
      accepted: Boolean(accepted)
    });
    const sequences = {
      guardian: [
        { kind: "oscillator", offset: 0, frequency: 392, gain: .03, duration: .16 },
        { kind: "oscillator", offset: .1, frequency: 523.25, gain: .034, duration: .22 },
        { kind: "oscillator", offset: .2, frequency: 659.25, gain: .028, duration: .28 }
      ],
      chaos: [
        { kind: "oscillator", offset: 0, frequency: 174.61, type: "sawtooth", gain: .04, duration: .2 },
        { kind: "noise", offset: .08, duration: .25, gain: .035, frequency: 620 },
        { kind: "oscillator", offset: .18, frequency: 116.54, type: "triangle", gain: .045, duration: .32 }
      ],
      neutral: [
        { kind: "oscillator", offset: 0, frequency: 349.23, gain: .028, duration: .14 },
        { kind: "oscillator", offset: .12, frequency: 440, gain: .03, duration: .2 }
      ]
    };
    const rejected = [{ kind: "oscillator", frequency: 148, type: "triangle", gain: .05, duration: .16 }];
    const sources = this._playSequence(this._adaptSequence(accepted ? sequences[normalizedFaction] : rejected), {
      bus: "effects",
      startAt,
      pan: normalizedFaction === "guardian" ? -.24 : normalizedFaction === "chaos" ? .24 : 0
    });
    return { played: sources.length > 0, softened: this.reducedEffects, caption, sources, faction: normalizedFaction, accepted: Boolean(accepted) };
  }

  playWardenPhase({ phase = "warning", intensity = .65, direction = 0, startAt } = {}) {
    const normalizedPhase = WARDEN_PHASES[phase] ? phase : "warning";
    const descriptor = WARDEN_PHASES[normalizedPhase];
    const level = clamp(intensity);
    const pan = clamp(direction, -1, 1);
    const caption = this._caption(`warden-${normalizedPhase}`, descriptor.caption, {
      phase: normalizedPhase,
      intensity: level,
      direction: pan
    });
    const duration = normalizedPhase === "striking" || normalizedPhase === "repelled" ? .78 : .62;
    const baseGain = .04 + level * .075;
    const sequence = [
      { kind: "oscillator", offset: 0, frequency: Math.max(22, descriptor.base - level * 8), type: "sine", gain: baseGain, duration, release: .28 },
      { kind: "oscillator", offset: .08, frequency: descriptor.base * 1.43, type: normalizedPhase === "striking" ? "sawtooth" : "triangle", gain: baseGain * .28, duration: Math.max(.18, duration - .12), release: .22 }
    ];
    if (descriptor.noise) sequence.push({ kind: "noise", offset: .12, duration: normalizedPhase === "striking" ? .38 : .25, gain: .02 + level * .032, frequency: normalizedPhase === "striking" ? 780 : 260 });
    const sources = this._playSequence(this._adaptSequence(sequence, { fallbackFrequency: descriptor.base }), {
      bus: "effects",
      startAt,
      pan
    });
    return { played: sources.length > 0, softened: this.reducedEffects, caption, sources, phase: normalizedPhase, intensity: level, direction: pan };
  }

  playEnding({ ending = "humane", title = "", startAt } = {}) {
    const normalized = ["humane", "roof", "tunnel", "failure"].includes(ending) ? ending : "humane";
    const endings = {
      humane: {
        caption: "The Warden's motif releases into a fragile dawn.",
        sequence: [
          { kind: "oscillator", offset: 0, frequency: 146.83, type: "triangle", gain: .04, duration: 1.3, release: .72 },
          { kind: "oscillator", offset: .22, frequency: 220, gain: .035, duration: 1.15, release: .65 },
          { kind: "oscillator", offset: .46, frequency: 293.66, gain: .032, duration: 1.0, release: .58 },
          { kind: "oscillator", offset: .72, frequency: 440, gain: .024, duration: .82, release: .5 }
        ]
      },
      roof: {
        caption: "Rain gives way to a cautious dawn above the Ward.",
        sequence: [
          { kind: "noise", offset: 0, duration: 1.2, gain: .025, frequency: 2200 },
          { kind: "oscillator", offset: .18, frequency: 261.63, gain: .034, duration: 1.15, release: .65 },
          { kind: "oscillator", offset: .5, frequency: 392, gain: .026, duration: .9, release: .55 }
        ]
      },
      tunnel: {
        caption: "The descent closes on a restrained, unresolved pulse.",
        sequence: [
          { kind: "oscillator", offset: 0, frequency: 73.42, type: "triangle", gain: .055, duration: 1.25, release: .68 },
          { kind: "oscillator", offset: .3, frequency: 110, gain: .032, duration: 1.0, release: .58 }
        ]
      },
      failure: {
        caption: "The signal collapses into one final low tone.",
        sequence: [
          { kind: "noise", offset: 0, duration: .32, gain: .045, frequency: 420 },
          { kind: "oscillator", offset: .08, frequency: 43.65, type: "sawtooth", gain: .07, duration: 1.35, release: .9 }
        ]
      }
    };
    const descriptor = endings[normalized];
    const caption = this._caption(`ending-${normalized}`, `${descriptor.caption}${title ? ` ${title}` : ""}`, {
      ending: normalized,
      title
    });
    const sources = this._playSequence(this._adaptSequence(descriptor.sequence, { fallbackFrequency: normalized === "failure" ? 43.65 : 220 }), {
      bus: "music",
      startAt
    });
    return { played: sources.length > 0, softened: this.reducedEffects, caption, sources, ending: normalized };
  }

  playTransition({ from = "unknown", to = "unknown" } = {}) {
    const caption = this._caption("room-transition", "A steel door seals behind you.", { from, to });
    if (!this.unlocked || this.reducedEffects) {
      const source = this.unlocked ? this._oscillator({ frequency: 112, type: "sine", gain: .045, duration: .12 }) : null;
      return { played: Boolean(source), softened: this.reducedEffects, caption };
    }
    const at = this.context.currentTime;
    const sources = [
      this._noise({ duration: .34, gain: .06, frequency: 690, startAt: at }),
      this._oscillator({ frequency: 92, type: "triangle", gain: .09, duration: .42, release: .28, startAt: at + .02 }),
      this._oscillator({ frequency: 138, type: "sine", gain: .035, duration: .3, release: .18, startAt: at + .08 })
    ];
    return { played: sources.some(Boolean), softened: false, caption };
  }

  playWardenWarning({ intensity = .65 } = {}) {
    return this.playWardenPhase({ phase: "warning", intensity });
  }

  playUI(kind = "click") {
    const normalized = UI_CAPTIONS[kind] ? kind : "click";
    const caption = this._caption(`ui-${normalized}`, UI_CAPTIONS[normalized], { kind: normalized });
    if (!this.unlocked) return { played: false, caption };
    const tones = {
      click: [310, .026, .055],
      success: [520, .04, .11],
      error: [148, .05, .16],
      vote: [390, .032, .08]
    };
    const [frequency, gain, duration] = tones[normalized];
    const source = this._oscillator({
      frequency,
      type: normalized === "error" ? "triangle" : "sine",
      gain: this.reducedEffects ? gain * .55 : gain,
      duration: this.reducedEffects ? Math.min(duration, .07) : duration
    });
    return { played: Boolean(source), softened: this.reducedEffects, caption };
  }

  async destroy({ closeContext = true } = {}) {
    if (this.closed) return false;
    this.stopAmbience({ caption: false });
    this.stopScore({ caption: false });
    for (const record of [...this.activeSources]) {
      safeStop(record.source, this.context?.currentTime || 0);
      record.cleanup?.();
    }
    for (const bus of Object.values(this.buses)) safeDisconnect(bus);
    safeDisconnect(this.compressor);
    if (closeContext) await this.context?.close?.();
    this.buses = {};
    this.compressor = null;
    this.context = null;
    this.state = "closed";
    return true;
  }
}

export function createNightShiftAudio(options) {
  return new NightShiftAudio(options);
}

export { ACTION_CUES, ITEM_CUES, ROOM_TONES, SCORE_TONES, UI_CAPTIONS, WARDEN_PHASES };
