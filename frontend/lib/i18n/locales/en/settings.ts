import { Messages } from '../../types';

export const settingsEn: Messages = {
  title: 'Settings Module',
  subtitle: 'System configuration',
  placeholder: {
    title: 'Settings Module Placeholder',
    description: 'This module is under development',
    content: 'Here will be functionality for system configuration, user management and settings.',
  },
  users: {
    title: 'Users',
    subtitle: 'Manage system users',
  },
  roles: {
    title: 'Roles',
    subtitle: 'Manage user roles',
  },
  countries: {
    title: 'Countries',
    subtitle: 'Manage countries',
    table: {
      columns: {
        name: 'Country name',
        code: 'Country code',
        actions: 'Actions',
      },
      empty: 'No countries yet',
    },
    form: {
      create: {
        title: 'Add country',
        fields: {
          name: 'Country name',
          code: 'Country code',
        },
        actions: {
          create: 'Create',
          cancel: 'Cancel',
        },
      },
      edit: {
        title: 'Edit country',
        fields: {
          name: 'Country name',
          code: 'Country code',
        },
        actions: {
          save: 'Save',
          cancel: 'Cancel',
        },
      },
    },
    actions: {
      add: 'Add country',
      edit: 'Edit',
      delete: 'Delete',
    },
    messages: {
      created: 'Country created successfully',
      updated: 'Country updated successfully',
      deleted: 'Country deleted successfully',
      error: 'Failed to perform operation',
      deleteConfirm: 'Are you sure you want to delete this country?',
    },
  },
  marketplaces: {
    title: 'Marketplaces',
    subtitle: 'Manage marketplaces',
    table: {
      columns: {
        name: 'Marketplace name',
        code: 'Marketplace code',
        countries: 'Countries',
        actions: 'Actions',
      },
      empty: 'No marketplaces yet',
    },
    form: {
      create: {
        title: 'Add marketplace',
        fields: {
          name: 'Marketplace name',
          code: 'Marketplace code',
          logoUrl: 'Logo URL',
        },
        actions: {
          create: 'Create',
          cancel: 'Cancel',
        },
      },
      edit: {
        title: 'Edit marketplace',
        fields: {
          name: 'Marketplace name',
          code: 'Marketplace code',
          logoUrl: 'Logo URL',
        },
        actions: {
          save: 'Save',
          cancel: 'Cancel',
        },
      },
    },
    actions: {
      add: 'Add marketplace',
      edit: 'Edit',
      delete: 'Delete',
      manageCountries: 'Manage countries',
    },
    messages: {
      created: 'Marketplace created successfully',
      updated: 'Marketplace updated successfully',
      deleted: 'Marketplace deleted successfully',
      error: 'Failed to perform operation',
      deleteConfirm: 'Are you sure you want to delete this marketplace?',
    },
  },
  marketplaceAvailability: {
    title: 'Marketplace Availability',
    subtitle: 'Manage marketplace availability by country',
    table: {
      columns: {
        marketplace: 'Marketplace',
        countries: 'Available countries',
        actions: 'Actions',
      },
      empty: 'No marketplaces yet',
    },
    form: {
      title: 'Edit marketplace countries',
      fields: {
        countries: 'Select countries',
      },
      actions: {
        save: 'Save',
        cancel: 'Cancel',
      },
    },
    messages: {
      updated: 'Marketplace countries updated successfully',
      error: 'Failed to update marketplace countries',
    },
  },
  marketplaceIntegrations: {
    title: 'Marketplace Integrations',
    subtitle: 'Manage marketplace integrations with API credentials',
    table: {
      columns: {
        name: 'Name',
        marketplace: 'Marketplace',
        brand: 'Brand',
        country: 'Country',
        status: 'Status',
        lastSync: 'Last Sync',
        actions: 'Actions',
      },
      empty: 'No integrations yet',
    },
    form: {
      create: {
        title: 'Add Integration',
        fields: {
          marketplace: 'Marketplace',
          brand: 'Brand',
          country: 'Country',
        },
        actions: {
          create: 'Create',
          cancel: 'Cancel',
        },
      },
    },
    detail: {
      title: 'Integration Details',
      sections: {
        info: 'Information',
        ozonSeller: 'Ozon Seller API',
        ozonPerformance: 'Ozon Performance API',
      },
      fields: {
        name: 'Name',
        marketplace: 'Marketplace',
        brand: 'Brand',
        country: 'Country',
        status: 'Status',
        lastSync: 'Last Sync',
        clientId: 'Client ID',
        token: 'Token',
        clientSecret: 'Client Secret',
        tokenSet: 'Token is set',
        secretSet: 'Secret is set',
      },
      actions: {
        save: 'Save',
        testConnection: 'Test Connection',
      },
    },
    actions: {
      add: 'Add Integration',
      configure: 'Configure',
    },
    status: {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      ERROR: 'Error',
    },
    messages: {
      created: 'Integration created successfully',
      updated: 'Integration updated successfully',
      testSuccess: 'Connection test passed',
      testError: 'Connection test failed',
      error: 'Failed to perform operation',
    },
  },
};
