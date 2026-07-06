import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = "D:\\FloorAgent\\warehouse-conversation-extract";

const CANDIDATE_DIRS = [
  "C:\\Users\\NeverAMoment\\.claude",
  "C:\\Users\\NeverAMoment\\.codex",
  "C:\\Users\\NeverAMoment\\.copilot",
  "C:\\Users\\craig\\.copilot",
  "C:\\Users\\NeverAMoment\\flooragent\\.claude",
  "D:\\craig-CODA\\.claude",
  "D:\\craig-CODA\\agent\\.claude",
  "D:\\Model-Lab\\.claude",
  "E:\\warehouse-agent\\.claude",
  "F:\\.claude",
  "F:\\flooragent\\.claude",
  "F:\\warehouse-agent\\.claude",
  "F:\\warehouse-agent-material-first\\.claude",
  "G:\\warehouse-agent\\.claude",
];

const PATH_HINTS = [
  "warehouse",
  "warehouse-agent",
  "warehouse-optimizer",
  "optimizer",
  "flooragent",
  "the-floor-beta",
  "floor beta",
  "plastipak",
];

const CONTENT_HINTS = [
  "warehouse",
  "consolidat",
  "putaway",
  "side bin",
  "r-bin",
  "sap",
  "pallet",
  "wh1",
  "wh3",
  "floor beta",
  "bin map",
  "material-first",
  "warehouse optimizer",
  "flooragent",
];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function* walkFiles(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function toIso(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function flattenText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const item of content) {
      if (!item) continue;
      if (typeof item === "string") {
        parts.push(item);
        continue;
      }
      if (item.type === "text" || item.type === "input_text" || item.type === "output_text") {
        if (item.text) parts.push(item.text);
        continue;
      }
      if (item.type === "tool_use" && item.name) {
        parts.push(`[Tool use: ${item.name}]`);
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

function cleanCopilotUserText(text) {
  if (!text) return "";
  return text
    .replace(/<current_datetime>[\s\S]*?<\/current_datetime>\s*/gi, "")
    .replace(/<reminder>[\s\S]*?<\/reminder>\s*/gi, "")
    .trim();
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function collectMatches(text, hints) {
  const haystack = lower(text);
  return hints.filter((hint) => haystack.includes(hint));
}

function scoreSession(session) {
  const pathText = [session.project, session.cwd, session.workspace].filter(Boolean).join(" ");
  const allText = session.messages.map((msg) => msg.text).join("\n");
  const pathMatches = collectMatches(pathText, PATH_HINTS);
  const contentMatches = collectMatches(allText, CONTENT_HINTS);
  return {
    pathMatches,
    contentMatches,
    relevant: pathMatches.length > 0 || contentMatches.length > 0,
  };
}

function sortMessages(messages) {
  return [...messages].sort((a, b) => {
    const aTime = a.timestamp || "";
    const bTime = b.timestamp || "";
    return aTime.localeCompare(bTime);
  });
}

async function readJsonl(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJsonLine)
    .filter(Boolean);
}

async function extractClaudeHistory(filePath) {
  const rows = await readJsonl(filePath);
  const sessions = new Map();

  for (const row of rows) {
    const sessionId = row.sessionId || `claude-history-${row.timestamp}`;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        source: "claude-history",
        sessionId,
        cwd: row.project || "",
        project: row.project || "",
        workspace: "",
        transcriptCompleteness: "prompt-only",
        messages: [],
        sourceFiles: new Set([filePath]),
      });
    }
    const session = sessions.get(sessionId);
    session.messages.push({
      role: "user",
      timestamp: toIso(row.timestamp),
      text: row.display || "",
    });
  }

  return [...sessions.values()];
}

async function extractClaudeProjects(projectRoot) {
  const sessions = [];
  for await (const filePath of walkFiles(projectRoot)) {
    if (!filePath.endsWith(".jsonl")) continue;
    if (filePath.includes(`${path.sep}subagents${path.sep}`)) continue;

    const rows = await readJsonl(filePath);
    const messages = [];
    let sessionId = null;
    let cwd = "";

    for (const row of rows) {
      if (!sessionId && row.sessionId) sessionId = row.sessionId;
      if (!cwd && row.cwd) cwd = row.cwd;

      if (row.type === "user" && row.message?.role === "user") {
        messages.push({
          role: "user",
          timestamp: toIso(row.timestamp),
          text: flattenText(row.message.content),
        });
        continue;
      }

      if (row.type === "assistant" && row.message?.role === "assistant") {
        const text = flattenText(row.message.content);
        if (text) {
          messages.push({
            role: "assistant",
            timestamp: toIso(row.timestamp),
            text,
          });
        }
      }
    }

    if (!messages.length) continue;
    sessions.push({
      source: "claude-project",
      sessionId: sessionId || path.basename(filePath, ".jsonl"),
      cwd,
      project: cwd,
      workspace: "",
      transcriptCompleteness: "full",
      messages,
      sourceFiles: new Set([filePath]),
    });
  }
  return sessions;
}

