import assert from "node:assert/strict";
import test from "node:test";
import { NightShiftAudio, ROOM_TONES } from "../dist/audio.mjs";

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  cancelScheduledValues(at) {
    this.events.push(["cancel", at]);
  }
  setValueAtTime(value, at) {
    this.value = value;
    this.events.push(["set", value, at]);
  }
  linearRampToValueAtTime(value, at) {
    this.value = value;
    this.events.push(["ramp", value, at]);
  }
}

class FakeNode {
  constructor(kind) {
    this.kind = kind;
    this.connections = [];
    this.disconnected = false;
  }
  connect(node) {
    this.connections.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super("gain");
    this.gain = new FakeParam(1);
  }
}

class FakeSource extends FakeNode {
  constructor(kind) {
    super(kind);
    this.frequency = new FakeParam();
    this.detune = new FakeParam();
    this.started = [];
    this.stopped = [];
    this.onended = null;
    this.loop = false;
  }
  start(at = 0) {
    this.started.push(at);
  }
  stop(at = 0) {
    this.stopped.push(at);
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super("filter");
    this.frequency = new FakeParam();
    this.type = "lowpass";
  }
}

class FakeBuffer {
  constructor(frames) {
    this.data = new Float32Array(frames);
  }
  getChannelData() {
    return this.data;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 2;
    this.sampleRate = 1000;
    this.destination = new FakeNode("destination");
    this.nodes = [];
    this.resumed = 0;
    this.closed = 0;
  }
  _add(node) {
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this._add(new FakeGain());
  }
  createOscillator() {
    return this._add(new FakeSource("oscillator"));
  }
  createBiquadFilter() {
    return this._add(new FakeFilter());
  }
  createBuffer(_channels, frames) {
    return new FakeBuffer(frames);
  }
  createBufferSource() {
    return this._add(new FakeSource("buffer-source"));
  }
  async resume() {
    this.resumed++;
  }
  async close() {
    this.closed++;
  }
}

test("construction and non-gesture calls never create an AudioContext", async () => {
  let factoryCalls = 0;
  const audio = new NightShiftAudio({
    contextFactory: () => {
      factoryCalls++;
      return new FakeAudioContext();
    }
  });
  assert.equal(factoryCalls, 0);
  assert.deepEqual(await audio.unlock(), {
    unlocked: false,
    reason: "A trusted user gesture is required"
  });
  assert.equal(factoryCalls, 0);
  assert.equal(audio.state, "locked");
});

test("a trusted gesture creates one routed context and applies bus settings", async () => {
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({
    contextFactory: () => context,
    volumes: { master: .6, effects: .4, ambience: .2 }
  });
  const first = await audio.unlock({ userGesture: true });
  assert.equal(first.unlocked, true);
  assert.equal(first.reused, false);
  assert.equal(context.resumed, 1);
  assert.deepEqual(Object.keys(audio.buses).sort(), ["ambience", "effects", "master"]);
  assert.equal(audio.buses.effects.connections[0], audio.buses.master);
  assert.equal(audio.buses.ambience.connections[0], audio.buses.master);
  assert.equal(audio.buses.master.connections[0], context.destination);
  assert.equal(audio.setVolume("effects", 3), 1);
  assert.equal(audio.setVolume("effects", -.5), 0);
  assert.equal(audio.setMuted("ambience", true), true);
  assert.equal(audio.buses.ambience.gain.value, 0);
  assert.equal((await audio.unlock({ userGesture: true })).reused, true);
  assert.equal(context.resumed, 2);
});

test("AudioContext startup failures degrade to captions without breaking the game", async () => {
  const captions = [];
  const audio = new NightShiftAudio({
    contextFactory: () => {
      throw new Error("device denied");
    },
    onCaption: detail => captions.push(detail)
  });
  assert.deepEqual(await audio.unlock({ userGesture: true }), {
    unlocked: false,
    reason: "device denied"
  });
  assert.equal(audio.state, "locked");
  assert.match(captions.at(-1).text, /visual captions remain active/i);
  assert.doesNotThrow(() => audio.playUI("error"));
});

