const BUS_NAMES = Object.freeze(["master", "effects", "ambience"]);
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
    this.activeSources = new Set();
    this.ambience = null;
    this.captionLog = [];
    this.reducedEffects = Boolean(reducedEffects);
    this.volumes = {
      master: clamp(volumes.master ?? .78),
      effects: clamp(volumes.effects ?? .82),
      ambience: clamp(volumes.ambience ?? .46)
    };
    this.muted = { master: false, effects: false, ambience: false };
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
      await context.close?.().catch?.(() => {});
      this.buses = {};
      this.context = null;
      const reason = error?.message || "AudioContext could not start";
      this._caption("audio-unavailable", `Audio is unavailable: ${reason}. Visual captions remain active.`);
      return { unlocked: false, reason };
    }
    this.state = "unlocked";
    this._caption("audio-ready", "Soundscape enabled.");
    return { unlocked: true, reused: false };
  }

  _createBuses() {
    const context = this.context;
    const master = context.createGain();
    const effects = context.createGain();
    const ambience = context.createGain();
    effects.connect(master);
    ambience.connect(master);
    master.connect(context.destination);
    this.buses = { master, effects, ambience };
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
    return this.reducedEffects;
  }

  getSettings() {
    return {
      state: this.state,
      reducedEffects: this.reducedEffects,
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

  _oscillator({
    frequency,
    type = "sine",
    gain = .1,
    attack = .012,
    duration = .16,
    release = .08,
    bus = "effects",
    detune = 0,
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
    envelope.connect(this.buses[bus]);
    this._track(oscillator, [envelope]);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
    return oscillator;
  }

  _noise({
    duration = .18,
    gain = .035,
    frequency = 520,
    bus = "effects",
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
    envelope.connect(this.buses[bus]);
    this._track(source, [filter, envelope]);
    source.start(at);
    source.stop(at + duration + .02);
    return source;
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
    const level = clamp(intensity);
    const caption = this._caption("warden-warning", "Heavy footsteps scrape behind surgical plastic.", { intensity: level });
    if (!this.unlocked) return { played: false, caption };
    const at = this.context.currentTime;
    const gain = this.reducedEffects ? .035 : .055 + level * .07;
    const sources = [this._oscillator({ frequency: 48 - level * 9, type: "sine", gain, duration: this.reducedEffects ? .18 : .72, release: .22, startAt: at })];
    if (!this.reducedEffects) {
      sources.push(this._oscillator({ frequency: 64 - level * 7, type: "sawtooth", gain: gain * .25, duration: .55, release: .3, startAt: at + .08 }));
      sources.push(this._noise({ duration: .26, gain: .025 + level * .025, frequency: 240, startAt: at + .12 }));
    }
    return { played: sources.some(Boolean), softened: this.reducedEffects, caption };
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
    for (const record of [...this.activeSources]) {
      safeStop(record.source, this.context?.currentTime || 0);
      record.cleanup?.();
    }
    for (const bus of Object.values(this.buses)) safeDisconnect(bus);
    if (closeContext) await this.context?.close?.();
    this.buses = {};
    this.context = null;
    this.state = "closed";
    return true;
  }
}

export function createNightShiftAudio(options) {
  return new NightShiftAudio(options);
}

export { ROOM_TONES, UI_CAPTIONS };