async function extractCodexHistory(filePath) {
  const rows = await readJsonl(filePath);
  const sessions = new Map();

  for (const row of rows) {
    const sessionId = row.session_id || `codex-history-${row.ts}`;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        source: "codex-history",
        sessionId,
        cwd: "",
        project: "",
        workspace: "",
        transcriptCompleteness: "prompt-only",
        messages: [],
        sourceFiles: new Set([filePath]),
      });
    }
    const session = sessions.get(sessionId);
    session.messages.push({
      role: "user",
      timestamp: toIso(row.ts),
      text: row.text || "",
    });
  }

  return [...sessions.values()];
}

async function extractCodexSessions(sessionRoot) {
  const sessions = [];
  for await (const filePath of walkFiles(sessionRoot)) {
    if (!filePath.endsWith(".jsonl")) continue;
    if (!path.basename(filePath).startsWith("rollout-")) continue;

    const rows = await readJsonl(filePath);
    const messages = [];
    let sessionId = null;
    let cwd = "";

    for (const row of rows) {
      if (row.type === "session_meta") {
        sessionId = row.payload?.id || sessionId;
        cwd = row.payload?.cwd || cwd;
        continue;
      }

      if (row.type !== "response_item") continue;
      const payload = row.payload || {};
      if (payload.type !== "message") continue;
      const role = payload.role;
      if (role !== "user" && role !== "assistant") continue;
      const text = flattenText(payload.content);
      if (!text) continue;
      messages.push({
        role,
        timestamp: toIso(row.timestamp),
        text,
      });
    }

    if (!messages.length) continue;
    sessions.push({
      source: "codex-session",
      sessionId: sessionId || path.basename(filePath, ".jsonl"),
      cwd,
      project: cwd,
      workspace: "",
      transcriptCompleteness: "full",
      messages,
      sourceFiles: new Set([filePath]),
    });
  }
  return sessions;
}

async function extractCopilotSessions(copilotRoot) {
  const sessionState = path.join(copilotRoot, "session-state");
  if (!(await exists(sessionState))) return [];

  const sessions = [];
  for await (const filePath of walkFiles(sessionState)) {
    if (path.basename(filePath) !== "events.jsonl") continue;

    const rows = await readJsonl(filePath);
    const messages = [];
    let sessionId = path.basename(path.dirname(filePath));
    let cwd = "";

    for (const row of rows) {
      if (row.type === "session.start") {
        sessionId = row.data?.sessionId || sessionId;
        cwd = row.data?.context?.cwd || cwd;
        continue;
      }

      if (row.type === "user.message") {
        const text = cleanCopilotUserText(row.data?.content || row.data?.transformedContent || "");
        if (text) {
          messages.push({
            role: "user",
            timestamp: toIso(row.timestamp),
            text,
          });
        }
        continue;
      }

      if (row.type === "assistant.message") {
        const text = (row.data?.content || "").trim();
        if (text) {
          messages.push({
            role: "assistant",
            timestamp: toIso(row.timestamp),
            text,
          });
        }
      }
    }

    if (!messages.length) continue;
    sessions.push({
      source: "copilot-session",
      sessionId,
      cwd,
      project: cwd,
      workspace: "",
      transcriptCompleteness: "full",
      messages,
      sourceFiles: new Set([filePath]),
    });
  }
  return sessions;
}

function mergeSessions(sessions) {
  const merged = new Map();

  for (const session of sessions) {
    const provider = session.source.startsWith("claude")
      ? "claude"
      : session.source.startsWith("codex")
      ? "codex"
      : session.source.startsWith("copilot")
      ? "copilot"
      : session.source;
    const key = `${provider}:${session.sessionId}`;
    if (!merged.has(key)) {
      merged.set(key, {
        ...session,
        messages: [...session.messages],
        sourceFiles: new Set(session.sourceFiles),
      });
      continue;
    }

    const existing = merged.get(key);
    existing.messages.push(...session.messages);
    for (const filePath of session.sourceFiles) existing.sourceFiles.add(filePath);
    if (!existing.cwd && session.cwd) existing.cwd = session.cwd;
    if (!existing.project && session.project) existing.project = session.project;
    if (existing.transcriptCompleteness !== "full" && session.transcriptCompleteness === "full") {
      existing.transcriptCompleteness = "full";
      existing.source = session.source;
    }
  }

  return [...merged.values()].map((session) => ({
    ...session,
    messages: sortMessages(session.messages.filter((msg) => msg.text && msg.timestamp)),
    sourceFiles: [...session.sourceFiles].sort(),
  }));
}

