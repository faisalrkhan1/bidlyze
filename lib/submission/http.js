// Shared request helpers for the Submission Check API routes.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel rejects request bodies over 4.5 MB; page text of a 250-page document is well under this.
export const MAX_BODY_BYTES = 4_000_000;

export function errJson(status, message, extra = {}, headers) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status, headers });
}

export class BodyError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Read a JSON body with a hard size limit (checked on the real bytes, not only the header). */
export async function readJsonBody(request, max = MAX_BODY_BYTES) {
  if (Number(request.headers.get("content-length") || 0) > max) {
    throw new BodyError("The documents are too large to send in one go (over 4 MB of text). Upload only the parts the check needs.", 413);
  }
  const raw = await request.text();
  if (raw.length > max) throw new BodyError("The documents are too large to send in one go (over 4 MB of text). Upload only the parts the check needs.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new BodyError("Invalid request.", 400);
  }
}

/** The signed-in user (from the Supabase access token) and a client that acts as that user (RLS applies). */
export async function userFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null };
  const token = authHeader.split(" ")[1];
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { user: null };
  return { user: data.user, client };
}

/** Service-role client, used only for the usage-limit functions. Null when not configured. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let quotaSingleton = null;
/** One quota object per server instance (its in-memory fallback must be shared). */
export async function getQuota() {
  if (!quotaSingleton) {
    const { createQuota } = await import("./quota.js");
    quotaSingleton = createQuota({ admin: adminClient() });
  }
  return quotaSingleton;
}
