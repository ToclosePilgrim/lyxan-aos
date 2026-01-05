"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type IdName = { id: string; name: string; code?: string };

export type Scope = {
  countryId?: string;
  brandId?: string;
  marketplaceId?: string;
};

export type ScopeLists = {
  countries: IdName[];
  brands: IdName[];
  marketplaces: IdName[];
};

type ScopeContextValue = {
  scope: Scope | null;
  lists: ScopeLists;
  ready: boolean;
  scopeKey: string;
  setScope: (next: Partial<Scope>) => void;
};

const ScopeContext = createContext<ScopeContextValue | undefined>(undefined);

const STORAGE_KEY = "aos.scope";

function readStoredScope(): Scope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Scope;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredScope(scope: Scope | null) {
  try {
    if (!scope) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
  } catch {
    // ignore
  }
}

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<Scope | null>(null);
  const [lists, setLists] = useState<ScopeLists>({
    countries: [],
    brands: [],
    marketplaces: [],
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // restore scope from storage
    setScopeState(readStoredScope());
  }, []);

  useEffect(() => {
    // best-effort load lists; app should not hard-fail if endpoints are missing
    let cancelled = false;

    async function load() {
      try {
        const [countries, brands, marketplaces] = await Promise.all([
          apiRequest<IdName[]>("/org/countries").catch(() => []),
          apiRequest<IdName[]>("/bcm/brands").catch(() => []),
          apiRequest<IdName[]>("/org/marketplaces").catch(() => []),
        ]);

        if (cancelled) return;
        setLists({
          countries: Array.isArray(countries) ? countries : [],
          brands: Array.isArray(brands) ? brands : [],
          marketplaces: Array.isArray(marketplaces) ? marketplaces : [],
        });
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scopeKey = useMemo(() => {
    const c = scope?.countryId ?? "";
    const b = scope?.brandId ?? "";
    const m = scope?.marketplaceId ?? "";
    return `${c}:${b}:${m}`;
  }, [scope?.countryId, scope?.brandId, scope?.marketplaceId]);

  const setScope = (next: Partial<Scope>) => {
    setScopeState((prev) => {
      const merged: Scope = { ...(prev ?? {}), ...next };

      // normalize empty strings
      if (merged.countryId === "") delete merged.countryId;
      if (merged.brandId === "") delete merged.brandId;
      if (merged.marketplaceId === "") delete merged.marketplaceId;

      const finalScope = Object.keys(merged).length ? merged : null;
      writeStoredScope(finalScope);
      return finalScope;
    });
  };

  const value: ScopeContextValue = useMemo(
    () => ({ scope, lists, ready, scopeKey, setScope }),
    [scope, lists, ready, scopeKey],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used within ScopeProvider");
  return ctx;
}

