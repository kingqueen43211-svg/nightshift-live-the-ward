import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const captureScript = fileURLToPath(new URL("../scripts/capture-proof.mjs", import.meta.url));

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.error?.message || result.stderr}`);
  return result.stdout.trim();
}

function createRepository(t) {
  const root = mkdtempSync(join(tmpdir(), "nightshift-capture-integrity-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist", "app.mjs"), "export const release = 1;\n");
  writeFileSync(join(root, "README.md"), "# proof fixture\n");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "proof@example.invalid"]);
  git(root, ["config", "user.name", "Proof Fixture"]);
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", "fixture"]);
  return { root, head: git(root, ["rev-parse", "HEAD"]) };
}

function runPreflight(root, values = {}) {
  const env = { ...process.env, CAPTURE_PROOF_REPO_ROOT: root };
  for (const name of [
    "CAPTURE_EXPECTED_COMMIT",
    "CAPTURE_EXPECTED_SOURCE_TREE",
    "CAPTURE_EXPECTED_RUNTIME_TREE",
    "CAPTURE_GIT_BINARY",
  ]) delete env[name];
  Object.assign(env, values);
  return spawnSync(process.execPath, [captureScript, "--preflight"], {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
}

test("capture source preflight accepts only a clean repository pinned to its full release commit", t => {
  const { root, head } = createRepository(t);
  const result = runPreflight(root, { CAPTURE_EXPECTED_COMMIT: head });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.head, head);
  assert.equal(report.declaredCommit, head);
  assert.equal(report.worktree.commandSucceeded, true);
  assert.equal(report.worktree.dirty, false);
  assert.match(report.sourceTree, /^[0-9a-f]{40}$/);
  assert.match(report.runtimeTree, /^[0-9a-f]{40}$/);
  assert.match(report.sourceManifestSha256, /^[0-9a-f]{64}$/);
  assert.match(report.runtimeManifestSha256, /^[0-9a-f]{64}$/);
});

test("capture source preflight fails closed when the release commit is missing", t => {
  const { root } = createRepository(t);
  const result = runPreflight(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CAPTURE_EXPECTED_COMMIT is required/);
});

test("capture source preflight fails closed outside a Git repository", t => {
  const root = mkdtempSync(join(tmpdir(), "nightshift-capture-nonrepo-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = runPreflight(root, { CAPTURE_EXPECTED_COMMIT: "0".repeat(40) });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Git command failed \(git rev-parse --show-toplevel\)/);
});

test("capture source preflight fails closed when Git cannot execute", t => {
  const { root, head } = createRepository(t);
  const result = runPreflight(root, {
    CAPTURE_EXPECTED_COMMIT: head,
    CAPTURE_GIT_BINARY: "nightshift-git-command-that-does-not-exist",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Git command failed/);
  assert.match(result.stderr, /ENOENT|not found/i);
});

test("capture source preflight fails closed on a dirty worktree", t => {
  const { root, head } = createRepository(t);
  writeFileSync(join(root, "untracked-proof.txt"), "not committed\n");
  const result = runPreflight(root, { CAPTURE_EXPECTED_COMMIT: head });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Git worktree is dirty/);
  const report = JSON.parse(result.stderr);
  assert.equal(report.worktree.dirty, true);
  assert.ok(report.worktree.entries.some(entry => entry.includes("untracked-proof.txt")));
});

test("capture source preflight rejects a clean HEAD that differs from the declared release", t => {
  const { root, head: declared } = createRepository(t);
  writeFileSync(join(root, "README.md"), "# changed release\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "--quiet", "-m", "different head"]);
  const result = runPreflight(root, { CAPTURE_EXPECTED_COMMIT: declared });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not equal declared release commit/);
});

test("capture source preflight rejects declared source and runtime tree hash mismatches", t => {
  const { root, head } = createRepository(t);
  const result = runPreflight(root, {
    CAPTURE_EXPECTED_COMMIT: head,
    CAPTURE_EXPECTED_SOURCE_TREE: "0".repeat(40),
    CAPTURE_EXPECTED_RUNTIME_TREE: "0".repeat(40),
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not match CAPTURE_EXPECTED_SOURCE_TREE/);
  assert.match(result.stderr, /does not match CAPTURE_EXPECTED_RUNTIME_TREE/);
});
