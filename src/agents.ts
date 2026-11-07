import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const AGENTS = ["claude", "codex", "copilot"] as const;
export type Agent = (typeof AGENTS)[number];

export const AGENT_NAMES: Record<Agent, string> = {
  claude: "Claude Code",
  codex: "Codex",
  copilot: "Copilot CLI",
};

export const CLAUDE_SKILL_PATH = join(".claude", "skills", "makedoc", "SKILL.md");
// Codex and Copilot CLI both read skills from .agents/skills.
export const SHARED_SKILL_PATH = join(".agents", "skills", "makedoc", "SKILL.md");

const SKILL_DESCRIPTION =
  "코드, 커밋, 작업 기록을 바탕으로 README, 아키텍처, 설계 결정, 변경 기록, 개발 환경 문서를 만들거나 최신으로 갱신한다. 사용자가 프로젝트 문서를 만들거나 갱신해 달라고 할 때 사용한다.";

// Claude Code runs the command before the model reads the skill.
const CLAUDE_SKILL = `---
description: ${SKILL_DESCRIPTION}
allowed-tools: Bash(makedoc collect) Bash(makedoc check)
---

!\`makedoc collect\`
`;

// Codex and Copilot CLI cannot run a command inside a skill, so the AI runs it.
const SHARED_SKILL = `---
name: makedoc
description: ${SKILL_DESCRIPTION}
---

"makedoc collect"를 실행하고, 출력된 자료와 작업 지시를 순서대로 따른다.
`;

export function isAgent(name: string): name is Agent {
  return (AGENTS as readonly string[]).includes(name);
}

interface PlannedWrite {
  path: string;
  content: string;
}

// Creates a file only when it is missing, so user edits are kept.
function planNewFile(path: string, content: string): PlannedWrite | undefined {
  return existsSync(path) ? undefined : { path, content };
}

function planAgent(projectRoot: string, agent: Agent): PlannedWrite | undefined {
  switch (agent) {
    case "claude":
      return planNewFile(join(projectRoot, CLAUDE_SKILL_PATH), CLAUDE_SKILL);
    case "codex":
    case "copilot":
      return planNewFile(join(projectRoot, SHARED_SKILL_PATH), SHARED_SKILL);
  }
}

// Returns the paths it wrote. Every file is planned first, so a shared skill is written once.
export function connectAgents(projectRoot: string, agents: readonly Agent[]): string[] {
  const writes = new Map<string, string>();
  for (const agent of agents) {
    const write = planAgent(projectRoot, agent);
    if (write !== undefined) {
      writes.set(write.path, write.content);
    }
  }
  for (const [path, content] of writes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return [...writes.keys()];
}
