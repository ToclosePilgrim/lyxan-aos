"use client";

import { useDocumentLedger } from "@/hooks/useDocumentLedger";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LedgerSectionProps {
  title?: string;
  docType?: string | null;
  docId?: string | null;
  baseCurrencyLabel?: string;
  entries?: any[] | null;
  loading?: boolean;
  error?: Error | null;
}

export function LedgerSection({
  title = "Ledger",
  docType,
  docId,
  baseCurrencyLabel = "Base Amount",
  entries,
  loading: externalLoading,
  error: externalError,
}: LedgerSectionProps) {
  const internal = useDocumentLedger(
    entries ? null : docType || null,
    entries ? null : docId || null
  );
  const loading = externalLoading ?? internal.loading;
  const error = externalError ?? internal.error;
  const data = entries ?? internal.data;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        {docType && <Badge variant="outline">{docType}</Badge>}
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertTitle>Ledger load error</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load ledger entries."}
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && (!data || data.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No accounting entries for this document yet.
        </p>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>#</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">{baseCurrencyLabel}</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {entry.postingDate
                      ? new Date(entry.postingDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>{entry.lineNumber}</TableCell>
                  <TableCell>{entry.debitAccount}</TableCell>
                  <TableCell>{entry.creditAccount}</TableCell>
                  <TableCell className="text-right">
                    {entry.amount} {entry.currency}
                  </TableCell>
                  <TableCell className="text-right">{entry.amountBase}</TableCell>
                  <TableCell
                    className="max-w-xs truncate"
                    title={entry.description || undefined}
                  >
                    {entry.description || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}


