import { addLegalEntityFilterToArgs } from './prisma-scope.extension';

describe('Prisma Scope Extension (args scoping)', () => {
  it('adds where.legalEntityId when args are undefined', () => {
    expect(addLegalEntityFilterToArgs(undefined, 'le-1')).toEqual({
      where: { legalEntityId: 'le-1' },
    });
  });

  it('adds where.legalEntityId when where is missing', () => {
    expect(addLegalEntityFilterToArgs({}, 'le-1')).toEqual({
      where: { legalEntityId: 'le-1' },
    });
  });

  it('does not override existing where.legalEntityId', () => {
    const args = { where: { legalEntityId: 'le-2' } };
    expect(addLegalEntityFilterToArgs(args, 'le-1')).toBe(args);
  });

  it('appends to existing AND array', () => {
    const args = { where: { AND: [{ docType: 'SUPPLY' }] } };
    expect(addLegalEntityFilterToArgs(args, 'le-1')).toEqual({
      where: { AND: [{ docType: 'SUPPLY' }, { legalEntityId: 'le-1' }] },
    });
  });

  it('wraps existing where in AND when needed', () => {
    const args = { where: { docType: 'SUPPLY' } };
    expect(addLegalEntityFilterToArgs(args, 'le-1')).toEqual({
      where: { AND: [{ docType: 'SUPPLY' }, { legalEntityId: 'le-1' }] },
    });
  });
});


