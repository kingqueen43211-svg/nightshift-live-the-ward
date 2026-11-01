import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const html = read("../dist/index.html");
const app = read("../dist/app.mjs");
const css = read("../dist/styles.css");

function parseAttributes(source) {
  const attributes = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function openingTags(source) {
  return [...source.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(match => ({
    name: match[1].toLowerCase(),
    attributes: parseAttributes(match[2]),
    source: match[0]
  }));
}

function tagById(id) {
  return openingTags(html).find(tag => tag.attributes.get("id") === id);
}

function hasAccessibleName(tag) {
  const attributes = tag.attributes;
  if (attributes.get("aria-label")?.trim() || attributes.get("aria-labelledby")?.trim()) return true;
  const id = attributes.get("id");
  return Boolean(id && [...html.matchAll(/<label\b([^>]*)>/gi)]
    .some(match => parseAttributes(match[1]).get("for") === id));
}

function cssRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
    selectors: match[1].trim(),
    declarations: match[2].trim()
  }));
}

test("cinematic intro and ending expose labelled modal-dialog semantics", () => {
  for (const id of ["cinematicIntro", "ending"]) {
    const tag = tagById(id);
    assert.ok(tag, `#${id} must exist`);
    assert.equal(tag.attributes.get("role"), "dialog", `#${id} must use role=dialog`);
    assert.equal(tag.attributes.get("aria-modal"), "true", `#${id} must be aria-modal`);
    const labelId = tag.attributes.get("aria-labelledby");
    assert.ok(labelId, `#${id} must use aria-labelledby`);
    assert.ok(tagById(labelId), `#${id} must reference an existing labelled title`);
  }
});

test("health, threat, power, and objective progress expose named value semantics", () => {
  const tags = openingTags(html);
  const progress = tags.filter(tag => tag.name === "progress" || tag.attributes.get("role") === "progressbar");
  assert.ok(progress.length >= 4, `expected at least 4 progress indicators, found ${progress.length}`);

  for (const indicator of progress) {
    assert.ok(hasAccessibleName(indicator), `progress indicator needs an accessible name: ${indicator.source}`);
    if (indicator.name === "progress") {
      assert.ok(indicator.attributes.has("max"), `native progress needs max: ${indicator.source}`);
      assert.ok(indicator.attributes.has("value"), `native progress needs value: ${indicator.source}`);
    } else {
      for (const attribute of ["aria-valuemin", "aria-valuemax", "aria-valuenow"]) {
        assert.ok(indicator.attributes.has(attribute), `${attribute} is required: ${indicator.source}`);
      }
    }
  }

  assert.match(app, /aria-valuenow|ariaValueNow|\.value\s*=/,
    "rendering must update semantic progress values alongside visual bars");
});

test("chat command uses an explicit label without wrapping the Send button", () => {
  const labels = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)].map(match => ({
    attributes: parseAttributes(match[1]),
    content: match[2]
  }));
  const chatLabel = labels.find(label => label.attributes.get("for") === "chatCommand");
  assert.ok(chatLabel, "chatCommand needs a <label for=chatCommand>");
  assert.doesNotMatch(chatLabel.content, /<button\b/i, "a label must not contain the Send button");
});

test("the application registers a keyboard pause shortcut", () => {
  assert.match(app, /addEventListener\(\s*["']keydown["']/,
    "register a keydown handler for the gameplay pause shortcut");
  assert.match(app, /["'](?:Escape|KeyP)["']/,
    "the handler must identify Escape or KeyP explicitly");
  assert.match(app, /(?:INPUT|TEXTAREA|SELECT|isContentEditable|closest\(\s*["'][^"']*(?:input|textarea|select))/,
    "the shortcut must guard editable controls");
});

test("primary controls and checkbox rows provide 44 CSS-pixel touch targets", () => {
  const variables = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([\d.]+)px/gi)]
    .map(match => [match[1], Number(match[2])]));
  const targetSize = declarations => {
    const match = declarations.match(/(?:min-height|height|min-block-size|block-size)\s*:\s*(?:([\d.]+)px|var\(\s*(--[\w-]+)\s*\))/i);
    return match ? Number(match[1] ?? variables.get(match[2]) ?? 0) : 0;
  };
  const rules = cssRules(css);
  const buttonRule = rules.find(rule => /(?:^|,)\s*(?:button|:where\([^)]*button|:is\([^)]*button)\b/i.test(rule.selectors) && targetSize(rule.declarations) >= 44);
  const toggleRule = rules.find(rule => /\.toggles\s+label\b/i.test(rule.selectors) && targetSize(rule.declarations) >= 44);
  assert.ok(buttonRule, "provide at least a 44px minimum target for buttons");
  assert.ok(toggleRule, "provide at least a 44px target for accessibility toggle rows");
});

test("reduced motion covers the in-app preference, OS preference, and pseudo-elements", () => {
  assert.doesNotMatch(css, /,\s*@media/i, "@media cannot appear inside a selector list");
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i,
    "honor the operating-system reduced-motion preference");
  assert.match(css, /body\.reduced-motion[^{}]*::before/i, "the in-app rule must cover ::before");
  assert.match(css, /body\.reduced-motion[^{}]*::after/i, "the in-app rule must cover ::after");
  assert.match(css, /animation-(?:duration|name)\s*:\s*(?:0|\.0*1m?s)/i,
    "reduced-motion rules must effectively stop animations");
});

test("reduced-effects mode suppresses every flash-bearing layer", () => {
  const rules = cssRules(css);
  const safetySelector = /body\.(?:low-effects|reduced-flash(?:es)?)/i;
  for (const layer of ["impact-flash", "alarm", "room-wipe"]) {
    const covered = rules.some(rule => safetySelector.test(rule.selectors) &&
      new RegExp(`\\.${layer}\\b`, "i").test(rule.selectors));
    assert.ok(covered, `reduced effects must explicitly suppress .${layer}`);
  }
  assert.match(app, /classList\.toggle\(\s*["'](?:low-effects|reduced-flash(?:es)?)["']/i,
    "the safety setting must activate its body hook");
});
