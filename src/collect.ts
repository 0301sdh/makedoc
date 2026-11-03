import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DOC_LIST } from "./docs.js";
import { readHandoffEntries } from "./handoff.js";
import { git, isGitRepo, listFiles, readPackage } from "./project.js";

export const MAX_FILES = 300;
export const MAX_COMMITS = 50;
export const MAX_HANDOFF_ENTRIES = 150;

const STEPS = `프로젝트 문서를 만들거나 최신으로 갱신한다. 아래 순서를 그대로 따른다.

1. 아래 재료를 보고, 필요한 소스 코드와 설정 파일을 직접 열어 확인한다.
2. 문서 목록의 각 문서를 만든다. 이미 있는 문서는 사람이 쓴 내용을 지우지 말고, 코드와 다른 부분만 고치고 빠진 부분을 채운다.
3. 근거가 없는 내용은 지어내지 않는다. 코드, 설정 파일, 커밋 메시지, 작업 기록에 적혀 있지 않은 이유나 계획은 추측하지 말고 "확인 필요"라고 적는다.
4. 설계 결정(DECISIONS.md)은 "## " 제목 하나에 결정 하나씩, 되돌리기 어려운 결정만 적는다. 결정마다 근거가 된 커밋 해시나 작업 기록 날짜(YYYY-MM-DD)를 적는다. 이유가 커밋 메시지나 작업 기록에 없으면 이유는 "확인 필요"라고 적는다.
   설치 방법은 package.json, 배포 설정, 기존 문서로 확인된 것만 쓴다. 패키지가 배포됐는지 확인할 수 없으면 저장소를 받아 빌드해 설치하는 방법을 쓴다.
5. API 문서와 DB 설계(ERD)는 만들지 않는다. 필요하면 DEVELOPMENT.md에 전용 도구(예: springdoc, DB 도구의 ERD 기능)를 안내한다.
6. 비밀번호, API 키 같은 비밀 값은 문서에 옮기지 않는다.
7. 문서 언어는 기존 문서를 따르고, 기존 문서가 없으면 사용자가 쓰는 언어로 쓴다.
8. "makedoc check"를 실행해 문제가 없을 때까지 고친다.
9. 만들거나 고친 문서와 "확인 필요"로 남긴 부분을 사용자에게 알린다.`;

function block(name: string, content: string): string {
  return `<${name}>\n${content.trimEnd()}\n</${name}>`;
}

function projectInfo(root: string): string {
  const info = readPackage(root);
  if (info === undefined) {
    return `이름: ${basename(root)}\npackage.json 없음. 다른 설정 파일(예: build.gradle, pyproject.toml)을 직접 확인한다.`;
  }
  return [
    `이름: ${info.name ?? basename(root)}`,
    `버전: ${info.version ?? "없음"}`,
    `설명: ${info.description ?? "없음"}`,
    `npm 스크립트: ${info.scripts.length > 0 ? info.scripts.join(", ") : "없음"}`,
  ].join("\n");
}

function fileList(files: readonly string[]): string {
  const shown = files.slice(0, MAX_FILES).join("\n");
  return files.length > MAX_FILES
    ? `${shown}\n... 외 ${String(files.length - MAX_FILES)}개`
    : shown;
}

function commitLog(root: string): string {
  if (!isGitRepo(root)) {
    return "Git 저장소가 아니다. 변경 기록은 작업 기록과 코드로만 판단한다.";
  }
  const log = git(root, [
    "log",
    `-${String(MAX_COMMITS)}`,
    "--date=short",
    "--format=%h %ad %s",
  ]);
  return log === undefined || log.trim() === "" ? "아직 커밋이 없다." : log;
}

function docStatus(root: string): string {
  return DOC_LIST.map((doc) => {
    const path = join(root, doc.path);
    const state =
      existsSync(path) && readFileSync(path, "utf8").trim() !== "" ? "있음 (갱신)" : "없음 (새로 작성)";
    return `- ${doc.path}: ${state}. ${doc.purpose}`;
  }).join("\n");
}

function handoffLog(root: string): string | undefined {
  const entries = readHandoffEntries(root);
  if (entries === undefined) {
    return undefined;
  }
  if (entries.length === 0) {
    return "작업 기록이 아직 없다.";
  }
  const recent = entries.slice(-MAX_HANDOFF_ENTRIES);
  const lines = recent.map((entry) => `- ${entry.date} [${entry.section}] ${entry.text}`);
  const note =
    entries.length > recent.length
      ? `\n이전 기록 ${String(entries.length - recent.length)}개는 .handoff/logs/에서 직접 읽는다.`
      : "";
  return `.handoff/spec.md에 목표가 있다. 아래는 날짜별 작업 기록의 결정과 한 일이다. 설계 결정의 이유는 여기서 찾는다.\n${lines.join("\n")}${note}`;
}

export function buildCollectPrompt(root: string): string {
  const files = listFiles(root);
  const blocks = [
    STEPS,
    block("documents", docStatus(root)),
    block("project", projectInfo(root)),
    block("files", fileList(files)),
    block("commits", commitLog(root)),
  ];
  const handoff = handoffLog(root);
  if (handoff !== undefined) {
    blocks.push(block("handoff", handoff));
  }
  return `${blocks.join("\n\n")}\n`;
}
