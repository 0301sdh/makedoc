import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOCS, DOC_LIST } from "./docs.js";
import { parseSections } from "./markdown.js";
import { git, isGitRepo, listFiles, readPackage, topLevelDirs } from "./project.js";

export interface CheckResult {
  problems: string[];
  warnings: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\w-])${escapeRegExp(word)}([^\\w-]|$)`, "m").test(text);
}

function mentionsScript(text: string, script: string): boolean {
  const name = escapeRegExp(script);
  return new RegExp(`\\b(npm|pnpm|yarn|bun)(\\s+run)?\\s+${name}(?![\\w:-])`).test(text);
}

function readDoc(root: string, path: string): string | undefined {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
}

// The time of the latest commit that changed anything other than the docs.
function lastCodeCommitTime(root: string): number | undefined {
  const excluded = [...DOC_LIST.map((doc) => doc.path), "docs", ".handoff"].map(
    (path) => `:(exclude)${path}`,
  );
  const output = git(root, ["log", "-1", "--format=%ct", "--", ".", ...excluded]);
  const seconds = Number(output?.trim());
  return output === undefined || output.trim() === "" || Number.isNaN(seconds)
    ? undefined
    : seconds * 1000;
}

export function checkDocs(root: string): CheckResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  const texts = new Map<string, string>();
  for (const doc of DOC_LIST) {
    const text = readDoc(root, doc.path);
    if (text === undefined) {
      problems.push(`Missing document: ${doc.path}`);
    } else if (text.trim() === "") {
      problems.push(`Empty document: ${doc.path}`);
    } else {
      texts.set(doc.path, text);
    }
  }

  const architecture = texts.get(DOCS.architecture.path);
  if (architecture !== undefined) {
    for (const dir of topLevelDirs(listFiles(root))) {
      if (!mentions(architecture, dir)) {
        problems.push(`${DOCS.architecture.path} does not describe the directory: ${dir}/`);
      }
    }
  }

  const decisions = texts.get(DOCS.decisions.path);
  if (decisions !== undefined) {
    for (const [title, lines] of parseSections(decisions)) {
      if (!/\b[0-9a-f]{7,40}\b|\d{4}-\d{2}-\d{2}/.test(lines.join("\n"))) {
        problems.push(
          `${DOCS.decisions.path} has no source (a commit hash or YYYY-MM-DD date) for: ${title}`,
        );
      }
    }
  }

  const info = readPackage(root);
  const development = texts.get(DOCS.development.path);
  if (development !== undefined && info !== undefined) {
    for (const script of info.scripts) {
      if (!mentionsScript(development, script)) {
        problems.push(
          `${DOCS.development.path} does not explain the npm script: ${script} (write it as "npm run ${script}")`,
        );
      }
    }
  }

  const changelog = texts.get(DOCS.changelog.path);
  if (
    changelog !== undefined &&
    info?.version !== undefined &&
    !changelog.includes(info.version) &&
    !/unreleased/i.test(changelog)
  ) {
    problems.push(
      `${DOCS.changelog.path} has neither the current version ${info.version} nor an Unreleased section`,
    );
  }

  const codeTime = isGitRepo(root) ? lastCodeCommitTime(root) : undefined;
  if (codeTime !== undefined) {
    for (const path of texts.keys()) {
      if (statSync(join(root, path)).mtimeMs < codeTime) {
        warnings.push(`May be outdated: ${path} was last edited before the latest code commit`);
      }
    }
  }

  return { problems, warnings };
}
