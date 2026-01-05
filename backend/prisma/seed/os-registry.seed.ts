import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ActionDef = {
  code: string;
  handlerName: string;
  actionType: string;
  name: string;
  description?: string;
  httpMethod?: string;
  httpPath?: string;
  isPostingAction?: boolean;
  allowedFromStatuses?: string[] | null;
  targetStatus?: string | null;
  isBulk?: boolean;
  enabledForAgents?: boolean;
  requiredRole?: string | null;
  requestSchema?: any;
  responseSchema?: any;
  allowWhenNoStatus?: boolean;
};

type ObjectDef = {
  code: string;
  name: string;
  domain: string;
  entityName?: string | null;
  serviceKey?: string | null;
  apiBasePath?: string | null;
  primaryKey?: string | null;
  idPayloadKey?: string | null;
  description?: string | null;
  isActive?: boolean;
  isInternal?: boolean;
  statusEntityName?: string | null;
  statusFieldName?: string | null;
  statusesDefinition?: string[] | null;
  actions: ActionDef[];
  lifecycle?: any;
};

const OBJECTS: ObjectDef[] = [
  {
    code: 'SUPPLY',
    name: 'Supply',
    domain: 'SCM',
    entityName: 'ScmSupply',
    serviceKey: 'ScmSuppliesService',
    apiBasePath: '/scm/supplies',
    primaryKey: 'id',
    idPayloadKey: 'supplyId',
    statusEntityName: 'ScmSupply',
    statusFieldName: 'status',
    statusesDefinition: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    actions: [
      {
        code: 'CONFIRM_RECEIVE',
        handlerName: 'confirmReceiveOs',
        actionType: 'COMMAND',
        name: 'Confirm Receive',
        httpMethod: 'POST',
        httpPath: '/:id/confirm-receive',
        enabledForAgents: true,
        allowedFromStatuses: ['CONFIRMED', 'PARTIALLY_RECEIVED'],
        targetStatus: 'RECEIVED',
      },
    ],
    lifecycle: {
      initialStatus: 'DRAFT',
      states: {
        DRAFT: { allowedActions: ['CONFIRM', 'CANCEL'] },
        CONFIRMED: { allowedActions: ['CONFIRM_RECEIVE', 'CANCEL'] },
        PARTIALLY_RECEIVED: { allowedActions: ['CONFIRM_RECEIVE', 'CANCEL'] },
        RECEIVED: { allowedActions: [] },
        CANCELLED: { allowedActions: [] },
      },
    },
  },
  {
    code: 'SALES_DOCUMENT',
    name: 'Sales Document',
    domain: 'FINANCE',
    entityName: 'SalesDocument',
    serviceKey: 'SalesDocumentsService',
    apiBasePath: '/finance/sales-documents',
    primaryKey: 'id',
    idPayloadKey: 'salesDocumentId',
    statusEntityName: 'SalesDocument',
    statusFieldName: 'status',
    statusesDefinition: ['IMPORTED', 'VALIDATED', 'POSTED', 'CANCELLED'],
    actions: [
      {
        code: 'VALIDATE',
        handlerName: 'validateSalesDocument',
        actionType: 'COMMAND',
        name: 'Validate sales document',
        httpMethod: 'POST',
        httpPath: '/:id/validate',
        enabledForAgents: true,
        allowedFromStatuses: ['IMPORTED'],
        targetStatus: 'VALIDATED',
      },
      {
        code: 'POST',
        handlerName: 'postSalesDocument',
        actionType: 'COMMAND',
        name: 'Post sales document',
        httpMethod: 'POST',
        httpPath: '/:id/post',
        isPostingAction: true,
        enabledForAgents: true,
        allowedFromStatuses: ['VALIDATED'],
        targetStatus: 'POSTED',
      },
    ],
    lifecycle: {
      initialStatus: 'IMPORTED',
      states: {
        IMPORTED: { allowedActions: ['VALIDATE', 'CANCEL'] },
        VALIDATED: { allowedActions: ['POST', 'CANCEL'] },
        POSTED: { allowedActions: [] },
        CANCELLED: { allowedActions: [] },
      },
    },
  },
  {
    code: 'INVENTORY_BALANCE',
    name: 'Inventory Balance',
    domain: 'INVENTORY',
    serviceKey: 'InventoryReportService',
    primaryKey: 'id',
    idPayloadKey: null,
    actions: [
      { code: 'GET_BALANCES', handlerName: 'getBalances', actionType: 'QUERY', name: 'Get balances', enabledForAgents: true },
      { code: 'GET_BATCHES', handlerName: 'getBatches', actionType: 'QUERY', name: 'Get batches', enabledForAgents: true },
      { code: 'GET_MOVEMENTS', handlerName: 'getMovements', actionType: 'QUERY', name: 'Get movements', enabledForAgents: true },
    ],
  },
  {
    code: 'INVENTORY_ADJUSTMENT',
    name: 'Inventory Adjustment',
    domain: 'INVENTORY',
    serviceKey: 'ScmStocksService',
    entityName: 'InventoryAdjustment',
    primaryKey: 'id',
    idPayloadKey: 'adjustmentId',
    statusEntityName: 'InventoryAdjustment',
    statusFieldName: 'status',
    statusesDefinition: ['DRAFT', 'POSTED', 'CANCELLED'],
    actions: [
      {
        code: 'POST_ADJUSTMENT',
        handlerName: 'adjustStock',
        actionType: 'COMMAND',
        name: 'Post inventory adjustment',
        httpMethod: 'POST',
        httpPath: '/adjust',
        enabledForAgents: true,
        allowedFromStatuses: ['DRAFT'],
        targetStatus: 'POSTED',
        allowWhenNoStatus: true,
      },
    ],
  },
  {
    code: 'STOCK_TRANSFER',
    name: 'Stock Transfer',
    domain: 'INVENTORY',
    serviceKey: 'TransfersService',
    entityName: 'ScmTransfer',
    primaryKey: 'id',
    idPayloadKey: 'transferId',
    statusEntityName: 'ScmTransfer',
    statusFieldName: 'status',
    statusesDefinition: ['DRAFT', 'REQUESTED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'],
    actions: [
      {
        code: 'POST',
        handlerName: 'postTransfer',
        actionType: 'COMMAND',
        name: 'Post transfer',
        httpMethod: 'POST',
        httpPath: '/:id/post',
        enabledForAgents: true,
        allowedFromStatuses: ['DRAFT', 'REQUESTED'],
        targetStatus: 'DELIVERED',
      },
    ],
  },
];

