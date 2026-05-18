/**
 * MeetingsStore interface + async factory.
 * Resolves to SupabaseMeetingsStore when configured, otherwise InMemoryMeetingsStore.
 */

import type {
  Meeting,
  MeetingInsert,
  MeetingListItem,
  MeetingUpdate,
} from "./types";
import { isE2eFakeRecordingEnabled } from "@/lib/recording/e2e-fake-recording";

export interface MeetingsStore {
  insert(row: MeetingInsert): Promise<Meeting>;
  update(id: string, patch: MeetingUpdate): Promise<Meeting | null>;
  get(id: string): Promise<Meeting | null>;
  list(limit: number): Promise<MeetingListItem[]>;
  delete(id: string): Promise<boolean>;
}

export async function getMeetingsStore(): Promise<MeetingsStore> {
  if (isE2eFakeRecordingEnabled()) {
    const { InMemoryMeetingsStore } = await import("./store-in-memory");
    return new InMemoryMeetingsStore();
  }

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    const { SupabaseMeetingsStore } = await import("./store-supabase");
    return new SupabaseMeetingsStore();
  }

  const { InMemoryMeetingsStore } = await import("./store-in-memory");
  return new InMemoryMeetingsStore();
}
