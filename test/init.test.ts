import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SKILL_PATH } from "../src/init.js";
import { project, runCli, writeFile } from "./helpers.js";

describe("makedoc init", () => {
  it("adds the skill", () => {
    const result = runCli("init");

    expect(result.exitCode).toBe(0);
    const skill = readFileSync(join(project.root, SKILL_PATH), "utf8");
    expect(skill).toContain("!`makedoc collect`");
    expect(skill).toContain("allowed-tools: Bash(makedoc collect) Bash(makedoc check)");
  });

  it("does not overwrite a customized skill", () => {
    writeFile(SKILL_PATH, "my skill");

    const result = runCli("init");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already exists");
    expect(readFileSync(join(project.root, SKILL_PATH), "utf8")).toBe("my skill");
  });

  it("does not create anything else", () => {
    runCli("init");

    expect(existsSync(join(project.root, "docs"))).toBe(false);
    expect(existsSync(join(project.root, "README.md"))).toBe(false);
  });
});
