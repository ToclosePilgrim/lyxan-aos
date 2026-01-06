-- TZ 4.3 — Index for matching lookups (StatementLine.matchedEntityType/matchedEntityId)

CREATE INDEX IF NOT EXISTS "statement_lines_matchedEntityType_matchedEntityId_idx"
  ON "statement_lines"("matchedEntityType", "matchedEntityId");



CREATE INDEX IF NOT EXISTS "statement_lines_matchedEntityType_matchedEntityId_idx"
  ON "statement_lines"("matchedEntityType", "matchedEntityId");









