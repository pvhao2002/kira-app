import {healthEnglish} from './health.translations';
import {overviewEnglish} from './overview.translations';
import {travelEnglish} from './travel.translations';
import {visitsEnglish} from './login-visits.translations';
import {usersEnglish} from './admin-users.translations';

export const englishTranslations = {
  ...usersEnglish,
  ...visitsEnglish,
  ...travelEnglish,
  ...healthEnglish,
  ...overviewEnglish,
  'language.change': 'Change language',
  'language.english': 'English',
  'language.vietnamese': 'Tiếng Việt',
  'theme.label': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'common.login': 'Log in',
  'common.register': 'Sign up',
  'common.startFree': 'Start for free',
  'common.search': 'Search',
  'common.all': 'All',
  'common.filter': 'Filter',
  'common.export': 'Export data',
  'common.reset': 'Reset',
  'common.addNew': 'Add new',
  'common.edit': 'Edit',
  'common.actions': 'Actions',
  'common.cancel': 'Cancel',
  'common.save': 'Save record',
  'common.viewDetails': 'View details →',
  'common.noLimit': 'No limit',
  'common.close': 'Close',
  'common.previous': 'Previous page',
  'common.next': 'Next page',
  'select.placeholder': 'Select an option',
  'select.search': 'Search options…',
  'select.noOptions': 'No matching options',
  'auth.registerEyebrow': 'Create your financial space',
  'auth.loginEyebrow': 'Welcome back',
  'auth.registerTitle': 'Get started with Kira Life',
  'auth.loginTitle': 'Log in to your account',
  'auth.registerDescription': 'Free, private and ready in minutes.',
  'auth.loginDescription': 'Continue managing your two separate cash flows.',
  'auth.fullName': 'Full name',
  'auth.fullNamePlaceholder': 'Jane Doe',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'At least 8 characters',
  'auth.validationError': 'Please check the required fields.',
  'auth.invalidCredentials': 'Incorrect email or password.',
  'auth.invalidEmail': 'Please enter a valid email address.',
  'auth.invalidPassword': 'Password must be at least 8 characters.',
  'auth.adminNotice': 'Accounts are issued by an Administrator. Contact your Admin if you need access.',
  'auth.heroTitle': 'Financial Flow & Asset Balance Management',
  'auth.heroDescription': 'Track credit cards, statements, payments and investment account profiles in one secure workspace.',
  'auth.featureSeparationTitle': 'Clear financial records',
  'auth.featureSeparationDesc': 'Keep cards, statements and payments easy to reconcile',
  'auth.featureSecurityTitle': '256-bit Security',
  'auth.featureSecurityDesc': 'End-to-end encrypted data with JWT Rotation',
  'auth.systemOperational': 'System operational · Encrypted SSL',
  'auth.showPassword': 'Show password',
  'auth.hidePassword': 'Hide password',
  'auth.processing': 'Processing…',
  'auth.createAccount': 'Create account',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': 'Don’t have an account?',
  'auth.registerNow': 'Sign up now',
  'shell.closeMenu': 'Close menu',
  'shell.openMenu': 'Open menu',
  'shell.overview': 'Overview',
  'shell.groupCredit': 'CREDIT CARDS',
  'shell.groupInvestment': 'INVESTMENTS',
  'shell.groupAdmin': 'ADMINISTRATION',
  'shell.adminUsers': 'User Management',
  'shell.adminBanks': 'Bank Directory',
  'shell.adminAiProviders': 'Cloudflare Accounts',
  'shell.groupSystem': 'SYSTEM',
  'shell.dashboard': 'Dashboard',
  'shell.myCards': 'My cards',
  'shell.banks': 'Bank directory',
  'shell.accounts': 'Accounts',
  'shell.investmentTransactions': 'Transaction import',
  'shell.investmentStatistics': 'Statistics',
  'shell.investmentAiQueue': 'AI queue',
  'shell.investmentHistory': 'History',
  'shell.notifications': 'Notifications',
  'shell.settings': 'Settings',
  'shell.secureConnection': 'Secure connection',
  'shell.dataProtected': 'Your data is protected',
  'shell.searchLabel': 'Global search',
  'shell.searchPlaceholder': 'Search pages, cards, banks, accounts…',
  'shell.searchResults': 'Global search results',
  'shell.searchGroupPages': 'Pages',
  'shell.searchGroupCards': 'Credit cards',
  'shell.searchGroupBanks': 'Banks',
  'shell.searchGroupAccounts': 'Investment accounts',
  'shell.searchOpenPage': 'Open page',
  'shell.searchLoading': 'Searching…',
  'shell.searchEmpty': 'No matching results',
  'shell.searchHint': 'Type at least 2 characters to search your data',
  'shell.searchPartialError': 'Some data sources could not be searched.',
  'shell.closeSearch': 'Close search',
  'shell.openAccountMenu': 'Open account menu',
  'shell.preferences': 'Preferences',
  'shell.profile': 'Profile',
  'shell.logout': 'Log out',
  'dashboard.date': 'Wednesday, July 22',
  'dashboard.title': 'Financial overview',
  'dashboard.greeting': 'Good afternoon. Here is your financial picture for today.',
  'dashboard.changeDateRange': 'Change date range',
  'dashboard.last7Days': 'Last 7 days',
  'dashboard.last30Days': 'Last 30 days',
  'dashboard.last90Days': 'Last 90 days',
  'dashboard.flowCredit': 'Credit Cards',
  'dashboard.goToDashboard': 'Go to dashboard →',
  'dashboard.dueSoon': 'Due soon',
  'dashboard.next7Days': 'Next 7 days',
  'dashboard.viewAll': 'View all',
  'dashboard.dueDate24': 'Due 24/07',
  'dashboard.dueDate27': 'Due 27/07',
  'dashboard.dueDate29': 'Due 29/07',
  'resource.flowCredit': 'CREDIT CARDS',
  'resource.flowInvestment': 'INVESTMENTS',
  'resource.flowSystem': 'SYSTEM',
  'resource.description': 'Track, search and reconcile your own data.',
  'resource.searchPlaceholder': 'Search…',
  'resource.filteredRecordCount': '{shown} / {total} records',
  'resource.recordCount': '{shown} / {total} records',
  'resource.emptyTitle': 'No data yet',
  'resource.emptyBody': 'Add your first record to start tracking and reconciling.',
  'resource.emptyReadOnlyBody': 'There are no records to display.',
  'resource.catalogReadOnly': 'This catalog is managed by the system and is read-only for users.',
  'resource.notificationsReadOnly': 'Notifications are generated by the system. You can only mark them as read.',
  'resource.apiUnavailable': 'This module does not have a backend API yet, so create and edit actions are disabled.',
  'resource.useSettings': 'Update your personal information from the Settings page.',
  'resource.dialogTitle': 'Create a new record',
  'resource.dialogBody': 'The form validates your data and sends all financial calculations to the backend for confirmation.',
  'resource.reference': 'Reference',
  'resource.referencePlaceholder': 'Unique reference code',
  'resource.note': 'Note',
  'resource.notePlaceholder': 'Additional information',
  'form.selectPlaceholder': 'Select an option',
  'form.required': 'This field is required.',
  'form.invalidFormat': 'The value has an invalid format.',
  'form.minimum': 'Minimum value is {value}.',
  'form.maximum': 'Maximum value is {value}.',
  'form.maxLength': 'Maximum length is {value} characters.',
  'form.invalidValue': 'Please check this value.',
  'form.confirmDiscard': 'Discard unsaved changes?',
  'form.saving': 'Saving…',
  'form.saved': 'Saved successfully.',
  'form.saveFailed': 'Unable to save this record.',
  'form.reloadRequired': 'This record is missing its current version. Reload and try again.',
  'form.addCard': 'Add a credit card',
  'form.addCardDescription': 'Choose the issuing bank and enter the remaining card details.',
  'form.editCard': 'Edit credit card',
  'form.editCardDescription': 'Update card settings without changing the issuing bank.',
  'form.sharedCreditLimitExistingHint': 'This bank already has a shared limit. All cards from this bank use the same limit.',
  'form.sharedCreditLimitEditHint': 'Changing this value updates the shared limit for every card from this bank.',
  'form.billingCycle': 'Update monthly statement',
  'form.billingCycleDescription': 'Enter the statement amounts and confirm whether the full balance has been paid.',
  'form.minimumPaymentExceedsBalance': 'Minimum payment cannot exceed the statement balance.',
  'form.minimumPaymentRequired': 'Minimum payment must be greater than zero when the statement has a balance.',
  'form.zeroStatementHint': 'A zero statement is completed automatically without creating a payment.',
  'form.addAccount': 'Add investment account',
  'form.addAccountDescription': 'Create a profile for an investment account.',
  'form.editAccount': 'Edit investment account',
  'form.editAccountDescription': 'Update the account profile and status.',
  'action.markRead': 'Mark as read',
  'action.enterStatement': 'Enter statement',
  'action.updatePayment': 'Update payment',
  'option.currencyVnd': 'VND — Vietnamese đồng',
  'option.currencyUsd': 'USD — US dollar',
  'option.active': 'Active',
  'option.inactive': 'Inactive',
  'option.closed': 'Closed',
  'settings.title': 'Settings',
  'settings.description': 'Manage your profile, security and personal preferences.',
  'settings.profileTitle': 'Personal profile',
  'settings.profileDescription': 'Keep your account information up to date.',
  'settings.phone': 'Phone number',
  'settings.saveProfile': 'Save profile',
  'settings.profileSaved': 'Profile updated successfully.',
  'settings.securityTitle': 'Security',
  'settings.securityDescription': 'Use a strong password that you do not reuse elsewhere.',
  'settings.currentPassword': 'Current password',
  'settings.newPassword': 'New password',
  'settings.confirmPassword': 'Confirm new password',
  'settings.passwordMismatch': 'The confirmation does not match the new password.',
  'settings.changePassword': 'Change password',
  'settings.passwordChanged': 'Password changed successfully.',
  'settings.appearanceTitle': 'Appearance and language',
  'settings.appearanceDescription': 'Choose how Kira Life is displayed.',
  'settings.language': 'Language',
  'settings.languageDescription': 'This preference is saved on this device.',
  'error.serverUnavailable': 'Unable to connect to the server',
  'route.login': 'Log in',
  'route.overview': 'Overview',
  'route.creditDashboard': 'Credit card dashboard',
  'route.adminUsers': 'User management',
  'route.adminBanks': 'Bank management',
  'route.adminAiProviders': 'Cloudflare Accounts',
  'route.profile': 'Profile',
  'route.banks': 'Bank directory',
  'route.myCards': 'My cards',
  'route.creditReports': 'Credit card reports',
  'route.investmentAccounts': 'Investment accounts',
  'route.investmentTransactions': 'Investment transactions',
  'route.investmentStatistics': 'Investment statistics',
  'route.investmentAiQueue': 'Investment AI queue',
  'route.investmentHistory': 'Transaction history',
  'route.notifications': 'Notifications',
  'route.settings': 'Settings',
  'aiProviders.eyebrow': 'ADMINISTRATION · CLOUDFLARE',
  'aiProviders.title': 'Cloudflare Accounts',
  'aiProviders.description': 'Manage encrypted Workers AI and R2 configuration without provider environment variables.',
  'aiProviders.add': 'Add account',
  'aiProviders.editTitle': 'Edit Cloudflare account',
  'aiProviders.createTitle': 'Add Cloudflare account',
  'aiProviders.name': 'Display name',
  'aiProviders.accountId': 'Account ID',
  'aiProviders.accountIdKeep': 'Leave blank to keep the current Account ID',
  'aiProviders.token': 'API token',
  'aiProviders.tokenKeep': 'Leave blank to keep the current token',
  'aiProviders.priority': 'Priority',
  'aiProviders.priorityHint': 'Lower numbers are tried first.',
  'aiProviders.save': 'Save account',
  'aiProviders.loading': 'Loading Cloudflare accounts…',
  'aiProviders.emptyTitle': 'No database accounts',
  'aiProviders.emptyDescription': 'Add and verify a Cloudflare account before using Workers AI or R2.',
  'aiProviders.test': 'Test',
  'aiProviders.enable': 'Enable',
  'aiProviders.disable': 'Disable',
  'aiProviders.delete': 'Delete',
  'aiProviders.testRequired': 'Test this credential successfully before enabling it.',
  'aiProviders.saved': 'Cloudflare account saved.',
  'aiProviders.testPassed': 'Cloudflare credential verified.',
  'aiProviders.enabled': 'Cloudflare account enabled.',
  'aiProviders.disabled': 'Cloudflare account disabled.',
  'aiProviders.deleted': 'Cloudflare account deleted.',
  'aiProviders.deleteConfirm': 'Delete this Cloudflare account?',
  'aiProviders.status': 'Status',
  'aiProviders.lastTested': 'Last tested',
  'aiProviders.lastSuccess': 'Last success',
  'aiProviders.cooldownUntil': 'Cooldown until',
  'aiProviders.lastError': 'Last error',
  'aiProviders.statusPending': 'Pending test',
  'aiProviders.statusVerified': 'Verified',
  'aiProviders.statusCooldown': 'Cooldown',
  'aiProviders.statusBlocked': 'Blocked',
  'aiProviders.loadFailed': 'Unable to load Cloudflare accounts.',
  'aiProviders.actionFailed': 'The Cloudflare account action failed.',
  'aiProviders.accountSection': 'Cloudflare account',
  'aiProviders.model': 'Model',
  'aiProviders.secretKeep': 'Leave blank to keep the current secret.',
  'aiProviders.r2AccessKey': 'R2 Access Key ID',
  'aiProviders.r2SecretKey': 'R2 Secret Access Key',
  'aiProviders.bucket': 'Bucket',
  'aiProviders.bucketKeep': 'Leave blank to keep the current bucket.',
  'aiProviders.publicUrl': 'Public URL (optional)',
  'aiProviders.files': 'Stored files',
  'aiProviders.testAi': 'Test AI connection',
  'aiProviders.testR2': 'Test R2 connection',
  'aiProviders.aiCredentialHint': 'Add and save the Workers AI API token before testing.',
  'aiProviders.r2CredentialHint': 'Add and save the R2 Access Key ID, Secret Access Key, and bucket before testing.',
  'aiProviders.aiTestPassed': 'Workers AI credential and model verified.',
  'aiProviders.r2TestPassed': 'R2 upload, read and delete verified.',
  'aiProviders.makePrimary': 'Make primary',
  'aiProviders.stopUploads': 'Stop uploads',
  'aiProviders.r2PrimaryStatus': 'Primary',
  'aiProviders.r2Primary': 'R2 is now receiving new uploads.',
  'aiProviders.r2Stopped': 'This R2 account no longer receives new uploads.',
  'aiProviders.adoptLegacy': 'Assign legacy files',
  'aiProviders.adoptConfirm': 'Assign {count} legacy files to this R2 account? This cannot be guessed automatically.',
  'aiProviders.adopted': 'Legacy files assigned to this R2 account.',
  'investmentTransactions.eyebrow': 'INVESTMENT · AI REVIEW',
  'investmentTransactions.historyEyebrow': 'INVESTMENT · HISTORY',
  'investmentTransactions.description': 'Send transaction screenshots to the AI queue, review each result, then save it to history.',
  'investmentTransactions.account': 'Account',
  'investmentTransactions.accountPlaceholder': 'Choose an account',
  'investmentTransactions.type': 'Type',
  'investmentTransactions.uploadTitle': '1. Choose transaction screenshots',
  'investmentTransactions.uploadDescription': 'Up to 10 JPEG/PNG/WebP files, 10 MB each and 50 MB per batch.',
  'investmentTransactions.dropTitle': 'Drop screenshots here',
  'investmentTransactions.dropHint': 'or click to choose from your device, or paste an image from the clipboard',
  'investmentTransactions.removeFile': 'Remove {name}',
  'investmentTransactions.uploading': 'Uploading screenshots…',
  'investmentTransactions.createBatch': 'Create AI batch',
  'investmentTransactions.batchTitle': '2. Processing status',
  'investmentTransactions.detected': 'Detected',
  'investmentTransactions.review': 'Needs review',
  'investmentTransactions.inserted': 'Added',
  'investmentTransactions.updated': 'Updated',
  'investmentTransactions.failed': 'Failed',
  'investmentTransactions.retryFile': 'Retry file',
  'investmentTransactions.reviewTitle': '3. Review and edit',
  'investmentTransactions.reviewDescription': 'The backend normalizes and checks duplicates again when you confirm.',
  'investmentTransactions.confirmSelected': 'Confirm selected items',
  'investmentTransactions.selectItem': 'Select {id}',
  'investmentTransactions.action': 'Action',
  'investmentTransactions.dateTime': 'Date and time',
  'investmentTransactions.externalId': 'External ID',
  'investmentTransactions.resolution': 'Resolution',
  'investmentTransactions.warnings': '{count} warnings',
  'investmentTransactions.notSelected': 'Not selected',
  'investmentTransactions.unknownValue': 'Unknown',
  'investmentTransactions.confirmResult': 'Confirmation result',
  'investmentTransactions.createdCount': '{count} created',
  'investmentTransactions.updatedCount': '{count} updated',
  'investmentTransactions.skippedCount': '{count} skipped',
  'investmentTransactions.failedCount': '{count} failed',
  'investmentTransactions.historyTitle': 'Transaction history',
  'investmentTransactions.historyDescription': 'This is an independent history and does not change balance or ledger.',
  'investmentTransactions.historyResults': '{count} transactions',
  'investmentTransactions.showFilters': 'Show filters',
  'investmentTransactions.hideFilters': 'Hide filters',
  'investmentTransactions.fromDate': 'From date',
  'investmentTransactions.toDate': 'To date',
  'investmentTransactions.allTypes': 'All types',
  'investmentTransactions.allStatuses': 'All statuses',
  'investmentTransactions.filter': 'Filter',
  'investmentTransactions.invalidDateRange': 'The from date must be earlier than or equal to the to date.',
  'investmentTransactions.loadingHistory': 'Loading transaction history…',
  'investmentTransactions.emptyHistory': 'No confirmed transactions yet.',
  'investmentTransactions.emptyHistoryTitle': 'No confirmed transactions yet',
  'investmentTransactions.emptyHistoryDescription': 'Confirmed transactions for this investment account will appear here.',
  'investmentTransactions.emptyFilteredTitle': 'No matching transactions',
  'investmentTransactions.emptyFilteredDescription': 'Try changing or clearing the current filters.',
  'investmentTransactions.clearFilters': 'Clear filters',
  'investmentTransactions.paginationRange': '{start}–{end} of {total} transactions',
  'investmentTransactions.paginationPage': 'Page {current} of {total}',
  'investmentTransactions.resolutionTitle': 'Resolve {action} item',
  'investmentTransactions.resolutionDescription': 'Choose how the backend handles this item after normalization and duplicate checks. Use “Save as new” only for genuinely different transactions.',
  'investmentTransactions.resolution.accept': 'Accept',
  'investmentTransactions.resolution.acceptDescription': 'Save the reviewed data if the backend finds no remaining conflict.',
  'investmentTransactions.resolution.mergeExisting': 'Merge existing',
  'investmentTransactions.resolution.mergeExistingDescription': 'Keep the existing transaction and only update its status or metadata.',
  'investmentTransactions.resolution.saveAsNew': 'Save as new',
  'investmentTransactions.resolution.saveAsNewDescription': 'Create a distinct fingerprint for a same-minute transaction without an external ID.',
  'investmentTransactions.resolution.skip': 'Skip',
  'investmentTransactions.resolution.skipDescription': 'Do not save this item.',
  'investmentTransactions.type.deposit': 'Deposit',
  'investmentTransactions.type.withdrawal': 'Withdrawal',
  'investmentTransactions.type.bonus': 'Bonus',
  'investmentTransactions.status.pending': 'Pending',
  'investmentTransactions.status.completed': 'Completed',
  'investmentTransactions.status.failed': 'Failed',
  'investmentTransactions.status.cancelled': 'Cancelled',
  'investmentTransactions.importStatus.queued': 'Queued',
  'investmentTransactions.importStatus.processing': 'Processing',
  'investmentTransactions.importStatus.ready': 'Ready',
  'investmentTransactions.importStatus.readyWithErrors': 'Ready with errors',
  'investmentTransactions.importStatus.partiallyConfirmed': 'Partially confirmed',
  'investmentTransactions.importStatus.confirmed': 'Confirmed',
  'investmentTransactions.importStatus.failed': 'Failed',
  'investmentTransactions.importStatus.cancelled': 'Cancelled',
  'investmentTransactions.action.insert': 'Insert',
  'investmentTransactions.action.update': 'Update',
  'investmentTransactions.action.duplicate': 'Duplicate',
  'investmentTransactions.action.review': 'Review',
  'investmentTransactions.action.ignore': 'Ignore',
  'investmentTransactions.errorAccountLoad': 'Unable to load investment accounts.',
  'investmentTransactions.errorCreateBatch': 'Unable to create an import batch.',
  'investmentTransactions.errorRetryFile': 'Unable to retry this file.',
  'investmentTransactions.errorConfirm': 'Unable to confirm this batch.',
  'investmentTransactions.errorHistoryLoad': 'Unable to load transaction history.',
  'investmentTransactions.deleteDirty': 'Delete',
  'investmentTransactions.deleteConfirmTitle': 'Delete this transaction?',
  'investmentTransactions.deleteConfirmDescription': 'This transaction has no external reference ID and may be dirty data. Deleting it cannot be undone.',
  'investmentTransactions.deleteConfirm': 'Delete',
  'investmentTransactions.deleting': 'Deleting…',
  'investmentTransactions.deletedToast': 'Transaction deleted.',
  'investmentTransactions.errorDelete': 'Unable to delete this transaction.',
  'investmentTransactions.errorPolling': 'Connection lost while updating AI status. You can reload the page.',
  'investmentTransactions.errorBatchLoad': 'Unable to reload the batch result.',
  'investmentTransactions.errorReviewTarget': 'This review batch does not exist or does not belong to your account.',
  'investmentTransactions.reviewWaitingTitle': 'AI processing is still in progress',
  'investmentTransactions.reviewWaitingDescription': 'This page will keep updating. Confirmation becomes available when the batch is ready for review.',
  'investmentTransactions.reviewConfirmedTitle': 'This batch has already been confirmed',
  'investmentTransactions.reviewConfirmedDescription': 'The summary is read-only. Confirmed transactions are available in transaction history.',
  'investmentTransactions.reviewUnavailableTitle': 'This batch is not available for confirmation',
  'investmentTransactions.reviewUnavailableDescription': 'Review the file errors or retry the failed files before continuing.',
  'investmentTransactions.errorTooManyFiles': 'Each batch accepts up to 10 files.',
  'investmentTransactions.errorInvalidFiles': 'Only JPEG, PNG and WebP are accepted; each file must be from 1 byte to 10 MB.',
  'investmentTransactions.errorTotalSize': 'The batch must not exceed 50 MB in total.',
  'investmentStatistics.eyebrow': 'INVESTMENT · STATISTICS',
  'investmentStatistics.title': 'Investment statistics',
  'investmentStatistics.description': 'Review completed cash flow and current investment operations.',
  'investmentStatistics.refresh': 'Refresh',
  'investmentStatistics.account': 'Account',
  'investmentStatistics.searchAccount': 'Search account',
  'investmentStatistics.allAccounts': 'All accounts',
  'investmentStatistics.from': 'From',
  'investmentStatistics.to': 'To',
  'investmentStatistics.quickRange': 'Quick range',
  'investmentStatistics.apply': 'Apply',
  'investmentStatistics.currency': 'Currency',
  'investmentStatistics.cashFlow': 'Cash flow',
  'investmentStatistics.completedHint': 'Completed transactions only. Net flow = deposits + bonuses − withdrawals.',
  'investmentStatistics.deposits': 'Deposits',
  'investmentStatistics.withdrawals': 'Withdrawals',
  'investmentStatistics.bonuses': 'Bonuses',
  'investmentStatistics.net': 'Net flow',
  'investmentStatistics.netFlowMode': 'Net flow formula',
  'investmentStatistics.netFlowModeWithdrawalMinusDeposit': 'Withdrawals − Deposits',
  'investmentStatistics.netFlowModeWithdrawalPlusBonusMinusDeposit': 'Withdrawals + Bonuses − Deposits',
  'investmentStatistics.transactions': 'Transactions',
  'investmentStatistics.daily': 'Daily flow',
  'investmentStatistics.netDaily': 'Net flow by day',
  'investmentStatistics.netMonthly': 'Net flow by month',
  'investmentStatistics.noFlow': 'No completed transactions in this period.',
  'investmentStatistics.byAccount': 'By account',
  'investmentStatistics.statusLabel': 'Status',
  'investmentStatistics.noAccounts': 'No investment accounts found.',
  'investmentStatistics.current': 'CURRENT BACKLOG',
  'investmentStatistics.operations': 'Operations',
  'investmentStatistics.currentHint': 'Current backlog is independent of the selected date range.',
  'investmentStatistics.openQueue': 'Open AI queue',
  'investmentStatistics.aiPending': 'AI pending',
  'investmentStatistics.aiProcessing': 'AI processing',
  'investmentStatistics.aiReady': 'AI ready',
  'investmentStatistics.aiFailed': 'AI failed',
  'investmentStatistics.importReview': 'Imports to review',
  'investmentStatistics.reconciliation': 'Reconciliation',
  'investmentStatistics.noPending': 'No current backlog.',
  'investmentStatistics.reason': 'Reason',
  'investmentStatistics.detail': 'Detail',
  'investmentStatistics.history': 'History',
  'investmentStatistics.noHistory': 'No history available.',
  'investmentStatistics.loading': 'Loading statistics…',
  'investmentStatistics.error': 'Unable to load this section.',
  'investmentStatistics.retry': 'Retry',
  'investmentStatistics.status.active': 'Active',
  'investmentStatistics.status.inactive': 'Inactive',
  'investmentStatistics.status.open': 'Open',
  'investmentStatistics.status.in_review': 'In review',
  'investmentStatistics.status.needs_info': 'Needs info',
  'investmentStatistics.status.resolved': 'Resolved',
  'investmentStatistics.status.rejected': 'Rejected',
  'investmentTransactions.processedToast': '{count} transactions processed.',
  'investmentTransactions.trace': 'Trace {id}',
  'investmentAiQueue.eyebrow': 'INVESTMENT · AI OPERATIONS',
  'investmentAiQueue.title': 'AI processing queue',
  'investmentAiQueue.description': 'Track receipt extraction jobs, inspect normalized results, and safely control queued work.',
  'investmentAiQueue.refresh': 'Refresh',
  'investmentAiQueue.filters': 'Queue filters',
  'investmentAiQueue.scope': 'Queue scope',
  'investmentAiQueue.allJobs': 'All jobs',
  'investmentAiQueue.myJobs': 'My jobs',
  'investmentAiQueue.statusLabel': 'Status',
  'investmentAiQueue.status.all': 'All statuses',
  'investmentAiQueue.status.pending': 'Pending',
  'investmentAiQueue.status.processing': 'Processing',
  'investmentAiQueue.status.ready': 'Ready',
  'investmentAiQueue.status.failed': 'Failed',
  'investmentAiQueue.status.cancelled': 'Cancelled',
  'investmentAiQueue.status.confirmed': 'Confirmed',
  'investmentAiQueue.liveRefresh': 'Live refresh every 5 seconds',
  'investmentAiQueue.errorTitle': 'Queue error:',
  'investmentAiQueue.jobs': 'Processing jobs',
  'investmentAiQueue.resultCount': '{count} jobs',
  'investmentAiQueue.updating': 'Updating…',
  'investmentAiQueue.loading': 'Loading AI jobs…',
  'investmentAiQueue.emptyTitle': 'No matching AI jobs',
  'investmentAiQueue.emptyDescription': 'Jobs created from investment receipt imports will appear here.',
  'investmentAiQueue.job': 'Job and file',
  'investmentAiQueue.owner': 'Owner',
  'investmentAiQueue.attempts': 'Attempts',
  'investmentAiQueue.timeline': 'Timeline',
  'investmentAiQueue.modelPending': 'Model not assigned',
  'investmentAiQueue.created': 'Created',
  'investmentAiQueue.started': 'Started',
  'investmentAiQueue.completed': 'Completed',
  'investmentAiQueue.viewImage': 'View image',
  'investmentAiQueue.viewJson': 'JSON detect',
  'investmentAiQueue.run': 'Run',
  'investmentAiQueue.rerun': 'Re-run',
  'investmentAiQueue.reviewAndConfirm': 'Review & Confirm',
  'investmentAiQueue.reviewOwnerOnly': 'Only the owner can review and confirm this job.',
  'investmentAiQueue.reviewUnavailable': 'There is no active import batch waiting for review.',
  'investmentAiQueue.reviewTargetEyebrow': 'REVIEW DESTINATION',
  'investmentAiQueue.reviewTargetTitle': 'Choose an account and batch',
  'investmentAiQueue.reviewTargetDescription': 'Job #{id} is linked to multiple active imports. Choose the batch you want to review.',
  'investmentAiQueue.pendingItems': '{count} items waiting for review',
  'investmentAiQueue.pagination': 'Showing {start}–{end} of {total}',
  'investmentAiQueue.confirmCancelTitle': 'Cancel this queued job?',
  'investmentAiQueue.confirmCancelDescription': 'Job #{id} will be removed from the pending queue. The source image is kept.',
  'investmentAiQueue.confirmCancel': 'Cancel job',
  'investmentAiQueue.detectedJson': 'Normalized detection JSON',
  'investmentAiQueue.normalizedJsonNotice': 'This is the validated draft for this image only. The provider batch response is never exposed.',
  'investmentAiQueue.sourceImage': 'Source image',
  'investmentAiQueue.loadingImage': 'Loading source image…',
  'investmentAiQueue.imageError': 'The source image could not be loaded or has expired.',
  'investmentAiQueue.loadError': 'Unable to refresh the AI queue. Existing rows are kept.',
  'investmentAiQueue.actionError': 'The job changed or this action is no longer allowed. The queue will refresh automatically.',
  'investmentAiQueue.cancelledToast': 'Job #{id} was cancelled.',
  'investmentAiQueue.runningToast': 'Job #{id} is running now.',
  'investmentAiQueue.completedToast': 'Job #{id} finished with status {status}.',
  'field.id': 'ID',
  'field.fullName': 'Full name',
  'field.email': 'Email',
  'field.name': 'Name',
  'field.code': 'Code',
  'field.status': 'Status',
  'field.amount': 'Amount',
  'field.description': 'Description',
  'field.createdAt': 'Created at',
  'field.updatedAt': 'Updated at',
  'field.bankName': 'Bank',
  'field.cardName': 'Card',
  'field.reference': 'Reference'
  ,'field.bankId': 'Bank'
  ,'field.sequence': 'No.'
  ,'field.cardType': 'Card type'
  ,'field.nickname': 'Card holder'
  ,'field.lastFour': 'Last four digits'
  ,'field.creditLimit': 'Credit limit'
  ,'field.statementDay': 'Statement day'
  ,'field.dueDay': 'Payment day'
  ,'field.billingStatus': 'Current billing cycle'
  ,'field.statementBalance': 'Statement balance'
  ,'field.minimumPayment': 'Minimum payment'
  ,'field.paymentStatus': 'Payment status'
  ,'format.dayOfMonth': 'Day {value}'
  ,'billing.not_due': 'Not due'
  ,'billing.needs_input': 'Needs statement input'
  ,'billing.unpaid': 'Unpaid'
  ,'billing.overdue': 'Overdue'
  ,'billing.paid': 'Paid'
  ,'billing.statementOn': 'Statement {date}'
  ,'billing.dueOn': 'Due {date}'
  ,'field.note': 'Note'
  ,'field.currency': 'Currency'
  ,'field.referenceNumber': 'Reference number'
  ,'field.accountCode': 'Account code'
  ,'field.accountName': 'Account name'
  ,'field.accountUsername': 'Account username'
  ,'field.accountEmail': 'Account email'
  ,'field.phoneNumber': 'Phone number'
  ,'field.registerDate': 'Register date'
  ,'field.accountPassword': 'Account password'
  ,'field.songTitle': 'Song title'
  ,'field.artist': 'Artist'
  ,'field.genre': 'Genre'
  ,'field.karaokeCode': 'Karaoke code'
  ,'field.tone': 'Tone / key'
  ,'field.musicLink': 'Music link'
  ,'field.companyName': 'Company'
  ,'field.positionTitle': 'Position'
  ,'field.location': 'Location'
  ,'field.jobUrl': 'Job link'
  ,'field.salary': 'Salary range'
  ,'field.employmentType': 'Employment type'
  ,'field.priority': 'Priority'
  ,'field.deadline': 'Application deadline'
  ,'field.contactName': 'Contact name'
  ,'field.contactEmail': 'Contact email'
  ,'option.fullTime': 'Full-time'
  ,'option.partTime': 'Part-time'
  ,'option.contract': 'Contract'
  ,'option.freelance': 'Freelance'
  ,'option.internship': 'Internship'
  ,'option.other': 'Other'
  ,'job.statusSaved': 'Saved'
  ,'job.statusApplied': 'Applied'
  ,'job.statusInterview': 'Interview'
  ,'job.statusOffer': 'Offer'
  ,'job.statusRejected': 'Rejected'
  ,'job.statusWithdrawn': 'Withdrawn'
  ,'job.priorityLow': 'Low'
  ,'job.priorityMedium': 'Medium'
  ,'job.priorityHigh': 'High'
  ,'datepicker.selectDate': 'Select date'
  ,'datepicker.selectDateTime': 'Select date & time'
  ,'datepicker.selectDatePlaceholder': 'Select date...'
  ,'datepicker.selectDateTimePlaceholder': 'Select date & time...'
  ,'datepicker.today': 'Today'
  ,'datepicker.plus1Day': '+1 Day'
  ,'datepicker.plus7Days': '+7 Days'
  ,'datepicker.plus30Days': '+30 Days'
  ,'datepicker.endOfMonth': 'End of month'
  ,'datepicker.prevMonth': 'Previous month'
  ,'datepicker.nextMonth': 'Next month'
  ,'datepicker.timeTitle': 'Time (HH:mm)'
  ,'datepicker.clear': 'Clear'
  ,'datepicker.apply': 'Apply'
  ,'bank.eyebrow': 'System Management'
  ,'bank.title': 'Banks'
  ,'bank.description': 'Browse and manage the partner bank directory.'
  ,'bank.addBank': 'Add bank'
  ,'bank.statBanks': 'Total banks'
  ,'bank.searchPlaceholder': 'Search banks by name or code…'
  ,'bank.allBanks': 'All banks'
  ,'bank.sectionBanks': 'Partner Bank Directory'
  ,'bank.bankCount': '{n} banks'
  ,'bank.website': 'Website'
  ,'bank.dialogBankEyebrow': 'Bank Management'
  ,'bank.dialogBankTitle': 'Add new bank'
  ,'bank.dialogBankDesc': 'Enter the information for the new partner bank.'
  ,'bank.fieldCode': 'Bank Code'
  ,'bank.fieldCodePlaceholder': 'e.g. TCB, VCB, VPB…'
  ,'bank.fieldShortName': 'Short Name'
  ,'bank.fieldShortNamePlaceholder': 'e.g. Techcombank, Vietcombank…'
  ,'bank.fieldFullName': 'Full bank name'
  ,'bank.fieldFullNamePlaceholder': 'e.g. Vietnam Technological and Commercial Bank…'
  ,'bank.fieldLogoUrl': 'Bank logo link (URL)'
  ,'bank.fieldHotline': 'Hotline'
  ,'bank.fieldHotlinePlaceholder': '1900xxxx'
  ,'bank.fieldWebsite': 'Website'
  ,'bank.fieldWebsitePlaceholder': 'https://bank.com.vn'
  ,'field.currentBalance': 'Current balance'
  ,'creditCards.cardCount': '{count} cards'
  ,'creditCards.cardTypeMissing': 'Not updated'
  ,'creditCards.totalAllBanks': 'Total — all banks'
  ,'creditCards.totalCreditLimit': 'Total credit limit'
  ,'creditCards.totalBalance': 'Total current balance'
  ,'creditCards.previewTitle': 'Live card preview'
  ,'creditBalance.edit': 'Edit current balance'
  ,'creditBalance.editFor': 'Edit {bank} current balance'
  ,'creditBalance.editDescription': 'Enter the remaining credit. The adjustment is recorded without rewriting card statements.'
  ,'creditBalance.currentValue': 'Current remaining credit'
  ,'creditBalance.rangeHint': 'Enter an amount from 0 to {limit}.'
  ,'creditBalance.reason': 'Adjustment reason'
  ,'creditBalance.reasonRequired': 'Enter a reason with no more than 500 characters.'
  ,'creditDashboard.eyebrow': 'CREDIT CARDS'
  ,'creditDashboard.title': 'Credit card debt overview'
  ,'creditDashboard.description': 'See statement debt, current balance and credit usage by bank.'
  ,'creditDashboard.totalStatementDebt': 'Total statement debt'
  ,'creditDashboard.currentBalance': 'Current balance'
  ,'creditDashboard.totalCreditLimit': 'Total credit limit'
  ,'creditDashboard.availableCredit': 'Available credit'
  ,'creditDashboard.usedCredit': 'Used credit'
  ,'creditDashboard.utilization': '{value}% used'
  ,'creditDashboard.usageByBank': 'Credit usage by bank'
  ,'creditDashboard.usageByBankDescription': 'Used credit compared with total credit limit'
  ,'creditDashboard.chartAria': 'Used credit divided by total credit limit for each bank'
  ,'creditDashboard.mobileBankOverview': 'Bank overview'
  ,'creditDashboard.mobileBankDescription': 'Tap a bank to see balances and credit cards.'
  ,'creditDashboard.cardList': 'Credit cards'
  ,'creditDashboard.debtDetail': 'Debt details'
  ,'creditDashboard.debtDetailDescription': 'Expand a bank to see each credit card.'
  ,'creditDashboard.bankCard': 'Bank / Card'
  ,'creditDashboard.statementDebt': 'Statement debt'
  ,'creditDashboard.creditLimit': 'Credit limit'
  ,'creditDashboard.available': 'Available'
  ,'creditDashboard.used': 'Used'
  ,'creditDashboard.utilizationColumn': 'Utilization'
  ,'creditDashboard.status': 'Status'
  ,'creditDashboard.cards': '{count} cards'
  ,'creditDashboard.lastFour': '•••• {value}'
  ,'creditDashboard.overLimit': 'Over limit'
  ,'creditDashboard.sharedLimit': 'Shared'
  ,'creditDashboard.sharedBalance': 'Shared'
  ,'creditDashboard.editLimit': 'Edit limit'
  ,'creditDashboard.editLimitFor': 'Edit {bank} shared limit'
  ,'creditDashboard.editLimitDescription': 'This limit is shared by every card from this bank.'
  ,'creditDashboard.totalAllBanks': 'Total — all banks'
  ,'creditDashboard.expandBank': 'Show cards for {bank}'
  ,'creditDashboard.collapseBank': 'Hide cards for {bank}'
  ,'creditDashboard.emptyTitle': 'No credit card data yet'
  ,'creditDashboard.emptyDescription': 'Add a credit card to start tracking your balances.'
  ,'creditDashboard.errorTitle': 'Could not load credit card debt'
  ,'creditDashboard.retry': 'Try again'
  ,'bank.saveBank': 'Save bank'
  ,'lodging.eyebrow': 'ROOM FINDER'
  ,'lodging.title': 'Lodging listings'
  ,'lodging.description': 'Keep shared room listings, costs, travel distances and reviews in one place.'
  ,'lodging.add': 'Add listing'
  ,'lodging.edit': 'Edit listing'
  ,'lodging.search': 'Search address, note or phone…'
  ,'lodging.addLocation': 'Add shared location'
  ,'lodging.loading': 'Loading lodging listings…'
  ,'lodging.empty': 'No lodging listings yet'
  ,'lodging.emptyDescription': 'Add a listing to start comparing rooms.'
  ,'lodging.by': 'Added by'
  ,'lodging.month': 'month'
  ,'lodging.images': 'images'
  ,'lodging.electricity': 'Electricity'
  ,'lodging.water': 'Water'
  ,'lodging.service': 'Service'
  ,'lodging.parking': 'Parking'
  ,'lodging.calculating': 'Calculating…'
  ,'lodging.distanceFailed': 'Distance unavailable'
  ,'lodging.notOk': 'Not OK'
  ,'lodging.review': 'Review'
  ,'lodging.retry': 'Retry distance'
  ,'lodging.delete': 'Delete'
  ,'lodging.deleteConfirm': 'Delete this lodging listing?'
  ,'lodging.deleted': 'Lodging listing deleted'
  ,'lodging.saved': 'Lodging listing saved'
  ,'lodging.saveFailed': 'Could not save lodging listing'
  ,'lodging.loadFailed': 'Could not load lodging listings'
  ,'lodging.uploadFailed': 'Image upload failed'
  ,'lodging.retryFailed': 'Could not recalculate distance'
  ,'lodging.address': 'Address'
  ,'lodging.rent': 'Monthly rent (VND)'
  ,'lodging.phone': 'Phone'
  ,'lodging.locations': 'Comparison locations'
  ,'lodging.selectLocation': 'Select at least one location.'
  ,'lodging.note': 'Note'
  ,'lodging.locationName': 'Location name'
  ,'lodging.reason': 'Reason'
  ,'lodging.reviewReasonRequired': 'A reason is required for Not OK.'
  ,'lodging.reviewHistory': 'Review history'
  ,'lodging.reviewSaved': 'Review saved'
  ,'shell.groupLodging': 'ROOM FINDER'
  ,'shell.lodgings': 'Find lodging'
  ,'shell.creditBenefits': 'Benefits & cashback'
  ,'route.creditBenefits': 'Card benefits & cashback'
  ,'creditBenefits.eyebrow': 'CARD BENEFITS'
  ,'creditBenefits.title': 'Benefits & cashback'
  ,'creditBenefits.description': 'Keep each card’s cashback programs, MCC groups and monthly limits in one place.'
  ,'creditBenefits.addProgram': 'Add program'
  ,'creditBenefits.loadFailed': 'Could not load card benefit settings.'
  ,'creditBenefits.reload': 'Reload'
  ,'creditBenefits.loading': 'Loading card benefits…'
  ,'creditBenefits.noCards': 'No credit cards yet'
  ,'creditBenefits.noCardsDescription': 'Add a credit card before configuring its benefits.'
  ,'creditBenefits.chooseCard': 'Card to configure'
  ,'creditBenefits.cardTypeMissing': 'Card type not updated'
  ,'creditBenefits.monthlyCap': 'Total monthly cashback limit'
  ,'creditBenefits.monthlyCapDescription': 'Shared calendar-month limit across all active programs on this card.'
  ,'creditBenefits.amountIn': 'Amount ({currency})'
  ,'creditBenefits.saving': 'Saving…'
  ,'creditBenefits.saveCap': 'Save limit'
  ,'creditBenefits.capInvalid': 'Enter a monthly cashback limit greater than zero.'
  ,'creditBenefits.capSaved': 'Monthly cashback limit saved.'
  ,'creditBenefits.saveFailed': 'Could not save the cashback configuration.'
  ,'creditBenefits.programs': 'Cashback programs'
  ,'creditBenefits.programsDescription': 'Programs can run together and are enabled or disabled manually.'
  ,'creditBenefits.programCount': '{count} programs'
  ,'creditBenefits.emptyPrograms': 'No program configured'
  ,'creditBenefits.emptyProgramsDescription': 'Add the first program and group its eligible MCC codes.'
  ,'creditBenefits.active': 'Active'
  ,'creditBenefits.inactive': 'Inactive'
  ,'creditBenefits.toggleProgram': 'Toggle program'
  ,'creditBenefits.terms': 'View terms'
  ,'creditBenefits.maxPerMonth': 'Up to {amount} {currency}/month'
  ,'creditBenefits.delete': 'Delete'
  ,'creditBenefits.editProgram': 'Edit program'
  ,'creditBenefits.programName': 'Program name'
  ,'creditBenefits.notes': 'Notes / conditions'
  ,'creditBenefits.termsUrl': 'Terms URL'
  ,'creditBenefits.activeOnSave': 'Program is active'
  ,'creditBenefits.categoryGroups': 'MCC category groups'
  ,'creditBenefits.categoryGroupsDescription': 'Each MCC can appear in only one group within this program.'
  ,'creditBenefits.addGroup': 'Add group'
  ,'creditBenefits.groupNumber': 'Group {number}'
  ,'creditBenefits.removeGroup': 'Remove group'
  ,'creditBenefits.categoryName': 'Category name'
  ,'creditBenefits.categoryExample': 'Dining, groceries, online shopping…'
  ,'creditBenefits.cashbackRate': 'Cashback rate'
  ,'creditBenefits.groupCap': 'Maximum cashback / month'
  ,'creditBenefits.mccCodes': 'MCC codes'
  ,'creditBenefits.addMcc': 'Add MCC'
  ,'creditBenefits.mccHint': 'Enter one or more four-digit MCCs, separated by commas or spaces.'
  ,'creditBenefits.removeMcc': 'Remove MCC {code}'
  ,'creditBenefits.nameRequired': 'Enter a program name.'
  ,'creditBenefits.notesInvalid': 'Notes cannot exceed 2,000 characters.'
  ,'creditBenefits.urlInvalid': 'Terms URL must use HTTP or HTTPS.'
  ,'creditBenefits.groupRequired': 'Add at least one MCC group.'
  ,'creditBenefits.groupNameRequired': 'Every group needs a category name.'
  ,'creditBenefits.groupDuplicate': 'Category names cannot repeat within a program.'
  ,'creditBenefits.rateInvalid': 'Cashback rate must be greater than 0 and no more than 100%.'
  ,'creditBenefits.groupCapInvalid': 'Every group needs a maximum cashback amount greater than zero.'
  ,'creditBenefits.mccRequired': 'Every group needs at least one MCC.'
  ,'creditBenefits.mccInvalid': 'MCC must contain exactly four digits.'
  ,'creditBenefits.mccDuplicate': 'MCC {code} already belongs to another group in this program.'
  ,'creditBenefits.programSaved': 'Cashback program saved.'
  ,'creditBenefits.deleteConfirm': 'Delete “{name}”? This program will be kept in the audit history.'
  ,'creditBenefits.programDeleted': 'Cashback program deleted.'
  ,'creditBenefits.deleteFailed': 'Could not delete the cashback program.'
  ,'creditBenefits.stale': 'This configuration changed in another session. Reload before saving again.'
  ,'route.passwordManager': 'Password Manager'
  ,'shell.passwordManager': 'Password Manager'
  ,'passwordManager.eyebrow': 'PERSONAL SECURITY'
  ,'passwordManager.title': 'Password Manager'
  ,'passwordManager.description': 'Keep service accounts in a private encrypted vault.'
  ,'passwordManager.addModule': 'Add module'
  ,'passwordManager.lockNow': 'Lock now'
  ,'passwordManager.search': 'Search modules or account names…'
  ,'passwordManager.unlocked': 'Unlocked for this session'
  ,'passwordManager.lockedState': 'Vault locked'
  ,'passwordManager.loading': 'Loading your vault…'
  ,'passwordManager.emptyTitle': 'Your vault is empty'
  ,'passwordManager.emptyDescription': 'Create a service module, then add one or more accounts.'
  ,'passwordManager.modules': 'Modules'
  ,'passwordManager.accountCount': '{count} accounts'
  ,'passwordManager.delete': 'Delete'
  ,'passwordManager.noMatch': 'No matching results.'
  ,'passwordManager.service': 'Service module'
  ,'passwordManager.addAccount': 'Add account'
  ,'passwordManager.emptyAccounts': 'No accounts in this module yet.'
  ,'passwordManager.reveal': 'Reveal'
  ,'passwordManager.copyPassword': 'Copy password'
  ,'passwordManager.module': 'Service module'
  ,'passwordManager.editModule': 'Edit module'
  ,'passwordManager.moduleName': 'Module name'
  ,'passwordManager.website': 'Website'
  ,'passwordManager.descriptionField': 'Description'
  ,'passwordManager.editAccount': 'Edit account'
  ,'passwordManager.accountName': 'Account name'
  ,'passwordManager.username': 'Username'
  ,'passwordManager.password': 'Password'
  ,'passwordManager.generator': 'Strong password generator'
  ,'passwordManager.length': 'Length'
  ,'passwordManager.generate': 'Generate password'
  ,'passwordManager.loginUrl': 'Login URL'
  ,'passwordManager.note': 'Secure note'
  ,'passwordManager.encryptedHint': 'Username, password, login URL and note are encrypted together before storage.'
  ,'passwordManager.securityCheck': 'Security check'
  ,'passwordManager.unlockTitle': 'Unlock password vault'
  ,'passwordManager.unlockDescription': 'Confirm your current Kira Life password. The unlock expires automatically after five minutes.'
  ,'passwordManager.currentPassword': 'Current password'
  ,'passwordManager.unlocking': 'Unlocking…'
  ,'passwordManager.unlock': 'Unlock'
  ,'passwordManager.decryptedForSession': 'Decrypted for this session'
  ,'passwordManager.clipboardNote': 'Copied content remains under your browser and operating system clipboard controls.'
  ,'passwordManager.moduleSaved': 'Module saved.'
  ,'passwordManager.moduleDeleted': 'Module and its accounts deleted.'
  ,'passwordManager.accountSaved': 'Account saved securely.'
  ,'passwordManager.accountDeleted': 'Account deleted.'
  ,'passwordManager.deleteModuleConfirm': 'Delete “{name}” and its {count} accounts?'
  ,'passwordManager.deleteAccountConfirm': 'Delete account “{name}”?'
  ,'passwordManager.copied': 'Copied to clipboard.'
  ,'passwordManager.copyFailed': 'The browser did not allow clipboard access.'
  ,'passwordManager.locked': 'Password vault locked.'
  ,'passwordManager.actionFailed': 'The password vault action could not be completed.'
  ,'route.tutorSchedule': 'Tutor schedule'
  ,'route.favoriteSongs': 'Favorite karaoke songs'
  ,'route.jobApplications': 'Job tracker'
  ,'shell.groupPersonal': 'PERSONAL LIFE'
  ,'shell.favoriteSongs': 'Favorite songs'
  ,'shell.jobApplications': 'Job tracker'
  ,'resource.flowPersonal': 'PERSONAL LIFE'
  ,'common.delete': 'Delete'
  ,'form.addFavoriteSong': 'Add favorite song'
  ,'form.addFavoriteSongDescription': 'Save the song details you need for your next karaoke session.'
  ,'form.editFavoriteSong': 'Edit favorite song'
  ,'form.editFavoriteSongDescription': 'Keep your karaoke reference information up to date.'
  ,'form.addJob': 'Add job to tracker'
  ,'form.addJobDescription': 'Keep a clear record of opportunities you may apply for.'
  ,'form.editJob': 'Edit job'
  ,'form.editJobDescription': 'Update the opportunity, application status and next details.'
  ,'karaoke.deleteConfirm': 'Delete this favorite song?'
  ,'job.deleteConfirm': 'Delete this job from your tracker?'
  ,'job.status': 'Job status'
  ,'job.priority': 'Job priority'
  ,'shell.groupTutor': 'TUTORING'
  ,'shell.tutorSchedule': 'Teaching schedule'
  ,'tutor.eyebrow': 'PERSONAL TUTORING'
  ,'tutor.title': 'Teaching schedule'
  ,'tutor.description': 'Plan recurring lessons, make one-off changes and keep each student’s details together.'
  ,'tutor.students': 'Students'
  ,'tutor.addLesson': 'Add lesson'
  ,'tutor.previousWeek': 'Previous week'
  ,'tutor.nextWeek': 'Next week'
  ,'tutor.today': 'Today'
  ,'tutor.weekNavigation': 'Week navigation'
  ,'tutor.timezone': 'Vietnam time'
  ,'tutor.viewMode': 'Schedule view'
  ,'tutor.weekView': 'Week'
  ,'tutor.agendaView': 'Agenda'
  ,'tutor.summary': 'Schedule summary'
  ,'tutor.lessonsUnit': 'lessons'
  ,'tutor.focusHoursHint': 'Showing the hours around your lessons'
  ,'tutor.fullDayHint': 'Full schedule · 06:00–23:00'
  ,'tutor.showFullDay': 'Show all hours'
  ,'tutor.retry': 'Retry'
  ,'tutor.loading': 'Loading teaching schedule…'
  ,'tutor.loadFailed': 'Could not load the teaching schedule.'
  ,'tutor.pastReadOnly': 'Past weeks are preserved as read-only history.'
  ,'tutor.lessonCount': 'Lessons'
  ,'tutor.totalHours': 'Teaching hours'
  ,'tutor.expectedFee': 'Expected fees'
  ,'tutor.conflicts': 'Conflicts'
  ,'tutor.noStudents': 'No students yet'
  ,'tutor.noStudentsDescription': 'Add your first student before scheduling a lesson.'
  ,'tutor.addStudent': 'Add student'
  ,'tutor.cancelled': 'Cancelled once'
  ,'tutor.movedOnce': 'Moved once'
  ,'tutor.add': 'Add'
  ,'tutor.noLesson': 'No lesson scheduled.'
  ,'tutor.online': 'Online'
  ,'tutor.inPerson': 'In person'
  ,'tutor.restore': 'Restore'
  ,'tutor.editLesson': 'Edit lesson'
  ,'tutor.fromThisWeek': 'This week and future weeks'
  ,'tutor.onlyThisLesson': 'Only this lesson'
  ,'tutor.onceHint': 'A one-off change only moves this occurrence. Other lesson details stay unchanged.'
  ,'tutor.student': 'Student'
  ,'tutor.subject': 'Subject'
  ,'tutor.date': 'Date'
  ,'tutor.start': 'Start'
  ,'tutor.end': 'End'
  ,'tutor.mode': 'Teaching mode'
  ,'tutor.meetingLink': 'Meeting link'
  ,'tutor.location': 'Location'
  ,'tutor.fee': 'Fee (VND)'
  ,'tutor.note': 'Note'
  ,'tutor.deleteFuture': 'End recurring lesson'
  ,'tutor.cancelOnce': 'Cancel this lesson'
  ,'tutor.saving': 'Saving…'
  ,'tutor.directory': 'STUDENT DIRECTORY'
  ,'tutor.noPhone': 'No phone number'
  ,'tutor.editStudent': 'Edit student'
  ,'tutor.deleteStudent': 'Archive student'
  ,'tutor.studentName': 'Student name'
  ,'tutor.phone': 'Phone'
  ,'tutor.color': 'Schedule color'
  ,'tutor.timeInvalid': 'End time must be after start time.'
  ,'tutor.cancelOnceConfirm': 'Cancel only this lesson? Future weeks will stay unchanged.'
  ,'tutor.deleteFutureConfirm': 'End this recurring lesson from the selected week onward?'
  ,'tutor.deleteStudentConfirm': 'Archive this student?'
  ,'tutor.applyFutureConfirm': 'Apply this new day and time from the selected week onward?'
  ,'tutor.conflictConfirm': 'This creates an overlapping lesson. Save it anyway?'
  ,'tutor.dragSameWeek': 'Drag a lesson within the selected week.'
  ,'tutor.studentSaved': 'Student saved.'
  ,'tutor.studentDeleted': 'Student archived.'
  ,'tutor.saved': 'Teaching schedule saved.'
  ,'tutor.saveFailed': 'Could not save the teaching schedule.'
  ,'route.financeReport': 'Investment & bank report'
  ,'shell.groupReports': 'REPORTS'
  ,'shell.financeReport': 'Investment & bank'
  ,'financeReport.eyebrow': 'Combined report'
  ,'financeReport.title': 'Investment & bank report'
  ,'financeReport.description': 'Bank credit exposure today next to investment cash flow for the selected period.'
  ,'financeReport.refresh': 'Refresh'
  ,'financeReport.from': 'From'
  ,'financeReport.to': 'To'
  ,'financeReport.quickRange': 'Quick range'
  ,'financeReport.apply': 'Apply'
  ,'financeReport.rangeInvalid': 'Pick a valid range of at most 365 days.'
  ,'financeReport.loading': 'Loading…'
  ,'financeReport.error': 'Could not load this section.'
  ,'financeReport.retry': 'Retry'
  ,'financeReport.bankEyebrow': 'Current position'
  ,'financeReport.bankSection': 'Banks & credit'
  ,'financeReport.openBankDashboard': 'Open credit dashboard →'
  ,'financeReport.bank': 'Bank'
  ,'financeReport.cards': 'Cards'
  ,'financeReport.creditLimit': 'Credit limit'
  ,'financeReport.statementDebt': 'Statement debt'
  ,'financeReport.currentBalance': 'Current balance'
  ,'financeReport.availableCredit': 'Available credit'
  ,'financeReport.utilization': 'Utilisation'
  ,'financeReport.noBanks': 'No bank data yet.'
  ,'financeReport.investmentSection': 'Investment cash flow'
  ,'financeReport.openInvestmentStatistics': 'Open statistics →'
  ,'financeReport.currency': 'Currency'
  ,'financeReport.currencyHint': 'Currencies are reported separately and never summed together.'
  ,'financeReport.deposits': 'Deposits'
  ,'financeReport.withdrawals': 'Withdrawals'
  ,'financeReport.bonuses': 'Bonuses'
  ,'financeReport.net': 'Net'
  ,'financeReport.transactions': 'Transactions'
  ,'financeReport.account': 'Account'
  ,'financeReport.statusLabel': 'Status'
  ,'financeReport.noAccounts': 'No investment accounts in this range.'
  ,'financeReport.noFlow': 'No investment activity in this range.'
} as const;

export type TranslationKey = keyof typeof englishTranslations;
