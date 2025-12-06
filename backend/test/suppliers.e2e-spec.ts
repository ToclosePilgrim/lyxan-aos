import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Suppliers (e2e)', () => {
  let app: any;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Очищаем тестовых поставщиков перед каждым тестом
    await prisma.supplier.deleteMany({
      where: { code: { in: ['TEST_SUPPLIER_RU', 'TEST_SUPPLIER_NO_LEGAL', 'TEST_SUPPLIER_GET', 'TEST_SUPPLIER_PATCH', 'TEST_SUPPLIER_RU_NEW', 'TEST_SUPPLIER_ID_NEW'] } },
    });
  });

  describe('POST /api/scm/suppliers', () => {
    it('should create a supplier with Russian legal profile', async () => {
      const token = await loginAsAdmin();

      // First, get a country (preferably Russia)
      const countriesRes = await request()
        .get('/api/org/countries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countries = countriesRes.body;
      expect(Array.isArray(countries)).toBe(true);
      
      const russia = countries.find((c: any) => c.code === 'RU');
      expect(russia).toBeDefined();

      const supplierData = {
        name: 'Test Supplier RU',
        code: 'TEST_SUPPLIER_RU',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
        countryId: russia.id,
        suppliesWhat: 'Test products',
        contactPerson: 'John Doe',
        email: 'test@supplier.ru',
        phone: '+7 999 123 4567',
        legalProfile: {
          countryCode: 'RU',
          inn: '7700000000',
          kpp: '770001001',
          ogrn: '1027700000000',
          legalAddress: 'Moscow, Test Street 1',
          actualAddress: 'Moscow, Test Street 1',
          bankAccount: '40702810123456789012',
          bankName: 'Test Bank',
          bankBic: '044525593',
          bankCorrAccount: '30101810100000000593',
          edoType: 'СБИС',
          edoNumber: '2BE3TEST123',
          generalDirector: 'Иванов Иван Иванович',
        },
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBe(supplierData.code);
      expect(response.body.types).toEqual(supplierData.types);
      expect(response.body.status).toBe(supplierData.status);
      expect(response.body.country).toBeDefined();
      expect(response.body.country.id).toBe(russia.id);
      
      // Check legal profile
      expect(response.body.legalProfiles).toBeDefined();
      expect(Array.isArray(response.body.legalProfiles)).toBe(true);
      expect(response.body.legalProfiles.length).toBeGreaterThan(0);
      
      const ruProfile = response.body.legalProfiles.find((p: any) => p.countryCode === 'RU');
      expect(ruProfile).toBeDefined();
      expect(ruProfile.inn).toBe(supplierData.legalProfile.inn);
      expect(ruProfile.kpp).toBe(supplierData.legalProfile.kpp);
      expect(ruProfile.ogrn).toBe(supplierData.legalProfile.ogrn);
    });

    it('should auto-generate code when code is not provided', async () => {
      const token = await loginAsAdmin();

      const supplierData = {
        name: 'Test Supplier Without Code',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBeDefined();
      expect(response.body.code).toMatch(/^SUP-\d{4}-\d{4}$/); // Format: SUP-2025-0001
    });

    it('should auto-generate code when code is empty string', async () => {
      const token = await loginAsAdmin();

      const supplierData = {
        name: 'Test Supplier Empty Code',
        code: '',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBeDefined();
      expect(response.body.code).toMatch(/^SUP-\d{4}-\d{4}$/); // Format: SUP-2025-0001
    });

    it('should create a supplier without legal profile', async () => {
      const token = await loginAsAdmin();

      const supplierData = {
        name: 'Test Supplier No Legal',
        code: 'TEST_SUPPLIER_NO_LEGAL',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBe(supplierData.code);
      expect(response.body.legalProfiles).toBeDefined();
      expect(Array.isArray(response.body.legalProfiles)).toBe(true);
    });

    it('POST /scm/suppliers creates supplier with minimal data (name only)', async () => {
      const token = await loginAsAdmin();

      const supplierData = {
        name: 'Minimal Test Supplier',
        types: ['MANUFACTURER'],
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBeDefined();
      expect(response.body.code).toMatch(/^SUP-\d{4}-\d{4}$/); // Auto-generated code
      expect(response.body.types).toEqual(supplierData.types);
      expect(response.body.status).toBe('ACTIVE'); // Default status
    });

    it('should create a supplier with RU countryCode and russianLegal (new structure)', async () => {
      const token = await loginAsAdmin();

      // Get Russia country
      const countriesRes = await request()
        .get('/api/org/countries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countries = countriesRes.body;
      const russia = countries.find((c: any) => c.code === 'RU');
      expect(russia).toBeDefined();

      const supplierData = {
        name: 'ООО Вимти',
        code: 'TEST_SUPPLIER_RU_NEW',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
        countryId: russia.id,
        countryCode: 'RU',
        russianLegal: {
          legalName: 'ООО «Вимти»',
          inn: '7701234567',
          kpp: '770101001',
          ogrn: '1234567890123',
          legalAddress: 'г. Москва, ул. Такая-то, д. 1',
          actualAddress: 'г. Москва, ул. Другая, д. 2',
          // Bank details (required)
          bankName: 'ПАО Сбербанк',
          bic: '044525225',
          bankAccount: '40702810123456789012',
          correspondentAccount: '30101810100000000593',
          bankExtraDetails: 'Дополнительная информация по оплатам',
          // Additional legal info
          edoSystem: 'СБИС',
          edoNumber: '2BE3TEST123',
          ceoFullName: 'Иванов Иван Иванович',
        },
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBe(supplierData.code);
      expect(response.body.country).toBeDefined();
      expect(response.body.country.id).toBe(russia.id);
      expect(response.body.country.code).toBe('RU');
      
      // Check that legalName is set in Supplier
      expect(response.body.legalName).toBe(supplierData.russianLegal.legalName);
      expect(response.body.legalAddress).toBe(supplierData.russianLegal.legalAddress);
      
      // Check legal profile
      expect(response.body.legalProfiles).toBeDefined();
      expect(Array.isArray(response.body.legalProfiles)).toBe(true);
      expect(response.body.legalProfiles.length).toBeGreaterThan(0);
      
      const ruProfile = response.body.legalProfiles.find((p: any) => p.countryCode === 'RU');
      expect(ruProfile).toBeDefined();
      expect(ruProfile.inn).toBe(supplierData.russianLegal.inn);
      expect(ruProfile.kpp).toBe(supplierData.russianLegal.kpp);
      expect(ruProfile.ogrn).toBe(supplierData.russianLegal.ogrn);
      expect(ruProfile.legalAddress).toBe(supplierData.russianLegal.legalAddress);
      expect(ruProfile.actualAddress).toBe(supplierData.russianLegal.actualAddress);
      
      // Check bank details
      expect(ruProfile.bankName).toBe(supplierData.russianLegal.bankName);
      expect(ruProfile.bankBic).toBe(supplierData.russianLegal.bic);
      expect(ruProfile.bankAccount).toBe(supplierData.russianLegal.bankAccount);
      expect(ruProfile.bankCorrAccount).toBe(supplierData.russianLegal.correspondentAccount);
      expect(ruProfile.bankExtraDetails).toBe(supplierData.russianLegal.bankExtraDetails);
      
      // Check additional legal info
      expect(ruProfile.edoType).toBe(supplierData.russianLegal.edoSystem);
      expect(ruProfile.edoNumber).toBe(supplierData.russianLegal.edoNumber);
      expect(ruProfile.generalDirector).toBe(supplierData.russianLegal.ceoFullName);
    });

    it('should create a supplier with non-RU countryCode and legal (new structure)', async () => {
      const token = await loginAsAdmin();

      // Get Indonesia country (or any non-RU country)
      const countriesRes = await request()
        .get('/api/org/countries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countries = countriesRes.body;
      const indonesia = countries.find((c: any) => c.code === 'ID');
      expect(indonesia).toBeDefined();

      const supplierData = {
        name: 'PT Aromatika',
        code: 'TEST_SUPPLIER_ID_NEW',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
        countryId: indonesia.id,
        countryCode: 'ID',
        legal: {
          legalName: 'PT Aromatika Nusantara',
          taxId: '123456789',
          registrationNumber: 'REG-123',
          legalAddress: 'Jl. Sunset Road 1, Jakarta',
          bankDetails: 'BCA, 123-456-789',
        },
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBe(supplierData.code);
      expect(response.body.country).toBeDefined();
      expect(response.body.country.id).toBe(indonesia.id);
      expect(response.body.country.code).toBe('ID');
      
      // Check that generic legal fields are set in Supplier
      expect(response.body.legalName).toBe(supplierData.legal.legalName);
      expect(response.body.taxId).toBe(supplierData.legal.taxId);
      expect(response.body.registrationNumber).toBe(supplierData.legal.registrationNumber);
      expect(response.body.legalAddress).toBe(supplierData.legal.legalAddress);
      expect(response.body.bankDetails).toBeDefined();
      
      // For non-RU countries, legalProfiles should be empty or not contain RU profile
      expect(response.body.legalProfiles).toBeDefined();
      expect(Array.isArray(response.body.legalProfiles)).toBe(true);
      const ruProfile = response.body.legalProfiles.find((p: any) => p.countryCode === 'RU');
      expect(ruProfile).toBeUndefined();
    });
  });

  describe('GET /api/scm/suppliers/:id', () => {
    it('should return supplier with legal profile', async () => {
      const token = await loginAsAdmin();

      // First, get a country
      const countriesRes = await request()
        .get('/api/org/countries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countries = countriesRes.body;
      const russia = countries.find((c: any) => c.code === 'RU');
      
      // Create a supplier with legal profile
      const supplierData = {
        name: 'Test Supplier for GET',
        code: 'TEST_SUPPLIER_GET',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
        countryId: russia?.id,
        legalProfile: {
          countryCode: 'RU',
          inn: '7700000001',
          kpp: '770001002',
        },
      };

      const createResponse = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      const supplierId = createResponse.body.id;

      // Get the supplier
      const getResponse = await request()
        .get(`/api/scm/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getResponse.body).toBeDefined();
      expect(getResponse.body.id).toBe(supplierId);
      expect(getResponse.body.legalProfiles).toBeDefined();
      expect(Array.isArray(getResponse.body.legalProfiles)).toBe(true);
      
      const ruProfile = getResponse.body.legalProfiles.find((p: any) => p.countryCode === 'RU');
      expect(ruProfile).toBeDefined();
      expect(ruProfile.inn).toBe(supplierData.legalProfile.inn);
    });
  });

  describe('PATCH /api/scm/suppliers/:id', () => {
    it('should update supplier and create/update legal profile', async () => {
      const token = await loginAsAdmin();

      // Create a supplier first
      const createData = {
        name: 'Test Supplier for PATCH',
        code: 'TEST_SUPPLIER_PATCH',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };

      const createResponse = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(createData)
        .expect(201);

      const supplierId = createResponse.body.id;

      // Get a country
      const countriesRes = await request()
        .get('/api/org/countries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countries = countriesRes.body;
      const russia = countries.find((c: any) => c.code === 'RU');

      // Update with legal profile
      const updateData = {
        countryId: russia?.id,
        legalProfile: {
          countryCode: 'RU',
          inn: '7700000002',
          kpp: '770001003',
          ogrn: '1027700000002',
        },
      };

      const updateResponse = await request()
        .patch(`/api/scm/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body).toBeDefined();
      expect(updateResponse.body.legalProfiles).toBeDefined();
      expect(Array.isArray(updateResponse.body.legalProfiles)).toBe(true);
      
      const ruProfile = updateResponse.body.legalProfiles.find((p: any) => p.countryCode === 'RU');
      expect(ruProfile).toBeDefined();
      expect(ruProfile.inn).toBe(updateData.legalProfile.inn);
      expect(ruProfile.kpp).toBe(updateData.legalProfile.kpp);
    });
  });
});

