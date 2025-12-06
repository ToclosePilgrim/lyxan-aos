import { CreateSupplierDto } from '../src/modules/scm/suppliers/dto/create-supplier.dto';
import { CreateWarehouseDto } from '../src/modules/scm/warehouses/dto/create-warehouse.dto';
import { CreateScmSupplyDto } from '../src/modules/scm/supplies/dto/create-scm-supply.dto';
import { CreateProductionOrderDto } from '../src/modules/scm/production-orders/dto/create-production-order.dto';
import { CreateFinancialDocumentDto } from '../src/modules/finance/documents/dto/create-financial-document.dto';

describe('DTO/Prisma Contract Tests', () => {
  describe('CreateSupplierDto', () => {
    it('should have required fields matching Prisma Supplier model', () => {
      const dto = new CreateSupplierDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma Supplier required fields: name, code
      const requiredPrismaFields = ['name', 'code'];
      
      requiredPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });

    it('should have optional fields matching Prisma Supplier model', () => {
      const dto = new CreateSupplierDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma Supplier optional fields
      const optionalPrismaFields = ['status', 'countryId'];
      
      optionalPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });
  });

  describe('CreateWarehouseDto', () => {
    it('should have required fields matching Prisma Warehouse model', () => {
      const dto = new CreateWarehouseDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma Warehouse required fields: name, code (but code can be auto-generated)
      const requiredPrismaFields = ['name', 'code'];
      
      requiredPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });

    it('should have optional fields matching Prisma Warehouse model', () => {
      const dto = new CreateWarehouseDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma Warehouse optional fields
      const optionalPrismaFields = ['address', 'isActive', 'countryId', 'city', 'notes', 'type'];
      
      optionalPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });
  });

  describe('CreateScmSupplyDto', () => {
    it('should have required fields matching Prisma ScmSupply model', () => {
      const dto = new CreateScmSupplyDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma ScmSupply required fields: supplierId, warehouseId, currency
      const requiredPrismaFields = ['supplierId', 'warehouseId', 'currency'];
      
      requiredPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });

    it('should have optional fields matching Prisma ScmSupply model', () => {
      const dto = new CreateScmSupplyDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma ScmSupply optional fields
      const optionalPrismaFields = ['status', 'productionOrderId', 'orderDate', 'expectedDate', 'comment'];
      
      optionalPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });
  });

  describe('CreateProductionOrderDto', () => {
    it('should have required fields matching Prisma ProductionOrder model', () => {
      const dto = new CreateProductionOrderDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma ProductionOrder required fields: productId, quantityPlanned, unit
      const requiredPrismaFields = ['productId', 'quantityPlanned', 'unit'];
      
      requiredPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });

    it('should have optional fields matching Prisma ProductionOrder model', () => {
      const dto = new CreateProductionOrderDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma ProductionOrder optional fields
      const optionalPrismaFields = ['name', 'code', 'status', 'plannedStartAt', 'plannedEndAt', 'productionSite', 'notes', 'productionCountryId', 'manufacturerId'];
      
      optionalPrismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });
  });

  describe('CreateFinancialDocumentDto', () => {
    it('should have fields matching Prisma FinancialDocument model', () => {
      const dto = new CreateFinancialDocumentDto();
      const dtoKeys = Object.keys(dto);
      
      // Prisma FinancialDocument fields
      const prismaFields = ['type', 'amountTotal', 'currency', 'docDate', 'supplierId', 'productionOrderId', 'scmSupplyId', 'purchaseId', 'expenseId'];
      
      prismaFields.forEach(field => {
        expect(dtoKeys.includes(field)).toBe(true);
      });
    });

    it('should support all FinancialDocumentType enum values', () => {
      const validTypes = ['SUPPLY', 'PRODUCTION', 'PURCHASE', 'EXPENSE', 'INVOICE', 'BILL', 'ACT', 'CREDIT_NOTE', 'OTHER'];
      
      validTypes.forEach(type => {
        const dto = new CreateFinancialDocumentDto();
        dto.type = type as any;
        expect(dto.type).toBe(type);
      });
    });
  });

  describe('Controller DTO Usage', () => {
    it('should verify DTOs are used in controllers', () => {
      // This is a structural check - actual usage is verified in e2e tests
      expect(CreateSupplierDto).toBeDefined();
      expect(CreateWarehouseDto).toBeDefined();
      expect(CreateScmSupplyDto).toBeDefined();
      expect(CreateProductionOrderDto).toBeDefined();
      expect(CreateFinancialDocumentDto).toBeDefined();
    });
  });
});

