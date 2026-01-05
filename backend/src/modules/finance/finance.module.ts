import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinancialDocumentsModule } from './documents/financial-documents.module';
import { OverheadRulesModule } from './overhead-rules/overhead-rules.module';
import { CurrencyRateModule } from './currency-rates/currency-rate.module';
import { AccountingEntryModule } from './accounting-entry/accounting-entry.module';
import { LedgerAggregateService } from './ledger-aggregate.service';
import { LedgerAggregateController } from './ledger-aggregate.controller';
import { SalesDocumentsModule } from './sales-documents/sales-documents.module';
import { InventoryAccountingLinkService } from './inventory-accounting-link.service';
import { InventoryModule } from '../inventory/inventory.module';
import { FinancialAccountsModule } from './financial-accounts/financial-accounts.module';
import { MoneyTransactionsModule } from './money-transactions/money-transactions.module';
import { CashAccountingLinksModule } from './cash-accounting-links/cash-accounting-links.module';
import { InternalTransfersModule } from './internal-transfers/internal-transfers.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';
import { PaymentPlansModule } from './payment-plans/payment-plans.module';
import { PaymentCalendarModule } from './payment-calendar/payment-calendar.module';
import { PaymentExecutionsModule } from './payment-executions/payment-executions.module';
import { StatementsModule } from './statements/statements.module';
import { CashTransfersModule } from './cash-transfers/cash-transfers.module';
import { AcquiringEventsModule } from './acquiring-events/acquiring-events.module';
import { CategoryDefaultMappingsModule } from './category-default-mappings/category-default-mappings.module';
import { FinanceCategoriesModule } from './categories/finance-categories.module';
import { ApprovalPoliciesModule } from './approval-policies/approval-policies.module';
import { RecurringJournalsModule } from './recurring-journals/recurring-journals.module';
import { ReportsModule } from './reports/reports.module';
import { ExplainModule } from './explain/explain.module';
import { PostingRunsModule } from './posting-runs/posting-runs.module';

@Module({
  imports: [
    FinancialDocumentsModule,
    FinancialAccountsModule,
    MoneyTransactionsModule,
    CashAccountingLinksModule,
    InternalTransfersModule,
    PaymentRequestsModule,
    PaymentPlansModule,
    PaymentCalendarModule,
    PaymentExecutionsModule,
    StatementsModule,
    CashTransfersModule,
    AcquiringEventsModule,
    CategoryDefaultMappingsModule,
    FinanceCategoriesModule,
    ApprovalPoliciesModule,
    RecurringJournalsModule,
    ReportsModule,
    ExplainModule,
    PostingRunsModule,
    OverheadRulesModule,
    CurrencyRateModule,
    AccountingEntryModule,
    SalesDocumentsModule,
    InventoryModule,
  ],
  controllers: [FinanceController, LedgerAggregateController],
  providers: [
    FinanceService,
    LedgerAggregateService,
    InventoryAccountingLinkService,
  ],
  exports: [
    FinancialDocumentsModule,
    FinancialAccountsModule,
    MoneyTransactionsModule,
    CashAccountingLinksModule,
    InternalTransfersModule,
    PaymentRequestsModule,
    PaymentPlansModule,
    PaymentCalendarModule,
    PaymentExecutionsModule,
    StatementsModule,
    CashTransfersModule,
    OverheadRulesModule,
    CurrencyRateModule,
    AccountingEntryModule,
    SalesDocumentsModule,
    InventoryAccountingLinkService,
    LedgerAggregateService,
    FinanceService,
    FinanceCategoriesModule,
    ApprovalPoliciesModule,
  ],
})
export class FinanceModule {}
