import type { HeldRecord } from '../../platform/adult-check';

export interface MembershipRepository {
  find(memberId: string): Promise<HeldRecord | null>;
}

export function d1MembershipRepository(db: D1Database): MembershipRepository {
  return {
    find(memberId) {
      return db
        .prepare(
          'SELECT last_name_hash AS lastNameHash, expires_at AS expiresAt FROM membership_status WHERE member_id = ?',
        )
        .bind(memberId)
        .first<HeldRecord>();
    },
  };
}
