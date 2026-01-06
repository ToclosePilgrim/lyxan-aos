import { useEffect, useState } from "react";
import { AccountingEntry } from "@/lib/types/finance";
import { fetchFinancialDocumentLedger } from "@/lib/api/finance-ledger";

export function useFinancialDocumentLedger(id: string | null) {
  const [data, setData] = useState<AccountingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFinancialDocumentLedger(id)
      .then((entries) => {
        if (!cancelled) setData(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error("Failed to load finance document ledger")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, loading, error };
}






















