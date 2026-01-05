export async function seedCountry(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
}) {
  const code =
    params.code.trim().toUpperCase().length > 10
      ? params.code.trim().toUpperCase().slice(-10)
      : params.code.trim().toUpperCase();
  return (
    await params
      .request()
      .post('/api/mdm/countries')
      .set('Authorization', `Bearer ${params.token}`)
      .send({ code, name: params.name })
      .expect(201)
  ).body;
}

export async function seedLegalEntity(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
  countryCode: string;
}) {
  return (
    await params
      .request()
      .post('/api/mdm/legal-entities')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        code: params.code,
        name: params.name,
        countryCode: params.countryCode,
      })
      .expect(201)
  ).body;
}

export async function seedBrand(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
}) {
  return (
    await params
      .request()
      .post('/api/mdm/brands')
      .set('Authorization', `Bearer ${params.token}`)
      .send({ code: params.code, name: params.name })
      .expect(201)
  ).body;
}

export async function seedBrandCountry(params: {
  request: () => any;
  token: string;
  brandId: string;
  countryId: string;
  legalEntityId?: string;
}) {
  return (
    await params
      .request()
      .post('/api/mdm/brands/brand-countries')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        brandId: params.brandId,
        countryId: params.countryId,
        legalEntityId: params.legalEntityId,
      })
      .expect(201)
  ).body;
}

export async function seedWarehouse(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
  countryId: string;
  type?: string;
}) {
  return (
    await params
      .request()
      .post('/api/scm/warehouses')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        code: params.code,
        name: params.name,
        countryId: params.countryId,
        type: params.type ?? 'OWN',
      })
      .expect(201)
  ).body;
}

export async function seedMdmItem(params: {
  request: () => any;
  token: string;
  type: string;
  name: string;
  code?: string;
  unit?: string;
}) {
  return (
    await params
      .request()
      .post('/api/mdm/items/ensure')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        type: params.type,
        name: params.name,
        code: params.code,
        unit: params.unit,
      })
      .expect(201)
  ).body;
}

export async function seedCashflowCategory(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
  isTransfer?: boolean;
}) {
  return (
    await params
      .request()
      .post('/api/finance/cashflow-categories')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        code: params.code,
        name: params.name,
        isTransfer: params.isTransfer,
      })
      .expect(201)
  ).body;
}

export async function seedPnlCategory(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
}) {
  return (
    await params
      .request()
      .post('/api/finance/pnl-categories')
      .set('Authorization', `Bearer ${params.token}`)
      .send({ code: params.code, name: params.name })
      .expect(201)
  ).body;
}

export async function seedApprovalPolicy(params: {
  request: () => any;
  token: string;
  legalEntityId: string;
  type: string;
  amountBaseFrom: string;
  amountBaseTo?: string | null;
  approverRole: string;
  isAutoApprove?: boolean;
}) {
  return (
    await params
      .request()
      .post('/api/finance/approval-policies')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        legalEntityId: params.legalEntityId,
        type: params.type,
        amountBaseFrom: params.amountBaseFrom,
        amountBaseTo: params.amountBaseTo ?? null,
        approverRole: params.approverRole,
        isAutoApprove: params.isAutoApprove ?? false,
      })
      .expect(201)
  ).body;
}

export async function seedMarketplace(params: {
  request: () => any;
  token: string;
  code: string;
  name: string;
}) {
  return (
    await params
      .request()
      .post('/api/mdm/marketplaces')
      .set('Authorization', `Bearer ${params.token}`)
      .send({ code: params.code, name: params.name })
      .expect(201)
  ).body;
}

export async function seedCategoryDefaultMapping(params: {
  request: () => any;
  token: string;
  legalEntityId?: string;
  sourceType: string;
  sourceCode: string;
  defaultCashflowCategoryId?: string;
  defaultPnlCategoryId?: string | null;
  priority?: number;
  isActive?: boolean;
}) {
  return (
    await params
      .request()
      .post('/api/finance/category-default-mappings')
      .set('Authorization', `Bearer ${params.token}`)
      .send({
        legalEntityId: params.legalEntityId,
        sourceType: params.sourceType,
        sourceCode: params.sourceCode,
        defaultCashflowCategoryId: params.defaultCashflowCategoryId,
        defaultPnlCategoryId: params.defaultPnlCategoryId ?? undefined,
        priority: params.priority ?? 100,
        isActive: params.isActive ?? true,
      })
      .expect(201)
  ).body;
}
