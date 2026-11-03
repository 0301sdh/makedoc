// Splits Markdown into "## heading" sections, skipping code blocks and HTML comments.
export function parseSections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | undefined;
  let inFence = false;
  let inComment = false;

  for (const line of text.split(/\r?\n/)) {
    if (!inFence && line.includes("<!--")) {
      inComment = true;
    }
    if (inComment) {
      if (line.includes("-->")) {
        inComment = false;
      }
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
    }
    const heading = inFence ? null : /^##\s+(.+?)\s*$/.exec(line);
    const name = heading?.[1];
    if (name !== undefined) {
      current = sections.get(name) ?? [];
      sections.set(name, current);
    } else {
      current?.push(line);
    }
  }
  return sections;
}

export function listItems(lines: readonly string[]): string[] {
  return lines.flatMap((line) => {
    const item = /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1];
    return item === undefined ? [] : [item];
  });
}
