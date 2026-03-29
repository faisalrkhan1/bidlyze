"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data: { user } }) => {
      router.replace(user ? "/dashboard" : "/login");
    }).catch(() => {
      router.replace("/login");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  );
}
