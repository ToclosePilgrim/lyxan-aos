import { Messages } from '../../types';

export const bcmEn: Messages = {
  brand: {
    list: {
      title: 'Brands',
      subtitle: 'Manage brands and catalog',
      table: {
        columns: {
          name: 'Brand name',
          code: 'Brand code',
          countries: 'Countries',
          createdAt: 'Created at',
          products: 'Products',
        },
        empty: 'No brands yet',
      },
      actions: {
        addBrand: 'Add brand',
        viewBrand: 'View brand',
      },
    },
    create: {
      title: 'Create brand',
      subtitle: 'Add a new brand to the system',
      fields: {
        name: 'Brand name',
        code: 'Brand code',
        countries: 'Countries of presence',
      },
      actions: {
        create: 'Create brand',
        cancel: 'Cancel',
      },
      messages: {
        created: 'Brand created successfully',
        error: 'Failed to create brand',
      },
    },
    edit: {
      title: 'Edit brand',
      subtitle: 'Update brand information',
      sections: {
        brandInfo: 'Brand information',
        presence: 'Brand presence',
      },
      fields: {
        name: 'Brand name',
        code: 'Brand code',
        countries: 'Countries of presence',
      },
      messages: {
        saved: 'Changes saved',
        error: 'Failed to save changes',
        notFound: 'Brand not found',
      },
    },
  },
  legalEntity: {
    sectionTitle: 'Legal entity',
    table: {
      columns: {
        country: 'Country',
        legalEntity: 'Legal entity',
        status: 'Status',
        actions: 'Actions',
      },
      empty: 'No countries added',
      status: {
        filled: 'Completed',
        empty: 'Not set',
      },
      actions: {
        add: 'Add legal entity',
        edit: 'Edit legal entity',
        remove: 'Remove',
      },
    },
    form: {
      titleCreate: 'Add legal entity',
      titleEdit: 'Edit legal entity',
      subtitle: 'Enter legal entity details',
      fields: {
        name: 'Legal entity name',
        inn: 'Tax ID (INN)',
        kpp: 'KPP',
        ogrn: 'OGRN',
        legalAddr: 'Legal address',
        bankName: 'Bank name',
        bik: 'BIC',
        account: 'Account number',
        corrAccount: 'Correspondent account',
        director: 'Managing director',
      },
      actions: {
        save: 'Save',
        cancel: 'Cancel',
      },
      messages: {
        saved: 'Legal entity saved successfully',
        error: 'Failed to save legal entity',
      },
    },
    addCountry: {
      label: 'Add country',
      placeholder: 'Select country',
      button: 'Add',
    },
    removeCountry: {
      confirm: 'Remove country from brand?',
    },
  },
  product: {
    list: {
      title: 'Listings',
      subtitle: 'Manage marketplace listings',
      table: {
        columns: {
          name: 'Listing name',
          sku: 'SKU',
          brand: 'Brand',
          marketplace: 'Marketplace',
          status: 'Status',
        },
        empty: 'No listings yet',
      },
      actions: {
        createListing: 'Create Listing',
      },
    },
    create: {
      title: 'Create Listing',
      subtitle: 'Create a new marketplace listing',
      fields: {
        brand: 'Brand',
        scmProduct: 'SCM Product',
        name: 'Listing Name',
        marketplace: 'Marketplace',
        category: 'Category',
        skuCode: 'SKU Code',
        skuName: 'SKU Name',
        price: 'Price',
        cost: 'Cost',
      },
      messages: {
        scmProductRequired: 'SCM Product is required',
        created: 'Listing created successfully',
        error: 'Failed to create listing',
      },
    },
    edit: {
      title: 'Edit Listing',
      subtitle: 'Update listing information',
      messages: {
        notLinkedToScm: 'Listing is not linked to SCM Product',
      },
    },
  },
};

