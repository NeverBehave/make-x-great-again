import { createServer } from "node:http";
import { classifyAccount } from "./classify.ts";
import { adaptMvpSignals } from "./mvp.ts";
import { latestByUserId } from "./store.ts";

/**
 * Local-only MVP service. The browser extension's background worker calls
 * this on localhost (extension background fetches are not subject to page
 * CORS). No CORS headers are sent on purpose: with them, any web page could
 * read the private curation DB via GET /records or burn LLM tokens via
 * POST /classify.
 */
const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY_BYTES = 256 * 1024;

function send(res: import("node:http").ServerResponse, code: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(json);
}

async function readBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    const buf = c as Buffer;
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error(`request body too large (max ${MAX_BODY_BYTES} bytes)`);
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, records: latestByUserId().size });
    }

    // Passive blocklist check — no LLM call. Extension uses this first.
    if (req.method === "GET" && url.pathname === "/lookup") {
      const userId = url.searchParams.get("userId") ?? "";
      const hit = latestByUserId().get(userId) ?? null;
      return send(res, 200, { hit });
    }

    if (req.method === "GET" && url.pathname === "/records") {
      const all = [...latestByUserId().values()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return send(res, 200, { count: all.length, records: all });
    }

    // Triggered by the extension's manual "检查此账号" button.
    if (req.method === "POST" && url.pathname === "/classify") {
      const { signals, idResolved } = adaptMvpSignals(await readBody(req));
      const outcome = await classifyAccount(signals);
      return send(res, 200, {
        idResolved,
        cached: outcome.cached,
        record: outcome.record,
        ...(outcome.usage ? { usage: outcome.usage } : {}),
      });
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`x-spam-sentinel local service → http://127.0.0.1:${PORT}`);
  console.log("  GET  /health   GET /lookup?userId=  GET /records   POST /classify");
});
