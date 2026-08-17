export type ResourceFlow = 'credit' | 'investment' | 'system';
export type ResourceFieldType = 'text' | 'textarea' | 'number' | 'money' | 'percentage' | 'date' | 'datetime' | 'select' | 'hidden';
export type LookupKey = 'banks' | 'platforms' | 'accounts' | 'tasks';
export type RequestMethod = 'post' | 'put' | 'patch';
export type ResourceColumnKind = 'text' | 'status' | 'bank' | 'money' | 'dayOfMonth' | 'billing';

export interface ResourceColumn {
  name: string;
  kind?: ResourceColumnKind;
  imageField?: string;
  secondaryField?: string;
  currencyField?: string;
}

export interface SelectOption {
  value: string | number;
  labelKey: string;
}

export interface ResourceField {
  name: string;
  sourceField?: string;
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
  layout?: 'creditCard';
  validation?: 'billingCycle';
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
  columns?: ResourceColumn[];
  rowHighlightField?: string;
}

const currencyOptions: SelectOption[] = [
  {value: 'VND', labelKey: 'option.currencyVnd'},
  {value: 'USD', labelKey: 'option.currencyUsd'}
];

const statusOptions: SelectOption[] = [
  {value: 'ACTIVE', labelKey: 'option.active'},
  {value: 'INACTIVE', labelKey: 'option.inactive'},
  {value: 'CLOSED', labelKey: 'option.closed'}
];

const cardFields: ResourceField[] = [
  {name: 'bankId', labelKey: 'field.bankId', type: 'select', lookup: 'banks', required: true, readonlyOnEdit: true},
  {name: 'nickname', labelKey: 'field.nickname', type: 'text', required: true, maxLength: 100},
  {name: 'lastFour', labelKey: 'field.lastFour', type: 'text', pattern: '^\\d{4}$', maxLength: 4},
  {name: 'creditLimit', labelKey: 'field.creditLimit', type: 'money', required: true, min: 0.0001},
  {name: 'statementDay', labelKey: 'field.statementDay', type: 'number', required: true, min: 1, max: 31},
  {name: 'dueDay', labelKey: 'field.dueDay', type: 'number', required: true, min: 1, max: 31},
  {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 1000}
];

const billingCycleForm: ResourceFormDefinition = {
  titleKey: 'form.billingCycle',
  descriptionKey: 'form.billingCycleDescription',
  method: 'put',
  path: row => `credit-cards/${row!['id']}/billing-cycle`,
  validation: 'billingCycle',
  fields: [
    {name: 'billingCycleId', labelKey: 'field.billingStatus', type: 'hidden'},
    {name: 'statementBalance', labelKey: 'field.statementBalance', type: 'money', required: true, min: 0.0001},
    {name: 'minimumPayment', labelKey: 'field.minimumPayment', type: 'money', required: true, min: 0.0001},
    {
      name: 'paymentStatus',
      labelKey: 'field.paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'UNPAID',
      options: [
        {value: 'UNPAID', labelKey: 'billing.unpaid'},
        {value: 'PAID', labelKey: 'billing.paid'}
      ]
    },
    {name: 'version', sourceField: 'billingVersion', labelKey: 'field.version', type: 'hidden', required: true}
  ]
};

const accountFields: ResourceField[] = [
  {name: 'accountCode', labelKey: 'field.accountCode', type: 'text', required: true, maxLength: 100},
  {name: 'accountName', labelKey: 'field.accountName', type: 'text', required: true, maxLength: 150},
  {name: 'accountUsername', labelKey: 'field.accountUsername', type: 'text', required: true, maxLength: 100},
  {name: 'accountEmail', labelKey: 'field.accountEmail', type: 'text', required: true, maxLength: 150},
  {name: 'phoneNumber', labelKey: 'field.phoneNumber', type: 'text', required: true, maxLength: 50},
  {name: 'registerDate', labelKey: 'field.registerDate', type: 'date', required: true},
  {name: 'accountPassword', labelKey: 'field.accountPassword', type: 'text', required: true, maxLength: 100},
  {name: 'currency', labelKey: 'field.currency', type: 'select', options: currencyOptions, defaultValue: 'VND', required: true, readonlyOnEdit: true}
];

export const resourceDefinitions: Record<string, ResourceDefinition> = {
  creditCards: {
    key: 'creditCards',
    titleKey: 'route.myCards',
    apiPath: 'credit-cards',
    flow: 'credit',
    rowHighlightField: 'billingStatus',
    columns: [
      {name: 'bankName', kind: 'bank', imageField: 'bankLogoUrl', secondaryField: 'lastFour'},
      {name: 'nickname'},
      {name: 'creditLimit', kind: 'money', currencyField: 'currency'},
      {name: 'currentBalance', kind: 'money', currencyField: 'currency'},
      {name: 'statementDay', kind: 'dayOfMonth'},
      {name: 'dueDay', kind: 'dayOfMonth'},
      {name: 'billingStatus', kind: 'billing', currencyField: 'currency'},
      {name: 'status', kind: 'status'}
    ],
    create: {
      titleKey: 'form.addCard',
      descriptionKey: 'form.addCardDescription',
      method: 'post',
      path: () => 'credit-cards',
      layout: 'creditCard',
      fields: cardFields
    },
    edit: {
      titleKey: 'form.editCard',
      descriptionKey: 'form.editCardDescription',
      method: 'put',
      path: row => `credit-cards/${row!['id']}`,
      detailPath: row => `credit-cards/${row['id']}`,
      stripFields: ['bankId'],
      layout: 'creditCard',
      fields: [
        ...cardFields,
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true},
        {name: 'creditLimitVersion', labelKey: 'field.version', type: 'hidden', required: true},
        {name: 'version', labelKey: 'field.version', type: 'number', required: true}
      ]
    },
    actions: [
      {
        key: 'enterBillingCycle',
        labelKey: 'action.enterStatement',
        form: billingCycleForm,
        visible: row => row['billingStatus'] === 'NEEDS_INPUT'
      },
      {
        key: 'updateBillingCycle',
        labelKey: 'action.updatePayment',
        form: billingCycleForm,
        visible: row => row['billingStatus'] === 'UNPAID' || row['billingStatus'] === 'OVERDUE'
      }
    ]
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
      stripFields: ['currency'],
      fields: [
        ...accountFields,
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true},
        {name: 'version', labelKey: 'field.version', type: 'number', required: true}
      ]
    }
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
