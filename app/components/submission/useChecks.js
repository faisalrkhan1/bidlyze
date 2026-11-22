"use client";

// Tenders on the user's account, with what this browser remembers of their
// last check (results and review notes are kept on the device where the check ran).

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import { summarize } from "@/lib/submission/review";

const STORE_PREFIX = "bidlyze.submissionCheck.v1.";

export function localCheck(id) {
  try {
    const raw = window.localStorage.getItem(`${STORE_PREFIX}${id}`);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.result?.items) return null;
    const sum = summarize(s.result.items, s.reviews || {});
    const reviewed = Object.values(s.reviews || {}).filter((r) => r?.reviewed || r?.verdict).length;
    return { checkedAt: s.result.checkedAt, attention: sum.byGroup.attention, manual: sum.byGroup.manual, ok: sum.byGroup.ok, total: s.result.items.length, reviewed, proposal: s.result.response?.files?.length > 1 ? `${s.result.response.files.length} files` : s.result.response?.filename };
  } catch {
    return null;
  }
}

export function useTenders(user, { limit = 100 } = {}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (!user) return;
    getSupabase()
      .from("analyses")
      .select("id, project_name, file_name, created_at, analysis_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error: e }) => {
        if (e) {
          setError("Your tenders could not be loaded. Please refresh the page.");
          setRows([]);
          return;
        }
        setError("");
        setRows(
          (data || [])
            .filter((r) => r.analysis_data && !isDeletedAnalysis(r))
            .map((r) => {
              const { total, cited } = requirementsFromAnalysis(r.analysis_data);
              return {
                id: r.id,
                name: r.analysis_data?.summary?.projectName || r.project_name || "Untitled tender",
                fileName: r.file_name,
                createdAt: r.created_at,
                total,
                cited,
                source: r.analysis_data?.meta?.source === "submission-check" ? "submission-check" : "tender-intelligence",
                local: localCheck(r.id),
              };
            })
        );
      });
  }, [user, limit]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, reload: load };
}

export async function fetchUsage() {
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    const res = await fetch("/api/submission-check/usage", { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
