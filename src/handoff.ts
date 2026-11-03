import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listItems, parseSections } from "./markdown.js";

// Sections of a handoff log that explain what changed and why.
const SECTIONS = ["결정한 것", "오늘 한 일"] as const;

export interface HandoffEntry {
  date: string;
  section: (typeof SECTIONS)[number];
  text: string;
}

// Reads work logs written by the handoff CLI, when the project has them.
export function readHandoffEntries(root: string): HandoffEntry[] | undefined {
  const logsPath = join(root, ".handoff", "logs");
  if (!existsSync(logsPath)) {
    return undefined;
  }

  const logs = readdirSync(logsPath)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
  return logs.flatMap((name) => {
    const date = name.slice(0, -".md".length);
    const sections = parseSections(readFileSync(join(logsPath, name), "utf8"));
    return SECTIONS.flatMap((section) =>
      listItems(sections.get(section) ?? [])
        // \b does not work with Korean, so look for the end or punctuation instead.
        .filter((text) => !/^없음(?=$|[\s(:.,])/.test(text))
        .map((text) => ({ date, section, text })),
    );
  });
}
