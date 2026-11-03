import { describe, expect, it } from "vitest";
import { MAX_FILES } from "../src/collect.js";
import { gitCommit, runCli, writeFile } from "./helpers.js";

const PACKAGE = JSON.stringify({
  name: "demo",
  version: "1.2.0",
  description: "A demo app",
  scripts: { build: "tsc", test: "vitest" },
});

describe("makedoc collect", () => {
  it("prints the steps, project info and files", () => {
    writeFile("package.json", PACKAGE);
    writeFile("src/app.ts", "");

    const { exitCode, stdout } = runCli("collect");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("makedoc check");
    expect(stdout).toContain("이름: demo");
    expect(stdout).toContain("npm 스크립트: build, test");
    expect(stdout).toContain("src/app.ts");
  });

  it("marks which documents exist", () => {
    writeFile("README.md", "# Demo");
    writeFile("CHANGELOG.md", "   ");

    const { stdout } = runCli("collect");

    expect(stdout).toContain("- README.md: 있음 (갱신)");
    expect(stdout).toContain("- CHANGELOG.md: 없음 (새로 작성)");
    expect(stdout).toContain("- docs/ARCHITECTURE.md: 없음 (새로 작성)");
  });

  it("works without package.json or Git", () => {
    writeFile("main.py", "");

    const { exitCode, stdout } = runCli("collect");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("package.json 없음");
    expect(stdout).toContain("Git 저장소가 아니다");
    expect(stdout).not.toContain("<handoff>");
  });

  it("skips hidden and generated folders outside Git", () => {
    writeFile("src/app.ts", "");
    writeFile("node_modules/lib/index.js", "");
    writeFile(".env", "SECRET=1");

    const { stdout } = runCli("collect");

    expect(stdout).toContain("src/app.ts");
    expect(stdout).not.toContain("node_modules");
    expect(stdout).not.toContain(".env");
  });

  it("lists commits and respects .gitignore in a Git project", () => {
    writeFile(".gitignore", "secret.txt\n");
    writeFile("secret.txt", "");
    writeFile("src/app.ts", "");
    gitCommit("Add the app");
    writeFile("src/new.ts", "");

    const { stdout } = runCli("collect");

    expect(stdout).toMatch(/[0-9a-f]+ \d{4}-\d{2}-\d{2} Add the app/);
    expect(stdout).toContain("src/new.ts");
    expect(stdout).not.toContain("secret.txt");
  });

  it("caps the file list", () => {
    for (let index = 0; index < MAX_FILES + 5; index += 1) {
      writeFile(`src/file${String(index).padStart(4, "0")}.ts`, "");
    }

    const { stdout } = runCli("collect");

    expect(stdout).toContain("... 외 5개");
  });

  it("includes decisions and work from handoff logs", () => {
    writeFile(
      ".handoff/logs/2026-11-03.md",
      "# 2026-11-03\n\n## 오늘 한 일\n- 로그인 구현\n\n## 결정한 것\n- JWT 사용: 서버를 단순하게\n- 없음\n\n## 주요 대화\n- Q: 비밀\n",
    );
    writeFile(".handoff/logs/notes.md", "## 결정한 것\n- ignored\n");

    const { stdout } = runCli("collect");

    expect(stdout).toContain("<handoff>");
    expect(stdout).toContain("- 2026-11-03 [결정한 것] JWT 사용: 서버를 단순하게");
    expect(stdout).toContain("- 2026-11-03 [오늘 한 일] 로그인 구현");
    expect(stdout).not.toContain("[결정한 것] 없음");
    expect(stdout).not.toContain("Q: 비밀");
    expect(stdout).not.toContain("ignored");
  });
});
