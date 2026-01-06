"use client";

import { toast } from "sonner";

type FieldSetter<TFieldValues> = (field: keyof TFieldValues, error: { message: string }) => void;

export type HandleFormApiErrorOptions<TFieldValues> = {
  error: any;
  form: {
    setError: FieldSetter<TFieldValues>;
  };
  fieldMap?: Record<string, keyof TFieldValues>;
  toastOptions?: {
    title?: string;
    description?: string;
  };
  knownPatterns?: Array<(ctx: { error: any; form: { setError: FieldSetter<TFieldValues> } }) => boolean>;
};

/**
 * Normalizes backend validation/HTTP errors and maps them to form fields + a fallback toast.
 * - Supports NestJS/class-validator style responses (string or string[] in `message`).
 * - Attempts to map messages to fields using `fieldMap` (backendField -> formField).
 * - Allows custom `knownPatterns` to short-circuit handling (return true if handled).
 * - Shows a destructive toast for unhandled messages.
 */
export function handleFormApiError<TFieldValues>({
  error,
  form,
  fieldMap,
  toastOptions,
  knownPatterns,
}: HandleFormApiErrorOptions<TFieldValues>) {
  if (knownPatterns?.length) {
    for (const fn of knownPatterns) {
      try {
        const handled = fn({ error, form });
        if (handled) return;
      } catch (_) {
        // ignore pattern errors, fallback to generic handling
      }
    }
  }

  const raw = (error as any)?.response?.data ?? (error as any)?.data ?? error;
  const statusCode =
    raw?.statusCode ??
    (error as any)?.response?.status ??
    (error as any)?.status;

  let message = raw?.message ?? raw?.error ?? (error as any)?.message;

  const normalizedMessages: string[] = [];

  if (Array.isArray(message)) {
    // class-validator can return an array of strings or objects
    for (const m of message) {
      if (typeof m === "string") {
        normalizedMessages.push(m);
      } else if (m && typeof m === "object") {
        const property = m.property || m.field || "";
        const constraints = m.constraints
          ? Object.values(m.constraints)
          : [];
        if (constraints.length) {
          normalizedMessages.push(
            `${property}: ${constraints[0]}`
          );
        } else if (m.message) {
          normalizedMessages.push(
            `${property ? `${property}: ` : ""}${m.message}`
          );
        }
      }
    }
  } else if (message) {
    normalizedMessages.push(String(message));
  }

  if (!normalizedMessages.length) {
    normalizedMessages.push("Unexpected error");
  }

  const handled = new Set<number>();

  // Map messages to fields if possible
  if (fieldMap && Object.keys(fieldMap).length) {
    normalizedMessages.forEach((msg, idx) => {
      const lowerMsg = msg.toLowerCase();
      for (const backendField of Object.keys(fieldMap)) {
        if (lowerMsg.includes(backendField.toLowerCase())) {
          form.setError(fieldMap[backendField], { message: msg });
          handled.add(idx);
          break;
        }
      }
    });
  }

  const unhandledMessages = normalizedMessages.filter(
    (_msg, idx) => !handled.has(idx)
  );

  if (unhandledMessages.length) {
    toast.error(
      toastOptions?.title ?? "Ошибка",
      {
        description:
          toastOptions?.description ??
          unhandledMessages.join("\n"),
      }
    );
  } else if (!normalizedMessages.length && statusCode) {
    toast.error(toastOptions?.title ?? "Ошибка", {
      description: toastOptions?.description ?? `Ошибка ${statusCode}`,
    });
  }
}
























