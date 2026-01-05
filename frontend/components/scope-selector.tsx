"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScope } from "@/context/scope-context";

export function ScopeSelector() {
  const { scope, lists, ready, setScope } = useScope();

  const disabled = !ready;

  return (
    <div className="flex items-center gap-3">
      <div className="w-40">
        <Select
          disabled={disabled}
          value={scope?.countryId ?? ""}
          onValueChange={(v) => setScope({ countryId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            {(lists.countries ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select
          disabled={disabled}
          value={scope?.brandId ?? ""}
          onValueChange={(v) => setScope({ brandId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            {(lists.brands ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-44">
        <Select
          disabled={disabled}
          value={scope?.marketplaceId ?? ""}
          onValueChange={(v) => setScope({ marketplaceId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Marketplace" />
          </SelectTrigger>
          <SelectContent>
            {(lists.marketplaces ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}















