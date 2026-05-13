#!/usr/bin/env tsx
/**
 * Records PR review readiness as a proof artifact.
 *
 * This does not approve, merge, or mutate a pull request. It answers whether
 * the branch still needs a separate human review before merge.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Person = {
  login?: string;
  name?: string;
  type?: string;
};

type Review = {
  author?: Person;
  state?: string;
  submittedAt?: string;
  url?: string;
};

type CheckRollup = {
  __typename?: string;
  name?: string;
  context?: string;
  conclusion?: string;
  state?: string;
  status?: string;
  workflowName?: string;
  detailsUrl?: string;
};

type PullRequestView = {
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  isDraft?: boolean;
  author?: Person;
  headRefName?: string;
  headRefOid?: string;
  baseRefName?: string;
  mergeable?: string;
  reviewDecision?: string;
  reviewRequests?: Person[];
  reviews?: Review[];
  statusCheckRollup?: CheckRollup[];
};

const cwd = process.cwd();
const out = join(cwd, ".evidence", "pr-review-state.json");
const required = process.env.PR_REVIEW_REQUIRED === "1";
const inputPath = process.env.PR_REVIEW_STATE_INPUT;
const proofCommentHref = process.env.PR_REVIEW_PROOF_COMMENT_URL ?? process.env.PROOF_COMMENT_URL ?? null;
const prNumber = process.env.PR_REVIEW_NUMBER ?? process.env.GITHUB_PR_NUMBER ?? process.env.PULL_REQUEST_NUMBER ?? "";
const repo = process.env.PR_REVIEW_REPO ?? process.env.GITHUB_REPOSITORY ?? inferGithubRepo() ?? null;
const currentUser = process.env.PR_REVIEW_CURRENT_USER ?? process.env.GITHUB_ACTOR ?? currentGithubUser();

function commandPath(command: string): string | null {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], { cwd, encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function run(command: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function inferGithubRepo(): string | null {
  const result = run("git", ["config", "--get", "remote.origin.url"]);
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  const https = value.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return https?.[1] ?? null;
}

function currentGithubUser(): string | null {
  if (!commandPath("gh")) return null;
  const result = run("gh", ["api", "user", "--jq", ".login"]);
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function currentBranchName(): string | null {
  const result = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (result.status !== 0) return null;
  const branch = result.stdout.trim();
  return branch && branch !== "HEAD" ? branch : null;
}

function readPrView(): { pr: PullRequestView | null; source: string; error?: string } {
  if (inputPath) {
    try {
      return {
        pr: JSON.parse(readFileSync(join(cwd, inputPath), "utf-8")) as PullRequestView,
        source: inputPath,
      };
    } catch (error) {
      return { pr: null, source: inputPath, error: `Could not read PR review input: ${(error as Error).message}` };
    }
  }

  if (!commandPath("gh")) {
    return { pr: null, source: "gh", error: "GitHub CLI is not available on PATH." };
  }

  const fields = [
    "number",
    "title",
    "url",
    "state",
    "isDraft",
    "author",
    "headRefName",
    "headRefOid",
    "baseRefName",
    "mergeable",
    "reviewDecision",
    "reviewRequests",
    "reviews",
    "statusCheckRollup",
  ].join(",");
  const args = ["pr", "view"];
  const prSelector = prNumber || currentBranchName();
  if (prSelector) args.push(prSelector);
  if (repo && !prSelector) {
    return {
      pr: null,
      source: "gh pr view",
      error: "Could not infer a pull request number, URL, or branch for gh pr view.",
    };
  }
  if (repo) args.push("--repo", repo);
  args.push("--json", fields);
  const result = run("gh", args);
  if (result.status !== 0) {
    return { pr: null, source: `gh ${args.join(" ")}`, error: result.stderr.trim() || result.stdout.trim() || "gh pr view failed." };
  }
  try {
    return { pr: JSON.parse(result.stdout) as PullRequestView, source: `gh ${args.join(" ")}` };
  } catch (error) {
    return { pr: null, source: `gh ${args.join(" ")}`, error: `GitHub CLI returned invalid JSON: ${(error as Error).message}` };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function reviewLogin(review: Review): string {
  return review.author?.login ?? review.author?.name ?? "";
}

function normalizeState(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function checkState(item: CheckRollup): "success" | "skipped" | "failed" | "pending" | "unknown" {
  const conclusion = normalizeState(item.conclusion);
  const state = normalizeState(item.state);
  const status = normalizeState(item.status);
  if (conclusion === "SUCCESS" || state === "SUCCESS") return "success";
  if (conclusion === "SKIPPED") return "skipped";
  if (["FAILURE", "FAILED", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(conclusion) || ["FAILURE", "ERROR"].includes(state)) return "failed";
  if (["QUEUED", "IN_PROGRESS", "REQUESTED", "PENDING"].includes(status) || state === "PENDING") return "pending";
  return "unknown";
}

const { pr, source, error } = readPrView();
const reviews = pr?.reviews ?? [];
const requestedReviewers = unique((pr?.reviewRequests ?? []).map((person) => person.login ?? person.name ?? ""));
const authorLogin = pr?.author?.login ?? pr?.author?.name ?? null;
const approvedReviewers = unique(reviews.filter((review) => normalizeState(review.state) === "APPROVED").map(reviewLogin));
const separateApprovals = approvedReviewers.filter((login) => login && login !== authorLogin);
const authorApprovedOwnPr = Boolean(authorLogin && approvedReviewers.includes(authorLogin));
const changesRequested = unique(reviews.filter((review) => normalizeState(review.state) === "CHANGES_REQUESTED").map(reviewLogin));
const reviewDecision = normalizeState(pr?.reviewDecision);
const prState = normalizeState(pr?.state);
const checks = pr?.statusCheckRollup ?? [];
const checkSummary = checks.reduce((acc, item) => {
  acc[checkState(item)] += 1;
  return acc;
}, { success: 0, skipped: 0, failed: 0, pending: 0, unknown: 0 });

let status: "approved" | "review-required" | "changes-requested" | "draft" | "closed" | "unavailable";
if (!pr) status = "unavailable";
else if (pr.isDraft) status = "draft";
else if (prState && prState !== "OPEN") status = "closed";
else if (reviewDecision === "APPROVED" || separateApprovals.length > 0) status = "approved";
else if (reviewDecision === "CHANGES_REQUESTED" || changesRequested.length > 0) status = "changes-requested";
else status = "review-required";

const pass = status !== "unavailable" && (!required || status === "approved");
const currentAssignment = !pr
  ? "No pull request review state could be read."
  : requestedReviewers.length
    ? `Review requested from ${requestedReviewers.join(", ")}.`
    : "No reviewer is currently assigned or requested.";
const selfReviewStatus = authorApprovedOwnPr
  ? `${authorLogin} approved or verified their own PR, but a separate reviewer is still required for branch protection.`
  : currentUser && authorLogin && currentUser === authorLogin
    ? `${currentUser} is the PR author; self-approval cannot satisfy a separate-review gate.`
    : "No author self-approval was counted as separate review proof.";
const nextAction = status === "approved"
  ? "Separate reviewer approval is present. Continue merge/release gates."
  : status === "changes-requested"
    ? "Resolve requested changes, rerun proof, and request review again."
    : requestedReviewers.length
      ? `Review request is sent to ${requestedReviewers.join(", ")}. Wait for approval or follow up with the requested reviewer${requestedReviewers.length === 1 ? "" : "s"}.`
    : "Request a review from a separate GitHub user with write or review access.";

const payload = {
  runAt: new Date().toISOString(),
  pass,
  required,
  status,
  source,
  error: error ?? null,
  proofBoundary: "This artifact only records PR review readiness. It does not approve, merge, or release the pull request.",
  repo,
  currentUser,
  pr: pr ? {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    isDraft: pr.isDraft,
    author: authorLogin,
    headRefName: pr.headRefName,
    headRefOid: pr.headRefOid,
    baseRefName: pr.baseRefName,
    mergeable: pr.mergeable,
    reviewDecision: pr.reviewDecision,
  } : null,
  reviewerAssignment: {
    state: status,
    currentAssignment,
    requestedReviewers,
    approvedReviewers,
    separateApprovals,
    changesRequested,
    authorApprovedOwnPr,
    selfReviewStatus,
    proofCommentHref,
    nextAction,
  },
  checks: {
    total: checks.length,
    ...checkSummary,
    rollup: checks.map((item) => ({
      name: item.name ?? item.context ?? "unnamed check",
      workflowName: item.workflowName ?? null,
      state: checkState(item),
      conclusion: item.conclusion ?? item.state ?? item.status ?? null,
      detailsUrl: item.detailsUrl ?? null,
    })),
  },
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[pr-review-state] wrote ${out}`);
if (!pass) {
  console.error(`[pr-review-state] review state is ${status}; required=${required}`);
  process.exit(1);
}
