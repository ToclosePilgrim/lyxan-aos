import { Messages } from '../../types';

export const supportEn: Messages = {
  tickets: {
    list: {
      title: 'Support Tickets',
      subtitle: 'Support requests and tickets',
      table: {
        columns: {
          id: 'ID',
          title: 'Title',
          status: 'Status',
          createdAt: 'Created at',
          updatedAt: 'Updated at',
        },
        empty: 'No tickets yet',
      },
      actions: {
        create: 'Create ticket',
      },
    },
    create: {
      title: 'Create ticket',
      subtitle: 'Create a new support request',
      fields: {
        title: 'Title',
        description: 'Description',
      },
      placeholders: {
        title: 'Brief problem description',
        description: 'Detailed problem description',
      },
      actions: {
        create: 'Create ticket',
        cancel: 'Cancel',
      },
      messages: {
        created: 'Ticket created',
        error: 'Failed to create ticket',
      },
    },
    detail: {
      title: 'Ticket details',
      fields: {
        title: 'Title',
        description: 'Description',
        status: 'Status',
        createdAt: 'Created at',
        updatedAt: 'Updated at',
      },
      actions: {
        updateStatus: 'Update status',
      },
    },
    status: {
      NEW: 'New',
      IN_PROGRESS: 'In Progress',
      RESOLVED: 'Resolved',
      CLOSED: 'Closed',
    },
  },
  reviews: {
    list: {
      title: 'Reviews',
      subtitle: 'Product reviews and ratings',
    },
  },
};

