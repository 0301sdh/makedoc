import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_SKILL_PATH, SHARED_SKILL_PATH } from "../src/agents.js";
import { project, runCli, writeFile } from "./helpers.js";

const read = (path: string) => readFileSync(join(project.root, path), "utf8");
const exists = (path: string) => existsSync(join(project.root, path));

describe("makedoc init --agent claude", () => {
  it("adds a skill that runs makedoc collect", () => {
    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Connected to Claude Code");
    expect(result.stdout).toContain("Claude Code: /makedoc");
    const skill = read(CLAUDE_SKILL_PATH);
    expect(skill).toContain("!`makedoc collect`");
    expect(skill).toContain("allowed-tools: Bash(makedoc collect) Bash(makedoc check)");
    expect(exists(SHARED_SKILL_PATH)).toBe(false);
  });

  it("does not overwrite a customized skill", () => {
    writeFile(CLAUDE_SKILL_PATH, "my skill");

    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Already connected");
    expect(read(CLAUDE_SKILL_PATH)).toBe("my skill");
  });

  it("is safe to run twice", () => {
    runCli("init", "--agent", "claude");
    const before = read(CLAUDE_SKILL_PATH);

    const result = runCli("init", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Already connected to Claude Code");
    expect(read(CLAUDE_SKILL_PATH)).toBe(before);
  });

  it("does not create any docs", () => {
    runCli("init", "--agent", "claude");

    expect(exists("docs")).toBe(false);
    expect(exists("README.md")).toBe(false);
  });
});

describe.each([
  ["codex", "Codex", "$makedoc"],
  ["copilot", "Copilot CLI", "/makedoc"],
])("makedoc init --agent %s", (agent, name, invocation) => {
  it("adds the shared skill", () => {
    const result = runCli("init", "--agent", agent);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`${name}: ${invocation}`);
    const skill = read(SHARED_SKILL_PATH);
    expect(skill).toContain("name: makedoc");
    expect(skill).toContain('"makedoc collect"를 실행하고');
    expect(exists(CLAUDE_SKILL_PATH)).toBe(false);
  });

  it("does not overwrite a customized skill", () => {
    writeFile(SHARED_SKILL_PATH, "my skill");

    runCli("init", "--agent", agent);

    expect(read(SHARED_SKILL_PATH)).toBe("my skill");
  });
});

describe("makedoc init with several agents", () => {
  it("connects every agent and writes the shared skill once", () => {
    const result = runCli("init", "--agent", "codex", "--agent", "copilot", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Codex, Copilot CLI, Claude Code");
    expect(result.stdout.match(/\.agents\/skills/g)).toHaveLength(1);
    expect(exists(CLAUDE_SKILL_PATH)).toBe(true);
    expect(exists(SHARED_SKILL_PATH)).toBe(true);
  });

  it("ignores a repeated agent", () => {
    const result = runCli("init", "--agent", "claude", "--agent", "claude");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Connected to Claude Code.\n");
  });

  it("requires an agent", () => {
    const result = runCli("init");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("makedoc init --agent claude");
    expect(exists(".claude")).toBe(false);
    expect(exists(".agents")).toBe(false);
  });

  it("rejects an unknown agent", () => {
    const result = runCli("init", "--agent", "cursor", "--agent", "claude");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown agent: cursor");
    expect(result.stderr).toContain("Choose from: claude, codex, copilot");
    expect(exists(".claude")).toBe(false);
  });

  it("rejects --agent on other commands", () => {
    const result = runCli("collect", "--agent", "claude");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('--agent only works with "makedoc init"');
    expect(result.stdout).toBe("");
  });
});