test("every meaningful cue emits text even while locked or muted", async () => {
  const callbacks = [];
  const events = [];
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({
    contextFactory: () => context,
    onCaption: detail => callbacks.push(detail)
  });
  audio.addEventListener("caption", event => events.push(event.detail));
  assert.equal(audio.playWardenWarning().played, false);
  assert.equal(audio.playTransition({ from: "intake", to: "surgery" }).played, false);
  assert.equal(audio.playUI("error").played, false);
  assert.match(callbacks[0].text, /footsteps/i);
  assert.match(callbacks[1].text, /steel door/i);
  assert.match(callbacks[2].text, /warning/i);
  assert.deepEqual(events.map(entry => entry.cue), callbacks.map(entry => entry.cue));

  await audio.unlock({ userGesture: true });
  audio.setMuted("master", true);
  const sourceCount = context.nodes.filter(node => node.kind === "oscillator").length;
  assert.equal(audio.playUI("success").played, false);
  assert.equal(context.nodes.filter(node => node.kind === "oscillator").length, sourceCount);
  assert.match(audio.getCaptionLog().at(-1).text, /confirmation/i);
});

test("room ambience is authored, switchable, reusable, and cleanly stoppable", async () => {
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context, seed: 7 });
  const locked = audio.startAmbience("surgery");
  assert.equal(locked.played, false);
  assert.equal(locked.caption.text, ROOM_TONES.surgery.caption);

  await audio.unlock({ userGesture: true });
  const started = audio.startAmbience("surgery");
  assert.equal(started.played, true);
  assert.equal(audio.ambience.roomId, "surgery");
  assert.equal(audio.ambience.oscillators.length, 2);
  assert.ok(audio.ambience.noise);
  assert.equal(audio.startAmbience("surgery").reused, true);
  const oldAmbience = audio.ambience;
  audio.startAmbience("generator");
  assert.equal(audio.ambience.roomId, "generator");
  assert.ok(oldAmbience.oscillators.every(({ oscillator }) => oscillator.stopped.length === 1));
  assert.equal(audio.stopAmbience(), true);
  assert.equal(audio.ambience, null);
  assert.equal(audio.stopAmbience(), false);
});

test("reduced-effects mode keeps cues short and removes noisy threat transients", async () => {
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context, reducedEffects: true });
  await audio.unlock({ userGesture: true });
  const buffersBefore = context.nodes.filter(node => node.kind === "buffer-source").length;
  const warning = audio.playWardenWarning({ intensity: 1 });
  const transition = audio.playTransition({ from: "theatre", to: "generator" });
  assert.equal(warning.softened, true);
  assert.equal(transition.softened, true);
  assert.equal(context.nodes.filter(node => node.kind === "buffer-source").length, buffersBefore);
  audio.startAmbience("theatre");
  assert.equal(audio.ambience.noise, null);
});

test("one-shot sources are tracked and destroy is deterministic and idempotent", async () => {
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context });
  await audio.unlock({ userGesture: true });
  audio.startAmbience("intake");
  audio.playUI("click");
  audio.playWardenWarning();
  assert.ok(audio.activeSources.size >= 2);
  const sources = [...audio.activeSources].map(record => record.source);
  assert.equal(await audio.destroy(), true);
  assert.equal(audio.state, "closed");
  assert.equal(context.closed, 1);
  assert.equal(audio.activeSources.size, 0);
  assert.ok(sources.every(source => source.stopped.length >= 1));
  assert.equal(await audio.destroy(), false);
  assert.deepEqual(await audio.unlock({ userGesture: true }), {
    unlocked: false,
    reason: "Audio system is closed"
  });
});

test("invalid bus names are rejected instead of silently misrouting audio", () => {
  const audio = new NightShiftAudio();
  assert.throws(() => audio.setVolume("music", .5), /Unknown audio bus/);
  assert.throws(() => audio.setMuted("voice", true), /Unknown audio bus/);
});