function renderSessionFile(index, session, relevance) {
  const started = session.messages[0]?.timestamp || "";
  const ended = session.messages[session.messages.length - 1]?.timestamp || "";
  const lines = [
    `# Conversation ${index}`,
    "",
    `- Source: ${session.source}`,
    `- Session ID: ${session.sessionId}`,
    `- Started: ${started}`,
    `- Ended: ${ended}`,
    `- Project/CWD: ${session.project || session.cwd || "(none recorded)"}`,
    `- Transcript completeness: ${session.transcriptCompleteness}`,
    `- Relevance path matches: ${relevance.pathMatches.length ? relevance.pathMatches.join(", ") : "(none)"}`,
    `- Relevance content matches: ${relevance.contentMatches.length ? relevance.contentMatches.join(", ") : "(none)"}`,
    `- Source files:`,
    ...session.sourceFiles.map((filePath) => `  - ${filePath}`),
    "",
    "## Transcript",
    "",
  ];

  for (const message of session.messages) {
    lines.push(`### ${message.role === "user" ? "User" : "Assistant"} - ${message.timestamp}`);
    lines.push("");
    lines.push(message.text);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function renderIndexFile(sessions) {
  const lines = [
    "# Warehouse Conversation Extract",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Conversation count: ${sessions.length}`,
    "",
    "## Files",
    "",
  ];

  sessions.forEach((session, idx) => {
    const started = session.messages[0]?.timestamp || "";
    lines.push(`${idx + 1}. \`${idx + 1}.md\` - ${started} - ${session.source} - ${session.project || session.cwd || "(none recorded)"}`);
  });

  lines.push("");
  return lines.join("\n");
}

function renderMasterTimeline(sessions) {
  const lines = [
    "# Warehouse Conversation Master Timeline",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Conversation count: ${sessions.length}`,
    "",
  ];

  sessions.forEach((session, idx) => {
    const started = session.messages[0]?.timestamp || "";
    const ended = session.messages[session.messages.length - 1]?.timestamp || "";
    lines.push(`## Conversation ${idx + 1}`);
    lines.push("");
    lines.push(`- Source: ${session.source}`);
    lines.push(`- Session ID: ${session.sessionId}`);
    lines.push(`- Started: ${started}`);
    lines.push(`- Ended: ${ended}`);
    lines.push(`- Project/CWD: ${session.project || session.cwd || "(none recorded)"}`);
    lines.push(`- Transcript completeness: ${session.transcriptCompleteness}`);
    lines.push("");
    lines.push(`Reference file: \`${idx + 1}.md\``);
    lines.push("");
    lines.push("### Transcript");
    lines.push("");

    for (const message of session.messages) {
      lines.push(`#### ${message.role === "user" ? "User" : "Assistant"} - ${message.timestamp}`);
      lines.push("");
      lines.push(message.text);
      lines.push("");
    }
  });

  return lines.join("\n").trimEnd() + "\n";
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const entry of await fs.readdir(OUTPUT_DIR, { withFileTypes: true })) {
    const target = path.join(OUTPUT_DIR, entry.name);
    await fs.rm(target, { recursive: true, force: true });
  }

  const discovered = [];
  for (const candidate of CANDIDATE_DIRS) {
    if (await exists(candidate)) discovered.push(candidate);
  }

  let sessions = [];

  for (const dirPath of discovered) {
    const base = path.basename(dirPath).toLowerCase();

    if (base === ".claude") {
      const historyFile = path.join(dirPath, "history.jsonl");
      if (await exists(historyFile)) {
        sessions.push(...(await extractClaudeHistory(historyFile)));
      }

      const projectsDir = path.join(dirPath, "projects");
      if (await exists(projectsDir)) {
        sessions.push(...(await extractClaudeProjects(projectsDir)));
      }
      continue;
    }

    if (base === ".codex") {
      const historyFile = path.join(dirPath, "history.jsonl");
      if (await exists(historyFile)) {
        sessions.push(...(await extractCodexHistory(historyFile)));
      }

      const sessionDir = path.join(dirPath, "sessions");
      if (await exists(sessionDir)) {
        sessions.push(...(await extractCodexSessions(sessionDir)));
      }
      continue;
    }

    if (base === ".copilot") {
      sessions.push(...(await extractCopilotSessions(dirPath)));
    }
  }

  sessions = mergeSessions(sessions)
    .map((session) => ({ session, relevance: scoreSession(session) }))
    .filter(({ session, relevance }) => relevance.relevant && session.messages.length > 0)
    .sort((a, b) => {
      const aStart = a.session.messages[0]?.timestamp || "";
      const bStart = b.session.messages[0]?.timestamp || "";
      return aStart.localeCompare(bStart);
    });

  for (let i = 0; i < sessions.length; i += 1) {
    const { session, relevance } = sessions[i];
    const filePath = path.join(OUTPUT_DIR, `${i + 1}.md`);
    await fs.writeFile(filePath, renderSessionFile(i + 1, session, relevance), "utf8");
  }

  const sessionOnly = sessions.map(({ session }) => session);
  await fs.writeFile(path.join(OUTPUT_DIR, "index.md"), renderIndexFile(sessionOnly), "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, "master-timeline.md"), renderMasterTimeline(sessionOnly), "utf8");

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir: OUTPUT_DIR,
    scannedCandidateDirs: discovered,
    exportedConversationCount: sessions.length,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`Exported ${sessions.length} conversations to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
