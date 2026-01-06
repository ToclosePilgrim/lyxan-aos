import { SupplierRole as SharedSupplierRole } from '@aos/shared';
import { SupplierRole as PrismaSupplierRole } from '@prisma/client';

describe('Enum Contract Tests', () => {
  describe('SupplierRole enum synchronization', () => {
    it('should match shared SupplierRole with Prisma SupplierRole', () => {
      const sharedValues = Object.values(SharedSupplierRole).sort();
      const prismaValues = Object.values(PrismaSupplierRole).sort();

      expect(sharedValues).toEqual(prismaValues);
    });

    it('should have all required SupplierRole values', () => {
      const requiredValues = [
        'PRODUCER',
        'RAW_MATERIAL',
        'PACKAGING',
        'PRINTING',
        'LOGISTICS',
        'OTHER',
      ];

      const sharedValues = Object.values(SharedSupplierRole);
      requiredValues.forEach((value) => {
        expect(sharedValues).toContain(value);
      });
    });
  });
});




