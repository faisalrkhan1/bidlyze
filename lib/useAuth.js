"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "./supabase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        const next = typeof window === "undefined"
          ? ""
          : `${window.location.pathname}${window.location.search}`;
        const loginPath = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
        router.replace(loginPath);
      } else {
        setUser(user);
      }
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  return { user, loading, logout };
}
