// ============================================================================
// src/lib/line/storage-factory.ts
// ストレージバックエンド切替 — 環境変数 STORAGE_BACKEND で制御
// ============================================================================

import { FileStorage } from './storage';
import { SupabaseStorage } from './supabase-storage';

export type StorageBackend = FileStorage | SupabaseStorage;

function createStorage(): StorageBackend {
  if (process.env.STORAGE_BACKEND === 'supabase') {
    return new SupabaseStorage();
  }
  return new FileStorage();
}

export const storage = createStorage();
