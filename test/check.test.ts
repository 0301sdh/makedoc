import { utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gitCommit, project, runCli, writeFile } from "./helpers.js";

function writeValidDocs() {
  writeFile("package.json", JSON.stringify({ version: "1.2.0", scripts: { build: "tsc", test: "vitest" } }));
  writeFile("src/app.ts", "");
  writeFile("test/app.test.ts", "");
  writeFile("README.md", "# Demo");
  writeFile("docs/ARCHITECTURE.md", "- `src/`: app\n- `test/`: tests\n");
  writeFile("docs/DECISIONS.md", "# Decisions");
  writeFile("CHANGELOG.md", "## [1.2.0]\n- first");
  writeFile("docs/DEVELOPMENT.md", "Run `npm run build` and `npm test`.");
}

describe("makedoc check", () => {
  it("passes complete docs", () => {
    writeValidDocs();

    const result = runCli("check");

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("reports missing and empty documents", () => {
    writeFile("README.md", "  \n");

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Empty document: README.md");
    expect(result.stderr).toContain("Missing document: docs/ARCHITECTURE.md");
    expect(result.stderr).toContain("Missing document: CHANGELOG.md");
  });

  it("reports a directory the architecture does not describe", () => {
    writeValidDocs();
    writeFile("scripts/release.sh", "");

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not describe the directory: scripts/");
  });

  it("does not count a directory name inside another word", () => {
    writeValidDocs();
    writeFile("docs/ARCHITECTURE.md", "- `test/`: tests\n- resources");

    const result = runCli("check");

    expect(result.stderr).toContain("does not describe the directory: src/");
  });

  it("reports an npm script the development guide does not explain", () => {
    writeValidDocs();
    writeFile("docs/DEVELOPMENT.md", "Run `npm run build`. Tests use vitest.");

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not explain the npm script: test");
    expect(result.stderr).not.toContain("npm script: build");
  });

  it("does not treat build:watch as build", () => {
    writeValidDocs();
    writeFile("docs/DEVELOPMENT.md", "Run `npm run build:watch` and `npm test`.");

    expect(runCli("check").stderr).toContain("npm script: build ");
  });

  it("accepts an Unreleased section instead of the version", () => {
    writeValidDocs();
    writeFile("CHANGELOG.md", "## [Unreleased]\n- wip");

    expect(runCli("check").exitCode).toBe(0);
  });

  it("reports a changelog without the version or Unreleased", () => {
    writeValidDocs();
    writeFile("CHANGELOG.md", "## [1.1.0]\n- old");

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("neither the current version 1.2.0");
  });

  it("warns about docs edited before the latest code commit", () => {
    writeValidDocs();
    gitCommit("Add the app");
    const old = new Date("2000-01-01");
    utimesSync(join(project.root, "docs/ARCHITECTURE.md"), old, old);

    const result = runCli("check");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("May be outdated: docs/ARCHITECTURE.md");
    expect(result.stderr).not.toContain("May be outdated: README.md");
  });

  it("ignores commits that only change the docs", () => {
    writeValidDocs();
    gitCommit("Add the app", "2001-01-01T00:00:00Z");
    const editedAt = new Date("2002-01-01");
    for (const path of ["README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md", "docs/DECISIONS.md", "docs/DEVELOPMENT.md"]) {
      utimesSync(join(project.root, path), editedAt, editedAt);
    }
    writeFile("docs/DECISIONS.md", "# Decisions\n- more");
    utimesSync(join(project.root, "docs/DECISIONS.md"), editedAt, editedAt);
    gitCommit("Update the docs", "2003-01-01T00:00:00Z");

    const result = runCli("check");

    expect(result.stderr).toBe("");
  });
});

describe("makedoc check for decisions", () => {
  it("accepts decisions with a commit hash or a date", () => {
    writeValidDocs();
    writeFile(
      "docs/DECISIONS.md",
      "# Decisions\n\n## Use JWT\n- 근거: a4fcb1e\n\n## Use Markdown logs\n- 근거: 2026-11-03 작업 기록\n",
    );

    expect(runCli("check").exitCode).toBe(0);
  });

  it("reports a decision without a source", () => {
    writeValidDocs();
    writeFile("docs/DECISIONS.md", "# Decisions\n\n## Use JWT\n- 이유: 확인 필요\n");

    const result = runCli("check");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("has no source (a commit hash or YYYY-MM-DD date) for: Use JWT");
  });
});
