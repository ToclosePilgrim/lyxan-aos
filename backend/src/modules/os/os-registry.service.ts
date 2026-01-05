import { Injectable } from '@nestjs/common';

interface RegistryAction {
  code: string;
  handlerName: string;
  serviceKey: string;
  enabledForAgents?: boolean;
  requiredRole?: string;
}

interface RegistryObject {
  code: string;
  actions: RegistryAction[];
}

@Injectable()
export class OsRegistryService {
  private readonly objects: RegistryObject[] = [
    {
      code: 'SUPPLY',
      actions: [
        {
          code: 'CONFIRM_RECEIVE',
          handlerName: 'confirmReceive',
          serviceKey: 'ScmSuppliesService',
          enabledForAgents: true,
        },
      ],
    },
    {
      code: 'SALES_DOCUMENT',
      actions: [
        {
          code: 'POST',
          handlerName: 'postSalesDocument',
          serviceKey: 'SalesDocumentsService',
          enabledForAgents: true,
        },
      ],
    },
    {
      code: 'INVENTORY_BALANCE',
      actions: [
        {
          code: 'GET_BALANCES',
          handlerName: 'getBalances',
          serviceKey: 'InventoryReportService',
          enabledForAgents: true,
        },
      ],
    },
  ];

  async resolveHandler(objectCode: string, actionCode: string) {
    const obj = this.objects.find((o) => o.code === objectCode);
    if (!obj) {
      throw {
        code: 'OS_OBJECT_NOT_FOUND',
        message: `Object ${objectCode} not registered`,
      };
    }
    const action = obj.actions.find((a) => a.code === actionCode);
    if (!action) {
      throw {
        code: 'OS_ACTION_NOT_FOUND',
        message: `Action ${actionCode} not registered for object ${objectCode}`,
      };
    }
    return {
      object: obj,
      action,
      serviceKey: action.serviceKey,
      handlerName: action.handlerName,
    };
  }
}

