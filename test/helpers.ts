import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { run } from "../src/cli.js";

export const project = { root: "" };

beforeEach(() => {
  project.root = mkdtempSync(join(tmpdir(), "makedoc-test-"));
});

afterEach(() => {
  rmSync(project.root, { recursive: true, force: true });
});

export function runCli(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = run(
    argv,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    project.root,
  );
  return { exitCode, stdout, stderr };
}

export function writeFile(path: string, content: string) {
  const fullPath = join(project.root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

export function gitCommit(message: string, date?: string) {
  const env = date === undefined ? process.env : { ...process.env, GIT_COMMITTER_DATE: date };
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
      cwd: project.root,
      stdio: "ignore",
      env,
    });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "--allow-empty", "-m", message);
}
