import { useEffect, useState } from "react";
import { AccountingEntry } from "@/lib/types/finance";
import { fetchSupplyLedger } from "@/lib/api/finance-ledger";

export function useSupplyLedger(supplyId: string | null) {
  const [data, setData] = useState<AccountingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supplyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSupplyLedger(supplyId)
      .then((entries) => {
        if (!cancelled) setData(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load supply ledger"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supplyId]);

  return { data, loading, error };
}






















