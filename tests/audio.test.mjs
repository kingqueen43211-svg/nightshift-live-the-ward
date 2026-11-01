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

class FakeCompressor extends FakeNode {
  constructor() {
    super("compressor");
    this.threshold = new FakeParam();
    this.knee = new FakeParam();
    this.ratio = new FakeParam();
    this.attack = new FakeParam();
    this.release = new FakeParam();
  }
}

class FakePanner extends FakeNode {
  constructor() {
    super("stereo-panner");
    this.pan = new FakeParam();
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
  createDynamicsCompressor() {
    return this._add(new FakeCompressor());
  }
  createStereoPanner() {
    return this._add(new FakePanner());
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
  assert.deepEqual(Object.keys(audio.buses).sort(), ["ambience", "effects", "master", "music"]);
  assert.equal(audio.buses.effects.connections[0], audio.buses.master);
  assert.equal(audio.buses.ambience.connections[0], audio.buses.master);
  assert.equal(audio.buses.music.connections[0], audio.buses.master);
  assert.equal(audio.buses.master.connections[0], audio.compressor);
  assert.equal(audio.compressor.connections[0], context.destination);
  assert.equal(audio.compressor.threshold.value, -18);
  assert.equal(audio.compressor.ratio.value, 8);
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

test("master compression and the music bus degrade safely when compressor support is absent", async () => {
  const compressedContext = new FakeAudioContext();
  const compressed = new NightShiftAudio({ contextFactory: () => compressedContext });
  await compressed.unlock({ userGesture: true });
  assert.equal(compressed.getSettings().compressor, true);
  assert.equal(compressed.buses.music.connections[0], compressed.buses.master);
  assert.equal(compressed.buses.master.connections[0].kind, "compressor");
  assert.equal(compressed.buses.master.connections[0].connections[0], compressedContext.destination);

  const fallbackContext = new FakeAudioContext();
  fallbackContext.createDynamicsCompressor = undefined;
  const fallback = new NightShiftAudio({ contextFactory: () => fallbackContext });
  await fallback.unlock({ userGesture: true });
  assert.equal(fallback.getSettings().compressor, false);
  assert.equal(fallback.buses.master.connections[0], fallbackContext.destination);
});

test("adaptive score remembers a locked request, follows tension, and switches rooms cleanly", async () => {
  const captions = [];
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context, onCaption: detail => captions.push(detail) });

  const pending = audio.startScore("surgery", { tension: .2 });
  assert.equal(pending.played, false);
  assert.equal(pending.caption.text, "A restrained pulse enters beneath Ward 06.");
  assert.deepEqual(audio.scoreRequest, { roomId: "surgery", tension: .2 });

  await audio.unlock({ userGesture: true });
  assert.equal(audio.score.roomId, "surgery");
  assert.equal(audio.score.oscillators.length, 2);
  assert.equal(audio.score.lowpass.connections[0], audio.buses.music);

  const rising = audio.setTension(.58);
  assert.equal(rising.stage, "rising");
  assert.equal(rising.caption.cue, "score-rising");
  const critical = audio.setTension(.9);
  assert.equal(critical.stage, "critical");
  assert.equal(critical.caption.cue, "score-critical");
  assert.ok(audio.score.output.gain.events.some(event => event[0] === "ramp"));
  const fullScoreGain = audio.score.output.gain.value;
  audio.setReducedEffects(true);
  assert.ok(audio.score.output.gain.value < fullScoreGain);
  audio.setReducedEffects(false);

  const oldScore = audio.score;
  const switched = audio.startScore("generator", { tension: .8 });
  assert.equal(switched.played, true);
  assert.equal(audio.score.roomId, "generator");
  assert.ok(oldScore.oscillators.every(({ oscillator }) => oscillator.stopped.length === 1));
  assert.equal(audio.stopScore(), true);
  assert.equal(audio.score, null);
  assert.equal(audio.scoreRequest, null);
  assert.ok(captions.some(entry => entry.cue === "score-start"));
});

test("action, item, audience, Warden, and ending APIs emit exact ordered captions and scheduled cues", async () => {
  const callbacks = [];
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context, onCaption: detail => callbacks.push(detail) });

