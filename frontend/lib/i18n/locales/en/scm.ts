import { Messages } from '../../types';

export const scmEn: Messages = {
  products: {
    list: {
      title: 'SCM Products',
      subtitle: 'Internal products (SKU) for supply chain management',
      table: {
        columns: {
          internalName: 'Internal Name',
          sku: 'SKU',
          brand: 'Brand',
          listings: 'Listings',
          createdAt: 'Created At',
        },
        empty: 'No SCM products found',
      },
      actions: {
        create: 'Create SCM Product',
      },
    },
    create: {
      title: 'Create SCM Product',
      subtitle: 'Create a new internal product for supply chain management',
      fields: {
        internalName: 'Internal Name',
        sku: 'SKU',
        brand: 'Brand',
        baseDescription: 'Base Description',
        composition: 'Composition',
      },
      messages: {
        created: 'SCM product created successfully',
        error: 'Failed to create SCM product',
      },
    },
    edit: {
      title: 'Edit SCM Product',
      subtitle: 'Update SCM product information',
      messages: {
        updated: 'SCM product updated successfully',
        error: 'Failed to update SCM product',
      },
    },
  },
};




























