export class OsSalesDocumentDto {
  id: string;
  status: string;
  countryId?: string | null;
  marketplaceId?: string | null;
  brandId?: string | null;
  warehouseId?: string | null;
  periodFrom: string;
  periodTo: string;
  totalRevenue: number;
  totalCogs?: number;
  totalCommission: number;
  totalRefunds: number;
}

export class OsSalesDocumentLineDto {
  id: string;
  date: string;
  skuId?: string | null;
  productId?: string | null;
  itemId?: string | null;
  quantity: number;
  revenue: number;
  commission: number;
  refunds: number;
  cogsAmount?: number | null;
}
