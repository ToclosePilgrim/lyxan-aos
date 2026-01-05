import { useEffect, useState } from "react";
import { AccountingEntry } from "@/lib/types/finance";
import { fetchDocumentLedger } from "@/lib/api/finance-ledger";

export function useDocumentLedger(docType: string | null, docId: string | null) {
  const [data, setData] = useState<AccountingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docType || !docId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDocumentLedger({ docType, docId })
      .then((entries) => {
        if (!cancelled) setData(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load ledger"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docType, docId]);

  return { data, loading, error };
}



















