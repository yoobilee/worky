import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixtureUrl = new URL("./fixtures/pr-164-clean-reaction.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));
const botLogin = "chatgpt-codex-connector[bot]";
const requiredChecks = ["build", "guest-e2e", "calendar-crud-e2e"];

function hasFreshCleanReaction(reactions, committedAt) {
  const committed = Date.parse(committedAt);
  return reactions.some((reaction) =>
    reaction.user?.login === botLogin &&
    reaction.content === "+1" &&
    Date.parse(reaction.created_at) > committed
  );
}

function requiredChecksPassed(checkRuns, headSha) {
  return requiredChecks.every((name) => {
    const matches = checkRuns.filter((check) =>
      check.name === name &&
      check.head_sha === headSha &&
      check.app?.slug === "github-actions"
    );
    const latest = matches.at(-1);
    return latest?.status === "completed" && latest.conclusion === "success";
  });
}

assert.equal(fixture.source, "GET /repos/yoobilee/worky/issues/164/reactions");
assert.equal(
  hasFreshCleanReaction(fixture.reactions, fixture.head_commit.committed_at),
  true,
  "PR #164's observed Codex +1 must be newer than its head commit",
);
assert.equal(
  hasFreshCleanReaction(fixture.reactions, "2026-09-08T05:08:00Z"),
  false,
  "a reaction from before a replacement head must be rejected",
);
assert.equal(
  requiredChecksPassed(fixture.check_runs, fixture.head_commit.sha),
  true,
  "all required PR #164 check-run shapes must pass",
);

const pendingChecks = structuredClone(fixture.check_runs);
pendingChecks.find((check) => check.name === "guest-e2e").status = "in_progress";
pendingChecks.find((check) => check.name === "guest-e2e").conclusion = null;
assert.equal(
  requiredChecksPassed(pendingChecks, fixture.head_commit.sha),
  false,
  "a pending required check must block merge",
);
assert.equal(
  requiredChecksPassed(fixture.check_runs, "0000000000000000000000000000000000000000"),
  false,
  "checks from a different head must be rejected",
);

console.log("PASS: PR #164 reaction and check-run fixture");
