export interface PositionTerm {
  positionCode: string;
  lastNameHash: string;
  expiresAt: string;
}

export interface PositionsRepository {
  /** Terms for one adult in one organization only; there is intentionally no cross-organization query. */
  list(memberId: string, organizationId: string): Promise<PositionTerm[]>;
}

export function d1PositionsRepository(db: D1Database): PositionsRepository {
  return {
    async list(memberId, organizationId) {
      const { results } = await db
        .prepare(
          'SELECT position_code AS positionCode, last_name_hash AS lastNameHash, expires_at AS expiresAt ' +
            'FROM position_assignments WHERE member_id = ? AND organization_id = ?',
        )
        .bind(memberId, organizationId)
        .all<PositionTerm>();
      return results;
    },
  };
}
