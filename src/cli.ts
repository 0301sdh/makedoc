import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseArgs } from "node:util";
import { AGENT_NAMES, AGENTS, type Agent, connectAgents, isAgent } from "./agents.js";
import { checkDocs } from "./check.js";
import { buildCollectPrompt } from "./collect.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const HELP = `makedoc: help AI write project docs from code, commits and work logs

Usage:
  makedoc <command> [options]

Commands:
  init            Add the makedoc skill to AI tools in this project
  collect         Print the materials and steps for the AI to write the docs
  check           Find missing or outdated parts of the docs

Options:
  --agent <name>  With init: connect an AI tool (${AGENTS.join(", ")}).
                  Repeat it to connect several. Safe to run again.
  -h, --help      Show this help
  -v, --version   Show the version
`;

const INVOCATIONS: Record<Agent, string> = {
  claude: "/makedoc",
  codex: "$makedoc",
  copilot: "/makedoc",
};

function readVersion(): string {
  const packageJson: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "version" in packageJson &&
    typeof packageJson.version === "string"
  ) {
    return packageJson.version;
  }
  throw new Error("package.json has no version");
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      agent: { type: "string", multiple: true },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runInit(root: string, io: Io, agents: readonly Agent[]): number {
  const names = agents.map((agent) => AGENT_NAMES[agent]).join(", ");
  let written: string[];
  try {
    written = connectAgents(root, agents);
  } catch (error) {
    io.stderr(`Could not connect to ${names}: ${errorMessage(error)}\n`);
    return 1;
  }

  if (written.length === 0) {
    io.stdout(`Already connected to ${names}, so nothing was changed.\n`);
    return 0;
  }
  const files = written.map((path) => `- ${relative(root, path)}`).join("\n");
  const usage = agents
    .map((agent) => `- ${AGENT_NAMES[agent]}: ${INVOCATIONS[agent]}`)
    .join("\n");
  io.stdout(
    `Connected to ${names}.\nWrote:\n${files}\nTo update the docs, run the skill or ask the AI to update them:\n${usage}\n`,
  );
  return 0;
}

function runCollect(root: string, io: Io): number {
  try {
    io.stdout(buildCollectPrompt(root));
  } catch (error) {
    io.stderr(`Could not collect the materials: ${errorMessage(error)}\n`);
    return 1;
  }
  return 0;
}

function runCheck(root: string, io: Io): number {
  let result: ReturnType<typeof checkDocs>;
  try {
    result = checkDocs(root);
  } catch (error) {
    io.stderr(`Could not check the docs: ${errorMessage(error)}\n`);
    return 1;
  }

  const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");
  if (result.warnings.length > 0) {
    io.stderr(
      `Warning: ${String(result.warnings.length)} document(s) may be outdated:\n${list(result.warnings)}\n`,
    );
  }
  if (result.problems.length > 0) {
    io.stderr(
      `Found ${String(result.problems.length)} problem(s):\n${list(result.problems)}\nFix these, then run "makedoc check" again.\n`,
    );
    return 1;
  }
  io.stdout("OK: all documents are present\n");
  return 0;
}

export function run(
  argv: readonly string[],
  io: Io,
  root: string = process.cwd(),
): number {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`${errorMessage(error)}\nRun "makedoc --help" to see the options.\n`);
    return 2;
  }

  if (parsed.values.help === true) {
    io.stdout(HELP);
    return 0;
  }

  if (parsed.values.version === true) {
    io.stdout(`${readVersion()}\n`);
    return 0;
  }

  const [command, ...extra] = parsed.positionals;
  if (command === undefined) {
    io.stdout(HELP);
    return 0;
  }

  const agentNames = parsed.values.agent ?? [];
  const agents = [...new Set(agentNames.filter(isAgent))];
  const handlers = new Map([
    ["init", (projectRoot: string, output: Io) => runInit(projectRoot, output, agents)],
    ["collect", runCollect],
    ["check", runCheck],
  ]);
  const handler = handlers.get(command);
  if (handler === undefined) {
    io.stderr(`Unknown command: ${command}\nRun "makedoc --help" to see the options.\n`);
    return 2;
  }

  if (extra.length > 0) {
    io.stderr(
      `"makedoc ${command}" takes no arguments, but got: ${extra.join(" ")}\nRun it inside the project directory.\n`,
    );
    return 2;
  }

  if (agentNames.length > 0 && command !== "init") {
    io.stderr(`--agent only works with "makedoc init".\n`);
    return 2;
  }

  const unknown = agentNames.filter((name) => !isAgent(name));
  if (unknown.length > 0) {
    io.stderr(`Unknown agent: ${unknown.join(", ")}\nChoose from: ${AGENTS.join(", ")}\n`);
    return 2;
  }

  if (command === "init" && agents.length === 0) {
    io.stderr(
      `Choose an AI tool to connect, for example "makedoc init --agent claude".\nChoose from: ${AGENTS.join(", ")}\n`,
    );
    return 2;
  }

  return handler(root, io);
}
