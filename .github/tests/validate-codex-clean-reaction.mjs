import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixtureUrl = new URL("./fixtures/pr-164-clean-reaction.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));
const workflowUrl = new URL(
  "../workflows/codex-clean-reaction-automerge.yml",
  import.meta.url,
);
const workflow = readFileSync(workflowUrl, "utf8");
const botLogin = "chatgpt-codex-connector[bot]";
const requiredChecks = ["build", "guest-e2e", "calendar-crud-e2e"];

function hasCurrentHeadCleanReaction(reviewPages, reactionPages, headSha) {
  const reviews = reviewPages.flat().filter((review) =>
    review.user?.login === botLogin &&
    review.commit_id === headSha &&
    Number.isFinite(Date.parse(review.submitted_at))
  );
  if (reviews.length === 0) return false;

  const latestReviewAt = Math.max(
    ...reviews.map((review) => Date.parse(review.submitted_at)),
  );
  return reactionPages.flat().some((reaction) =>
    reaction.user?.login === botLogin &&
    reaction.content === "+1" &&
    Date.parse(reaction.created_at) > latestReviewAt
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

function changedFilesAllowAutoMerge({ api_ok: apiOk, pages }) {
  if (!apiOk || !Array.isArray(pages)) return false;
  if (!pages.every((page) => Array.isArray(page))) return false;

  const files = pages.flat();
  if (
    files.length === 0 ||
    !files.every((file) =>
      file !== null &&
      typeof file === "object" &&
      typeof file.filename === "string"
    )
  ) return false;

  return !files.some((file) =>
    file.filename.startsWith(".github/workflows/")
  );
}

assert.equal(
  fixture.sources.reaction,
  "GET /repos/yoobilee/worky/issues/164/reactions",
);
assert.equal(
  fixture.sources.review,
  "GET /repos/yoobilee/worky/pulls/165/reviews",
);
assert.equal(
  fixture.observed_api.pr_164_reaction.user.login,
  botLogin,
  "PR #164 reaction must confirm the Codex bot login",
);
assert.equal(
  fixture.observed_api.pr_165_review.user.login,
  botLogin,
  "PR #165 review must confirm the same Codex bot login",
);
assert.match(fixture.observed_api.pr_165_review.commit_id, /^[0-9a-f]{40}$/);
assert.equal(
  Number.isFinite(Date.parse(fixture.observed_api.pr_165_review.submitted_at)),
  true,
  "PR #165 review must include submitted_at",
);

const fresh = fixture.scenarios.fresh_current_head;
assert.equal(
  hasCurrentHeadCleanReaction(
    fresh.reviews_pages,
    fresh.reactions_pages,
    fresh.head_sha,
  ),
  true,
  "a reaction after an exact-head review must pass across paginated responses",
);
const reactionAtReviewTime = structuredClone(fresh.reactions_pages);
reactionAtReviewTime[1][0].created_at = fresh.reviews_pages[1][0].submitted_at;
assert.equal(
  hasCurrentHeadCleanReaction(
    fresh.reviews_pages,
    reactionAtReviewTime,
    fresh.head_sha,
  ),
  false,
  "a clean reaction must be strictly later than the current-head review",
);

const replacement = fixture.scenarios.older_timestamp_replacement_head;
const replacementReactionAt = replacement.reactions_pages[0][0].created_at;
assert.equal(
  Date.parse(replacementReactionAt) > Date.parse(replacement.head_committed_at),
  true,
  "the old commit-date rule would incorrectly accept this stale reaction",
);
assert.equal(
  hasCurrentHeadCleanReaction(
    replacement.reviews_pages,
    replacement.reactions_pages,
    replacement.head_sha,
  ),
  false,
  "an older-timestamp replacement head without its own Codex review must be rejected",
);
assert.equal(
  requiredChecksPassed(fixture.check_runs, fresh.head_sha),
  true,
  "all required check-run shapes must pass for the current head",
);

const pendingChecks = structuredClone(fixture.check_runs);
pendingChecks.find((check) => check.name === "guest-e2e").status = "in_progress";
pendingChecks.find((check) => check.name === "guest-e2e").conclusion = null;
assert.equal(
  requiredChecksPassed(pendingChecks, fresh.head_sha),
  false,
  "a pending required check must block merge",
);
assert.equal(
  requiredChecksPassed(fixture.check_runs, "0000000000000000000000000000000000000000"),
  false,
  "checks from a different head must be rejected",
);

assert.equal(
  changedFilesAllowAutoMerge(fixture.changed_files_scenarios.workflow_change),
  false,
  "a workflow change on a later API page must require manual merge",
);
assert.equal(
  changedFilesAllowAutoMerge(fixture.changed_files_scenarios.regular_change),
  true,
  "ordinary changed files must remain eligible for auto-merge",
);
assert.equal(
  changedFilesAllowAutoMerge(fixture.changed_files_scenarios.lookup_failure),
  false,
  "a changed-files API failure must fail closed",
);
assert.equal(
  changedFilesAllowAutoMerge(fixture.changed_files_scenarios.parse_failure),
  false,
  "an invalid changed-files response must fail closed",
);

assert.match(
  workflow,
  /REVIEWS=\$\(gh api --paginate[\s\S]*?pulls\/\$PR_NUMBER\/reviews\?per_page=100/,
  "the reviews API must be fully paginated",
);
assert.match(
  workflow,
  /REACTIONS=\$\(gh api --paginate[\s\S]*?issues\/\$PR_NUMBER\/reactions\?per_page=100/,
  "the reactions API must be fully paginated",
);
assert.match(
  workflow,
  /FILES_PAGES=\$\(gh api --paginate --slurp[\s\S]*?pulls\/\$PR_NUMBER\/files\?per_page=100/,
  "the changed-files API must be fully paginated and slurped for validation",
);
assert.match(
  workflow,
  /startswith\("\.github\/workflows\/"\)/,
  "workflow changes must be detected before auto-merge",
);
assert.doesNotMatch(
  workflow,
  /HEAD_COMMITTED_AT|HEAD_COMMITTED_EPOCH|"repos\/\$REPO\/commits\/\$HEAD_SHA"/,
  "commit creation time must not authorize a clean reaction",
);
assert.match(workflow, /--match-head-commit "\$HEAD_SHA"/);

console.log("PASS: clean reaction gates, changed-file fail-closed gate, and checks");
