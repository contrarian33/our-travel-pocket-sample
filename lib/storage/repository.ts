import { STORAGE_KEY_V1, storedStateV1Schema, type StoredStateV1 } from "./schema";

export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type LoadResult = { status: "empty" } | { status: "ready"; data: StoredStateV1 } | { status: "corrupt"; message: string };
export type WriteResult = { ok: true } | { ok: false; status: "writeError"; message: string };

export function loadState(storage: StorageAdapter): LoadResult {
  try {
    const raw = storage.getItem(STORAGE_KEY_V1);
    if (raw === null) return { status: "empty" };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "corrupt", message: "저장된 데이터를 읽을 수 없습니다. 전체 초기화가 필요합니다." }; }
    const parsed = storedStateV1Schema.safeParse(value);
    return parsed.success ? { status: "ready", data: parsed.data } : { status: "corrupt", message: "저장 데이터가 손상되었거나 지원하지 않는 형식입니다." };
  } catch { return { status: "corrupt", message: "브라우저 저장소에 접근할 수 없습니다." }; }
}

export function saveState(storage: StorageAdapter, state: StoredStateV1): WriteResult {
  const parsed = storedStateV1Schema.safeParse(state);
  if (!parsed.success) return { ok: false, status: "writeError", message: "입력 데이터가 올바르지 않아 저장하지 못했습니다." };
  try {
    const serialized = JSON.stringify(parsed.data);
    storage.setItem(STORAGE_KEY_V1, serialized);
    const verified = storedStateV1Schema.safeParse(JSON.parse(serialized));
    if (!verified.success) throw new Error("verification failed");
    return { ok: true };
  } catch { return { ok: false, status: "writeError", message: "저장 공간이 부족하거나 사용할 수 없어 저장하지 못했습니다. 입력값은 유지됩니다." }; }
}

export function clearState(storage: StorageAdapter): WriteResult {
  try { storage.removeItem(STORAGE_KEY_V1); return { ok: true }; }
  catch { return { ok: false, status: "writeError", message: "데이터를 초기화하지 못했습니다. 다시 시도해 주세요." }; }
}
