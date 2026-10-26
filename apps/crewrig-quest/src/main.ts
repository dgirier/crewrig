// Entry point: `task quest` (or run this file with node, see ../README.md).

import path from "node:path";
import { createQuestServer } from "./server.ts";
import { QuestStore } from "./store.ts";
import { QUEST_ROOT, loadContent } from "./validate-content.ts";

const HOST = "127.0.0.1";

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 4173;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`CREWRIG_QUEST_PORT must be an integer between 0 and 65535, got "${raw}"`);
  }
  return port;
}

function main(): void {
  const port = parsePort(process.env.CREWRIG_QUEST_PORT);
  const dbFile = process.env.CREWRIG_QUEST_DB ?? path.join(QUEST_ROOT, "data", "quest.db");
  const content = loadContent();
  const store = QuestStore.open(dbFile);
  if (!store.persisted) {
    process.stderr.write(
      `warning: database unavailable (${store.openError ?? "unknown error"}); results will not be saved\n`,
    );
  }
  const server = createQuestServer({ content, store, webDir: path.join(QUEST_ROOT, "web") });
  server.listen(port, HOST, () => {
    const address = server.address();
    const actual = typeof address === "object" && address !== null ? address.port : port;
    process.stdout.write(`CrewRig Quest: http://${HOST}:${actual}/  (Ctrl-C to stop)\n`);
  });
  const stop = (): void => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    server.closeAllConnections();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main();