async function upsertObject(def: ObjectDef) {
  const object = await prisma.osDomainObject.upsert({
    where: { code: def.code },
    update: {
      name: def.name,
      domain: def.domain,
      entityName: def.entityName ?? null,
      serviceKey: def.serviceKey ?? null,
      apiBasePath: def.apiBasePath ?? null,
      primaryKey: def.primaryKey ?? 'id',
      idPayloadKey: def.idPayloadKey ?? 'id',
      description: def.description ?? null,
      isActive: def.isActive ?? true,
      isInternal: def.isInternal ?? false,
      statusEntityName: def.statusEntityName ?? null,
      statusFieldName: def.statusFieldName ?? null,
      statusesDefinition: def.statusesDefinition ? def.statusesDefinition : Prisma.JsonNull,
    },
    create: {
      code: def.code,
      name: def.name,
      domain: def.domain,
      entityName: def.entityName ?? null,
      serviceKey: def.serviceKey ?? null,
      apiBasePath: def.apiBasePath ?? null,
      primaryKey: def.primaryKey ?? 'id',
      idPayloadKey: def.idPayloadKey ?? 'id',
      description: def.description ?? null,
      isActive: def.isActive ?? true,
      isInternal: def.isInternal ?? false,
      statusEntityName: def.statusEntityName ?? null,
      statusFieldName: def.statusFieldName ?? null,
      statusesDefinition: def.statusesDefinition ? def.statusesDefinition : Prisma.JsonNull,
    },
  });

  // Actions
  for (const act of def.actions) {
    const existing = await prisma.osDomainAction.findFirst({
      where: { objectId: object.id, code: act.code },
    });
    if (existing) {
      await prisma.osDomainAction.update({
        where: { id: existing.id },
        data: {
          handlerName: act.handlerName,
          actionType: act.actionType,
          name: act.name,
          description: act.description ?? null,
          httpMethod: act.httpMethod ?? null,
          httpPath: act.httpPath ?? null,
          isPostingAction: act.isPostingAction ?? false,
          allowedFromStatuses: act.allowedFromStatuses ? JSON.stringify(act.allowedFromStatuses) : null,
          targetStatus: act.targetStatus ?? null,
          isBulk: act.isBulk ?? false,
          enabledForAgents: act.enabledForAgents ?? true,
          requiredRole: act.requiredRole ?? null,
          requestSchema: act.requestSchema ?? null,
          responseSchema: act.responseSchema ?? null,
          allowWhenNoStatus: act.allowWhenNoStatus ?? false,
        },
      });
    } else {
      await prisma.osDomainAction.create({
        data: {
          objectId: object.id,
          code: act.code,
          handlerName: act.handlerName,
          actionType: act.actionType,
          name: act.name,
          description: act.description ?? null,
          httpMethod: act.httpMethod ?? null,
          httpPath: act.httpPath ?? null,
          isPostingAction: act.isPostingAction ?? false,
          allowedFromStatuses: act.allowedFromStatuses ? JSON.stringify(act.allowedFromStatuses) : null,
          targetStatus: act.targetStatus ?? null,
          isBulk: act.isBulk ?? false,
          enabledForAgents: act.enabledForAgents ?? true,
          requiredRole: act.requiredRole ?? null,
          requestSchema: act.requestSchema ?? null,
          responseSchema: act.responseSchema ?? null,
          allowWhenNoStatus: act.allowWhenNoStatus ?? false,
        },
      });
    }
  }

  // Lifecycle (single DEFAULT)
  if (def.lifecycle) {
    const existingLc = await prisma.osLifecycle.findFirst({
      where: { objectId: object.id, code: 'DEFAULT' },
    });
    if (existingLc) {
      await prisma.osLifecycle.update({
        where: { id: existingLc.id },
        data: { definition: def.lifecycle },
      });
    } else {
      await prisma.osLifecycle.create({
        data: { objectId: object.id, code: 'DEFAULT', definition: def.lifecycle },
      });
    }
  }
}

async function main() {
  for (const obj of OBJECTS) {
    await upsertObject(obj);
  }
  console.log('OS Registry seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

