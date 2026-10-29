import type { HeldRecord } from '../../platform/adult-check';

export interface SytRepository {
  find(memberId: string): Promise<HeldRecord | null>;
}

export function d1SytRepository(db: D1Database): SytRepository {
  return {
    find(memberId) {
      return db
        .prepare('SELECT last_name_hash AS lastNameHash, expires_at AS expiresAt FROM syt_status WHERE member_id = ?')
        .bind(memberId)
        .first<HeldRecord>();
    },
  };
}
