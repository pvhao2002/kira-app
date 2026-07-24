export type ResourceFlow = 'credit' | 'investment' | 'system';
export type ResourceFieldType = 'text' | 'textarea' | 'number' | 'money' | 'percentage' | 'date' | 'datetime' | 'select';
export type LookupKey = 'catalogCards' | 'userCards' | 'mccs' | 'statements' | 'serviceProviders'
  | 'platforms' | 'accounts' | 'tasks';
export type RequestMethod = 'post' | 'put' | 'patch';

export interface SelectOption {
  value: string | number;
  labelKey: string;
}

export interface ResourceField {
  name: string;
  labelKey: string;
  type: ResourceFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  defaultValue?: string | number | null;
  lookup?: LookupKey;
  options?: SelectOption[];
  readonlyOnEdit?: boolean;
}

export interface ResourceFormDefinition {
  titleKey: string;
  descriptionKey: string;
  method: RequestMethod;
  path: (row: Record<string, unknown> | null, values: Record<string, unknown>) => string;
  detailPath?: (row: Record<string, unknown>) => string;
  idempotent?: boolean;
  stripFields?: string[];
  fields: ResourceField[];
}

export interface ResourceActionDefinition {
  key: string;
  labelKey: string;
  form?: ResourceFormDefinition;
  method?: RequestMethod;
  path?: (row: Record<string, unknown>) => string;
  confirmKey?: string;
  visible?: (row: Record<string, unknown>) => boolean;
}

export interface ResourceDefinition {
  key: string;
  titleKey: string;
  apiPath: string;
  flow: ResourceFlow;
  create?: ResourceFormDefinition;
  edit?: ResourceFormDefinition;
  actions?: ResourceActionDefinition[];
  readOnlyKey?: string;
}

const currencyOptions: SelectOption[] = [
  {value: 'VND', labelKey: 'option.currencyVnd'},
  {value: 'USD', labelKey: 'option.currencyUsd'}
];

const paymentMethodOptions: SelectOption[] = [
  {value: 'BANK_TRANSFER', labelKey: 'option.bankTransfer'},
  {value: 'CASH', labelKey: 'option.cash'},
  {value: 'E_WALLET', labelKey: 'option.eWallet'}
];

const statusOptions: SelectOption[] = [
  {value: 'ACTIVE', labelKey: 'option.active'},
  {value: 'INACTIVE', labelKey: 'option.inactive'},
  {value: 'CLOSED', labelKey: 'option.closed'}
];

