// Netlify Function: /api/data
// Menyimpan dan membaca data sensor dari Netlify Blobs
// Dipanggil dari index_v2.html setiap polling

import { getStore } from "@netlify/blobs";

const STORE_NAME = "terramind";
const MAX_RECORDS = 10000; // simpan max 10.000 baris data

export default async (req, context) => {
  const store = getStore(STORE_NAME);
  const method = req.method;

  // CORS header agar bisa dipanggil dari browser
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Preflight OPTIONS
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // ── POST /api/data — simpan data baru dari polling ──────────
  if (method === "POST") {
    try {
      const body = await req.json();
      const { t, h, m, p, pump, auto: autoMode } = body;

      // Baca records yang sudah ada
      let records = [];
      try {
        const existing = await store.get("records", { type: "json" });
        if (existing && Array.isArray(existing)) records = existing;
      } catch (_) {}

      // Tambah record baru
      const now = new Date();
      const newRecord = {
        id: now.getTime(),
        waktu: now.toLocaleString("id-ID", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        }),
        t: parseFloat(t) || 0,
        h: parseFloat(h) || 0,
        m: parseFloat(m) || 0,
        p: parseFloat(p) || 0,
        pump: pump ? 1 : 0,
        auto: autoMode ? 1 : 0,
      };

      records.push(newRecord);

      // Hapus yang paling lama jika melebihi MAX_RECORDS
      if (records.length > MAX_RECORDS) {
        records = records.slice(records.length - MAX_RECORDS);
      }

      await store.setJSON("records", records);

      return new Response(JSON.stringify({ ok: true, total: records.length }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // ── GET /api/data — ambil semua records ──────────────────────
  if (method === "GET") {
    try {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "0");
      const from  = url.searchParams.get("from") || null; // timestamp ms

      let records = [];
      try {
        const existing = await store.get("records", { type: "json" });
        if (existing && Array.isArray(existing)) records = existing;
      } catch (_) {}

      // Filter dari timestamp tertentu jika ada
      if (from) {
        records = records.filter(r => r.id >= parseInt(from));
      }

      // Ambil N data terakhir jika limit ada
      if (limit > 0) {
        records = records.slice(-limit);
      }

      return new Response(JSON.stringify({ ok: true, total: records.length, records }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // ── DELETE /api/data — hapus semua records ───────────────────
  if (method === "DELETE") {
    try {
      await store.setJSON("records", []);
      return new Response(JSON.stringify({ ok: true, message: "Semua data dihapus" }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
};

export const config = { path: "/api/data" };
