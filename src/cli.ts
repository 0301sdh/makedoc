import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkDocs } from "./check.js";
import { buildCollectPrompt } from "./collect.js";
import { installSkill } from "./init.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const HELP = `makedoc: help AI write project docs from code, commits and work logs

Usage:
  makedoc <command> [options]

Commands:
  init           Add the /makedoc skill to Claude Code in this project
  collect        Print the materials and steps for the AI to write the docs
  check          Find missing or outdated parts of the docs

Options:
  -h, --help     Show this help
  -v, --version  Show the version
`;

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
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runInit(root: string, io: Io): number {
  let result: ReturnType<typeof installSkill>;
  try {
    result = installSkill(root);
  } catch (error) {
    io.stderr(`Could not add the skill: ${errorMessage(error)}\n`);
    return 1;
  }

  io.stdout(
    result.status === "created"
      ? `Created ${result.path}\nIn Claude Code, run /makedoc or ask Claude to update the docs.\n`
      : `${result.path} already exists, so nothing was changed.\n`,
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

  const handlers = new Map([
    ["init", runInit],
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

  return handler(root, io);
}
