import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  "venv",
  "__pycache__",
]);

export interface PackageInfo {
  name: string | undefined;
  version: string | undefined;
  description: string | undefined;
  scripts: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function git(root: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync("git", [...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

export function isGitRepo(root: string): boolean {
  return git(root, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

function walk(root: string, relative: string): string[] {
  const entries = readdirSync(join(root, relative), { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith(".") && !IGNORED_DIRS.has(entry.name))
    .flatMap((entry) => {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        return walk(root, path);
      }
      return entry.isFile() ? [path] : [];
    });
}

// Lists project files, respecting .gitignore when the project uses Git.
export function listFiles(root: string): string[] {
  const output = isGitRepo(root)
    ? git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    : undefined;
  const files =
    output === undefined
      ? walk(root, "")
      : output.split("\0").filter((path) => path !== "" && existsSync(join(root, path)));
  return [...new Set(files)].sort();
}

// Top-level directories that the architecture document should describe.
export function topLevelDirs(files: readonly string[]): string[] {
  const dirs = files.flatMap((path) => {
    const [first, ...rest] = path.split("/");
    if (first === undefined || rest.length === 0) {
      return [];
    }
    return first.startsWith(".") || first === "docs" ? [] : [first];
  });
  return [...new Set(dirs)].sort();
}

export function readPackage(root: string): PackageInfo | undefined {
  const path = join(root, "package.json");
  if (!existsSync(path)) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const scripts = isRecord(parsed.scripts) ? Object.keys(parsed.scripts) : [];
  return {
    name: stringField(parsed, "name"),
    version: stringField(parsed, "version"),
    description: stringField(parsed, "description"),
    scripts,
  };
}
