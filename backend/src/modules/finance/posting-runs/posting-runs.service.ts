import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountingDocType, PostingRunStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';

@Injectable()
export class PostingRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingEntryService,
  ) {}

  async getActivePostedRun(params: {
    legalEntityId: string;
    docType: AccountingDocType;
    docId: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    return (client as any).accountingPostingRun.findFirst({
      where: {
        legalEntityId: params.legalEntityId,
        docType: params.docType,
        docId: params.docId,
        status: PostingRunStatus.POSTED,
      } as any,
      orderBy: [{ version: 'desc' }],
    });
  }

  async getOrCreatePostedRun(params: {
    legalEntityId: string;
    docType: AccountingDocType;
    docId: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    const existing = await this.getActivePostedRun(params);
    if (existing) return existing;

    const max = await (client as any).accountingPostingRun.aggregate({
      where: {
        legalEntityId: params.legalEntityId,
        docType: params.docType,
        docId: params.docId,
      } as any,
      _max: { version: true },
    });
    const nextVer = (max?._max?.version ?? 0) + 1;

    try {
      return await (client as any).accountingPostingRun.create({
        data: {
          id: crypto.randomUUID(),
          legalEntityId: params.legalEntityId,
          docType: params.docType,
          docId: params.docId,
          version: nextVer,
          status: PostingRunStatus.POSTED,
          postedAt: new Date(),
        } as any,
      });
    } catch (e: any) {
      // Handle race condition: another request created the run with same version
      if (e?.code === 'P2002') {
        // Re-read to get the actual latest run
        const again = await this.getActivePostedRun(params);
        if (again) return again;
        // If still not found, try to get max version again and retry once
        const maxAgain = await (client as any).accountingPostingRun.aggregate({
          where: {
            legalEntityId: params.legalEntityId,
            docType: params.docType,
            docId: params.docId,
          } as any,
          _max: { version: true },
        });
        const nextVerAgain = (maxAgain?._max?.version ?? 0) + 1;
        try {
          return await (client as any).accountingPostingRun.create({
            data: {
              id: crypto.randomUUID(),
              legalEntityId: params.legalEntityId,
              docType: params.docType,
              docId: params.docId,
              version: nextVerAgain,
              status: PostingRunStatus.POSTED,
              postedAt: new Date(),
            } as any,
          });
        } catch (e2: any) {
          // Final retry: just return existing if any
          const final = await this.getActivePostedRun(params);
          if (final) return final;
          throw new ConflictException(
            'Failed to create posting run due to concurrent access',
          );
        }
      }
      throw e;
    }
  }

  async createNextRun(params: {
    legalEntityId: string;
    docType: AccountingDocType;
    docId: string;
    repostedFromRunId?: string | null;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    const max = await (client as any).accountingPostingRun.aggregate({
      where: {
        legalEntityId: params.legalEntityId,
        docType: params.docType,
        docId: params.docId,
      } as any,
      _max: { version: true },
    });
    const nextVer = (max?._max?.version ?? 0) + 1;
    try {
      return await (client as any).accountingPostingRun.create({
        data: {
          id: crypto.randomUUID(),
          legalEntityId: params.legalEntityId,
          docType: params.docType,
          docId: params.docId,
          version: nextVer,
          status: PostingRunStatus.POSTED,
          postedAt: new Date(),
          repostedFromRunId: params.repostedFromRunId ?? null,
        } as any,
      });
    } catch (e: any) {
      // Handle race condition: another request created the run with same version
      if (e?.code === 'P2002') {
        // Re-read to get the actual latest run
        const maxAgain = await (client as any).accountingPostingRun.aggregate({
          where: {
            legalEntityId: params.legalEntityId,
            docType: params.docType,
            docId: params.docId,
          } as any,
          _max: { version: true },
        });
        const nextVerAgain = (maxAgain?._max?.version ?? 0) + 1;
        try {
          return await (client as any).accountingPostingRun.create({
            data: {
              id: crypto.randomUUID(),
              legalEntityId: params.legalEntityId,
              docType: params.docType,
              docId: params.docId,
              version: nextVerAgain,
              status: PostingRunStatus.POSTED,
              postedAt: new Date(),
              repostedFromRunId: params.repostedFromRunId ?? null,
            } as any,
          });
        } catch (e2: any) {
          // If still fails, return the existing run with max version
          const existing = await (client as any).accountingPostingRun.findFirst({
            where: {
              legalEntityId: params.legalEntityId,
              docType: params.docType,
              docId: params.docId,
            } as any,
            orderBy: [{ version: 'desc' }],
          });
          if (existing) return existing;
          throw new ConflictException(
            'Failed to create posting run due to concurrent access',
          );
        }
      }
      throw e;
    }
  }

  async hasEntries(params: { runId: string; tx?: Prisma.TransactionClient }) {
    const client = params.tx ?? this.prisma;
    const cnt = await client.accountingEntry.count({
      where: { postingRunId: params.runId } as any,
    });
    return cnt > 0;
  }

  async voidRun(params: {
    runId: string;
    reason: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    const reason = (params.reason ?? '').trim() || 'void';
    const run = await (client as any).accountingPostingRun.findUnique({
      where: { id: params.runId },
    });
    if (!run) throw new NotFoundException('PostingRun not found');

    if (run.status === PostingRunStatus.VOIDED) {
      // idempotent: return already-created reversal run if any
      if (run.reversalRunId) {
        const rr = await (client as any).accountingPostingRun.findUnique({
          where: { id: run.reversalRunId },
        });
        return {
          originalRun: run,
          reversalRun: rr ?? null,
          alreadyVoided: true,
        };
      }
      return { originalRun: run, reversalRun: null, alreadyVoided: true };
    }

    // Create reversal run (next version) and mark original VOIDED
    const reversalRun = await this.createNextRun({
      tx: client as any,
      legalEntityId: run.legalEntityId,
      docType: run.docType,
      docId: run.docId,
      repostedFromRunId: null,
    });

    // Fetch entries for original run
    const entries = await client.accountingEntry.findMany({
      where: { postingRunId: run.id } as any,
      orderBy: [{ lineNumber: 'asc' }],
    });
    if (!entries.length) {
      // Nothing to reverse; still mark voided
      await (client as any).accountingPostingRun.update({
        where: { id: run.id },
        data: {
          status: PostingRunStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: reason,
          reversalRunId: reversalRun.id,
        } as any,
      });
      return {
        originalRun: run,
        reversalRun,
        reversedEntries: 0,
        alreadyVoided: false,
      };
    }

    let reversedEntries = 0;
    for (const e of entries as any[]) {
      const origDocLineId = e.metadata?.docLineId ?? `line:${e.lineNumber}`;
      const docLineId = `reversal:${run.id}:${origDocLineId}`;
      await this.accounting.createEntry({
        tx: client as any,
        docType: e.docType,
        docId: e.docId,
        sourceDocType: e.sourceDocType ?? e.docType,
        sourceDocId: e.sourceDocId ?? e.docId,
        legalEntityId: e.legalEntityId,
        brandId: e.brandId ?? undefined,
        countryId: e.countryId ?? undefined,
        marketplaceId: e.marketplaceId ?? null,
        warehouseId: e.warehouseId ?? null,
        lineNumber: e.lineNumber, // deterministic
        postingDate: e.postingDate,
        debitAccount: e.creditAccount,
        creditAccount: e.debitAccount,
        amount: e.amount,
        currency: e.currency,
        description: `REVERSAL of ${e.id}`,
        metadata: {
          ...(e.metadata ?? {}),
          docLineId,
          reversalOfEntryId: e.id,
          reversalOfRunId: run.id,
        },
        postingRunId: reversalRun.id,
      } as any);
      reversedEntries += 1;
    }

    await (client as any).accountingPostingRun.update({
      where: { id: run.id },
      data: {
        status: PostingRunStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: reason,
        reversalRunId: reversalRun.id,
      } as any,
    });

    return {
      originalRun: run,
      reversalRun,
      reversedEntries,
      alreadyVoided: false,
    };
  }
}


