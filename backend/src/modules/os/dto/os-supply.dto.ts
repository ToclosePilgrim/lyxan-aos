export class OsSupplyItemDto {
  id: string;
  itemId: string;
  productId?: string | null;
  skuId?: string | null;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  unitPrice: number;
}

export class OsSupplyDto {
  id: string;
  status: string;
  supplierId: string;
  warehouseId: string;
  currency: string;
  createdAt: string;
  expectedArrivalDate?: string | null;
  items: OsSupplyItemDto[];
}

export class ConfirmReceiveItemDto {
  supplyItemId: string;
  quantity: number;
}

export class ConfirmReceiveDto {
  items: ConfirmReceiveItemDto[];
  receivedAt?: string;
}

