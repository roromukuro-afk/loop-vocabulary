"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, SupabaseNotConfiguredError } from "./env";

export function createClient() {
  const env = getSupabaseEnv();
  if (!env.ok) throw new SupabaseNotConfiguredError();
  return createBrowserClient(env.url!, env.anon!);
}
