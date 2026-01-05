import { apiRequest } from "@/lib/api";
import { AccountingEntry } from "@/lib/types/finance";

export async function fetchDocumentLedger(params: {
  docType: string;
  docId: string;
}): Promise<AccountingEntry[]> {
  const searchParams = new URLSearchParams({
    docType: params.docType,
    docId: params.docId,
  });

  const res = await apiRequest(
    `/finance/accounting-entries/by-document?${searchParams.toString()}`,
    {
      method: "GET",
    }
  );

  return (res as AccountingEntry[]) ?? [];
}

export async function fetchSupplyLedger(supplyId: string): Promise<AccountingEntry[]> {
  const res = await apiRequest(`/finance/ledger/by-supply/${supplyId}`, {
    method: "GET",
  });
  return (res as AccountingEntry[]) ?? [];
}

export async function fetchFinancialDocumentLedger(id: string): Promise<AccountingEntry[]> {
  const res = await apiRequest(`/finance/ledger/by-financial-document/${id}`, {
    method: "GET",
  });
  return (res as AccountingEntry[]) ?? [];
}


