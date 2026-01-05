import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinanceService } from '../finance/finance.service';
import { FinancialDocumentsService } from '../finance/documents/financial-documents.service';
import { AccountingEntryService } from '../finance/accounting-entry/accounting-entry.service';
import { ok, fail, OsApiResponse } from './os-api.types';
import { GetPnlDto } from '../finance/dto/get-pnl.dto';
import {
  OsFinancialDocumentDto,
  OsAccountingEntryDto,
} from './dto/os-finance.dto';

@ApiTags('os-finance')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1/finance')
export class OsFinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly financialDocs: FinancialDocumentsService,
    private readonly accountingEntries: AccountingEntryService,
  ) {}

  @Get('pnl')
  @ApiOperation({ summary: 'Get P&L (ledger-based) - OS API' })
  async getPnl(@Query() query: GetPnlDto): Promise<OsApiResponse<any>> {
    try {
      const res = await this.finance.getPnl(query);
      return ok(res);
    } catch (e: any) {
      return fail('PNL_FAILED', e?.message ?? 'Failed to get P&L');
    }
  }

  @Get('documents')
  @ApiOperation({ summary: 'List financial documents - OS API' })
  async listDocuments(
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<
    OsApiResponse<{
      items: OsFinancialDocumentDto[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      const res = await this.financialDocs.findAll({
        type: type as any,
        fromDate: dateFrom,
        toDate: dateTo,
        limit: Number(pageSize) || 50,
        offset: ((Number(page) || 1) - 1) * (Number(pageSize) || 50),
      } as any);

      const data = {
        items: (res.items ?? []).map((d: any) => ({
          id: d.id,
          type: d.type,
          docType: d.linkedDocType,
          docId: d.linkedDocId,
          date:
            d.docDate?.toISOString?.() ??
            d.docDate ??
            d.createdAt?.toISOString?.() ??
            d.createdAt,
          totalAmount: d.amountTotal ? Number(d.amountTotal) : null,
          currency: d.currency,
        })),
        total: res.total ?? 0,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
      };
      return ok(data);
    } catch (e: any) {
      return fail(
        'FIN_DOC_LIST_FAILED',
        e?.message ?? 'Failed to list financial documents',
      );
    }
  }

  @Get('documents/:id/entries')
  @ApiOperation({
    summary: 'Get accounting entries for a financial document - OS API',
  })
  async getEntries(
    @Param('id') id: string,
  ): Promise<OsApiResponse<{ entries: OsAccountingEntryDto[] }>> {
    try {
      const entries = await this.accountingEntries.listByDocument({
        docType: undefined as any,
        docId: id,
      } as any);
      const mapped = entries.map((e: any) => ({
        id: e.id,
        postingDate: e.postingDate?.toISOString?.() ?? e.postingDate,
        debitAccount: e.debitAccount,
        creditAccount: e.creditAccount,
        amount: Number(e.amount),
        currency: e.currency,
        metadata: e.metadata ?? undefined,
      }));
      return ok({ entries: mapped });
    } catch (e: any) {
      return fail(
        'FIN_DOC_ENTRIES_FAILED',
        e?.message ?? 'Failed to get entries',
        { id },
      );
    }
  }
}
