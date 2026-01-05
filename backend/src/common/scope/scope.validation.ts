import { BadRequestException } from '@nestjs/common';

export class ScopeValidationException extends BadRequestException {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details });
  }
}

export function assertRequired(
  value: unknown,
  field: string,
  code = 'SCOPE_REQUIRED',
) {
  if (value === null || value === undefined || value === '') {
    throw new ScopeValidationException(
      code,
      `Missing required field: ${field}`,
      { field },
    );
  }
}

export function assertEqual(params: {
  left: unknown;
  right: unknown;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  if (params.left !== params.right) {
    throw new ScopeValidationException(params.code, params.message, {
      left: params.left,
      right: params.right,
      ...(params.details ?? {}),
    });
  }
}