const cardFields: ResourceField[] = [
  {name: 'cardCatalogId', labelKey: 'field.cardCatalog', type: 'select', lookup: 'catalogCards', required: true, readonlyOnEdit: true},
  {name: 'nickname', labelKey: 'field.nickname', type: 'text', required: true, maxLength: 100},
  {name: 'lastFour', labelKey: 'field.lastFour', type: 'text', pattern: '^\\d{4}$', maxLength: 4},
  {name: 'creditLimit', labelKey: 'field.creditLimit', type: 'money', required: true, min: 0.0001},
  {name: 'statementDay', labelKey: 'field.statementDay', type: 'number', required: true, min: 1, max: 31},
  {name: 'dueDay', labelKey: 'field.dueDay', type: 'number', required: true, min: 1, max: 31},
  {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
];

const accountFields: ResourceField[] = [
  {name: 'platformId', labelKey: 'field.platform', type: 'select', lookup: 'platforms', required: true, readonlyOnEdit: true},
  {name: 'accountName', labelKey: 'field.accountName', type: 'text', required: true, maxLength: 150},
  {name: 'externalAccountCode', labelKey: 'field.externalAccountCode', type: 'text', maxLength: 100},
  {name: 'currency', labelKey: 'field.currency', type: 'select', options: currencyOptions, defaultValue: 'VND', readonlyOnEdit: true},
  {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
];

export const resourceDefinitions: Record<string, ResourceDefinition> = {
  creditCards: {
    key: 'creditCards',
    titleKey: 'route.myCards',
    apiPath: 'credit-cards',
    flow: 'credit',
    create: {
      titleKey: 'form.addCard',
      descriptionKey: 'form.addCardDescription',
      method: 'post',
      path: () => 'credit-cards',
      fields: cardFields
    },
    edit: {
      titleKey: 'form.editCard',
      descriptionKey: 'form.editCardDescription',
      method: 'put',
      path: row => `credit-cards/${row!['id']}`,
      detailPath: row => `credit-cards/${row['id']}`,
      stripFields: ['cardCatalogId'],
      fields: [
        ...cardFields,
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true},
        {name: 'version', labelKey: 'field.version', type: 'number', required: true}
      ]
    }
  },
  cardTransactions: {
    key: 'cardTransactions',
    titleKey: 'route.cardTransactions',
    apiPath: 'card-transactions',
    flow: 'credit',
    create: {
      titleKey: 'form.addTransaction',
      descriptionKey: 'form.addTransactionDescription',
      method: 'post',
      path: () => 'card-transactions',
      fields: [
        {name: 'userCardId', labelKey: 'field.card', type: 'select', lookup: 'userCards', required: true},
        {name: 'transactionDate', labelKey: 'field.transactionDate', type: 'datetime', required: true},
        {name: 'mccId', labelKey: 'field.mcc', type: 'select', lookup: 'mccs', required: true},
        {name: 'amount', labelKey: 'field.amount', type: 'money', required: true, min: 0.0001},
        {name: 'currency', labelKey: 'field.currency', type: 'select', options: currencyOptions, defaultValue: 'VND'},
        {name: 'referenceNumber', labelKey: 'field.referenceNumber', type: 'text', required: true, maxLength: 100},
        {name: 'description', labelKey: 'field.description', type: 'text', maxLength: 500},
        {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
      ]
    }
  },
  statements: {
    key: 'statements',
    titleKey: 'route.statements',
    apiPath: 'statements',
    flow: 'credit',
    create: {
      titleKey: 'form.addStatement',
      descriptionKey: 'form.addStatementDescription',
      method: 'post',
      path: () => 'statements',
      fields: [
        {name: 'userCardId', labelKey: 'field.card', type: 'select', lookup: 'userCards', required: true},
        {name: 'periodStart', labelKey: 'field.periodStart', type: 'date', required: true},
        {name: 'periodEnd', labelKey: 'field.periodEnd', type: 'date', required: true},
        {name: 'statementDate', labelKey: 'field.statementDate', type: 'date', required: true},
        {name: 'dueDate', labelKey: 'field.dueDate', type: 'date', required: true},
        {name: 'openingBalance', labelKey: 'field.openingBalance', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'totalSpending', labelKey: 'field.totalSpending', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'totalRefund', labelKey: 'field.totalRefund', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'totalFee', labelKey: 'field.totalFee', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'totalInterest', labelKey: 'field.totalInterest', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'minimumPayment', labelKey: 'field.minimumPayment', type: 'money', required: true, min: 0, defaultValue: 0}
      ]
    }
  },
  payments: {
    key: 'payments',
    titleKey: 'route.payments',
    apiPath: 'payments',
    flow: 'credit',
    create: {
      titleKey: 'form.addPayment',
      descriptionKey: 'form.addPaymentDescription',
      method: 'post',
      path: (_row, values) => `statements/${values['statementId']}/payments`,
      idempotent: true,
      stripFields: ['statementId'],
      fields: [
        {name: 'statementId', labelKey: 'field.statement', type: 'select', lookup: 'statements', required: true},
        {name: 'amount', labelKey: 'field.amount', type: 'money', required: true, min: 0.0001},
        {name: 'paymentMethod', labelKey: 'field.paymentMethod', type: 'select', options: paymentMethodOptions, required: true},
        {name: 'sourceAccount', labelKey: 'field.sourceAccount', type: 'text', maxLength: 100},
        {name: 'referenceNumber', labelKey: 'field.referenceNumber', type: 'text', required: true, maxLength: 100},
        {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
      ]
    }
  },
  cashbacks: {
    key: 'cashbacks',
    titleKey: 'route.cashbacks',
    apiPath: 'cashbacks',
    flow: 'credit',
    readOnlyKey: 'resource.generatedReadOnly'
  },
  discountInvoices: {
    key: 'discountInvoices',
    titleKey: 'route.discountInvoices',
    apiPath: 'discount-invoices',
    flow: 'credit',
    create: {
      titleKey: 'form.addInvoice',
      descriptionKey: 'form.addInvoiceDescription',
      method: 'post',
      path: () => 'discount-invoices',
      fields: [
        {name: 'userCardId', labelKey: 'field.card', type: 'select', lookup: 'userCards', required: true},
        {name: 'serviceProviderId', labelKey: 'field.serviceProvider', type: 'select', lookup: 'serviceProviders', required: true},
        {name: 'invoiceNumber', labelKey: 'field.invoiceNumber', type: 'text', required: true, maxLength: 100},
        {name: 'invoiceDate', labelKey: 'field.invoiceDate', type: 'date', required: true},
        {name: 'invoiceAmount', labelKey: 'field.invoiceAmount', type: 'money', required: true, min: 0.0001},
        {name: 'amountPaid', labelKey: 'field.amountPaid', type: 'money', required: true, min: 0.0001},
        {name: 'serviceDiscountRate', labelKey: 'field.serviceDiscountRate', type: 'percentage', required: true, min: 0, defaultValue: 0},
        {name: 'additionalFee', labelKey: 'field.additionalFee', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'cashbackRate', labelKey: 'field.cashbackRate', type: 'percentage', required: true, min: 0, defaultValue: 0},
        {name: 'actualCashback', labelKey: 'field.actualCashback', type: 'money', min: 0, defaultValue: 0},
        {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
      ]
    }
  },
  investmentPlatforms: {
    key: 'investmentPlatforms',
    titleKey: 'route.investmentPlatforms',
    apiPath: 'investment/platforms',
    flow: 'investment',
    readOnlyKey: 'resource.catalogReadOnly'
  },
  investmentAccounts: {
    key: 'investmentAccounts',
    titleKey: 'route.investmentAccounts',
    apiPath: 'investment/accounts',
    flow: 'investment',
    create: {
      titleKey: 'form.addAccount',
      descriptionKey: 'form.addAccountDescription',
      method: 'post',
      path: () => 'investment/accounts',
      fields: accountFields
    },
    edit: {
      titleKey: 'form.editAccount',
      descriptionKey: 'form.editAccountDescription',
      method: 'put',
      path: row => `investment/accounts/${row!['id']}`,
      detailPath: row => `investment/accounts/${row['id']}`,
      stripFields: ['platformId', 'currency'],
      fields: [
        ...accountFields,
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true},
        {name: 'version', labelKey: 'field.version', type: 'number', required: true}
      ]
    }
  },
  investmentDeposits: {
    key: 'investmentDeposits',
    titleKey: 'route.investmentDeposits',
    apiPath: 'investment/deposits',
    flow: 'investment',
    create: {
      titleKey: 'form.addDeposit',
      descriptionKey: 'form.addDepositDescription',
      method: 'post',
      path: () => 'investment/deposits/completed',
      idempotent: true,
      fields: [
        {name: 'accountId', labelKey: 'field.account', type: 'select', lookup: 'accounts', required: true},
        {name: 'amount', labelKey: 'field.amount', type: 'money', required: true, min: 0.0001},
        {name: 'fee', labelKey: 'field.fee', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'paymentMethod', labelKey: 'field.paymentMethod', type: 'select', options: paymentMethodOptions},
        {name: 'referenceNumber', labelKey: 'field.referenceNumber', type: 'text', required: true, maxLength: 100},
        {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
      ]
    }
  },
  investmentTasks: {
    key: 'investmentTasks',
    titleKey: 'route.investmentTasks',
    apiPath: 'investment/tasks',
    flow: 'investment',
    create: {
      titleKey: 'form.addTask',
      descriptionKey: 'form.addTaskDescription',
      method: 'post',
      path: () => 'investment/tasks/allocate',
      idempotent: true,
      fields: [
        {name: 'accountId', labelKey: 'field.account', type: 'select', lookup: 'accounts', required: true},
        {name: 'taskCode', labelKey: 'field.taskCode', type: 'text', required: true, maxLength: 100},
        {name: 'taskName', labelKey: 'field.taskName', type: 'text', required: true, maxLength: 180},
        {name: 'taskType', labelKey: 'field.taskType', type: 'text', maxLength: 60},
        {name: 'allocatedCapital', labelKey: 'field.allocatedCapital', type: 'money', required: true, min: 0.0001},
        {name: 'expectedProfit', labelKey: 'field.expectedProfit', type: 'money', min: 0, defaultValue: 0},
        {name: 'expectedReward', labelKey: 'field.expectedReward', type: 'money', min: 0, defaultValue: 0},
        {name: 'expectedCompletionDate', labelKey: 'field.expectedCompletionDate', type: 'datetime'}
      ]
    },
    actions: [{
      key: 'settle',
      labelKey: 'action.settle',
      visible: row => ['IN_PROGRESS', 'WAITING_SETTLEMENT'].includes(String(row['status'])),
      form: {
        titleKey: 'form.settleTask',
        descriptionKey: 'form.settleTaskDescription',
        method: 'post',
        path: row => `investment/tasks/${row!['id']}/settlements`,
        idempotent: true,
        fields: [
          {name: 'totalReceived', labelKey: 'field.totalReceived', type: 'money', required: true, min: 0, defaultValue: 0},
          {name: 'capitalReturned', labelKey: 'field.capitalReturned', type: 'money', required: true, min: 0, defaultValue: 0},
          {name: 'profitReceived', labelKey: 'field.profitReceived', type: 'money', required: true, min: 0, defaultValue: 0},
          {name: 'rewardReceived', labelKey: 'field.rewardReceived', type: 'money', required: true, min: 0, defaultValue: 0},
          {name: 'fee', labelKey: 'field.fee', type: 'money', required: true, min: 0, defaultValue: 0},
          {name: 'referenceNumber', labelKey: 'field.referenceNumber', type: 'text', required: true, maxLength: 100}
        ]
      }
    }]
  },
  investmentRewards: {
    key: 'investmentRewards',
    titleKey: 'route.investmentRewards',
    apiPath: 'investment/rewards',
    flow: 'investment',
    create: {
      titleKey: 'form.addReward',
      descriptionKey: 'form.addRewardDescription',
      method: 'post',
      path: () => 'investment/rewards',
      idempotent: true,
      fields: [
        {name: 'accountId', labelKey: 'field.account', type: 'select', lookup: 'accounts', required: true},
        {name: 'taskId', labelKey: 'field.task', type: 'select', lookup: 'tasks'},
        {name: 'rewardType', labelKey: 'field.rewardType', type: 'text', required: true, maxLength: 40},
        {name: 'rewardSource', labelKey: 'field.rewardSource', type: 'text', maxLength: 150},
        {name: 'amount', labelKey: 'field.amount', type: 'money', required: true, min: 0.0001},
        {name: 'conditionDescription', labelKey: 'field.conditionDescription', type: 'textarea'},
        {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
      ]
    }
  },
  investmentWithdrawals: {
    key: 'investmentWithdrawals',
    titleKey: 'route.investmentWithdrawals',
    apiPath: 'investment/withdrawals',
    flow: 'investment',
    create: {
      titleKey: 'form.addWithdrawal',
      descriptionKey: 'form.addWithdrawalDescription',
      method: 'post',
      path: () => 'investment/withdrawals',
      idempotent: true,
      fields: [
        {name: 'accountId', labelKey: 'field.account', type: 'select', lookup: 'accounts', required: true},
        {name: 'requestedAmount', labelKey: 'field.requestedAmount', type: 'money', required: true, min: 0.0001},
        {name: 'fee', labelKey: 'field.fee', type: 'money', required: true, min: 0, defaultValue: 0},
        {name: 'destinationAccount', labelKey: 'field.destinationAccount', type: 'text', required: true, maxLength: 180},
        {name: 'referenceNumber', labelKey: 'field.referenceNumber', type: 'text', required: true, maxLength: 100}
      ]
    },
    actions: [{
      key: 'complete',
      labelKey: 'action.complete',
      method: 'post',
      path: row => `investment/withdrawals/${row['id']}/complete`,
      confirmKey: 'action.confirmCompleteWithdrawal',
      visible: row => ['PENDING_APPROVAL', 'PROCESSING'].includes(String(row['status']))
    }]
  },
  investmentLedger: {
    key: 'investmentLedger',
    titleKey: 'route.investmentLedger',
    apiPath: 'investment/accounts/0/ledger',
    flow: 'investment',
    readOnlyKey: 'resource.ledgerReadOnly'
  },
  notifications: {
    key: 'notifications',
    titleKey: 'route.notifications',
    apiPath: 'notifications',
    flow: 'system',
    readOnlyKey: 'resource.notificationsReadOnly',
    actions: [{
      key: 'read',
      labelKey: 'action.markRead',
      method: 'patch',
      path: row => `notifications/${row['id']}/read`,
      visible: row => !row['readAt']
    }]
  },
  creditReports: {
    key: 'creditReports',
    titleKey: 'route.creditReports',
    apiPath: '',
    flow: 'credit',
    readOnlyKey: 'resource.apiUnavailable'
  },
  investmentReports: {
    key: 'investmentReports',
    titleKey: 'route.investmentReports',
    apiPath: '',
    flow: 'investment',
    readOnlyKey: 'resource.apiUnavailable'
  },
  adminUsers: {
    key: 'adminUsers',
    titleKey: 'route.adminUsers',
    apiPath: '',
    flow: 'system',
    readOnlyKey: 'resource.apiUnavailable'
  },
  adminBanks: {
    key: 'adminBanks',
    titleKey: 'route.adminBanks',
    apiPath: '',
    flow: 'system',
    readOnlyKey: 'resource.apiUnavailable'
  },
  profile: {
    key: 'profile',
    titleKey: 'route.profile',
    apiPath: '',
    flow: 'system',
    readOnlyKey: 'resource.useSettings'
  },
  settings: {
    key: 'settings',
    titleKey: 'route.settings',
    apiPath: '',
    flow: 'system',
    readOnlyKey: 'resource.apiUnavailable'
  }
};
