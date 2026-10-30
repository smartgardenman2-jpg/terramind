// Netlify Function: /api/log
// Menyimpan log aktivitas dashboard + riwayat pompa di Netlify Blobs
// agar tidak hilang saat halaman di-refresh.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "terramind";
const MAX_LOGS = 2000;  // log aktivitas (termasuk baris sensor tiap menit)
const MAX_PUMP = 5000;  // riwayat pompa ON/OFF (disimpan terpisah agar tidak tergeser log lain)
const CLS_OK = ["lm", "lm pump", "lm ok", "lm warn"];

export default async (req) => {
  const store = getStore(STORE_NAME);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers });

  const read = async (key) => {
    try {
      const v = await store.get(key, { type: "json" });
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const list = Array.isArray(body.entries) ? body.entries : [body];

      const clean = list
        .filter((e) => e && Number.isFinite(+e.ts) && typeof e.msg === "string")
        .map((e) => {
          const c = {
            ts: +e.ts,
            msg: e.msg.slice(0, 300),
            cls: CLS_OK.includes(e.cls) ? e.cls : "lm",
          };
          if (e.kind === "pump") {
            c.kind = "pump";
            c.event = String(e.event || "").slice(0, 20);
            c.mode = String(e.mode || "").slice(0, 20);
          }
          return c;
        });

      if (!clean.length) return json({ ok: true, added: 0 });

      const logs = (await read("logs")).concat(clean).slice(-MAX_LOGS);
      await store.setJSON("logs", logs);

      const pumpNew = clean.filter((e) => e.kind === "pump");
      if (pumpNew.length) {
        const pump = (await read("pump")).concat(pumpNew).slice(-MAX_PUMP);
        await store.setJSON("pump", pump);
      }
      return json({ ok: true, added: clean.length });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const type = url.searchParams.get("type");
      const limit = parseInt(url.searchParams.get("limit") || "0");
      let entries = await read(type === "pump" ? "pump" : "logs");
      if (limit > 0) entries = entries.slice(-limit);
      return json({ ok: true, total: entries.length, entries });
    }

    if (req.method === "DELETE") {
      await store.setJSON("logs", []);
      await store.setJSON("pump", []);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
};

export const config = { path: "/api/log" };
