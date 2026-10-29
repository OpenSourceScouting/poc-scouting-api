import type { HeldRecord } from '../../platform/adult-check';

export interface YptRepository {
  find(memberId: string): Promise<HeldRecord | null>;
}

export function d1YptRepository(db: D1Database): YptRepository {
  return {
    find(memberId) {
      return db
        .prepare('SELECT last_name_hash AS lastNameHash, expires_at AS expiresAt FROM ypt_status WHERE member_id = ?')
        .bind(memberId)
        .first<HeldRecord>();
    },
  };
}
