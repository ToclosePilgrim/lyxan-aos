import fs from 'node:fs';
import path from 'node:path';

describe('Guardrail: PostingRuns must keep canonical UNIQUE(docType, docId, version)', () => {
  it('AccountingPostingRun has @@unique([docType, docId, version]) in schema.prisma', () => {
    const schemaPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prisma',
      'schema.prisma',
    );
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // This UNIQUE is the DB invariant that makes PostingRunsService concurrency-safe:
    // it must reliably throw P2002 when two writers try to create the same (docType, docId, version).
    const re =
      /model\s+AccountingPostingRun\s*\{[\s\S]*?@@unique\(\[docType,\s*docId,\s*version\]\)[\s\S]*?\n\}/m;
    expect(schema).toMatch(re);
  });
});


