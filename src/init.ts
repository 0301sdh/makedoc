import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SKILL_PATH = join(".claude", "skills", "makedoc", "SKILL.md");

const SKILL_TEMPLATE = `---
description: 코드, 커밋, 작업 기록을 바탕으로 README, 아키텍처, 설계 결정, 변경 기록, 개발 환경 문서를 만들거나 최신으로 갱신한다. 사용자가 프로젝트 문서를 만들거나 갱신해 달라고 할 때 사용한다.
allowed-tools: Bash(makedoc collect) Bash(makedoc check)
---

!\`makedoc collect\`
`;

export type InitResult = { status: "created" | "exists"; path: string };

export function installSkill(root: string): InitResult {
  const path = join(root, SKILL_PATH);
  if (existsSync(path)) {
    return { status: "exists", path };
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, SKILL_TEMPLATE);
  return { status: "created", path };
}