  const locked = audio.playAction("force-door", { roomId: "surgery" });
  assert.equal(locked.played, false);
  assert.match(locked.caption.text, /latch retracts, bolts hammer back/i);
  assert.equal(locked.caption.roomId, "surgery");

  await audio.unlock({ userGesture: true });
  const action = audio.playAction("force-door", { roomId: "surgery", pan: .5, startAt: 5 });
  assert.equal(action.played, true);
  assert.equal(action.sources.length, 4);
  assert.deepEqual(action.sources.map(source => Number(source.started[0].toFixed(2))), [5, 5.18, 5.42, 5.72]);
  const actionPanners = context.nodes.filter(node => node.kind === "stereo-panner").slice(-4);
  assert.equal(actionPanners.length, 4);
  assert.ok(actionPanners.every(node => node.pan.value === .5));

  const item = audio.playItem("Sedative ampoule", { effect: "Fear falls from 42 to 17." });
  assert.match(item.caption.text, /Fear falls from 42 to 17/);
  const audience = audio.playAudienceResult({ label: "Restore power", faction: "guardian", effect: "Emergency power rises by 20." });
  assert.equal(audience.caption.text, "Audience consequence: Restore power. Emergency power rises by 20.");
  const warden = audio.playWardenPhase({ phase: "repelled", intensity: .9, direction: -.7 });
  assert.equal(warden.phase, "repelled");
  assert.match(warden.caption.text, /howls, recoils/i);
  const ending = audio.playEnding({ ending: "humane", title: "MARA WALKS INTO DAWN" });
  assert.match(ending.caption.text, /fragile dawn.*MARA WALKS INTO DAWN/i);

  const ordered = audio.getCaptionLog()
    .map(entry => entry.cue)
    .filter(cue => cue.startsWith("action-") || ["item-used", "audience-result", "warden-repelled", "ending-humane"].includes(cue));
  assert.deepEqual(ordered, ["action-force-door", "action-force-door", "item-used", "audience-result", "warden-repelled", "ending-humane"]);

  audio.setMuted("master", true);
  const nodeCount = context.nodes.length;
  const muted = audio.playItem("Trauma kit", { effect: "Vitals rise from 40 to 65." });
  assert.equal(muted.played, false);
  assert.equal(context.nodes.length, nodeCount);
  assert.match(muted.caption.text, /Vitals rise from 40 to 65/);
  assert.equal(callbacks.at(-1).cue, "item-used");
});

test("blocked and reduced-effects cues remain descriptive without noisy transients", async () => {
  const context = new FakeAudioContext();
  const audio = new NightShiftAudio({ contextFactory: () => context, reducedEffects: true });
  await audio.unlock({ userGesture: true });
  const buffersBefore = context.nodes.filter(node => node.kind === "buffer-source").length;
  const blocked = audio.playAction("breaker-1", { accepted: false, reason: "breaker two must be first" });
  assert.equal(blocked.caption.text, "breaker 1 is blocked; breaker two must be first.");
  const physical = audio.playAction("force-door");
  assert.equal(physical.softened, true);
  assert.equal(context.nodes.filter(node => node.kind === "buffer-source").length, buffersBefore);
  assert.ok(physical.sources.length > 0);
});

test("invalid bus names are rejected instead of silently misrouting audio", () => {
  const audio = new NightShiftAudio();
  assert.equal(audio.setVolume("music", .5), .5);
  assert.throws(() => audio.setVolume("dialogue", .5), /Unknown audio bus/);
  assert.throws(() => audio.setMuted("voice", true), /Unknown audio bus/);
});
