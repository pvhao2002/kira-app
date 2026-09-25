export type ResourceFlow = 'credit' | 'investment' | 'personal' | 'system';
export type ResourceFieldType = 'text' | 'textarea' | 'number' | 'money' | 'percentage' | 'date' | 'datetime' | 'select' | 'hidden';
export type LookupKey = 'banks';
export type RequestMethod = 'post' | 'put' | 'patch' | 'delete';
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
  requestMetadata?: ResourceRequestMetadata[];
  fields: ResourceField[];
}

export interface ResourceRequestMetadata {
  name: string;
  sourceField?: string;
}

export interface ResourceActionDefinition {
  key: string;
  labelKey: string;
  form?: ResourceFormDefinition;
  method?: RequestMethod;
  path?: (row: Record<string, unknown>) => string;
  confirmKey?: string;
  /** Navigates instead of calling the API, e.g. to a dedicated feature page for the row. */
  route?: (row: Record<string, unknown>) => {commands: unknown[]; queryParams?: Record<string, unknown>};
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
  statusFilterOptions?: SelectOption[];
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
  {name: 'cardType', labelKey: 'field.cardType', type: 'text', required: true, maxLength: 150},
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
    {name: 'statementBalance', labelKey: 'field.statementBalance', type: 'money', required: true, min: 0},
    {name: 'minimumPayment', labelKey: 'field.minimumPayment', type: 'money', required: true, min: 0},
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
  ],
  requestMetadata: [
    {name: 'version', sourceField: 'billingVersion'}
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

const favoriteSongFields: ResourceField[] = [
  {name: 'title', labelKey: 'field.songTitle', type: 'text', required: true, maxLength: 255},
  {name: 'artist', labelKey: 'field.artist', type: 'text', maxLength: 255},
  {name: 'genre', labelKey: 'field.genre', type: 'text', maxLength: 100},
  {name: 'karaokeCode', labelKey: 'field.karaokeCode', type: 'text', maxLength: 100},
  {name: 'tone', labelKey: 'field.tone', type: 'text', maxLength: 50},
  {name: 'link', labelKey: 'field.musicLink', type: 'text', maxLength: 1000},
  {name: 'note', labelKey: 'field.note', type: 'textarea', maxLength: 10000}
];

const jobFields: ResourceField[] = [
  {name: 'companyName', labelKey: 'field.companyName', type: 'text', required: true, maxLength: 255},
  {name: 'positionTitle', labelKey: 'field.positionTitle', type: 'text', required: true, maxLength: 255},
  {name: 'location', labelKey: 'field.location', type: 'text', maxLength: 255},
  {name: 'jobUrl', labelKey: 'field.jobUrl', type: 'text', maxLength: 1000},
  {name: 'salary', labelKey: 'field.salary', type: 'text', maxLength: 255},
  {
    name: 'employmentType', labelKey: 'field.employmentType', type: 'select', options: [
      {value: 'FULL_TIME', labelKey: 'option.fullTime'},
      {value: 'PART_TIME', labelKey: 'option.partTime'},
      {value: 'CONTRACT', labelKey: 'option.contract'},
      {value: 'FREELANCE', labelKey: 'option.freelance'},
      {value: 'INTERNSHIP', labelKey: 'option.internship'},
      {value: 'OTHER', labelKey: 'option.other'}
    ]
  },
  {
    name: 'status', labelKey: 'field.status', type: 'select', required: true, defaultValue: 'SAVED', options: [
      {value: 'SAVED', labelKey: 'job.statusSaved'},
      {value: 'APPLIED', labelKey: 'job.statusApplied'},
      {value: 'INTERVIEW', labelKey: 'job.statusInterview'},
      {value: 'OFFER', labelKey: 'job.statusOffer'},
      {value: 'REJECTED', labelKey: 'job.statusRejected'},
      {value: 'WITHDRAWN', labelKey: 'job.statusWithdrawn'}
    ]
  },
  {
    name: 'priority', labelKey: 'field.priority', type: 'select', required: true, defaultValue: 'MEDIUM', options: [
      {value: 'LOW', labelKey: 'job.priorityLow'},
      {value: 'MEDIUM', labelKey: 'job.priorityMedium'},
      {value: 'HIGH', labelKey: 'job.priorityHigh'}
    ]
  },
  {name: 'deadline', labelKey: 'field.deadline', type: 'date'},
  {name: 'contactName', labelKey: 'field.contactName', type: 'text', maxLength: 255},
  {name: 'contactEmail', labelKey: 'field.contactEmail', type: 'text', maxLength: 255},
  {name: 'notes', labelKey: 'field.note', type: 'textarea', maxLength: 10000}
];

const jobStatusOptions: SelectOption[] = [
  {value: 'SAVED', labelKey: 'job.statusSaved'},
  {value: 'APPLIED', labelKey: 'job.statusApplied'},
  {value: 'INTERVIEW', labelKey: 'job.statusInterview'},
  {value: 'OFFER', labelKey: 'job.statusOffer'},
  {value: 'REJECTED', labelKey: 'job.statusRejected'},
  {value: 'WITHDRAWN', labelKey: 'job.statusWithdrawn'}
];

const deleteSongAction: ResourceActionDefinition = {
  key: 'delete', labelKey: 'common.delete', method: 'delete',
  path: row => `karaoke/favorite-songs/${row['id']}?version=${row['version']}`, confirmKey: 'karaoke.deleteConfirm'
};

const deleteJobAction: ResourceActionDefinition = {
  key: 'delete', labelKey: 'common.delete', method: 'delete',
  path: row => `jobs/${row['id']}?version=${row['version']}`, confirmKey: 'job.deleteConfirm'
};

export const resourceDefinitions: Record<string, ResourceDefinition> = {
  creditCards: {
    key: 'creditCards',
    titleKey: 'route.myCards',
    apiPath: 'credit-cards',
    flow: 'credit',
    rowHighlightField: 'billingStatus',
    columns: [
      {name: 'bankName', kind: 'bank', imageField: 'bankLogoUrl', secondaryField: 'lastFour'},
      {name: 'cardType'},
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
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true}
      ],
      requestMetadata: [
        {name: 'creditLimitVersion'},
        {name: 'version'}
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
        key: 'importStatementWithAi',
        labelKey: 'action.importStatementAi',
        route: row => ({commands: ['/app/credit-card/statement-import'], queryParams: {cardId: row['id']}}),
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
  investmentAccounts: {
    key: 'investmentAccounts',
    titleKey: 'route.investmentAccounts',
    apiPath: 'investment/accounts',
    flow: 'investment',
    columns: [
      {name: 'accountCode'},
      {name: 'accountName'},
      {name: 'accountUsername'},
      {name: 'accountEmail'},
      {name: 'phoneNumber'},
      {name: 'registerDate'},
      {name: 'currency'},
      {name: 'status', kind: 'status'}
    ],
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
        {name: 'status', labelKey: 'field.status', type: 'select', options: statusOptions, required: true}
      ],
      requestMetadata: [{name: 'version'}]
    }
  },
  favoriteSongs: {
    key: 'favoriteSongs',
    titleKey: 'route.favoriteSongs',
    apiPath: 'karaoke/favorite-songs',
    flow: 'personal',
    statusFilterOptions: [],
    columns: [
      {name: 'title'},
      {name: 'artist'},
      {name: 'genre'},
      {name: 'karaokeCode'},
      {name: 'tone'},
      {name: 'link'}
    ],
    create: {
      titleKey: 'form.addFavoriteSong',
      descriptionKey: 'form.addFavoriteSongDescription',
      method: 'post', path: () => 'karaoke/favorite-songs', fields: favoriteSongFields
    },
    edit: {
      titleKey: 'form.editFavoriteSong',
      descriptionKey: 'form.editFavoriteSongDescription',
      method: 'put', path: row => `karaoke/favorite-songs/${row!['id']}`,
      fields: favoriteSongFields,
      requestMetadata: [{name: 'version'}]
    },
    actions: [deleteSongAction]
  },
  jobApplications: {
    key: 'jobApplications',
    titleKey: 'route.jobApplications',
    apiPath: 'jobs',
    flow: 'personal',
    statusFilterOptions: jobStatusOptions,
    columns: [
      {name: 'companyName'},
      {name: 'positionTitle'},
      {name: 'location'},
      {name: 'status', kind: 'status'},
      {name: 'priority', kind: 'status'},
      {name: 'deadline'},
      {name: 'salary'}
    ],
    create: {
      titleKey: 'form.addJob',
      descriptionKey: 'form.addJobDescription',
      method: 'post', path: () => 'jobs', fields: jobFields
    },
    edit: {
      titleKey: 'form.editJob',
      descriptionKey: 'form.editJobDescription',
      method: 'put', path: row => `jobs/${row!['id']}`,
      fields: jobFields,
      requestMetadata: [{name: 'version'}]
    },
    actions: [deleteJobAction]
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
