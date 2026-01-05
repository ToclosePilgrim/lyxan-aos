import {
  assertEqual,
  assertRequired,
  ScopeValidationException,
} from './scope.validation';

describe('scope.validation', () => {
  it('assertRequired throws when missing', () => {
    expect(() => assertRequired('', 'countryId')).toThrow(
      ScopeValidationException,
    );
    expect(() => assertRequired(null, 'brandId')).toThrow(
      ScopeValidationException,
    );
    expect(() => assertRequired(undefined, 'marketplaceId')).toThrow(
      ScopeValidationException,
    );
  });

  it('assertRequired passes when present', () => {
    expect(() => assertRequired('cuid123', 'countryId')).not.toThrow();
  });

  it('assertEqual throws on mismatch', () => {
    expect(() =>
      assertEqual({
        left: 'A',
        right: 'B',
        code: 'SCOPE_COUNTRY_MISMATCH',
        message: 'mismatch',
      }),
    ).toThrow(ScopeValidationException);
  });
});

