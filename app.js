// === STATE ===
const S = {
  role: 'admin',
  nav: 'dashboard',
  entity: 'premier',
  empSel: null,
  empTab: 'sync',
  loanTab: 'pending',
  resignTab: 'active',
  resignSel: null,
  reportsTab: 'register',
  auditTab: 'all',
  syncHistoryTab: 'all',
  syncErrorsTab: 'all',
  resolvedSyncErrors: [],
  settingsTab: 'encashment',
  monthSel: '2026-05',
  lopSync: {
    phase: 'default', // default | syncing | success
    lastSync: null,
    statuses: {} // empId -> pending | sending | synced | error
  },
  showLoanRequest: false,
  modal: null,
  mdata: {},
  toast: null,
  loanForm: { type: 'festival', amount: 60000, tenure: 6 },
  // IT declaration admin tab
  itdecAdminTab: 'pending',
  reimbAdminTab: 'pending',
  // FY calendar — demo "today" date controls which window is open
  // Try '2026-04-10' to see Apr regime window open, '2026-05-17' for locked, '2027-01-10' for proof submission
  today: '2026-05-17',
  // Tax declaration tabs
  itdecTab: 'investments', // investments | other-income | lta
  // Which employee is logged in (when role=employee). Default Arjun (old, declared)
  empAsId: 'EMP1003',
  // Employee sync (Settings → Integration)
  empSync: {
    phase: 'default', // default | syncing | success | empty
    total: 245,
    synced: 230,
    pending: 12,
    failed: 3,
    progressCurrent: 230,
    lastSync: { date: '14 May 2026, 11:22 AM', status: 'Completed', synced: 230, failed: 3 }
  }
};

// Entity configs with encashment policy + pay period
const E = {
  premier: {
    name: 'Premier IT Solutions', encashmentPolicy: 'ff_only', encashmentMonth: null,
    payPeriod: { cutoffStart: 26, cutoffEnd: 25, payDate: 1, attendanceLockDay: 26 },
    encashmentCalc: { salaryBasisLabel: 'Basic Salary', salaryBasisKey: 'basic', divisor: 21, eligibleLeaveTypes: ['EL'] }
  },
  nemo: {
    name: 'Nemo IT Solutions', encashmentPolicy: 'ff_only', encashmentMonth: null,
    payPeriod: { cutoffStart: 1, cutoffEnd: 30, payDate: 5, attendanceLockDay: 1 },
    encashmentCalc: { salaryBasisLabel: 'Basic Salary', salaryBasisKey: 'basic', divisor: 21, eligibleLeaveTypes: ['EL', 'PL'] }
  },
  invicktus: {
    name: 'Invicktus', encashmentPolicy: 'ff_only', encashmentMonth: null,
    payPeriod: { cutoffStart: 21, cutoffEnd: 20, payDate: 25, attendanceLockDay: 21 },
    encashmentCalc: { salaryBasisLabel: 'Gross Salary', salaryBasisKey: 'gross', divisor: 26, eligibleLeaveTypes: ['EL'] }
  }
};

// F&F leave encashment → greytHR integration mapping (reusable component config; payroll month is per employee F&F)
const ENCASHMENT_INTEGRATION = {
  premier: { status: 'pending_api_validation', confirmedSubmissionMethod: null },
  nemo: { status: 'pending_api_validation', confirmedSubmissionMethod: null },
  invicktus: { status: 'pending_api_validation', confirmedSubmissionMethod: null }
};

function defaultEncashmentMappingRows() {
  return [
    { key: 'days', mySliceField: 'Approved encashment days', greytHRComponent: 'Pending confirmation', componentCode: '', submissionMethod: 'Pending API validation', validationStatus: 'pending', repositoryId: null },
    { key: 'amount', mySliceField: 'Calculated encashment amount', greytHRComponent: 'Leave Encashment', componentCode: 'LEAVE_ENCASHMENT', submissionMethod: 'Salary hand entry', validationStatus: 'pending_test', repositoryId: GREYTHR_ITEM_CODES.LEAVE_ENCASHMENT?.id || null }
  ];
}

function getEncashmentMappingRows(entity) {
  const ent = ENCASHMENT_INTEGRATION[entity] || ENCASHMENT_INTEGRATION.premier;
  if (!ent.rows) ent.rows = defaultEncashmentMappingRows().map(r => ({ ...r }));
  return ent.rows;
}

function encashMappingValidationPill(status) {
  if (status === 'pending') return '<span class="pill pill-gray">Pending</span>';
  if (status === 'pending_test') return '<span class="pill pill-orange">Pending test</span>';
  if (status === 'validated') return '<span class="pill pill-green">Validated</span>';
  return '<span class="pill pill-gray">' + status + '</span>';
}

function saveEncashmentMapping(rowKey) {
  const rows = getEncashmentMappingRows(S.entity);
  const row = rows.find(r => r.key === rowKey);
  if (!row) return;
  const compEl = document.getElementById('em-greythr-component');
  const codeEl = document.getElementById('em-component-code');
  if (compEl) row.greytHRComponent = compEl.value.trim() || row.greytHRComponent;
  if (codeEl) row.componentCode = codeEl.value.trim();
  closeM();
  toast('Encashment mapping saved · validation still required before go-live');
  R();
}

const ENCASHMENT_STATUS_LABELS = {
  pending_review: 'Pending Review',
  pending_approval: 'Pending Review',
  approved: 'Approved',
  ready_to_sync: 'Ready to Sync',
  syncing: 'Syncing',
  synced: 'Synced to greytHR',
  sync_failed: 'Sync Failed',
  ff_pending: 'F&F Pending in greytHR',
  ff_completed: 'F&F Completed',
  closed: 'Encashment Closed'
};

const LOAN_EMI_MAX_PCT = 20; // greytHR integration rule: EMI <= 20% of salary

const ENCASHMENT_POLICIES = {
  ff_only: { label: 'F&F only', desc: 'Encashment paid only during exit settlement. Not shown in monthly inputs.', icon: 'ti-door-exit' },
  ff_and_march: { label: 'F&F + March payroll', desc: 'Encashment in March (FY-end) for all active employees + during F&F for exits.', icon: 'ti-calendar-event' },
  ff_and_any_month: { label: 'F&F + admin-entered any month', desc: 'During F&F automatically + admin can manually add encashment in any month.', icon: 'ti-edit' },
  any_month: { label: 'Any month (manual)', desc: 'Admin enters encashment in any month. Not auto-computed.', icon: 'ti-calendar' },
  march_only: { label: 'March only', desc: 'Auto-computed only in March payroll. Exits handled separately in F&F.', icon: 'ti-calendar-event' }
};

// Helper: does encashment column show in current month for this entity?
function showEncashmentColumn() {
  const policy = E[S.entity].encashmentPolicy;
  const isMarch = S.monthSel === '2026-03';
  if (policy === 'ff_only') return false;
  if (policy === 'march_only') return isMarch;
  if (policy === 'ff_and_march') return isMarch;
  return true; // any_month, ff_and_any_month
}

// Helper: auto-fill encashment in March
function isMarchAutoFill() {
  const policy = E[S.entity].encashmentPolicy;
  return (policy === 'ff_and_march' || policy === 'march_only') && S.monthSel === '2026-03';
}

const EMP = [
  {
    id: 'EMP1003', name: 'Arjun Mehta', role: 'Team Lead', entity: 'premier', monthlyCTC: 186666, pf: true, gretyId: 'GHR-PRM-1003', av: 'AM', avBg: 'purple', doj: '14 Mar 2022', tenure: '4y 2m', residence: 'Hyderabad', workState: 'Telangana', leaveBalance: 8, taxRegime: 'old',
    att: { worked: 23, paid: 5, lop: 0, total: 28 }, emi: 8333, emiType: 'LOAN', incentive: 75000, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: true, status: 'active', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM'
  },
  {
    id: 'EMP1042', name: 'Ravi Kumar', role: 'Sr. Bench Sales', entity: 'premier', monthlyCTC: 154166, pf: true, gretyId: 'GHR-PRM-1042', av: 'RK', avBg: 'green', doj: '08 Jun 2023', tenure: '2y 11m', residence: 'Hyderabad', workState: 'Telangana', leaveBalance: 4, taxRegime: 'old',
    att: { worked: 22, paid: 1, lop: 5, total: 28 }, emi: 0, emiType: null, incentive: 0, bonus: 0, bonusType: null, overtime: 8400,
    reimb: { tel: 1200, medical: 0, lta: 0, books: 0, fuel: 0, internet: 2000, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: false, status: 'active', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM'
  },
  {
    id: 'EMP1058', name: 'Sneha Iyer', role: 'US IT Recruiter', entity: 'premier', monthlyCTC: 68333, pf: true, gretyId: 'GHR-PRM-1058', av: 'SI', avBg: 'orange', doj: '12 Jan 2024', tenure: '2y 4m', residence: 'Mumbai', workState: 'Maharashtra', leaveBalance: 12, taxRegime: 'new',
    att: { worked: 22, paid: 0, lop: 6, total: 28 }, emi: 0, emiType: null, incentive: 40000, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: false, status: 'active', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM'
  },
  {
    id: 'EMP1071', name: 'Priya Reddy', role: 'Recruiter', entity: 'premier', monthlyCTC: 51666, pf: false, gretyId: '', av: 'PR', avBg: 'blue', doj: '17 May 2026', tenure: '0y 0m', residence: 'Hyderabad', workState: 'Telangana', leaveBalance: 0, taxRegime: 'new',
    att: { worked: 11, paid: 0, lop: 0, total: 11 }, emi: 0, emiType: null, incentive: 0, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: false, newJoiner: true, status: 'active', syncStatus: 'pending', lastSynced: null
  },
  {
    id: 'EMP1019', name: 'Karthik Rao', role: 'Bench Sales', entity: 'premier', monthlyCTC: 48333, pf: true, gretyId: 'GHR-PRM-1019', av: 'KR', avBg: 'red', doj: '03 Mar 2024', tenure: '2y 2m', residence: 'Bangalore', workState: 'Karnataka', leaveBalance: 3, taxRegime: 'new',
    att: { worked: 18, paid: 0, lop: 10, total: 28 }, emi: 8333, emiType: 'LOAN', incentive: 0, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: true, hasActiveLoan: true, flag: 'absconding', status: 'active', syncStatus: 'error', lastSynced: null
  },
  {
    id: 'EMP1080', name: 'Meera Krishnan', role: 'Sr. Recruiter', entity: 'premier', monthlyCTC: 98333, pf: true, gretyId: 'GHR-PRM-1080', av: 'MK', avBg: 'purple', doj: '22 Sep 2023', tenure: '2y 8m', residence: 'Hyderabad', workState: 'Telangana', leaveBalance: 6, taxRegime: 'new',
    att: { worked: 25, paid: 3, lop: 0, total: 28 }, emi: 0, emiType: null, incentive: 0, bonus: 50000, bonusType: 'retention', overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: false, status: 'active', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM'
  },
  {
    id: 'EMP1067', name: 'Vikram Shah', role: 'Sr. Bench Sales', entity: 'nemo', monthlyCTC: 136666, pf: true, gretyId: 'GHR-NEM-1067', av: 'VS', avBg: 'purple', doj: '21 Jul 2022', tenure: '3y 10m', residence: 'Hyderabad', workState: 'Telangana', leaveBalance: 10, taxRegime: 'new',
    att: { worked: 23, paid: 5, lop: 0, total: 28 }, emi: 0, emiType: null, incentive: 0, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: -7500, hra: -3000, conveyance: -1000, special: -1000, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: false, status: 'active', syncStatus: 'pending'
  },
  {
    id: 'EMP2014', name: 'Manish Patel', role: 'Recruiter', entity: 'nemo', monthlyCTC: 58333, pf: true, gretyId: 'GHR-NEM-2014', av: 'MP', avBg: 'blue', doj: '14 Feb 2025', tenure: '1y 3m', residence: 'Pune', workState: 'Maharashtra', leaveBalance: 5, taxRegime: 'old',
    att: { worked: 28, paid: 0, lop: 0, total: 28 }, emi: 16666, emiType: 'LOAN', incentive: 0, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: true, status: 'active', syncStatus: 'pending'
  },
  {
    id: 'EMP3022', name: 'Anitha Reddy', role: 'Recruiter', entity: 'invicktus', monthlyCTC: 61666, pf: true, gretyId: 'GHR-INV-3022', av: 'AR', avBg: 'green', doj: '11 Nov 2024', tenure: '1y 6m', residence: 'Bangalore', workState: 'Karnataka', leaveBalance: 7, taxRegime: 'new',
    att: { worked: 27, paid: 1, lop: 0, total: 28 }, emi: 10000, emiType: 'LOAN', incentive: 0, bonus: 0, bonusType: null, overtime: 0,
    reimb: { tel: 0, medical: 0, lta: 0, books: 0, fuel: 0, internet: 0, misc: 0 },
    arrears: { basic: 0, hra: 0, conveyance: 0, special: 0, lta: 0 },
    encashment: 0, encashDays: 0, flagged: false, hasActiveLoan: true, status: 'active', syncStatus: 'pending'
  }
];

// Finance master data maintained in MySlice (People) and synced to greytHR
const FINANCE = {
  EMP1003: { bankName: 'HDFC Bank', accountNo: '5010012344582', ifsc: 'HDFC0001234', pan: 'ABCDE1234F', uan: '100234567890', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Telangana', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM' },
  EMP1042: { bankName: 'ICICI Bank', accountNo: '6002345678912', ifsc: 'ICIC0000456', pan: 'BBCPK1234G', uan: '100876543210', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Telangana', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM' },
  EMP1058: { bankName: 'Axis Bank', accountNo: '9123456789012', ifsc: 'UTIB0000789', pan: 'CCPSI5678H', uan: '101122334455', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Maharashtra', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM' },
  EMP1071: { bankName: '', accountNo: '', ifsc: '', pan: '', uan: '', pfApplicable: false, esiApplicable: false, esicNo: '', ptState: 'Telangana', syncStatus: 'pending', lastSynced: null },
  EMP1019: { bankName: 'SBI', accountNo: '38456789012', ifsc: 'SBIN0001234', pan: 'DDEKR9012J', uan: '101998877665', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Karnataka', syncStatus: 'error', lastSynced: null },
  EMP1080: { bankName: 'HDFC Bank', accountNo: '5010098765432', ifsc: 'HDFC0009876', pan: 'EEMKR3456K', uan: '102011223344', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Telangana', syncStatus: 'synced', lastSynced: '14 May 2026, 11:22 AM' },
  EMP1067: { bankName: 'Kotak Mahindra', accountNo: '9612345678', ifsc: 'KKBK0000123', pan: 'FFGVS7890L', uan: '', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Telangana', syncStatus: 'error', lastSynced: '10 May 2026, 09:15 AM' },
  EMP2014: { bankName: 'HDFC Bank', accountNo: '5010055551234', ifsc: 'HDFC0005555', pan: 'GGMPT2345M', uan: '102055667788', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Maharashtra', syncStatus: 'pending', lastSynced: null },
  EMP3022: { bankName: 'Canara Bank', accountNo: '11001234567', ifsc: 'CNRB0001100', pan: 'HHANR6789N', uan: '102099887766', pfApplicable: true, esiApplicable: false, esicNo: '', ptState: 'Karnataka', syncStatus: 'pending', lastSynced: null }
};

// === GREYTHR INTEGRATION CONSTANTS ===
// Maps MySlice fields to greytHR item codes from /payroll/v2/salary/repository
const GREYTHR_ITEM_CODES = {
  WORKDAYS: { id: 6, desc: 'Employee workdays', mySliceField: 'Days worked' },
  LOP: { id: 7, desc: 'Loss of Pay', mySliceField: 'LOP' },
  ANNUAL_CTC: { id: 90, desc: 'Annual CTC', mySliceField: 'Monthly CTC × 12' },
  MONTHLY_CTC: { id: 91, desc: 'Monthly CTC', mySliceField: 'Monthly CTC' },
  IS_PF_ELIGIBLE: { id: 107, desc: 'Eligible for PF', mySliceField: 'PF flag' },
  LOAN: { id: 20, desc: 'Loan EMI deduction', mySliceField: 'Loan EMI (festival/emergency)' },
  SAL_ADV: { id: 186, desc: 'Salary advance recovery', mySliceField: 'Loan EMI (advance type)' },
  INCENTIVE: { id: 97, desc: 'Incentive', mySliceField: 'Incentive' },
  MON_INCE: { id: 227, desc: 'Monthly incentives', mySliceField: 'Incentive (alt)' },
  BONUS: { id: 96, desc: 'Bonus (regular)', mySliceField: 'Bonus (regular)' },
  RET_BONUS: { id: 217, desc: 'Retention bonus', mySliceField: 'Bonus (retention)' },
  REF_BONUS: { id: 218, desc: 'Referral bonus', mySliceField: 'Bonus (referral)' },
  RE_BONUS: { id: 219, desc: 'Relocation bonus', mySliceField: 'Bonus (relocation)' },
  JOIN_BONUS: { id: 221, desc: 'Joining bonus', mySliceField: 'Bonus (joining)' },
  OT_PAYOUT: { id: 131, desc: 'Overtime payout', mySliceField: 'Overtime' },
  TEL_REIMB: { id: 166, desc: 'Telephone reimbursement', mySliceField: 'Reimbursements › Telephone' },
  MEDICAL_REIMB: { id: 167, desc: 'Medical reimbursement', mySliceField: 'Reimbursements › Medical' },
  LTA_REIMB: { id: 168, desc: 'LTA reimbursement', mySliceField: 'Reimbursements › LTA' },
  BOOKS_PERIODICAL: { id: 173, desc: 'Books & periodicals', mySliceField: 'Reimbursements › Books' },
  FM_A1600CC_REIMB: { id: 171, desc: 'Fuel maintenance', mySliceField: 'Reimbursements › Fuel' },
  INT_REIMBURSEMENT: { id: 177, desc: 'Internet reimbursement', mySliceField: 'Reimbursements › Internet' },
  MISC_REIM: { id: 62, desc: 'Misc reimbursement', mySliceField: 'Reimbursements › Other' },
  BASIC_A: { id: 81, desc: 'Basic arrears', mySliceField: 'Arrears › Basic' },
  HRA_A: { id: 87, desc: 'HRA arrears', mySliceField: 'Arrears › HRA' },
  CONVEYANCE_A: { id: 83, desc: 'Conveyance arrears', mySliceField: 'Arrears › Conveyance' },
  SPECIAL_ALLOW_A: { id: 95, desc: 'Special allowance arrears', mySliceField: 'Arrears › Special allowance' },
  LTA_A: { id: 193, desc: 'LTA arrears', mySliceField: 'Arrears › LTA' },
  ENCASH_DAYS: { id: 64, desc: 'Leave encashment days', mySliceField: 'Approved Leave Encashment Days' },
  LEAVE_ENCASHMENT: { id: 195, desc: 'Leave encashment amount', mySliceField: 'Calculated Leave Encashment Amount' },
  NOTICE_DAYS: { id: 65, desc: 'Notice period shortfall days', mySliceField: 'F&F · Notice shortfall' },
  NOTICE_RECOVERY: { id: 103, desc: 'Notice recovery', mySliceField: 'F&F · Notice recovery amount' },
  GRATUITY: { id: 196, desc: 'Gratuity', mySliceField: 'F&F · Gratuity' },
  TAX_REGIME: { id: 230, desc: 'Tax regime (1=Old, 2=New)', mySliceField: 'Tax regime' }
};

const BONUS_TYPES = {
  regular: { code: 'BONUS', label: 'Regular bonus', desc: 'Performance/year-end bonus' },
  retention: { code: 'RET_BONUS', label: 'Retention bonus', desc: 'Stay-back bonus' },
  referral: { code: 'REF_BONUS', label: 'Referral bonus', desc: 'Employee referral reward' },
  relocation: { code: 'RE_BONUS', label: 'Relocation bonus', desc: 'Relocation allowance' },
  joining: { code: 'JOIN_BONUS', label: 'Joining bonus', desc: 'Sign-on bonus' }
};

const REIMB_CATEGORIES = {
  tel: { code: 'TEL_REIMB', label: 'Telephone', limit: 2500, taxable: false },
  medical: { code: 'MEDICAL_REIMB', label: 'Medical', limit: 15000, taxable: false },
  lta: { code: 'LTA_REIMB', label: 'LTA', limit: 50000, taxable: false },
  books: { code: 'BOOKS_PERIODICAL', label: 'Books & periodicals', limit: 12000, taxable: false },
  fuel: { code: 'FM_A1600CC_REIMB', label: 'Fuel & maintenance', limit: 21600, taxable: false },
  internet: { code: 'INT_REIMBURSEMENT', label: 'Internet', limit: 24000, taxable: false },
  misc: { code: 'MISC_REIM', label: 'Other / Misc', limit: null, taxable: true }
};

const ARREARS_COMPONENTS = {
  basic: { code: 'BASIC_A', label: 'Basic', desc: 'Arrears on basic salary' },
  hra: { code: 'HRA_A', label: 'HRA', desc: 'Arrears on HRA' },
  conveyance: { code: 'CONVEYANCE_A', label: 'Conveyance', desc: 'Arrears on conveyance' },
  special: { code: 'SPECIAL_ALLOW_A', label: 'Special allowance', desc: 'Arrears on special allowance' },
  lta: { code: 'LTA_A', label: 'LTA', desc: 'Arrears on LTA' }
};

// Helpers for breakdown fields
function reimbTotal(r) { return Object.values(r || {}).reduce((s, v) => s + (v || 0), 0); }
function arrearsTotal(a) { return Object.values(a || {}).reduce((s, v) => s + (v || 0), 0); }
function setEmpReimb(empId, category, value) {
  const e = EMP.find(x => x.id === empId);
  if (e) { e.reimb[category] = value || 0; }
}
function setEmpArrears(empId, component, value) {
  const e = EMP.find(x => x.id === empId);
  if (e) { e.arrears[component] = value || 0; }
}

const LOANS_PEND = [
  { id: 'LN-001', empId: 'EMP1067', emp: 'Vikram Shah', av: 'VS', entity: 'Nemo IT Solutions', type: 'Emergency', amount: 250000, tenure: 12, emi: 20833, requested: '12 May 2026', reason: "Medical emergency - mother's heart surgery scheduled June. Will submit hospital documents.", awaiting: 'CEO', urgent: true, monthlyTakeHome: 98700 },
  { id: 'LN-002', empId: 'EMP1058', emp: 'Sneha Iyer', av: 'SI', entity: 'Premier IT Solutions', type: 'Festival', amount: 60000, tenure: 6, emi: 10000, requested: '13 May 2026', reason: "Sister's wedding in July. Will use for arrangements.", awaiting: 'Finance Admin', urgent: false, monthlyTakeHome: 56400 },
  { id: 'LN-003', empId: 'EMP1089', emp: 'Kavita Singh', av: 'KS', entity: 'Invicktus', type: 'Salary advance', amount: 40000, tenure: 1, emi: 40000, requested: '13 May 2026', reason: 'Sudden expense, will repay next month.', awaiting: 'Ineligible', urgent: false, monthlyTakeHome: 38000, ineligible: true }
];

const LOANS_ACTIVE = [
  { empId: 'EMP1003', emp: 'Arjun Mehta', entity: 'Premier', type: 'Festival', principal: 50000, paid: 4, total: 6, emi: 8333, outstanding: 16667, startDate: 'Jan 2026', endDate: 'Jun 2026' },
  { empId: 'EMP1019', emp: 'Karthik Rao', entity: 'Premier', type: 'Festival', principal: 50000, paid: 2, total: 6, emi: 8333, outstanding: 33333, startDate: 'Mar 2026', endDate: 'Aug 2026' },
  { empId: 'EMP2014', emp: 'Manish Patel', entity: 'Nemo', type: 'Emergency', principal: 200000, paid: 3, total: 12, emi: 16666, outstanding: 149994, startDate: 'Feb 2026', endDate: 'Jan 2027' },
  { empId: 'EMP3022', emp: 'Anitha Reddy', entity: 'Invicktus', type: 'Festival', principal: 60000, paid: 5, total: 6, emi: 10000, outstanding: 10000, startDate: 'Dec 2025', endDate: 'May 2026' }
];

const RESIGN_STEPS = [
  { key: 'request', label: 'Resignation request', icon: 'ti-mail' },
  { key: 'manager', label: 'Manager approval', icon: 'ti-user-check' },
  { key: 'hrLeave', label: 'HR leave clearance', icon: 'ti-leaf' },
  { key: 'itAssets', label: 'IT asset clearance', icon: 'ti-device-laptop' },
  { key: 'finalDays', label: 'Final payroll days', icon: 'ti-calendar-stats' },
  { key: 'finalAction', label: 'Separation & F&F handoff', icon: 'ti-send' }
];

const RESIGNATION_WORKFLOW = [
  { id: 'RW-1', key: 'request', approver: 'Employee', required: true, enabled: true, slaDays: null, greytHRAction: '—', description: 'Employee submits via ESS or HR creates on behalf' },
  { id: 'RW-2', key: 'manager', approver: 'Reporting manager', required: true, enabled: true, slaDays: 3, greytHRAction: '—', description: 'Manager accepts LWD and notice period' },
  { id: 'RW-3', key: 'hrLeave', approver: 'HR Admin', required: true, enabled: true, slaDays: 5, greytHRAction: 'F&F leave encashment push', description: 'HR approves encashable days per policy; MySlice calculates amount and pushes to greytHR for F&F' },
  { id: 'RW-4', key: 'itAssets', approver: 'IT Admin', required: true, enabled: true, slaDays: 7, greytHRAction: '—', description: 'Asset return and recovery amount captured' },
  { id: 'RW-5', key: 'finalDays', approver: 'Payroll Admin', required: true, enabled: true, slaDays: 2, greytHRAction: 'LOP via LOP Sync', description: 'Final payable days and LOP confirmed before separation' },
  { id: 'RW-6', key: 'finalAction', approver: 'HR Admin', required: true, enabled: true, slaDays: 1, greytHRAction: 'Separation API', description: 'MySlice sends separation payload; F&F completed in greytHR portal' }
];

const RESIGNATION_POLICY = {
  noticePeriodDays: 30,
  requireEncashmentBeforeSeparation: true,
  requireLopSyncBeforeSeparation: true,
  allowExcludeFromFF: true,
  alumniPortalAfterFF: true
};

const RESIGNATIONS = [
  {
    id: 'RES-001', empId: 'EMP1052', emp: 'Rohit Kapoor', av: 'RK', avBg: 'orange', entity: 'nemo', entityName: 'Nemo IT Solutions',
    resignationDate: '1 May 2026', proposedLwd: '31 May 2026', lwd: '31 May 2026', reason: 'Better opportunity', remarks: 'Relocating to Bangalore',
    noticeStatus: 'Full notice served', leaveBalance: 12, loanOutstanding: 78000, assetRecovery: 0, monthlyCTC: 87500,
    status: 'in_progress', currentStep: 4, separationSync: 'pending', ffStatus: 'Not started', daysToDeadline: 18,
    gratuityEligible: false, gratuityYears: 3.2, stage: 'it_clearance',
    steps: {
      request: { status: 'done', date: '1 May 2026', by: 'Rohit Kapoor' },
      manager: { status: 'done', date: '3 May 2026', by: 'Vasu Devalla' },
      hrLeave: { status: 'done', date: '8 May 2026', by: 'Priya Sharma', encashDays: 8, expireDays: 4 },
      itAssets: { status: 'active' },
      finalDays: { status: 'pending' },
      finalAction: { status: 'pending' }
    },
    leaveTypes: [
      { name: 'Earned Leave', code: 'EL', balance: 8, maxEncashable: 8, encashable: 8, approvedEncash: 8, lapsed: 0, expire: 4 },
      { name: 'Casual Leave', code: 'CL', balance: 4, maxEncashable: 0, encashable: 0, approvedEncash: 0, lapsed: 0, expire: 4 }
    ],
    assets: [
      { name: 'MacBook Pro 14"', assigned: true, returned: false, damage: 'None', recovery: 0 },
      { name: 'Office access card', assigned: true, returned: true, damage: 'None', recovery: 0 }
    ],
    payrollDays: { workingDays: 22, payableDays: 18, lop: 0 },
    encashAmount: 13336, encashSync: 'pending',
    encashStatus: 'ready_to_sync', encashApprovedBy: 'Priya Sharma', encashApprovedDate: '8 May 2026', encashRemarks: 'Full EL balance encashable per policy',
    encashLastSynced: null, encashSyncError: null, encashAudit: [
      { date: '8 May 2026', by: 'Priya Sharma', action: 'Approved leave encashment', originalValue: 0, modifiedValue: 8, remarks: 'Full EL balance encashable per policy', type: 'approve' }
    ]
  }, {
    id: 'RES-002', empId: 'EMP1019', emp: 'Karthik Rao', av: 'KR', avBg: 'red', entity: 'premier', entityName: 'Premier IT Solutions',
    resignationDate: '—', proposedLwd: '—', lwd: 'Disputed', reason: 'Absconding (termination)', remarks: 'No punch since 9 May',
    noticeStatus: 'No notice', leaveBalance: 3, loanOutstanding: 33333, assetRecovery: 15000, monthlyCTC: 48333,
    status: 'on_hold', currentStep: 2, separationSync: 'blocked', ffStatus: 'Blocked', daysToDeadline: null,
    gratuityEligible: false, gratuityYears: 2.2, stage: 'investigation',
    steps: {
      request: { status: 'done', date: '9 May 2026', by: 'HR Admin' },
      manager: { status: 'blocked' },
      hrLeave: { status: 'pending' },
      itAssets: { status: 'pending' },
      finalDays: { status: 'pending' },
      finalAction: { status: 'pending' }
    },
    leaveTypes: [
      { name: 'Earned Leave', code: 'EL', balance: 3, maxEncashable: 0, encashable: 0, approvedEncash: 0, lapsed: 3, expire: 3 }
    ],
    assets: [
      { name: 'Dell Latitude 5540', assigned: true, returned: false, damage: 'Screen crack', recovery: 15000 }
    ],
    payrollDays: { workingDays: 22, payableDays: 12, lop: 10 },
    encashAmount: 0, encashSync: 'blocked',
    encashStatus: 'pending_review', encashApprovedBy: null, encashApprovedDate: null, encashRemarks: '',
    encashLastSynced: null, encashSyncError: null, encashAudit: []
  }, {
    id: 'RES-003', empId: 'EMP1080', emp: 'Meera Krishnan', av: 'MK', avBg: 'purple', entity: 'premier', entityName: 'Premier IT Solutions',
    resignationDate: '15 Apr 2026', proposedLwd: '15 May 2026', lwd: '15 May 2026', reason: 'Personal reasons', remarks: 'Serving notice',
    noticeStatus: 'Full notice served', leaveBalance: 6, loanOutstanding: 0, assetRecovery: 0, monthlyCTC: 98333,
    status: 'ready_for_ff', currentStep: 6, separationSync: 'synced', ffStatus: 'Ready in greytHR', daysToDeadline: 3,
    gratuityEligible: false, gratuityYears: 2.8, stage: 'ready',
    steps: {
      request: { status: 'done', date: '15 Apr 2026', by: 'Meera Krishnan' },
      manager: { status: 'done', date: '17 Apr 2026', by: 'Vasu Devalla' },
      hrLeave: { status: 'done', date: '22 Apr 2026', by: 'Priya Sharma', encashDays: 4, expireDays: 2 },
      itAssets: { status: 'done', date: '10 May 2026', by: 'IT Admin', recovery: 0 },
      finalDays: { status: 'done', date: '12 May 2026', payableDays: 15, lop: 0 },
      finalAction: { status: 'done', date: '14 May 2026', by: 'Priya Sharma' }
    },
    leaveTypes: [
      { name: 'Earned Leave', code: 'EL', balance: 6, maxEncashable: 4, encashable: 4, approvedEncash: 4, lapsed: 2, expire: 2 }
    ],
    assets: [
      { name: 'MacBook Air M2', assigned: true, returned: true, damage: 'None', recovery: 0 }
    ],
    payrollDays: { workingDays: 22, payableDays: 15, lop: 0 },
    encashAmount: 7492, encashSync: 'synced',
    encashStatus: 'ff_pending', encashApprovedBy: 'Priya Sharma', encashApprovedDate: '22 Apr 2026',
    encashLastSynced: '28 Apr 2026, 03:45 PM', encashSyncError: null,
    encashAudit: [
      { date: '22 Apr 2026', by: 'Priya Sharma', action: 'Approved leave encashment', originalValue: 0, modifiedValue: 4, remarks: '2 days lapsed per policy cap', type: 'approve' },
      { date: '28 Apr 2026', by: 'Priya Sharma', action: 'Synced to greytHR', originalValue: null, modifiedValue: '4 days · ₹7,492', remarks: 'Submitted via configured integration mapping', type: 'sync' }
    ]
  }
];

const RESIGNATIONS_COMPLETED = [
  { empId: 'EMP2007', emp: 'Suresh Babu', entity: 'Nemo IT Solutions', lwd: '28 Feb 2026', separationDate: '2 Mar 2026', ffStatus: 'Settled in greytHR', reason: 'Resignation' },
  { empId: 'EMP1031', emp: 'Vikram Joshi', entity: 'Premier IT Solutions', lwd: '15 Jan 2026', separationDate: '17 Jan 2026', ffStatus: 'Settled in greytHR', reason: 'Resignation' }
];

const FF_ACTIVE = RESIGNATIONS.filter(r => r.status === 'in_progress' || r.status === 'on_hold');
const FF_COMPLETED = RESIGNATIONS_COMPLETED;

const HISTORY = [
  { id: 'BATCH-2026-04', entity: 'premier', month: 'Apr 2026', empCount: 6, totalCTC: 11375000, totalEMI: 24999, totalIncentive: 42000, totalBonus: 0, totalOT: 0, totalReimb: 0, totalEncash: 0, totalArrears: 0, status: 'completed', sentAt: '28 Apr 2026, 14:33', sentBy: 'Priya Sharma' },
  { id: 'BATCH-2026-03', entity: 'premier', month: 'Mar 2026', empCount: 6, totalCTC: 11200000, totalEMI: 24999, totalIncentive: 128200, totalBonus: 200000, totalOT: 12400, totalReimb: 18200, totalEncash: 168000, totalArrears: 0, status: 'completed', sentAt: '28 Mar 2026, 11:18', sentBy: 'Priya Sharma', hasEncashment: true },
  { id: 'BATCH-2026-02', entity: 'premier', month: 'Feb 2026', empCount: 5, totalCTC: 10900000, totalEMI: 8333, totalIncentive: 0, totalBonus: 0, totalOT: 0, totalReimb: 4200, totalEncash: 0, totalArrears: 0, status: 'completed', sentAt: '28 Feb 2026, 16:42', sentBy: 'Priya Sharma' }
];

const AUD = [
  { date: 'May 14', time: '11:22', type: 'system', title: 'Attendance auto-imported from Shifts', actor: 'System', meta: 'May 2026 cycle · 6 employees · Premier' },
  { date: 'May 14', time: '10:01', type: 'action', title: 'PF challan generated · Apr 2026', actor: 'Vasu Devalla', meta: 'ECR file ready · ₹26,440 total · Due 15 Jun' },
  { date: 'May 13', time: '16:14', type: 'action', title: 'Loan request submitted', actor: 'Sneha Iyer', meta: 'Festival loan · ₹60,000 · 6 months' },
  { date: 'May 12', time: '15:30', type: 'action', title: 'IT declaration submitted', actor: 'Arjun Mehta', meta: 'FY 2026-27 · Old regime · ₹2,30,000 total declared' },
  { date: 'May 10', time: '14:00', type: 'integration', title: 'Bank file generated · Apr payroll', actor: 'Vasu Devalla', meta: 'HDFC NetBanking format · 9 transfers · ₹6,52,810' },
  { date: 'May 12', time: '18:22', type: 'action', title: 'Loan request submitted', actor: 'Vikram Shah', meta: 'Emergency loan · ₹2,50,000 · escalated to CEO' },
  { date: 'May 10', time: '14:18', type: 'action', title: 'F&F initiated', actor: 'Priya Sharma', meta: 'Rohit Kapoor (EMP1052) · LWD 31 May 2026' },
  { date: 'May 08', time: '09:32', type: 'override', title: 'Employee flagged as absconding', actor: 'Priya Sharma', meta: 'Karthik Rao (EMP1019)' },
  { date: 'Apr 28', time: '14:33', type: 'approval', title: 'April payroll inputs sent', actor: 'Priya Sharma', meta: 'Premier · 6 employees' },
  { date: 'Mar 28', time: '11:18', type: 'approval', title: 'March payroll inputs sent (with encashment)', actor: 'Priya Sharma', meta: 'Premier · 6 employees · encashment ₹1,68,000 included' }
];

const SYNC_HISTORY = [
  { id: 'SH-008', type: 'lop', entity: 'premier', date: '14 May 2026', time: '11:22 AM', period: 'May 2026', label: 'LOP Sync', total: 6, success: 5, failed: 1, actor: 'Priya Sharma', status: 'partial', ref: 'SYNC-LOP-202605-001', detail: 'Karthik Rao failed — absconding flag in Shifts', payload: { item: 'LOP', value: 5, fromDate: '2026-05-01' } },
  { id: 'SH-007', type: 'employee', entity: 'premier', date: '14 May 2026', time: '11:22 AM', period: 'Full roster', label: 'Employee Sync', total: 245, success: 242, failed: 3, actor: 'System (scheduled)', status: 'partial', ref: 'SYNC-EMP-20260514-001', detail: '3 validation errors — duplicate email, missing PAN, invalid DOJ', payload: { employeeId: 'EMP021', action: 'upsert' } },
  { id: 'SH-006', type: 'loan', entity: 'premier', date: '12 May 2026', time: '09:15 AM', period: 'LN-004', label: 'Loan Create', total: 1, success: 1, failed: 0, actor: 'Priya Sharma', status: 'completed', ref: 'SYNC-LOAN-20260512-001', detail: 'Arjun Mehta · Festival loan · EMI ₹8,333 × 6 months', payload: { employeeId: 'EMP1003', loanType: 'FESTIVAL', principal: 50000, emi: 8333, tenure: 6 } },
  { id: 'SH-005', type: 'separation', entity: 'nemo', date: '2 Mar 2026', time: '04:10 PM', period: 'EMP2007', label: 'Separation Sync', total: 1, success: 1, failed: 0, actor: 'Priya Sharma', status: 'completed', ref: 'SYNC-SEP-20260302-001', detail: 'Suresh Babu · LWD 28 Feb 2026 · F&F settled in greytHR', payload: { employeeId: 'EMP2007', greytHRId: 'GHR-NMO-2007', lastWorkingDate: '2026-02-28', separationReason: 'Resignation' } },
  { id: 'SH-004', type: 'encashment', entity: 'premier', date: '28 Apr 2026', time: '03:45 PM', period: 'Meera Krishnan', label: 'Leave Encashment Push', total: 1, success: 1, failed: 0, actor: 'Priya Sharma', status: 'completed', ref: 'SYNC-ENC-20260428-001', detail: '4 EL days · ₹7,492 pushed for F&F processing', payload: { employeeId: 'EMP1080', leaveEncashDays: 4, leaveEncashAmount: 7492 } },
  { id: 'SH-003', type: 'lop', entity: 'premier', date: '28 Apr 2026', time: '11:18 AM', period: 'Apr 2026', label: 'LOP Sync', total: 6, success: 6, failed: 0, actor: 'Priya Sharma', status: 'completed', ref: 'SYNC-LOP-202604-001', detail: 'All employees synced · total 11 LOP days', payload: { item: 'LOP', value: 0, fromDate: '2026-04-01' } },
  { id: 'SH-001', type: 'employee', entity: 'premier', date: '1 Apr 2026', time: '09:30 AM', period: 'Delta sync', label: 'Employee Sync', total: 12, success: 12, failed: 0, actor: 'System (scheduled)', status: 'completed', ref: 'SYNC-EMP-20260401-001', detail: 'New joiners and profile updates since Mar payroll', payload: { employeeId: 'EMP1071', action: 'create' } }
];

const SYNC_ERRORS = [
  { id: 'SE-001', type: 'employee', entity: 'premier', date: '14 May 2026', time: '11:22 AM', empId: 'EMP021', emp: 'Rahul Shah', av: 'RS', avBg: 'orange', scope: 'Employee sync', reason: 'Email already exists in greytHR', apiError: '409 Conflict · duplicate email', fixHint: 'Update email in People or remove duplicate greytHR record', fixNav: 'greythr-settings', retryKind: 'empBatch', retryRef: 'ESF-1', batchRef: 'SH-007', severity: 'high' },
  { id: 'SE-002', type: 'employee', entity: 'premier', date: '14 May 2026', time: '11:22 AM', empId: 'EMP1071', emp: 'Priya Reddy', av: 'PR', avBg: 'blue', scope: 'Employee sync', reason: 'Missing PAN and bank account in People profile', apiError: '400 Bad Request · PAN required', fixHint: 'Complete bank and statutory details in People employee profile', fixNav: 'employees', retryKind: 'empBatch', retryRef: 'ESF-2', batchRef: 'SH-007', severity: 'high' },
  { id: 'SE-003', type: 'employee', entity: 'premier', date: '14 May 2026', time: '11:22 AM', empId: 'EMP099', emp: 'Vikram Mehta', av: 'VM', avBg: 'blue', scope: 'Employee sync', reason: 'Invalid date of joining', apiError: '400 Bad Request', fixHint: 'Correct DOJ in People — must not be in the future', fixNav: 'employees', retryKind: 'empBatch', retryRef: 'ESF-3', batchRef: 'SH-007', severity: 'medium' },
  { id: 'SE-004', type: 'employee', entity: 'premier', date: '14 May 2026', time: '11:22 AM', empId: 'EMP1019', emp: 'Karthik Rao', av: 'KR', avBg: 'red', scope: 'Employee profile sync', reason: 'Employee in stopped state — absconding flag active', apiError: '400 Bad Request · employee stopped', fixHint: 'Resolve absconding flag in Shifts or HR before retry', fixNav: 'employees', retryKind: 'employee', retryRef: 'EMP1019', batchRef: 'SH-007', severity: 'critical' },
  { id: 'SE-005', type: 'lop', entity: 'premier', date: '14 May 2026', time: '11:22 AM', empId: 'EMP1019', emp: 'Karthik Rao', av: 'KR', avBg: 'red', scope: 'May 2026 LOP', reason: 'greytHR rejected LOP payload for stopped employee', apiError: '400 Bad Request', fixHint: 'Clear absconding flag, recalculate LOP, then retry', fixNav: 'lop-sync', retryKind: 'lop', retryRef: 'EMP1019', batchRef: 'SH-008', severity: 'critical' },
  { id: 'SE-007', type: 'separation', entity: 'premier', date: '10 May 2026', time: '02:00 PM', empId: 'EMP1019', emp: 'Karthik Rao', av: 'KR', avBg: 'red', scope: 'Separation sync blocked', reason: 'Offboarding on hold — manager approval pending', apiError: 'Blocked by workflow', fixHint: 'Complete clearance steps in Resignation & Offboarding', fixNav: 'resignation', retryKind: null, retryRef: null, batchRef: null, severity: 'medium' }
];

const HIKES = [
  { date: '1 Apr 2026', type: 'Annual hike', from: 2000000, to: 2240000, pct: 12.0, approver: 'Vasu Devalla' },
  { date: '1 Oct 2024', type: 'Promotion', from: 1560000, to: 2000000, pct: 28.2, approver: 'Vasu Devalla', note: 'Sr Recruiter → Team Lead' },
  { date: '1 Apr 2024', type: 'Annual hike', from: 1400000, to: 1560000, pct: 11.4, approver: 'Priya Sharma' },
  { date: '1 Apr 2023', type: 'Annual hike', from: 1200000, to: 1400000, pct: 16.7, approver: 'Priya Sharma' },
  { date: '14 Mar 2022', type: 'Joined', from: 0, to: 1200000, pct: null, approver: 'Vasu Devalla', note: 'Mid band · US IT Recruiter' }
];

const EMP_MONTHLY = [
  { month: 'May 2026', monthCode: '2026-05-01', worked: 23, paid: 5, lop: 0, monthlyCTC: 186666, emi: 8333, emiType: 'LOAN', incentive: 75000, bonus: 0, bonusType: null, overtime: 0, reimbTotal: 0, arrearsTotal: 0, encashment: 0, encashDays: 0, status: 'pending', payrollId: null },
  { month: 'Apr 2026', monthCode: '2026-04-01', worked: 30, paid: 0, lop: 0, monthlyCTC: 186666, emi: 8333, emiType: 'LOAN', incentive: 0, bonus: 0, bonusType: null, overtime: 0, reimbTotal: 0, arrearsTotal: 0, encashment: 0, encashDays: 0, status: 'paid', payrollId: 'PR-2026-04' },
  { month: 'Mar 2026', monthCode: '2026-03-01', worked: 31, paid: 0, lop: 0, monthlyCTC: 186666, emi: 8333, emiType: 'LOAN', incentive: 128200, bonus: 200000, bonusType: 'regular', overtime: 0, reimbTotal: 8400, arrearsTotal: 0, encashment: 42000, encashDays: 8, status: 'paid', hasEncashment: true, payrollId: 'PR-2026-03' },
  { month: 'Feb 2026', monthCode: '2026-02-01', worked: 28, paid: 0, lop: 0, monthlyCTC: 186666, emi: 0, emiType: null, incentive: 0, bonus: 0, bonusType: null, overtime: 0, reimbTotal: 0, arrearsTotal: 0, encashment: 0, encashDays: 0, status: 'paid', payrollId: 'PR-2026-02' },
  { month: 'Jan 2026', monthCode: '2026-01-01', worked: 31, paid: 0, lop: 0, monthlyCTC: 186666, emi: 8333, emiType: 'LOAN', incentive: 0, bonus: 0, bonusType: null, overtime: 0, reimbTotal: 4200, arrearsTotal: 0, encashment: 0, encashDays: 0, status: 'paid', payrollId: 'PR-2026-01' },
  { month: 'Dec 2025', monthCode: '2025-12-01', worked: 26, paid: 0, lop: 5, monthlyCTC: 130000, emi: 0, emiType: null, incentive: 142800, bonus: 0, bonusType: null, overtime: 0, reimbTotal: 0, arrearsTotal: 0, encashment: 0, encashDays: 0, status: 'paid', payrollId: 'PR-2025-12' }
];

// Build the actual greytHR payload that will be POST'd for an employee
function buildGreytHRPayload(e, monthCode) {
  const fromDate = monthCode || '2026-05-01';
  const items = [];
  // Attendance (from Shifts)
  items.push({ item: 'WORKDAYS', value: e.att.worked + e.att.paid, fromDate });
  items.push({ item: 'LOP', value: e.att.lop, fromDate });
  // Salary
  items.push({ item: 'MONTHLY_CTC', value: e.monthlyCTC, fromDate });
  items.push({ item: 'IS_PF_ELIGIBLE', value: e.pf ? 1 : 0, fromDate });
  // Tax regime
  items.push({ item: 'TAX_REGIME', value: e.taxRegime === 'old' ? 1 : 2, fromDate });
  // Loan / advance
  if (e.emi > 0) items.push({ item: e.emiType || 'LOAN', value: e.emi, fromDate });
  // Incentive
  if (e.incentive > 0) items.push({ item: 'INCENTIVE', value: e.incentive, fromDate });
  // Bonus (typed)
  if (e.bonus > 0) {
    const code = e.bonusType ? BONUS_TYPES[e.bonusType].code : 'BONUS';
    items.push({ item: code, value: e.bonus, fromDate });
  }
  // Overtime
  if (e.overtime > 0) items.push({ item: 'OT_PAYOUT', value: e.overtime, fromDate });
  // Reimbursements by category
  if (e.reimb) {
    Object.keys(e.reimb).forEach(cat => {
      if (e.reimb[cat] > 0) items.push({ item: REIMB_CATEGORIES[cat].code, value: e.reimb[cat], fromDate });
    });
  }
  // Arrears by component
  if (e.arrears) {
    Object.keys(e.arrears).forEach(c => {
      if (e.arrears[c] !== 0) items.push({ item: ARREARS_COMPONENTS[c].code, value: e.arrears[c], fromDate });
    });
  }
  // Encashment (paired)
  if (e.encashment > 0 || e.encashDays > 0) {
    items.push({ item: 'ENCASH_DAYS', value: e.encashDays || 0, fromDate });
    items.push({ item: 'LEAVE_ENCASHMENT', value: e.encashment || 0, fromDate });
  }
  return items;
}

// Simulate "GET /payroll/v2/employees/handentry" — what greytHR returns
function mockGreytHRCurrentValues(e) {
  // Pretend last month's payroll values are still active
  return buildGreytHRPayload(e, '2026-04-01').filter(it => !['WORKDAYS', 'LOP', 'INCENTIVE'].includes(it.item));
}

// Pay period info (mocks GET /pay-period?inputDate=...)
const PAY_PERIODS = [
  { name: 'May 2026', start: '2026-05-01', end: '2026-05-31', workDays: 22, attendanceLockDay: 26, sendByDay: 28, payDate: '2026-06-01' },
  { name: 'Apr 2026', start: '2026-04-01', end: '2026-04-30', workDays: 22, attendanceLockDay: 26, sendByDay: 28, payDate: '2026-05-01' },
  { name: 'Mar 2026', start: '2026-03-01', end: '2026-03-31', workDays: 23, attendanceLockDay: 26, sendByDay: 28, payDate: '2026-04-01' }
];

// === COMPUTED PAYSLIP — what greytHR returns after processing ===
// Maps employeeId + monthCode → full payslip with auto-split CTC, deductions, net pay
function computePayslip(empId, monthCode) {
  const e = EMP.find(x => x.id === empId);
  if (!e) return null;
  const monthly = EMP_MONTHLY.find(m => m.monthCode === monthCode);
  if (!monthly) return null;
  // greytHR's typical CTC split (configured per company):
  // Basic = 40% of monthlyCTC, HRA = 40% of Basic, Conveyance = ₹1600 (capped), Special = remainder
  const monthlyCTC = monthly.monthlyCTC;
  const basic = Math.round(monthlyCTC * 0.40);
  const hra = Math.round(basic * 0.40);
  const conveyance = 1600;
  const employerPF = e.pf ? Math.min(Math.round(basic * 0.12), 1800) : 0; // capped at 1800 for PF wage ceiling
  const gratuityPart = Math.round(basic * 0.0481); // 4.81% accrued
  const special = monthlyCTC - basic - hra - conveyance - employerPF - gratuityPart;
  // Pro-rata for LOP
  const payableDays = monthly.worked + monthly.paid;
  const totalDays = 30; // standard month
  const proRataFactor = payableDays / totalDays;
  const earnings = {
    basic: Math.round(basic * proRataFactor),
    hra: Math.round(hra * proRataFactor),
    conveyance: Math.round(conveyance * proRataFactor),
    special: Math.round(special * proRataFactor),
    incentive: monthly.incentive || 0,
    bonus: monthly.bonus || 0,
    overtime: monthly.overtime || 0,
    reimbursements: monthly.reimbTotal || 0,
    encashment: monthly.encashment || 0,
    arrears: monthly.arrearsTotal || 0
  };
  const grossEarnings = Object.values(earnings).reduce((s, v) => s + v, 0);
  // Deductions
  const employeePF = e.pf ? Math.min(Math.round(earnings.basic * 0.12), 1800) : 0;
  const ptByState = { Telangana: 200, Maharashtra: 200, Karnataka: 200, 'Tamil Nadu': 208, 'West Bengal': 200 };
  const profTax = ptByState[e.workState] || 200;
  // Simplified income tax (new regime, monthly slabs)
  const annualGross = grossEarnings * 12;
  const standardDed = 75000;
  const taxableIncome = Math.max(0, annualGross - standardDed);
  let annualTax = 0;
  if (e.taxRegime === 'new') {
    if (taxableIncome > 300000) annualTax += Math.min(taxableIncome - 300000, 400000) * 0.05;
    if (taxableIncome > 700000) annualTax += Math.min(taxableIncome - 700000, 300000) * 0.10;
    if (taxableIncome > 1000000) annualTax += Math.min(taxableIncome - 1000000, 200000) * 0.15;
    if (taxableIncome > 1200000) annualTax += Math.min(taxableIncome - 1200000, 300000) * 0.20;
    if (taxableIncome > 1500000) annualTax += (taxableIncome - 1500000) * 0.30;
  } else {
    if (taxableIncome > 250000) annualTax += Math.min(taxableIncome - 250000, 250000) * 0.05;
    if (taxableIncome > 500000) annualTax += Math.min(taxableIncome - 500000, 500000) * 0.20;
    if (taxableIncome > 1000000) annualTax += (taxableIncome - 1000000) * 0.30;
  }
  const cess = annualTax * 0.04;
  const monthlyTDS = Math.round((annualTax + cess) / 12);
  const deductions = {
    pf: employeePF,
    profTax: profTax,
    incomeTax: monthlyTDS,
    loanEmi: monthly.emi || 0
  };
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
  const netPay = grossEarnings - totalDeductions;
  // Employer contributions (CTC visibility)
  const employerContrib = {
    pf: employerPF,
    edli: e.pf ? Math.round(Math.min(earnings.basic, 15000) * 0.005) : 0,
    gratuity: Math.round(gratuityPart * proRataFactor)
  };
  return {
    employeeId: empId,
    monthCode,
    month: monthly.month,
    payableDays,
    lopDays: monthly.lop,
    earnings,
    grossEarnings,
    deductions,
    totalDeductions,
    netPay,
    employerContrib,
    status: monthly.status,
    payrollId: monthly.payrollId,
    processedDate: monthly.status === 'paid' ? '28 ' + monthly.month : null
  };
}

// === IT DECLARATION — Employee tax saving investments ===
// Each section can have its own approval state and proof attachments
// Workflow: draft → submitted → (approved | rejected → resubmit) → considered
// Limits per section (FY 2026-27):
const IT_LIMITS = {
  '80C': 150000,
  '80D_self': 25000,
  '80D_parents': 25000,
  '80D_parents_sr': 50000,
  '80D_preventive': 5000,
  '80CCD_1B': 50000,
  '24_self': 200000,
  '80E': null, // no limit
  '80G_50pct': null,
  '80G_100pct': null,
  '80TTA': 10000,
  '80U_normal': 75000,
  '80U_severe': 125000,
  'HRA_rent': null // computed
};

const IT_DECLARATIONS = {
  EMP1003: {
    fy: '2026-27',
    overallStatus: 'partially_approved', // draft | submitted | partially_approved | approved | rejected | locked
    submittedOn: '15 Apr 2026',
    reviewedBy: 'Finance Admin',
    sections: {
      '80C': {
        items: [
          { id: 'i1', subSection: 'PPF', amount: 50000, proof: 'ppf-statement-fy2627.pdf', proofStatus: 'verified', status: 'approved' },
          { id: 'i2', subSection: 'ELSS', amount: 70000, proof: 'elss-statement.pdf', proofStatus: 'verified', status: 'approved' },
          { id: 'i3', subSection: 'Life insurance', amount: 30000, proof: null, proofStatus: 'missing', status: 'pending' }
        ]
      },
      '80D': {
        items: [
          { id: 'i4', subSection: 'Self+family premium', amount: 25000, proof: 'hdfc-ergo-policy.pdf', proofStatus: 'verified', status: 'approved' },
          { id: 'i5', subSection: 'Preventive check-up', amount: 5000, proof: null, proofStatus: 'missing', status: 'pending' }
        ]
      },
      '80CCD_1B': {
        items: [
          { id: 'i6', subSection: 'NPS Tier-1', amount: 50000, proof: 'nps-statement-2026.pdf', proofStatus: 'verified', status: 'approved' }
        ]
      },
      '24': {
        items: [
          { id: 'i7', subSection: 'Home loan interest', amount: 200000, proof: 'hdfc-interest-cert.pdf', proofStatus: 'verified', status: 'approved', propertyType: 'self-occupied', lender: 'HDFC Bank' }
        ]
      },
      'HRA': { items: [] },
      '80E': { items: [] },
      '80G': { items: [] },
      '80TTA': { items: [] }
    },
    rejectionNotes: 'Life insurance premium pending proof. Preventive check-up missing receipts.'
  },
  EMP2014: {
    fy: '2026-27',
    overallStatus: 'not_started', // Old regime but didn't declare anything yet
    submittedOn: null,
    reviewedBy: null,
    sections: {
      '80C': { items: [] }, '80D': { items: [] }, '80CCD_1B': { items: [] }, '24': { items: [] },
      'HRA': { items: [] }, '80E': { items: [] }, '80G': { items: [] }, '80TTA': { items: [] }
    },
    rejectionNotes: null
  },
  EMP1042: {
    fy: '2026-27',
    overallStatus: 'rejected',
    submittedOn: '02 May 2026',
    reviewedBy: 'Finance Admin',
    rejectedOn: '08 May 2026',
    sections: {
      '80C': {
        items: [
          { id: 'i13', subSection: 'ELSS', amount: 200000, proof: 'elss.pdf', proofStatus: 'verified', status: 'rejected' }
        ]
      },
      '80D': { items: [] }, '80CCD_1B': { items: [] }, '24': { items: [] }, 'HRA': { items: [] }, '80E': { items: [] }, '80G': { items: [] }, '80TTA': { items: [] }
    },
    rejectionNotes: 'Section 80C amount ₹2,00,000 exceeds annual limit of ₹1,50,000. Please revise and resubmit.'
  }
};

function getITDeclaration(empId) {
  return IT_DECLARATIONS[empId] || {
    fy: '2026-27', overallStatus: 'not_started', submittedOn: null, reviewedBy: null,
    sections: { '80C': { items: [] }, '80D': { items: [] }, '80CCD_1B': { items: [] }, '24': { items: [] }, 'HRA': { items: [] }, '80E': { items: [] }, '80G': { items: [] }, '80TTA': { items: [] } },
    rejectionNotes: null
  };
}

function sectionTotal(empId, section) {
  const d = getITDeclaration(empId);
  return (d.sections[section]?.items || []).reduce((s, it) => s + (it.amount || 0), 0);
}
function sectionApprovedTotal(empId, section) {
  const d = getITDeclaration(empId);
  return (d.sections[section]?.items || []).filter(it => it.status === 'approved').reduce((s, it) => s + (it.amount || 0), 0);
}

function totalITDeclared(empId) {
  const c80 = Math.min(sectionTotal(empId, '80C'), 150000);
  const c80d = Math.min(sectionTotal(empId, '80D'), 50000);
  const c80ccd = Math.min(sectionTotal(empId, '80CCD_1B'), 50000);
  const c24 = Math.min(sectionTotal(empId, '24'), 200000);
  const c80e = sectionTotal(empId, '80E');
  const c80g = sectionTotal(empId, '80G');
  const c80tta = Math.min(sectionTotal(empId, '80TTA'), 10000);
  return { c80, c80d, c80ccd, c24, c80e, c80g, c80tta, total: c80 + c80d + c80ccd + c24 + c80e + c80g + c80tta };
}
function totalITApproved(empId) {
  const c80 = Math.min(sectionApprovedTotal(empId, '80C'), 150000);
  const c80d = Math.min(sectionApprovedTotal(empId, '80D'), 50000);
  const c80ccd = Math.min(sectionApprovedTotal(empId, '80CCD_1B'), 50000);
  const c24 = Math.min(sectionApprovedTotal(empId, '24'), 200000);
  return c80 + c80d + c80ccd + c24;
}

// === FBP DECLARATION ===
const FBP_DECLARATIONS = {
  EMP1003: {
    fy: '2026-27', overallStatus: 'approved', submittedOn: '12 Apr 2026',
    annualEntitlement: 120000,
    items: [
      { id: 'f1', component: 'TEL_ALW', label: 'Telephone allowance', annual: 24000, monthly: 2000, status: 'approved' },
      { id: 'f2', component: 'INT_REIMBURSEMENT', label: 'Internet allowance', annual: 24000, monthly: 2000, status: 'approved' },
      { id: 'f3', component: 'LTA_REIMB', label: 'LTA', annual: 50000, monthly: 0, status: 'approved' },
      { id: 'f4', component: 'BOOKS_PERIODICAL', label: 'Books & periodicals', annual: 12000, monthly: 1000, status: 'approved' },
      { id: 'f5', component: 'FM_A1600CC_REIMB', label: 'Fuel & maintenance', annual: 10000, monthly: 833, status: 'approved' }
    ]
  },
  EMP1058: { fy: '2026-27', overallStatus: 'not_started', submittedOn: null, annualEntitlement: 60000, items: [] }
};

function getFBPDeclaration(empId) {
  return FBP_DECLARATIONS[empId] || { fy: '2026-27', overallStatus: 'not_started', submittedOn: null, annualEntitlement: 60000, items: [] };
}

// === TAX REGIME STATUS per employee ===
// FY 2026-27 regime status. Window: Apr 1 — Apr 30 open. After Apr 30, locked until next FY or admin override.
// Status: 'window_open' (Apr) | 'locked' (May-Jan) | 'final_locked' (Feb-Mar) | 'change_requested' | 'admin_override_pending'
const REGIME_STATUS = {
  EMP1003: { selectedRegime: 'old', selectedOn: '03 Apr 2026', status: 'locked', changeRequest: null },
  EMP1042: { selectedRegime: 'old', selectedOn: '04 Apr 2026', status: 'locked', changeRequest: null },
  EMP1058: { selectedRegime: 'new', selectedOn: '01 Apr 2026', status: 'locked', changeRequest: null }, // Sneha - new
  EMP2014: { selectedRegime: 'old', selectedOn: '02 Apr 2026', status: 'locked', changeRequest: { fromRegime: 'old', toRegime: 'new', requestedOn: '12 May 2026', reason: 'Realized standard deduction (₹75K) gives better benefit since I have no investments', status: 'pending_admin' } }, // Manish - change request pending
  EMP1071: { selectedRegime: null, selectedOn: null, status: 'window_open', changeRequest: null }, // Priya joined recently
  EMP1019: { selectedRegime: 'new', selectedOn: '08 Apr 2026', status: 'locked', changeRequest: null },
  EMP1080: { selectedRegime: 'new', selectedOn: '05 Apr 2026', status: 'locked', changeRequest: null },
  EMP1067: { selectedRegime: 'new', selectedOn: '03 Apr 2026', status: 'locked', changeRequest: null },
  EMP3022: { selectedRegime: 'new', selectedOn: '06 Apr 2026', status: 'locked', changeRequest: null }
};

function getRegimeStatus(empId) {
  return REGIME_STATUS[empId] || { selectedRegime: null, selectedOn: null, status: 'window_open', changeRequest: null };
}

// FY Calendar windows
function getFYWindow() {
  const today = S.today;
  const [y, m, d] = today.split('-').map(Number);
  // Apr 1 — Apr 30: regime selection window open
  // May 1 — Jan 14: declarations open, regime locked
  // Jan 15 — Mar 31: proof submission window, final lock
  // Apr 1 next FY: window opens again
  let phase;
  if (m === 4) phase = 'regime_window'; // April - regime selection
  else if ((m > 4 && m <= 12) || (m === 1 && d < 15)) phase = 'declarations_open';
  else if ((m === 1 && d >= 15) || m === 2 || m === 3) phase = 'proof_submission';
  return { phase, today };
}

// === OTHER INCOME DECLARATIONS ===
// Salaried employee can declare other income so employer factors it into TDS
const OTHER_INCOME = {
  EMP1003: {
    fy: '2026-27', overallStatus: 'approved', submittedOn: '15 Apr 2026',
    items: [
      { id: 'oi1', source: 'previous_employer', label: 'Previous employer income (Form 12B)', amount: 380000, employerName: 'Infosys Ltd', tdsDeducted: 28000, proof: 'form12b-infosys.pdf', status: 'approved' },
      { id: 'oi2', source: 'interest', label: 'Interest from savings bank', amount: 18500, employerName: null, tdsDeducted: 0, proof: 'sb-statement.pdf', status: 'approved' },
      { id: 'oi3', source: 'house_property', label: 'Rental income from house property', amount: 240000, employerName: null, tdsDeducted: 0, proof: 'rent-agreement.pdf', status: 'approved', municipalTax: 12000, interest24b: 0 }
    ],
    rejectionNotes: null
  }
};

function getOtherIncome(empId) {
  return OTHER_INCOME[empId] || { fy: '2026-27', overallStatus: 'not_started', submittedOn: null, items: [], rejectionNotes: null };
}

// === LTA CLAIMS — 4-year block tracking ===
// Current block: 2022-25 (ended). Next block: 2026-29.
// Two journeys exempt per block.
const LTA_CLAIMS = {
  EMP1003: {
    block: '2026-29',
    journeys: [
      { id: 'lta1', from: 'Hyderabad', to: 'Goa', mode: 'air', travelDate: '15 Apr 2026', returnDate: '21 Apr 2026', familyMembers: 3, amount: 42000, proof: 'goa-tickets.pdf', status: 'approved', approvedOn: '24 Apr 2026' }
    ],
    journeysUsedInBlock: 1, // out of 2 allowed
    prevBlockUnused: 0 // carry-forward from 2022-25
  }
};

function getLTAClaims(empId) {
  return LTA_CLAIMS[empId] || { block: '2026-29', journeys: [], journeysUsedInBlock: 0, prevBlockUnused: 0 };
}

// Get the current logged-in employee (when role === 'employee')
function getMe() {
  return EMP.find(e => e.id === S.empAsId) || EMP[0];
}

function setEmpAs(empId) { S.empAsId = empId; S.nav = 'dashboard'; R(); }

// === Helper: should employee see declarations? ===
function shouldShowDeclarations(empId) {
  const rs = getRegimeStatus(empId);
  return rs.selectedRegime === 'old';
}

// === Slab-based tax computation for regime comparison ===
function computeTaxOldRegime(grossAnnual, deductions) {
  const taxable = Math.max(0, grossAnnual - 50000 - deductions); // 50K std deduction old
  let tax = 0;
  if (taxable > 1000000) tax = 112500 + (taxable - 1000000) * 0.3;
  else if (taxable > 500000) tax = 12500 + (taxable - 500000) * 0.2;
  else if (taxable > 250000) tax = (taxable - 250000) * 0.05;
  // Rebate u/s 87A: full rebate up to ₹5L taxable (old regime)
  if (taxable <= 500000) tax = 0;
  return Math.round(tax + tax * 0.04); // 4% cess
}

function computeTaxNewRegime(grossAnnual) {
  const taxable = Math.max(0, grossAnnual - 75000); // 75K std deduction new regime FY 2026-27
  let tax = 0;
  // New regime slabs (FY 2026-27 estimated): 0-3L 0%, 3-7L 5%, 7-10L 10%, 10-12L 15%, 12-15L 20%, 15L+ 30%
  if (taxable > 1500000) tax = 140000 + (taxable - 1500000) * 0.3;
  else if (taxable > 1200000) tax = 80000 + (taxable - 1200000) * 0.2;
  else if (taxable > 1000000) tax = 50000 + (taxable - 1000000) * 0.15;
  else if (taxable > 700000) tax = 20000 + (taxable - 700000) * 0.1;
  else if (taxable > 300000) tax = (taxable - 300000) * 0.05;
  // Rebate u/s 87A: full rebate up to ₹7L taxable (new regime)
  if (taxable <= 700000) tax = 0;
  return Math.round(tax + tax * 0.04); // 4% cess
}
function getStatutorySummary(monthCode) {
  const emps = EMP.filter(e => e.entity === S.entity);
  let pfEmployee = 0, pfEmployer = 0, pfEdli = 0, pt = 0, tds = 0, ptByState = {};
  emps.forEach(e => {
    const p = computePayslip(e.id, monthCode || '2026-04-01');
    if (!p) return;
    pfEmployee += p.deductions.pf;
    pfEmployer += p.employerContrib.pf;
    pfEdli += p.employerContrib.edli;
    pt += p.deductions.profTax;
    tds += p.deductions.incomeTax;
    if (!ptByState[e.workState]) ptByState[e.workState] = 0;
    ptByState[e.workState] += p.deductions.profTax;
  });
  return {
    pf: { employee: pfEmployee, employer: pfEmployer, edli: pfEdli, total: pfEmployee + pfEmployer + pfEdli },
    esi: { applicable: 0, employee: 0, employer: 0, total: 0 }, // ESI only applies to wages < ₹21K — none of our demo employees qualify
    pt: { total: pt, byState: ptByState },
    tds: { total: tds }
  };
}

// === UTILS ===
const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtS = n => n === 0 ? '—' : n > 0 ? '+' + fmt(n) : '-' + fmt(Math.abs(n));
const fmtL = n => n >= 10000000 ? '₹' + (n / 10000000).toFixed(2) + 'Cr' : n >= 100000 ? '₹' + (n / 100000).toFixed(2) + 'L' : fmt(n);
const setT = (k, v) => { S[k] = v; R(); };
const nav = (n) => {
  S.nav = n; S.empSel = null; S.resignSel = null; S.showLoanRequest = false;
  R();
};
const goResign = (idx) => { S.resignSel = idx; S.nav = 'resignation'; R(); };
function setSettingsTab(tab) { S.settingsTab = tab; R(); }

function getEncashPrimaryLeave(r) {
  const calc = E[r.entity]?.encashmentCalc || E.premier.encashmentCalc;
  const eligible = r.leaveTypes.filter(lt => calc.eligibleLeaveTypes.includes(lt.code || 'EL'));
  return eligible[0] || r.leaveTypes[0];
}

function getMaxEncashableDays(r, lt) {
  if (!lt) return 0;
  const policyMax = lt.maxEncashable ?? lt.encashable ?? 0;
  return Math.min(lt.balance ?? 0, policyMax);
}

function recalcEncashFields(r) {
  const lt = getEncashPrimaryLeave(r);
  if (lt) {
    lt.lapsed = Math.max(0, (lt.balance || 0) - (lt.approvedEncash || 0));
    lt.expire = lt.lapsed;
  }
  r.encashAmount = calcLeaveEncashAmount(r);
}

function isEncashApiValidated(entity) {
  const cfg = ENCASHMENT_INTEGRATION[entity || S.entity];
  return cfg?.status === 'api_validated' && !!cfg?.confirmedSubmissionMethod;
}

function readEncashForm(idx) {
  const daysEl = document.getElementById('encash-days-' + idx);
  const remarksEl = document.getElementById('encash-remarks-' + idx);
  return {
    days: daysEl ? parseInt(daysEl.value, 10) : NaN,
    remarks: remarksEl ? remarksEl.value.trim() : ''
  };
}

function validateEncashDays(r, days) {
  const lt = getEncashPrimaryLeave(r);
  const max = getMaxEncashableDays(r, lt);
  if (isNaN(days) || days < 0) return { ok: false, msg: 'Enter a valid number of days' };
  if (days > max) return { ok: false, msg: 'Approved days cannot exceed eligible encashable days (' + max + ')' };
  return { ok: true, max };
}

function pushEncashAudit(r, entry) {
  if (!r.encashAudit) r.encashAudit = [];
  r.encashAudit.unshift({
    date: entry.date || '14 May 2026',
    by: entry.by || 'Priya Sharma',
    action: entry.action,
    originalValue: entry.originalValue,
    modifiedValue: entry.modifiedValue,
    remarks: entry.remarks || '',
    type: entry.type || 'save'
  });
}

function saveEncashDecision(idx) {
  const r = RESIGNATIONS[idx];
  if (!r || r.status === 'on_hold') return;
  const { days, remarks } = readEncashForm(idx);
  const v = validateEncashDays(r, days);
  if (!v.ok) { toast(v.msg); return; }
  const lt = getEncashPrimaryLeave(r);
  const prev = lt.approvedEncash || 0;
  lt.approvedEncash = days;
  if (['pending_review', 'pending_approval'].includes(r.encashStatus)) r.encashStatus = 'pending_review';
  recalcEncashFields(r);
  r.encashRemarks = remarks;
  pushEncashAudit(r, { action: 'Saved encashment decision', originalValue: prev, modifiedValue: days, remarks, type: 'save' });
  toast('Decision saved · ' + days + ' days · ' + fmt(r.encashAmount));
  R();
}

function approveLeaveEncashment(idx) {
  const r = RESIGNATIONS[idx];
  if (!r || r.status === 'on_hold') return;
  if (r.steps.manager?.status !== 'done') { toast('Manager approval required first'); return; }
  const { days, remarks } = readEncashForm(idx);
  const v = validateEncashDays(r, days);
  if (!v.ok) { toast(v.msg); return; }
  const lt = getEncashPrimaryLeave(r);
  const prev = lt.approvedEncash || 0;
  lt.approvedEncash = days;
  recalcEncashFields(r);
  r.encashApprovedBy = 'Priya Sharma';
  r.encashApprovedDate = '14 May 2026';
  r.encashRemarks = remarks;
  r.encashStatus = 'ready_to_sync';
  r.steps.hrLeave = { ...r.steps.hrLeave, status: 'done', date: '14 May 2026', by: 'Priya Sharma', encashDays: days, expireDays: lt.lapsed };
  pushEncashAudit(r, { action: 'Approved leave encashment', originalValue: prev, modifiedValue: days, remarks, type: 'approve' });
  toast('Leave encashment approved · ' + days + ' days · ' + fmt(r.encashAmount));
  R();
}

function getApprovedEncashDays(r) {
  return r.leaveTypes.reduce((s, lt) => s + (lt.approvedEncash || 0), 0);
}

function getLapsedEncashDays(r) {
  return r.leaveTypes.reduce((s, lt) => s + (lt.lapsed ?? lt.expire ?? 0), 0);
}

function calcDailySalaryRate(r) {
  const calc = E[r.entity]?.encashmentCalc || E.premier.encashmentCalc;
  const basis = calc.salaryBasisKey === 'gross' ? r.monthlyCTC : Math.round(r.monthlyCTC * 0.40);
  return Math.round(basis / calc.divisor);
}

function calcLeaveEncashAmount(r) {
  const days = getApprovedEncashDays(r);
  if (!days) return 0;
  return Math.round(days * calcDailySalaryRate(r));
}

function encashStatusPill(status) {
  const normalized = status === 'pending_approval' ? 'pending_review' : status;
  const label = ENCASHMENT_STATUS_LABELS[status] || ENCASHMENT_STATUS_LABELS[normalized] || status;
  const color = {
    pending_review: 'gray', approved: 'blue', ready_to_sync: 'teal', syncing: 'orange',
    synced: 'green', sync_failed: 'red', ff_pending: 'purple', ff_completed: 'green', closed: 'gray'
  }[normalized] || 'gray';
  return `<span class="pill pill-${color}">${label}</span>`;
}

function viewSyncDetailsBtn(idx) {
  return `<button class="btn btn-sm" onclick="openM('api-debug-detail', {kind:'ff-encashment', idx:${idx}})"><i class="ti ti-list-details"></i> View Sync Details</button>`;
}

function encashSubmissionMethodLabel(method) {
  if (method === 'pending_validation') return 'Pending API validation';
  if (method === 'days_input') return 'Approved days via leave/F&F input (pending test)';
  if (method === 'amount_component') return 'Amount via Leave Encashment component (pending test)';
  return method || 'Pending API validation';
}

function canPushEncashment(r) {
  return ['ready_to_sync', 'sync_failed'].includes(r.encashStatus) && r.status !== 'on_hold' && isEncashApiValidated(r.entity);
}

function saveFFEncashmentApproval(idx) { approveLeaveEncashment(idx); }

function pushLeaveEncashment(idx) {
  const r = RESIGNATIONS[idx];
  if (!r || r.status === 'on_hold') return;
  if (!isEncashApiValidated(r.entity)) {
    toast('Pending API Validation — greytHR endpoint and payload not yet confirmed');
    return;
  }
  if (!['ready_to_sync', 'sync_failed'].includes(r.encashStatus)) {
    toast('Approve leave encashment before syncing to greytHR');
    return;
  }
  recalcEncashFields(r);
  r.encashAmount = calcLeaveEncashAmount(r);
  r.encashStatus = 'syncing';
  r.encashSync = 'syncing';
  r.encashSyncError = null;
  R();
  setTimeout(() => {
    r.encashStatus = 'ff_pending';
    r.encashSync = 'synced';
    r.encashLastSynced = '14 May 2026, 03:45 PM';
    r.encashSyncError = null;
    pushEncashAudit(r, { action: 'Synced to greytHR', originalValue: null, modifiedValue: getApprovedEncashDays(r) + ' days · ' + fmt(r.encashAmount), remarks: 'Submitted via configured integration mapping', type: 'sync' });
    toast('Leave encashment synced to greytHR · ' + fmt(r.encashAmount));
    R();
  }, 900);
}

function retryFFEncashment(idx) {
  const r = RESIGNATIONS[idx];
  if (!r || r.encashStatus !== 'sync_failed') return;
  pushLeaveEncashment(idx);
}

function loginToGreytHRESS() {
  const me = getMe();
  toast('Calling greytHR SSO API for ' + me.name + '...');
  setTimeout(() => toast('Redirecting to greytHR ESS (GUID token)...'), 700);
}

const setRole = (r) => { S.role = r; S.nav = 'dashboard'; S.empSel = null; S.resignSel = null; S.showLoanRequest = false; R(); };
const goEmp = (id) => { S.empSel = id; S.nav = 'employees'; S.empTab = 'sync'; R(); };
const openM = (m, d) => { S.modal = m; S.mdata = d || {}; R(); };
const closeM = () => { S.modal = null; S.mdata = {}; R(); };
const toast = (m) => { S.toast = m; R(); setTimeout(() => { S.toast = null; R(); }, 2800); };
const setLoanForm = (k, v) => { S.loanForm[k] = v; R(); };
const setEntityPolicy = (p) => { E[S.entity].encashmentPolicy = p; R(); toast('Encashment policy updated for ' + E[S.entity].name); };
const setMonth = (m) => { S.monthSel = m; R(); };

// LOP Sync helpers
function lopMonthLabel() {
  if (S.monthSel === '2026-03') return 'Mar 2026';
  if (S.monthSel === '2026-04') return 'Apr 2026';
  return 'May 2026';
}

function getLopSyncStatus(empId) {
  return S.lopSync.statuses[empId] || 'pending';
}

function lopSyncPill(status) {
  if (status === 'synced') return '<span class="pill pill-green">Synced</span>';
  if (status === 'error') return '<span class="pill pill-red">Failed</span>';
  if (status === 'sending') return '<span class="pill pill-orange">Sending</span>';
  return '<span class="pill pill-gray">Pending</span>';
}

function lopJoinLeaveNote(e) {
  if (e.newJoiner) return '<span class="pill pill-blue" style="padding:1px 6px;font-size:9px;">New joiner</span>';
  const resign = RESIGNATIONS.find(r => r.empId === e.id && r.entity === e.entity);
  if (resign) return '<span class="pill pill-orange" style="padding:1px 6px;font-size:9px;">Leaving</span>';
  if (e.flagged) return '<span class="pill pill-red" style="padding:1px 6px;font-size:9px;">Review</span>';
  return '<span class="text-tertiary">None</span>';
}

function recomputeLop() {
  toast('Recalculating LOP from MySlice Shifts...');
  setTimeout(() => toast('LOP recalculated for ' + EMP.filter(e => e.entity === S.entity).length + ' employees'), 600);
}

function recomputeAttendance() { recomputeLop(); }

function confirmSendLopSync() {
  closeM();
  const emps = EMP.filter(e => e.entity === S.entity);
  S.lopSync.phase = 'syncing';
  emps.forEach(e => { S.lopSync.statuses[e.id] = 'sending'; });
  R();
  emps.forEach((e, i) => {
    setTimeout(() => {
      S.lopSync.statuses[e.id] = e.flagged ? 'error' : 'synced';
      R();
      if (i === emps.length - 1) {
        S.lopSync.phase = 'success';
        S.lopSync.lastSync = '14 May 2026, 11:22 AM';
        const ok = emps.filter(x => S.lopSync.statuses[x.id] === 'synced').length;
        const fail = emps.filter(x => S.lopSync.statuses[x.id] === 'error').length;
        toast('LOP synced for ' + ok + ' employees' + (fail ? ' · ' + fail + ' failed' : ''));
        R();
      }
    }, 350 + i * 180);
  });
}

function retryLopSync(empId) {
  S.lopSync.statuses[empId] = 'sending';
  R();
  const emp = EMP.find(x => x.id === empId);
  setTimeout(() => {
    S.lopSync.statuses[empId] = emp?.flagged ? 'error' : 'synced';
    R();
    toast(S.lopSync.statuses[empId] === 'synced' ? 'LOP retry succeeded' : 'LOP retry failed · resolve in Shifts first');
  }, 800);
}

function simulateSendBatch() { confirmSendLopSync(); }

function retryEmployeeSync(empId) {
  const e = EMP.find(x => x.id === empId);
  if (!e) return;
  e.syncStatus = 'sending';
  R();
  setTimeout(() => {
    e.syncStatus = e.flagged ? 'error' : 'synced';
    e.lastSynced = e.syncStatus === 'synced' ? '14 May 2026, 11:22 AM' : null;
    toast(e.syncStatus === 'synced' ? e.name + ' synced to greytHR' : 'Sync failed for ' + e.name);
    R();
  }, 800);
}

function empMySliceStatus(e) {
  if (e.flagged) return '<span class="pill pill-red">Flagged</span>';
  if (e.newJoiner) return '<span class="pill pill-blue">New joiner</span>';
  if (e.status === 'inactive') return '<span class="pill pill-gray">Inactive</span>';
  return '<span class="pill pill-green">Active</span>';
}

function empLastSyncedLabel(e) {
  if (e.syncStatus === 'synced') return e.lastSynced || '14 May 2026, 11:22 AM';
  if (e.syncStatus === 'error') return 'Failed';
  if (e.syncStatus === 'sending') return 'In progress';
  return '-';
}

function getFinance(empId) {
  const e = EMP.find(x => x.id === empId);
  return FINANCE[empId] || {
    bankName: '', accountNo: '', ifsc: '', pan: '', uan: '', pfApplicable: !!e?.pf, esiApplicable: false,
    esicNo: '', ptState: e?.workState || '', syncStatus: 'pending', lastSynced: null
  };
}

function financeValidationErrors(empId) {
  const f = getFinance(empId);
  const errs = [];
  if (!f.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)) errs.push('PAN missing or invalid format');
  if (!f.accountNo) errs.push('Bank account number required');
  if (!f.ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc)) errs.push('IFSC missing or invalid');
  if (f.pfApplicable && !f.uan) errs.push('UAN required when PF is applicable');
  if (f.esiApplicable && !f.esicNo) errs.push('ESIC IP number required when ESI is applicable');
  return errs;
}

function maskAccount(n) {
  if (!n || n.length < 4) return '—';
  return '****' + n.slice(-4);
}

function maskPan(p) {
  if (!p || p.length < 5) return '—';
  return p.slice(0, 2) + '*****' + p.slice(-1);
}

function financeSyncPill(status) {
  if (status === 'synced') return '<span class="pill pill-green"><i class="ti ti-check"></i> Synced</span>';
  if (status === 'error') return '<span class="pill pill-red"><i class="ti ti-x"></i> Failed</span>';
  if (status === 'sending') return '<span class="pill pill-orange"><i class="ti ti-loader-2"></i> Syncing</span>';
  return '<span class="pill pill-gray"><i class="ti ti-clock"></i> Pending</span>';
}

function retryFinanceSync(empId) {
  const f = getFinance(empId);
  const e = EMP.find(x => x.id === empId);
  if (!f || !e) return;
  if (financeValidationErrors(empId).length) {
    toast('Fix validation errors in People before syncing finance data');
    return;
  }
  f.syncStatus = 'sending';
  R();
  setTimeout(() => {
    f.syncStatus = e.flagged ? 'error' : 'synced';
    f.lastSynced = f.syncStatus === 'synced' ? '14 May 2026, 11:45 AM' : null;
    toast(f.syncStatus === 'synced' ? 'Finance master data synced to greytHR' : 'Finance sync failed for ' + e.name);
    R();
  }, 800);
}

function saveFinanceMaster(empId) {
  const f = FINANCE[empId] || (FINANCE[empId] = { esicNo: '', syncStatus: 'pending', lastSynced: null });
  const g = id => document.getElementById(id);
  f.bankName = g('fin-bank')?.value?.trim() || '';
  f.accountNo = g('fin-acct')?.value?.trim() || '';
  f.ifsc = g('fin-ifsc')?.value?.trim().toUpperCase() || '';
  f.pan = g('fin-pan')?.value?.trim().toUpperCase() || '';
  f.uan = g('fin-uan')?.value?.trim() || '';
  f.ptState = g('fin-pt')?.value?.trim() || '';
  f.pfApplicable = g('fin-pf')?.value === 'yes';
  f.esiApplicable = g('fin-esi')?.value === 'yes';
  f.esicNo = g('fin-esic')?.value?.trim() || '';
  f.syncStatus = 'pending';
  f.lastSynced = null;
  closeM();
  toast('Finance master saved in People · pending greytHR sync');
  R();
}

function resetSyncStatus() {
  EMP.filter(e => e.entity === S.entity).forEach(e => { delete S.lopSync.statuses[e.id]; });
  S.lopSync.phase = 'default';
  S.lopSync.lastSync = null;
  R();
  toast('LOP sync status reset');
}

function getResignationWorkflowRows() {
  return RESIGNATION_WORKFLOW.map(w => {
    const step = RESIGN_STEPS.find(s => s.key === w.key) || {};
    return { ...w, label: step.label, icon: step.icon, order: RESIGN_STEPS.findIndex(s => s.key === w.key) + 1 };
  });
}

function saveResignationStep(id) {
  const w = RESIGNATION_WORKFLOW.find(x => x.id === id);
  if (!w) return;
  const approverEl = document.getElementById('rw-approver');
  const slaEl = document.getElementById('rw-sla');
  const requiredEl = document.getElementById('rw-required');
  const enabledEl = document.getElementById('rw-enabled');
  if (approverEl) w.approver = approverEl.value.trim() || w.approver;
  if (slaEl) w.slaDays = slaEl.value === '' ? null : parseInt(slaEl.value, 10) || null;
  if (requiredEl) w.required = requiredEl.value === 'yes';
  if (enabledEl) w.enabled = enabledEl.value === 'yes';
  closeM();
  toast('Workflow step updated');
  R();
}

function saveResignationPolicy() {
  const noticeEl = document.getElementById('rp-notice');
  const encashEl = document.getElementById('rp-encash');
  const lopEl = document.getElementById('rp-lop');
  const excludeEl = document.getElementById('rp-exclude');
  const alumniEl = document.getElementById('rp-alumni');
  if (noticeEl) RESIGNATION_POLICY.noticePeriodDays = parseInt(noticeEl.value, 10) || 30;
  if (encashEl) RESIGNATION_POLICY.requireEncashmentBeforeSeparation = encashEl.value === 'yes';
  if (lopEl) RESIGNATION_POLICY.requireLopSyncBeforeSeparation = lopEl.value === 'yes';
  if (excludeEl) RESIGNATION_POLICY.allowExcludeFromFF = excludeEl.value === 'yes';
  if (alumniEl) RESIGNATION_POLICY.alumniPortalAfterFF = alumniEl.value === 'yes';
  closeM();
  toast('Resignation policy saved');
  R();
}

// Render JSON with simple syntax highlighting (developer / integration debug views only)
function fmtJSON(obj) {
  if (obj == null) return '<span class="text-secondary">—</span>';
  const s = JSON.stringify(obj, null, 2);
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)"(\s*:)/g, '<span class="k">"$1"</span>$2')
    .replace(/:\s*"([^"]*)"/g, ': <span class="s">"$1"</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="n">$1</span>');
}

function describeSyncPayload(type, payload) {
  if (!payload || !Object.keys(payload).length) return '—';
  if (type === 'employee') return `Employee ${payload.employeeId} · ${payload.action || 'update'}`;
  if (type === 'lop') return `LOP · ${payload.value ?? 0} day(s) · ${(payload.fromDate || '').slice(0, 7) || 'current month'}`;
  if (type === 'loan') return `${payload.loanType || 'Loan'} · ${fmt(payload.principal || 0)} · EMI ${fmt(payload.emi || 0)} × ${payload.tenure || 0} mo`;
  if (type === 'separation') return `LWD ${payload.lastWorkingDate || '—'} · ${payload.separationReason || 'Separation'}`;
  if (type === 'encashment') return `${payload.leaveEncashDays ?? 0} days encashment · ${fmt(payload.leaveEncashAmount || 0)}`;
  return Object.entries(payload).map(([k, v]) => k + ': ' + v).join(' · ');
}

function syncActionLabel(type, scope) {
  if (scope && /finance/i.test(scope)) return 'Finance master sync';
  const map = { employee: 'Employee sync', lop: 'LOP sync', separation: 'Separation sync', encashment: 'Leave encashment sync', loan: 'Loan create' };
  return map[type] || scope || 'greytHR sync';
}

function getApiDebugContext(d) {
  const kind = d.kind;
  if (kind === 'employee-sync') {
    const e = EMP.find(x => x.id === d.empId);
    const payload = e ? buildGreytHRPayload(e, S.monthSel + '-01') : [];
    const err = e?.syncStatus === 'error';
    return {
      title: 'Employee sync API · ' + (e?.name || d.empId),
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + (e?.gretyId || d.empId),
      request: payload,
      response: err
        ? { httpStatus: 400, error: 'Employee in stopped state', message: 'greytHR rejected sync for flagged employee' }
        : { httpStatus: 201, message: 'Created', durationMs: 287 }
    };
  }
  if (kind === 'finance') {
    const e = EMP.find(x => x.id === d.empId);
    const f = getFinance(d.empId);
    return {
      title: 'Finance master API · ' + (e?.name || d.empId),
      method: 'PUT',
      endpoint: '/payroll/v2/employees/' + d.empId + '/finance',
      request: {
        employeeId: d.empId, greytHRId: e?.gretyId || null,
        bankAccount: f.accountNo ? { bankName: f.bankName, accountNo: f.accountNo, ifsc: f.ifsc } : null,
        pan: f.pan || null, uan: f.uan || null, pfApplicable: f.pfApplicable,
        esiApplicable: f.esiApplicable, esicNo: f.esicNo || null, ptState: f.ptState
      },
      response: f.syncStatus === 'synced' ? { httpStatus: 200, message: 'Updated' }
        : f.syncStatus === 'error' ? { httpStatus: 400, error: 'Validation or employee state rejected sync' } : null
    };
  }
  if (kind === 'lop') {
    const e = EMP.find(x => x.id === d.empId);
    const status = getLopSyncStatus(d.empId);
    return {
      title: 'LOP sync API · ' + (e?.name || d.empId),
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + (e?.gretyId || d.empId) + '/inputs',
      request: { item: 'LOP', value: e?.att?.lop || 0, fromDate: S.monthSel + '-01' },
      response: status === 'synced' ? { httpStatus: 201, message: 'Accepted' }
        : status === 'error' ? { httpStatus: 400, error: 'Employee stopped or LOP rejected' } : null
    };
  }
  if (kind === 'separation') {
    const r = RESIGNATIONS[d.idx];
    if (!r) return { title: 'Separation API', method: 'POST', endpoint: '—', request: {}, response: null };
    return {
      title: 'Separation sync API · ' + r.emp,
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + r.empId + '/separation',
      request: {
        employeeId: r.empId, greytHRId: r.gretyId || 'pending', lastWorkingDate: r.lwd,
        separationReason: r.reason, assetRecovery: r.assetRecovery,
        leaveEncashDays: r.leaveTypes.reduce((s, lt) => s + (lt.approvedEncash || 0), 0),
        leaveEncashAmount: r.encashAmount || calcLeaveEncashAmount(r)
      },
      response: r.separationSync === 'synced' ? { httpStatus: 200, status: 'ACCEPTED' } : null
    };
  }
  if (kind === 'sync-error') {
    const e = SYNC_ERRORS.find(x => x.id === d.id);
    if (!e) return { title: 'Sync error API', method: 'POST', endpoint: '—', request: {}, response: {} };
    let request = { employeeId: e.empId, action: 'upsert' };
    if (e.type === 'lop') request = { item: 'LOP', value: 5, fromDate: '2026-05-01' };
    else if (e.type === 'encashment') request = { employeeId: e.empId, leaveEncashDays: 4, leaveEncashAmount: 7492 };
    else if (e.type === 'separation') request = { employeeId: e.empId, action: 'separation' };
    const httpMatch = e.apiError.match(/^(\d+)/);
    return {
      title: 'Request / response · ' + e.emp,
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + e.empId,
      request,
      response: { httpStatus: httpMatch ? parseInt(httpMatch[1], 10) : 400, error: e.reason, detail: e.apiError }
    };
  }
  if (kind === 'sync-history') {
    const h = SYNC_HISTORY.find(x => x.id === d.id);
    if (!h) return { title: 'Sync history API', method: 'POST', endpoint: '—', request: {}, response: null };
    return {
      title: h.label + ' · API trace',
      method: 'POST',
      endpoint: '/payroll/v2/sync/' + h.type,
      request: h.payload || {},
      response: h.failed
        ? { httpStatus: 207, partial: true, success: h.success, failed: h.failed, detail: h.detail }
        : { httpStatus: 200, success: h.success, total: h.total }
    };
  }
  if (kind === 'ff-encashment') {
    const r = RESIGNATIONS[d.idx];
    const cfg = ENCASHMENT_INTEGRATION[S.entity] || ENCASHMENT_INTEGRATION.premier;
    const rows = getEncashmentMappingRows(S.entity);
    const daysRow = rows.find(x => x.key === 'days');
    const amtRow = rows.find(x => x.key === 'amount');
    const method = cfg.confirmedSubmissionMethod;
    let request;
    if (method === 'days_input' && daysRow?.repositoryId) {
      request = { itemId: daysRow.repositoryId, item: daysRow.componentCode || 'ENCASH_DAYS', value: getApprovedEncashDays(r) };
    } else if (method === 'amount_component' && amtRow?.repositoryId) {
      request = { itemId: amtRow.repositoryId, item: amtRow.componentCode || 'LEAVE_ENCASHMENT', value: r?.encashAmount || calcLeaveEncashAmount(r) };
    } else {
      request = {
        note: 'Submission method not yet confirmed — payload will be ONE of the following after API validation',
        optionA_days: daysRow?.componentCode ? { item: daysRow.componentCode, value: getApprovedEncashDays(r) } : { item: 'TBD', value: getApprovedEncashDays(r) },
        optionB_amount: amtRow?.componentCode ? { item: amtRow.componentCode, value: r?.encashAmount || calcLeaveEncashAmount(r) } : { item: 'LEAVE_ENCASHMENT', value: r?.encashAmount || calcLeaveEncashAmount(r) }
      };
    }
    return {
      title: 'F&F leave encashment API · ' + (r?.emp || ''),
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + (r?.empId || '{id}') + '/inputs',
      request,
      response: r?.encashStatus === 'ff_pending' ? { httpStatus: 201, message: 'Accepted · pending F&F in greytHR' } : null
    };
  }
  if (kind === 'lop-batch-sample') {
    const employees = EMP.filter(e => e.entity === S.entity);
    return {
      title: 'LOP batch sync · sample request',
      method: 'POST',
      endpoint: '/payroll/v2/employees/inputs',
      request: { item: 'LOP', value: employees[0]?.att?.lop || 0, fromDate: S.monthSel + '-01' },
      response: null
    };
  }
  if (kind === 'payroll-batch-sample') {
    const emps = EMP.filter(e => e.entity === S.entity);
    const sample = emps[0] ? buildGreytHRPayload(emps[0], S.monthSel + '-01') : [];
    return {
      title: 'Payroll inputs · sample request',
      method: 'POST',
      endpoint: '/payroll/v2/employees/' + (emps[0]?.id || '{id}'),
      request: sample,
      response: null
    };
  }
  if (kind === 'resettlement') {
    const f = FF_ACTIVE[d.idx];
    return {
      title: 'Resettlement check · ' + (f?.emp || ''),
      method: 'GET',
      endpoint: '/payroll/v2/employees/resettlement/' + S.monthSel + '-01',
      request: { employeeId: f?.empId },
      response: [{ employeeId: f?.empId, settlementDate: '2026-06-02', processedDate: null, remarks: 'F&F initiated · awaiting final inputs', status: 'PENDING' }]
    };
  }
  return { title: 'API details', method: '—', endpoint: '—', request: {}, response: null };
}

function apiDetailsBtnInline(kind, extra) {
  const parts = [`kind:'${kind}'`];
  Object.entries(extra || {}).forEach(([k, v]) => {
    parts.push(typeof v === 'number' ? `${k}:${v}` : `${k}:'${v}'`);
  });
  return `<button class="btn btn-sm" onclick="openM('api-debug-detail', {${parts.join(', ')}})"><i class="ti ti-code"></i> View API details</button>`;
}

function resignStatusPill(r) {
  if (r.status === 'ready_for_ff') return '<span class="pill pill-blue">Ready for F&F</span>';
  if (r.status === 'on_hold') return '<span class="pill pill-red">On hold</span>';
  if (r.status === 'completed') return '<span class="pill pill-green">Completed</span>';
  return '<span class="pill pill-orange">In progress</span>';
}

function resignStepClass(step, r) {
  const s = r.steps[step.key]?.status || 'pending';
  if (s === 'done') return 'done';
  if (s === 'active' || s === 'blocked') return s === 'blocked' ? 'pending' : 'active';
  if (r.currentStep === RESIGN_STEPS.findIndex(x => x.key === step.key) + 1) return 'active';
  return 'pending';
}

function resignProgressPct(r) {
  const done = RESIGN_STEPS.filter(s => r.steps[s.key]?.status === 'done').length;
  return Math.round((done / RESIGN_STEPS.length) * 100);
}

function confirmSeparationSync(idx) {
  const r = RESIGNATIONS[idx];
  if (!r) return;
  r.separationSync = 'syncing';
  R();
  setTimeout(() => {
    r.separationSync = 'synced';
    r.ffStatus = 'Ready in greytHR';
    r.status = 'ready_for_ff';
    r.steps.finalAction.status = 'done';
    r.steps.finalAction.date = '14 May 2026';
    toast('Separation synced for ' + r.emp + ' | Finance can process F&F in greytHR');
    R();
  }, 900);
}

function openGreytHRPortal() {
  toast('Opening greytHR F&F portal in new tab...');
}

function syncHistoryTypeLabel(type) {
  const map = { employee: 'Employee', lop: 'LOP', loan: 'Loan', separation: 'Separation', encashment: 'Leave encashment' };
  return map[type] || type;
}

function syncHistoryStatusPill(status) {
  if (status === 'completed') return '<span class="pill pill-green">Completed</span>';
  if (status === 'partial') return '<span class="pill pill-orange">Partial</span>';
  return '<span class="pill pill-red">Failed</span>';
}

function getSyncHistoryRows() {
  let rows = SYNC_HISTORY.filter(h => h.entity === S.entity);
  const tab = S.syncHistoryTab;
  if (tab === 'separation') rows = rows.filter(h => h.type === 'separation' || h.type === 'encashment');
  else if (tab !== 'all') rows = rows.filter(h => h.type === tab);
  return rows;
}

function syncErrorSeverityPill(severity) {
  if (severity === 'critical') return '<span class="pill pill-red">Critical</span>';
  if (severity === 'high') return '<span class="pill pill-orange">High</span>';
  return '<span class="pill pill-gray">Medium</span>';
}

function getSyncErrorRows() {
  let rows = SYNC_ERRORS.filter(e => e.entity === S.entity && !S.resolvedSyncErrors.includes(e.id));
  const tab = S.syncErrorsTab;
  if (tab !== 'all') rows = rows.filter(e => e.type === tab);
  return rows;
}

function retrySyncError(id) {
  const err = SYNC_ERRORS.find(x => x.id === id);
  if (!err || !err.retryKind) return;
  if (err.retryKind === 'empBatch') retryEmpSyncOne(err.retryRef);
  else if (err.retryKind === 'employee') retryEmployeeSync(err.retryRef);
  else if (err.retryKind === 'lop') retryLopSync(err.retryRef);
}

function resolveSyncError(id) {
  if (!S.resolvedSyncErrors.includes(id)) S.resolvedSyncErrors.push(id);
  closeM();
  toast('Error marked resolved');
  R();
}

function retryAllSyncErrors() {
  const rows = getSyncErrorRows().filter(e => e.retryKind);
  if (!rows.length) return;
  rows.forEach(e => retrySyncError(e.id));
  toast('Retry queued for ' + rows.length + ' error(s)');
}

// Sync status icon
function syncIcon(status) {
  if (status === 'synced') return '<div class="sync-dot synced" title="Synced with greytHR"><i class="ti ti-check"></i></div>';
  if (status === 'error') return '<div class="sync-dot error" title="Sync failed"><i class="ti ti-x"></i></div>';
  if (status === 'sending') return '<div class="sync-dot sending" title="Sending..."><i class="ti ti-loader-2"></i></div>';
  return '<div class="sync-dot pending" title="Not yet sent"><i class="ti ti-minus"></i></div>';
}
// === SIDEBAR ===
function rSide() {
  const items = {
    admin: [
      {
        sec: 'Overview', items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'ti-dashboard' }
        ]
      },
      {
        sec: 'greytHR Integration', items: [
          { id: 'employees', label: 'Employees', icon: 'ti-users' },
          { id: 'lop-sync', label: 'LOP Sync', icon: 'ti-calendar-stats' },
          { id: 'loans', label: 'Loans', icon: 'ti-cash', badge: 3 },
          { id: 'resignation', label: 'Resignation & Offboarding', icon: 'ti-door-exit', badge: 2 }
        ]
      },
      {
        sec: 'Configuration', items: [
          { id: 'greythr-settings', label: 'greytHR Settings', icon: 'ti-settings' },
          { id: 'resignation-workflow', label: 'Resignation Workflow', icon: 'ti-git-branch' }
        ]
      },
      {
        sec: 'Monitoring', items: [
          { id: 'sync-history', label: 'Sync History', icon: 'ti-history' },
          { id: 'sync-errors', label: 'Sync Errors', icon: 'ti-alert-circle' },
          { id: 'audit', label: 'Audit Log', icon: 'ti-file-text' }
        ]
      }
    ],
    employee: [
      {
        sec: 'My account', items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'ti-dashboard' },
          { id: 'loans', label: 'My loans', icon: 'ti-cash' },
          { id: 'my-resignation', label: 'My resignation', icon: 'ti-door-exit' }
        ]
      },
      {
        sec: 'greytHR', items: [
          { id: 'greythr-ess', label: 'Open greytHR Portal', icon: 'ti-external-link' }
        ]
      }
    ]
  };
  const navItems = items[S.role];
  return `<aside class="sidebar">
    <div class="logo"><div class="logo-icon">M</div><div><div class="logo-text">MySlice</div><div class="logo-sub">Payroll · ${S.role === 'admin' ? 'Finance Admin' : 'Employee'}</div></div></div>
    ${navItems.map(s => `<div class="nav-section"><div class="nav-label">${s.sec}</div>${s.items.map(i => `<div class="nav-item ${S.nav === i.id ? 'active' : ''}" onclick="nav('${i.id}')"><i class="ti ${i.icon}"></i><span>${i.label}</span>${i.badge ? `<span class="badge">${i.badge}</span>` : ''}</div>`).join('')}</div>`).join('')}
    <div class="nav-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border);">
      <div class="nav-label">Quick switch</div>
      <div style="padding: 0 8px;">
        <div class="role-switcher" style="flex-direction: column; align-items: stretch;">
          <button class="role-btn ${S.role === 'admin' ? 'active' : ''}" onclick="setRole('admin')" style="text-align: left; padding: 7px 10px;"><i class="ti ti-shield-check" style="margin-right: 6px;"></i> Finance Admin</button>
          <button class="role-btn ${S.role === 'employee' ? 'active' : ''}" onclick="setRole('employee')" style="text-align: left; padding: 7px 10px;"><i class="ti ti-user" style="margin-right: 6px;"></i> Employee</button>
        </div>
      </div>
      ${S.role === 'employee' ? `<div style="padding: 12px 8px 0;"><div class="nav-label" style="margin-bottom: 4px;">Demo as</div><select onchange="setEmpAs(this.value)" style="width: 100%; padding: 7px 8px; font-size: 12px;">
        <option value="EMP1003" ${S.empAsId === 'EMP1003' ? 'selected' : ''}>Arjun · Old · declared</option>
        <option value="EMP1058" ${S.empAsId === 'EMP1058' ? 'selected' : ''}>Sneha · New regime</option>
        <option value="EMP2014" ${S.empAsId === 'EMP2014' ? 'selected' : ''}>Manish · Old · no declaration</option>
        <option value="EMP1071" ${S.empAsId === 'EMP1071' ? 'selected' : ''}>Priya · joiner (window open)</option>
      </select></div>` : ''}
    </div>
  </aside>`;
}

function rTop() {
  const navLabels = {
    dashboard: S.role === 'admin' ? 'Dashboard' : 'My dashboard',
    employees: S.empSel ? `Employees / ${EMP.find(e => e.id === S.empSel)?.name}` : 'Employees',
    'lop-sync': 'LOP Sync',
    loans: S.role === 'admin' ? 'Loans' : 'My loans',
    'my-resignation': 'My resignation',
    'greythr-ess': 'greytHR ESS Portal',
    resignation: 'Resignation & Offboarding',
    'greythr-settings': 'greytHR Settings',
    'resignation-workflow': 'Resignation Workflow',
    'sync-history': 'Sync History',
    'sync-errors': 'Sync Errors',
    audit: 'Audit Log'
  };
  const meE = S.role === 'employee' ? getMe() : null;
  const u = S.role === 'admin' ? { name: 'Priya Sharma', role: 'Finance Admin', initials: 'PS' } : { name: meE.name, role: meE.role, initials: meE.av };
  return `<div class="topbar">
    <div class="topbar-left"><div class="breadcrumb">Payroll / <b>${navLabels[S.nav] || S.nav}</b></div></div>
    <div class="topbar-right">
      ${S.role === 'admin' ? `<div class="entity-pill"><i class="ti ti-building" style="color: var(--text-secondary)"></i><select onchange="setT('entity', this.value)"><option value="premier" ${S.entity === 'premier' ? 'selected' : ''}>Premier IT Solutions</option><option value="nemo" ${S.entity === 'nemo' ? 'selected' : ''}>Nemo IT Solutions</option><option value="invicktus" ${S.entity === 'invicktus' ? 'selected' : ''}>Invicktus</option></select></div>` : ''}
      <button class="icon-btn" onclick="openM('notifications')"><i class="ti ti-bell"></i></button>
      <div style="display: flex; gap: 8px; align-items: center;"><div class="avatar">${u.initials}</div><div style="font-size: 12px;"><div class="font-semibold">${u.name}</div><div class="text-secondary" style="font-size: 11px;">${u.role}</div></div></div>
    </div>
  </div>`;
}

// === ADMIN: DASHBOARD ===
function rDash() {
  const e = E[S.entity];
  const employees = EMP.filter(emp => emp.entity === S.entity);
  const flag = employees.filter(emp => emp.flagged).length;
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Welcome back, Priya</h1><p class="page-sub">Here's what needs your attention today · ${e.name}</p></div>
      <div class="page-actions">
        <button class="btn" onclick="openM('export-dashboard')"><i class="ti ti-download"></i> Export</button>
        <button class="btn btn-primary" onclick="nav('lop-sync')"><i class="ti ti-calendar-stats"></i> Open LOP Sync</button>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-users"></i></div><div><div class="stat-label">Active employees</div><div class="stat-value">${employees.length}</div><div class="stat-meta">${employees.filter(e => e.pf).length} with PF</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-calendar-stats"></i></div><div><div class="stat-label">LOP sync</div><div class="stat-value">${employees.filter(e => getLopSyncStatus(e.id) === 'synced').length}/${employees.length}</div><div class="stat-meta">${lopMonthLabel()} pending send</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-cash"></i></div><div><div class="stat-label">Pending loans</div><div class="stat-value">3</div><div class="stat-meta">1 urgent</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-door-exit"></i></div><div><div class="stat-label">Offboarding active</div><div class="stat-value">${RESIGNATIONS.filter(r => r.status === 'in_progress' || r.status === 'on_hold').length}</div><div class="stat-meta">${RESIGNATIONS.filter(r => r.status === 'ready_for_ff').length} ready for F&F</div></div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar-stats"></i></span>${lopMonthLabel()} LOP sync</div><span class="pill pill-orange"><i class="ti ti-clock"></i> Not yet sent</span></div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div><div class="field-label">Shifts locked</div><div class="field-value"><i class="ti ti-circle-check" style="color: var(--green)"></i> 14 May</div></div>
            <div><div class="field-label">LOP calculated</div><div class="field-value">${employees.length - flag} of ${employees.length}</div></div>
            <div><div class="field-label">Target sync</div><div class="field-value">28 May 2026</div></div>
          </div>
          ${flag > 0 ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-circle"></i><div><b>${flag} flagged</b>Karthik Rao flagged as absconding.</div></div>` : ''}
          <button class="btn btn-primary" onclick="nav('lop-sync')"><i class="ti ti-arrow-right"></i> Open LOP Sync</button>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-bell"></i></span>Items needing attention</div></div>
          <div onclick="nav('loans')" style="cursor: pointer; padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <div><div class="font-semibold">3 loan requests pending</div><div class="text-sm text-secondary">1 emergency needs CEO sign-off</div></div>
            <i class="ti ti-chevron-right text-secondary"></i>
          </div>
          <div onclick="nav('resignation')" style="cursor: pointer; padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <div><div class="font-semibold">Resignation pending clearance</div><div class="text-sm text-secondary">Rohit Kapoor · LWD 31 May</div></div>
            <i class="ti ti-chevron-right text-secondary"></i>
          </div>
          <div onclick="openM('absconding-alerts')" style="cursor: pointer; padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <div><div class="font-semibold">1 absconding employee</div><div class="text-sm text-secondary">Karthik Rao · 5 days no punch</div></div>
            <i class="ti ti-chevron-right text-secondary"></i>
          </div>
          <div onclick="nav('sync-errors')" style="cursor: pointer; padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
            <div><div class="font-semibold">Sync failures need retry</div><div class="text-sm text-secondary">3 employees failed greytHR sync</div></div>
            <i class="ti ti-chevron-right text-secondary"></i>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar"></i></span>Upcoming</div></div>
          ${[['Send May LOP to greytHR', '28 May 2026', 14, 'orange'], ['Rohit separation sync', '2 Jun 2026', 19, 'red'], ['Quarterly review', '15 Jun 2026', 32, 'blue']].map(x => `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><div><div class="font-semibold">${x[0]}</div><div class="text-sm text-secondary">${x[1]} · in ${x[2]} days</div></div><span class="pill pill-${x[3]}">${x[3] === 'red' ? 'Critical' : x[3] === 'orange' ? 'Soon' : 'Scheduled'}</span></div>`).join('')}
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>Service status</div></div>
          <div class="status-card green"><div class="status-card-title"><i class="ti ti-circle-check"></i> All systems operational</div><div class="status-card-text">Payroll engine healthy. Last sync 14 May, 11:22.</div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-history"></i></span>Recent activity</div><button class="btn btn-sm" onclick="nav('audit')">View all</button></div>
          <div class="timeline">${AUD.slice(0, 4).map(e => `<div class="timeline-event ${e.type === 'approval' ? 'green' : e.type === 'override' ? 'orange' : e.type === 'system' ? 'purple' : 'blue'}"><div class="timeline-dot"></div><div class="timeline-title">${e.title}</div><div class="timeline-meta">${e.actor}</div><div class="timeline-date">${e.date} · ${e.time}</div></div>`).join('')}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// === ADMIN: LOP SYNC ===
function rLOPSync() {
  const employees = EMP.filter(e => e.entity === S.entity);
  const period = E[S.entity].payPeriod;
  const monthLabel = lopMonthLabel();
  const totalLOP = employees.reduce((s, e) => s + (e.att.lop || 0), 0);
  const synced = employees.filter(e => getLopSyncStatus(e.id) === 'synced').length;
  const failed = employees.filter(e => getLopSyncStatus(e.id) === 'error').length;
  const pending = employees.length - synced - failed;
  const issues = employees.filter(e => e.flagged || e.newJoiner).length;
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">LOP Sync | ${monthLabel}</h1>
        <p class="page-sub">${E[S.entity].name} | ${employees.length} employees | greytHR uses configured payroll working days | only LOP is sent</p>
      </div>
      <div class="page-actions">
        <select onchange="setMonth(this.value)" style="width: auto;">
          <option value="2026-05" ${S.monthSel === '2026-05' ? 'selected' : ''}>May 2026</option>
          <option value="2026-04" ${S.monthSel === '2026-04' ? 'selected' : ''}>Apr 2026</option>
          <option value="2026-03" ${S.monthSel === '2026-03' ? 'selected' : ''}>Mar 2026</option>
        </select>
        <button class="btn btn-icon-only" onclick="openM('pay-period-config')" title="Pay period info"><i class="ti ti-info-circle"></i></button>
      </div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>LOP only - payable days calculated in greytHR</b>
        MySlice calculates LOP from Shifts and leave rules, then sends employee-wise LOP for ${monthLabel}. greytHR applies its configured payroll working days. Edit attendance in Shifts, then recalculate LOP here.
      </div>
    </div>
    ${S.lopSync.phase === 'success' ? `<div class="alert-banner alert-blue" style="background:var(--green-bg);border-color:var(--green);"><i class="ti ti-circle-check"></i><div><b>Last LOP sync completed</b> ${S.lopSync.lastSync || 'Recently'} | ${synced} synced${failed ? ' | ' + failed + ' failed' : ''}. Finance can process payroll in greytHR.</div></div>` : ''}
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-users"></i></div><div><div class="stat-label">Employees</div><div class="stat-value">${employees.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar-x"></i></div><div><div class="stat-label">Total LOP days</div><div class="stat-value">${totalLOP}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Synced</div><div class="stat-value">${synced}</div></div></div>
      <div class="stat-tile"><div class="stat-icon ${failed > 0 ? 'orange' : 'purple'}"><i class="ti ti-${failed > 0 ? 'alert-circle' : 'clock'}"></i></div><div><div class="stat-label">${failed > 0 ? 'Failed' : 'Pending'}</div><div class="stat-value">${failed > 0 ? failed : pending}</div></div></div>
    </div>
    <div class="card" style="padding: 0;">
      <div style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 10px;">
        <div>
          <div class="font-semibold">Employee LOP for greytHR</div>
          <div class="text-xs text-secondary mt-2">Cutoff ${period.cutoffStart}-${period.cutoffEnd} | pay date ${period.payDate}${issues ? ' | ' + issues + ' exception(s)' : ''}</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-sm" onclick="openM('attendance-issues')"><i class="ti ti-alert-triangle"></i> View exceptions</button>
          <button class="btn btn-sm" onclick="recomputeLop()"><i class="ti ti-refresh"></i> Recalculate LOP</button>
        </div>
      </div>
      <div style="overflow-x: auto;">
        <table class="inputs-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th class="center">LOP days</th>
              <th class="center">Join/leave adj.</th>
              <th class="center">Sync status</th>
              <th>Last synced</th>
              <th class="center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => {
    const status = getLopSyncStatus(e.id);
    const lastSynced = status === 'synced' ? (S.lopSync.lastSync || 'Just now') : status === 'error' ? 'Failed' : '-';
    return `<tr class="${e.flagged ? 'flagged' : ''}">
                <td>
                  <div style="display:flex;gap:10px;align-items:center;">
                    <div class="avatar" style="width:30px;height:30px;font-size:11px;background:var(--${e.avBg}-bg);color:var(--${e.avBg}-text);">${e.av}</div>
                    <div>
                      <div class="font-semibold">${e.name}${e.flagged ? ' <span class="pill pill-red" style="padding:1px 5px;font-size:9px;">Flag</span>' : ''}</div>
                      <div class="text-xs text-secondary">${e.id} | ${e.gretyId || 'Not synced'}</div>
                    </div>
                  </div>
                </td>
                <td class="center-cell ${e.att.lop > 0 ? 'text-red font-semibold' : ''}">${e.att.lop || 0}</td>
                <td class="center-cell">${lopJoinLeaveNote(e)}</td>
                <td class="center-cell">${lopSyncPill(status)}</td>
                <td class="text-sm text-secondary">${lastSynced}</td>
                <td class="center-cell">
                  <div style="display:flex;gap:4px;justify-content:center;">
                    <button class="btn btn-sm btn-icon-only" onclick="openM('lop-sync-detail', {empId: '${e.id}'})" title="View sync details"><i class="ti ti-eye"></i></button>
                    ${status === 'error' ? `<button class="btn btn-sm btn-icon-only" onclick="retryLopSync('${e.id}')" title="Retry"><i class="ti ti-refresh"></i></button>` : ''}
                  </div>
                </td>
              </tr>`;
  }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-subtle);font-weight:700;">
              <td style="padding:12px 8px;">Totals</td>
              <td class="center-cell ${totalLOP > 0 ? 'text-red' : ''}">${totalLOP}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div class="send-summary" style="background:var(--blue-bg);border-color:var(--blue);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="font-semibold text-blue" style="font-size:14px;">Ready to send LOP for ${employees.length} employees</div>
          <div class="text-sm text-blue" style="margin-top:4px;">Review exceptions before sending. Payroll processing continues in greytHR after sync.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" onclick="resetSyncStatus()"><i class="ti ti-refresh"></i> Reset status</button>
          <button class="btn btn-primary" onclick="openM('confirm-lop-sync')" ${S.lopSync.phase === 'syncing' ? 'disabled' : ''}><i class="ti ti-send"></i> Send LOP to greytHR</button>
        </div>
      </div>
    </div>
  </div>`;
}

// === ADMIN: RESIGNATION WORKFLOW CONFIG ===
function rResignationWorkflow() {
  const steps = getResignationWorkflowRows();
  const enabled = steps.filter(s => s.enabled).length;
  const greytHRSteps = steps.filter(s => s.greytHRAction && s.greytHRAction !== '—').length;
  const p = RESIGNATION_POLICY;
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Resignation Workflow</h1>
        <p class="page-sub">${E[S.entity].name} | Approval levels and clearance steps for offboarding</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="openM('edit-resignation-policy')"><i class="ti ti-settings"></i> Edit policy</button>
        <button class="btn btn-primary" onclick="nav('resignation')"><i class="ti ti-door-exit"></i> Offboarding queue</button>
      </div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>MySlice orchestrates clearance | greytHR processes F&F</b>
        Configure who approves each step and when data is pushed to greytHR. Active resignations follow this workflow in Resignation & Offboarding.
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-list-numbers"></i></div><div><div class="stat-label">Clearance steps</div><div class="stat-value">${steps.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Enabled</div><div class="stat-value">${enabled}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-send"></i></div><div><div class="stat-label">greytHR touchpoints</div><div class="stat-value">${greytHRSteps}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Notice period</div><div class="stat-value">${p.noticePeriodDays}d</div></div></div>
    </div>
    <div class="card mb-3">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-git-branch"></i></span>Workflow preview</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 4px 8px;">
        ${steps.map((s, i) => `<div style="display:flex;align-items:center;gap:6px;">
          <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${s.enabled ? 'var(--blue-bg)' : 'var(--surface-subtle)'};color:${s.enabled ? 'var(--blue-text)' : 'var(--text-tertiary)'};"><i class="ti ${s.icon}" style="font-size:12px;"></i></div>
          <span class="text-sm ${s.enabled ? 'font-semibold' : 'text-tertiary'}">${s.order}. ${s.label}</span>
          ${i < steps.length - 1 ? '<i class="ti ti-chevron-right text-tertiary" style="font-size:10px;margin:0 4px;"></i>' : ''}
        </div>`).join('')}
      </div>
    </div>
    <div class="two-col">
      <div class="card" style="padding:0;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
          <div class="font-semibold">Clearance steps</div>
          <div class="text-xs text-secondary mt-2">Order matches the offboarding stepper in active cases</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th class="center">#</th>
                <th>Step</th>
                <th>Approver</th>
                <th class="center">SLA</th>
                <th>greytHR action</th>
                <th class="center">Required</th>
                <th class="center">Status</th>
                <th class="center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${steps.map(s => `<tr>
                <td class="center-cell font-semibold">${s.order}</td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <i class="ti ${s.icon} text-secondary"></i>
                    <div>
                      <div class="font-semibold">${s.label}</div>
                      <div class="text-xs text-secondary">${s.description}</div>
                    </div>
                  </div>
                </td>
                <td class="text-sm">${s.approver}</td>
                <td class="center-cell">${s.slaDays != null ? s.slaDays + 'd' : '—'}</td>
                <td class="text-sm">${s.greytHRAction === '—' ? '<span class="text-tertiary">—</span>' : '<span class="pill pill-purple" style="padding:1px 6px;font-size:9px;">' + s.greytHRAction + '</span>'}</td>
                <td class="center-cell">${s.required ? '<span class="pill pill-green">Yes</span>' : '<span class="pill pill-gray">No</span>'}</td>
                <td class="center-cell">${s.enabled ? '<span class="pill pill-blue">Enabled</span>' : '<span class="pill pill-gray">Disabled</span>'}</td>
                <td class="center-cell"><button class="btn btn-sm" onclick="openM('edit-resignation-step', {id:'${s.id}'})"><i class="ti ti-edit"></i> Edit</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-shield-check"></i></span>Offboarding policy</div></div>
          <div class="info-grid">
            <div><div class="field-label">Notice period</div><div class="field-value">${p.noticePeriodDays} days</div></div>
            <div><div class="field-label">Encashment before separation</div><div class="field-value">${p.requireEncashmentBeforeSeparation ? 'Required' : 'Optional'}</div></div>
            <div><div class="field-label">LOP sync before separation</div><div class="field-value">${p.requireLopSyncBeforeSeparation ? 'Required' : 'Optional'}</div></div>
            <div><div class="field-label">Exclude from F&F</div><div class="field-value">${p.allowExcludeFromFF ? 'Allowed' : 'Not allowed'}</div></div>
            <div><div class="field-label">Alumni portal after F&F</div><div class="field-value">${p.alumniPortalAfterFF ? 'Enabled in greytHR' : 'Disabled'}</div></div>
          </div>
          <button class="btn btn-sm mt-3" onclick="openM('edit-resignation-policy')"><i class="ti ti-edit"></i> Edit policy</button>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>greytHR handoff points</div></div>
          <div class="text-sm text-secondary mb-3">MySlice pushes data at these steps; Finance completes settlement in greytHR.</div>
          ${steps.filter(s => s.greytHRAction && s.greytHRAction !== '—').map(s => `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div class="font-semibold">${s.label}</div>
            <div class="text-sm text-secondary">${s.greytHRAction}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

// === ADMIN: EMPLOYEES LIST ===
function rEmpsList() {
  const employees = EMP.filter(e => e.entity === S.entity);
  const synced = employees.filter(e => e.syncStatus === 'synced').length;
  const failed = employees.filter(e => e.syncStatus === 'error').length;
  const pending = employees.filter(e => e.syncStatus === 'pending' || e.syncStatus === 'sending').length;
  const sync = S.empSync;
  const isBusy = sync.phase === 'syncing';
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Employees</h1>
        <p class="page-sub">${E[S.entity].name} | ${employees.length} employees | Create and update in People | MySlice syncs to greytHR</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="validateEmpSync()" ${isBusy ? 'disabled' : ''}><i class="ti ti-checkup-list"></i> Validate</button>
        <button class="btn btn-primary" onclick="startEmpSync()" ${isBusy ? 'disabled' : ''}><i class="ti ti-refresh"></i> Sync all</button>
        <button class="btn" onclick="retryFailedEmpSync()" ${isBusy || failed === 0 ? 'disabled' : ''}><i class="ti ti-reload"></i> Retry failed</button>
        <button class="btn" onclick="openM('emp-sync-report')"><i class="ti ti-file-text"></i> Report</button>
      </div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>Employee sync to greytHR</b>
        Employees are created in People. MySlice synchronizes bank, statutory, and employment details to the mapped greytHR entity. New joiners sync automatically after onboarding.
      </div>
    </div>
    ${sync.phase === 'syncing' ? `<div class="card" style="padding:16px 18px;background:var(--surface-subtle);margin-bottom:16px;">
      <div class="font-semibold mb-2"><i class="ti ti-loader-2" style="margin-right:6px;"></i>Synchronizing employees...</div>
      <div class="progress mb-2"><div class="progress-fill" style="width:${Math.round((sync.progressCurrent / sync.total) * 100)}%;"></div></div>
      <div class="text-sm text-secondary">${sync.progressCurrent} / ${sync.total} completed</div>
    </div>` : ''}
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-users"></i></div><div><div class="stat-label">Total</div><div class="stat-value">${employees.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Synced</div><div class="stat-value">${synced}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-clock"></i></div><div><div class="stat-label">Pending</div><div class="stat-value">${pending}</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-alert-circle"></i></div><div><div class="stat-label">Failed</div><div class="stat-value">${failed}</div></div></div>
    </div>
    <div class="card" style="padding: 0;">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
        <div class="font-semibold">Employee sync status</div>
        <div class="text-xs text-secondary mt-2">Click a row for details | greytHR owns salary structure and payroll processing</div>
      </div>
      <div style="overflow-x: auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>MySlice status</th>
              <th>greytHR ID</th>
              <th>Entity</th>
              <th>Last synced</th>
              <th>Sync status</th>
              <th class="center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => `<tr style="cursor:pointer;" onclick="goEmp('${e.id}')">
              <td>
                <div style="display:flex;gap:10px;align-items:center;">
                  <div class="avatar" style="background:var(--${e.avBg}-bg);color:var(--${e.avBg}-text);">${e.av}</div>
                  <div>
                    <div class="font-semibold">${e.name}</div>
                    <div class="text-xs text-secondary">${e.id} | ${e.role}</div>
                  </div>
                </div>
              </td>
              <td>${empMySliceStatus(e)}</td>
              <td><span class="text-mono text-sm">${e.gretyId || 'Not assigned'}</span></td>
              <td class="text-sm">${E[e.entity].name}</td>
              <td class="text-sm text-secondary">${empLastSyncedLabel(e)}</td>
              <td>${lopSyncPill(e.syncStatus)}</td>
              <td class="center-cell" onclick="event.stopPropagation()">
                <div style="display:flex;gap:4px;justify-content:center;">
                  <button class="btn btn-sm btn-icon-only" onclick="openM('sync-status-detail', {empId:'${e.id}'})" title="View sync"><i class="ti ti-eye"></i></button>
                  ${e.syncStatus === 'error' || e.syncStatus === 'pending' ? `<button class="btn btn-sm btn-icon-only" onclick="retryEmployeeSync('${e.id}')" title="Retry"><i class="ti ti-refresh"></i></button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// === ADMIN: EMPLOYEE DETAIL ===
function rEmpDetail() {
  const e = EMP.find(x => x.id === S.empSel);
  if (!e) { S.empSel = null; return rEmpsList(); }
  // Pass empId not name for modal to look up data fresh
  return `<div class="page">
    <div class="page-header">
      <div style="display: flex; gap: 14px; align-items: center;">
        <button class="icon-btn" onclick="setT('empSel', null)"><i class="ti ti-arrow-left"></i></button>
        <div class="avatar" style="width: 48px; height: 48px; font-size: 16px; background: var(--${e.avBg}-bg); color: var(--${e.avBg}-text);">${e.av}</div>
        <div>
          <h1 class="page-title" style="margin-bottom: 4px">${e.name}</h1>
          <p class="page-sub">${e.id} · ${e.role} · ${E[e.entity].name}</p>
          <p class="text-xs text-tertiary" style="margin-top: 2px">DOJ ${e.doj} · ${e.tenure} tenure · ${e.leaveBalance} leave balance</p>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openM('sync-status-detail', {empId: '${e.id}'})"><i class="ti ti-cloud-upload"></i> Sync status</button>
        ${e.syncStatus === 'error' || e.syncStatus === 'pending' ? `<button class="btn btn-primary" onclick="retryEmployeeSync('${e.id}')"><i class="ti ti-refresh"></i> Retry sync</button>` : ''}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon ${e.syncStatus === 'synced' ? 'green' : e.syncStatus === 'error' ? 'red' : 'orange'}"><i class="ti ti-cloud-upload"></i></div><div><div class="stat-label">greytHR sync</div><div class="stat-value" style="font-size:14px">${e.syncStatus === 'synced' ? 'Synced' : e.syncStatus === 'error' ? 'Failed' : 'Pending'}</div><div class="stat-meta">${e.gretyId || 'Not assigned'}</div></div></div>
      <div class="stat-tile"><div class="stat-icon teal"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">Leave balance</div><div class="stat-value">${e.leaveBalance}</div><div class="stat-meta">days in MySlice</div></div></div>
      <div class="stat-tile"><div class="stat-icon ${e.hasActiveLoan ? 'orange' : 'green'}"><i class="ti ti-cash"></i></div><div><div class="stat-label">Loan</div><div class="stat-value" style="font-size:14px">${e.hasActiveLoan ? 'Active' : 'None'}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-building"></i></div><div><div class="stat-label">Entity</div><div class="stat-value" style="font-size:14px">${E[e.entity].name}</div></div></div>
    </div>

    <div class="tabs">
      ${[['sync', 'Sync details'], ['finance', 'Finance master'], ['attendance', 'Attendance'], ['loans', 'Loans']].map(t => `<div class="tab ${S.empTab === t[0] ? 'active' : ''}" onclick="setT('empTab', '${t[0]}')">${t[1]}</div>`).join('')}
    </div>
    ${rEmpTabContent(e)}
  </div>`;
}

function rEmpTabContent(e) {
  const t = S.empTab;
  const f = getFinance(e.id);
  const financeErrs = financeValidationErrors(e.id);
  if (t === 'finance') return `<div class="card">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon"><i class="ti ti-building-bank"></i></span>Finance master data</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-sm" onclick="openM('edit-finance-master', {empId:'${e.id}'})"><i class="ti ti-pencil"></i> Edit in People</button>
        <button class="btn btn-sm btn-primary" onclick="retryFinanceSync('${e.id}')" ${financeErrs.length ? 'disabled' : ''}><i class="ti ti-refresh"></i> Sync to greytHR</button>
      </div>
    </div>
    ${financeErrs.length ? `<div class="alert-banner alert-red mb-3"><i class="ti ti-alert-triangle"></i><div><b>${financeErrs.length} validation issue${financeErrs.length === 1 ? '' : 's'}</b>${financeErrs.map(x => ' · ' + x).join('')}</div></div>` : ''}
    <div class="info-grid mb-3">
      <div><div class="field-label">Bank</div><div class="field-value">${f.bankName || '—'}${f.accountNo ? '<br><span class="text-xs text-secondary">' + maskAccount(f.accountNo) + ' · ' + (f.ifsc || '—') + '</span>' : ''}</div></div>
      <div><div class="field-label">PAN</div><div class="field-value text-mono">${f.pan ? maskPan(f.pan) : '—'}</div></div>
      <div><div class="field-label">UAN</div><div class="field-value text-mono">${f.uan || (f.pfApplicable ? '—' : 'Not applicable')}</div></div>
      <div><div class="field-label">PF applicable</div><div class="field-value">${f.pfApplicable ? 'Yes' : 'No'}</div></div>
      <div><div class="field-label">ESI applicable</div><div class="field-value">${f.esiApplicable ? 'Yes' + (f.esicNo ? ' · ' + f.esicNo : '') : 'No'}</div></div>
      <div><div class="field-label">Professional tax state</div><div class="field-value">${f.ptState || '—'}</div></div>
      <div><div class="field-label">greytHR sync</div><div class="field-value">${financeSyncPill(f.syncStatus)}</div></div>
      <div><div class="field-label">Last synced</div><div class="field-value">${f.lastSynced || '—'}</div></div>
    </div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Finance fields are maintained in People. MySlice validates and pushes bank and statutory identifiers to greytHR. Payslips and tax documents are available via greytHR ESS.</div></div>
  </div>`;
  if (t === 'sync' || t === 'setup') return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-cloud-upload"></i></span>greytHR sync details</div><button class="btn btn-sm" onclick="openM('sync-status-detail', {empId: '${e.id}'})">View sync status</button></div>
    <div class="info-grid mb-3">
      <div><div class="field-label">MySlice employee ID</div><div class="field-value text-mono">${e.id}</div></div>
      <div><div class="field-label">greytHR employee ID</div><div class="field-value text-mono">${e.gretyId || 'Not assigned'}</div></div>
      <div><div class="field-label">Entity mapping</div><div class="field-value">${E[e.entity].name}</div></div>
      <div><div class="field-label">Sync status</div><div class="field-value">${lopSyncPill(e.syncStatus)}</div></div>
      <div><div class="field-label">Last synced</div><div class="field-value">${empLastSyncedLabel(e)}</div></div>
      <div><div class="field-label">MySlice status</div><div class="field-value">${empMySliceStatus(e)}</div></div>
    </div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Employee profile, bank, statutory, and employment data are maintained in People and synced to greytHR. Salary structure and payroll are managed in greytHR.</div></div>
  </div>
  <div class="field-grid-2">
    <div class="card"><div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-map-pin"></i></span>Employment</div></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">Role</span><b>${e.role}</b></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">Work state</span><b>${e.workState}</b></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">DOJ</span><b>${e.doj}</b></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">Tenure</span><b>${e.tenure}</b></div>
    </div>
    <div class="card"><div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar-check"></i></span>Leave (MySlice master)</div></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">Leave balance</span><b>${e.leaveBalance} days</b></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0;"><span class="text-secondary">Entity policy</span><b>${ENCASHMENT_POLICIES[E[e.entity].encashmentPolicy].label}</b></div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; align-items: center;"><span class="text-secondary">Bank</span><b>${f.bankName ? f.bankName + ' · ' + maskAccount(f.accountNo) : '—'} <button class="btn btn-sm" style="margin-left:8px;padding:2px 8px;font-size:11px;" onclick="setT('empTab','finance')">Finance</button></b></div>
    </div>
  </div>`;

  if (t === 'attendance') return `<div class="stat-grid">
    <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Avg payable</div><div class="stat-value">28.9</div></div></div>
    <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar-x"></i></div><div><div class="stat-label">Total LOP</div><div class="stat-value">${EMP_MONTHLY.reduce((s, m) => s + m.lop, 0)}</div></div></div>
    <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">Paid leave</div><div class="stat-value">${EMP_MONTHLY.reduce((s, m) => s + m.paid, 0)}</div></div></div>
    <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-target"></i></div><div><div class="stat-label">Score</div><div class="stat-value">94.2%</div></div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar"></i></span>Monthly attendance · last 12 months</div><div style="display: flex; gap: 6px;"><button class="btn btn-sm" onclick="openM('view-attendance-snapshot', {empId: '${e.id}'})"><i class="ti ti-eye"></i> View engine snapshot</button><button class="btn btn-sm" onclick="openM('revert-attendance', {empId: '${e.id}'})"><i class="ti ti-arrow-back-up"></i> Revert</button></div></div>
    <p class="text-sm text-secondary mb-3">Auto-synced from MySlice Shifts when attendance is locked each month. Revert restores snapshot to the source state.</p>
    <table class="table">
      <thead><tr><th>Month</th><th>Distribution</th><th class="text-right">Worked</th><th class="text-right">Paid leave</th><th class="text-right">LOP</th><th class="text-right">Payable</th></tr></thead>
      <tbody>${EMP_MONTHLY.map(m => `<tr><td><b>${m.month}</b></td><td><div class="attendance-bar" style="width: 200px;"><div style="background: var(--green); flex: ${m.worked};"></div>${m.paid > 0 ? `<div style="background: var(--blue); flex: ${m.paid};"></div>` : ''}${m.lop > 0 ? `<div style="background: var(--orange); flex: ${m.lop};"></div>` : ''}<div style="background: var(--surface-subtle); flex: ${Math.max(0, 31 - m.worked - m.paid - m.lop)};"></div></div></td><td class="text-right">${m.worked}</td><td class="text-right">${m.paid}</td><td class="text-right ${m.lop > 0 ? 'text-red' : ''}">${m.lop || '—'}</td><td class="text-right"><b>${m.worked + m.paid}</b></td></tr>`).join('')}</tbody>
    </table>
    <div style="display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 12px;">
      <div><span class="legend-dot" style="background: var(--green);"></span>Worked</div>
      <div><span class="legend-dot" style="background: var(--blue);"></span>Paid leave</div>
      <div><span class="legend-dot" style="background: var(--orange);"></span>LOP</div>
    </div>
  </div>`;

  if (t === 'loans') return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-cash"></i></span>Active loans</div><button class="btn btn-primary btn-sm" onclick="openM('hr-new-loan', {empId: '${e.id}'})"><i class="ti ti-plus"></i> Create loan</button></div>
    ${e.hasActiveLoan ? `<div class="req-card" style="margin-bottom: 0;">
      <div class="req-header"><div><b>Festival loan</b><div class="text-sm text-secondary">${fmt(50000)} · 6 months · started Jan 2026</div></div><span class="pill pill-green">On track</span></div>
      <div class="req-grid">
        <div><div class="req-cell-label">Outstanding</div><div class="req-cell-value">${fmt(16667)}</div></div>
        <div><div class="req-cell-label">EMI</div><div class="req-cell-value">${fmt(8333)}</div></div>
        <div><div class="req-cell-label">Paid</div><div class="req-cell-value">4 of 6</div></div>
        <div><div class="req-cell-label">Closes</div><div class="req-cell-value">Jun 2026</div></div>
      </div>
      <div class="mt-3" style="padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 8px;">
        <button class="btn btn-sm" onclick="openM('loan-schedule', {empId: '${e.id}'})"><i class="ti ti-list"></i> View schedule</button>
        <button class="btn btn-sm" onclick="openM('foreclose-loan', {empId: '${e.id}'})">Foreclose early</button>
      </div>
    </div>` : `<div style="text-align: center; padding: 32px; color: var(--text-secondary);"><i class="ti ti-cash-off" style="font-size: 28px; display: block; margin-bottom: 8px;"></i>No active loans</div>`}
  </div>`;

  return '';
}
// === ADMIN: LOANS ===
function rLoans() {
  const t = S.loanTab;
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Loans</h1><p class="page-sub">Across all entities · 3 pending · 4 active</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openM('hr-new-loan')"><i class="ti ti-plus"></i> Create loan</button></div>
    </div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Loan workflow</b>Employee submits in MySlice → Finance approves → Loan created in greytHR → greytHR deducts EMI in payroll. EMI must not exceed ${LOAN_EMI_MAX_PCT}% of salary.</div></div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-clock"></i></div><div><div class="stat-label">Pending</div><div class="stat-value">3</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-cash"></i></div><div><div class="stat-label">Active</div><div class="stat-value">4</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-arrow-down-right"></i></div><div><div class="stat-label">May EMI total</div><div class="stat-value">${fmt(43332)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-currency-rupee"></i></div><div><div class="stat-label">Outstanding</div><div class="stat-value">${fmtL(209994)}</div></div></div>
    </div>
    <div class="tabs">
      <div class="tab ${t === 'pending' ? 'active' : ''}" onclick="setT('loanTab', 'pending')">Pending · 3</div>
      <div class="tab ${t === 'active' ? 'active' : ''}" onclick="setT('loanTab', 'active')">Active · 4</div>
      <div class="tab ${t === 'completed' ? 'active' : ''}" onclick="setT('loanTab', 'completed')">Completed</div>
    </div>
    ${t === 'pending' ? rLoansPending() : t === 'active' ? rLoansActive() : rLoansCompleted()}
  </div>`;
}

function rLoansPending() {
  return LOANS_PEND.map(l => `<div class="req-card ${l.urgent ? 'urgent' : ''}">
    <div class="req-header">
      <div style="display: flex; gap: 12px; align-items: center;">
        <div class="avatar" style="background: var(--${l.ineligible ? 'red' : l.urgent ? 'purple' : 'green'}-bg); color: var(--${l.ineligible ? 'red' : l.urgent ? 'purple' : 'green'}-text);">${l.av}</div>
        <div><div class="font-semibold">${l.emp}</div><div class="text-sm text-secondary">${l.empId} · ${l.entity}</div></div>
      </div>
      <div style="text-align: right;"><span class="pill pill-${l.ineligible ? 'red' : l.urgent ? 'orange' : 'blue'}"><i class="ti ti-${l.ineligible ? 'alert-triangle' : 'clock'}"></i> ${l.awaiting}</span><div class="text-xs text-tertiary mt-2">Requested ${l.requested}</div></div>
    </div>
    <div><b>${l.type} · ${fmt(l.amount)} · ${l.tenure} ${l.tenure === 1 ? 'shot' : 'months'}</b><div class="text-sm text-secondary mt-2"><i>"${l.reason}"</i></div></div>
    <div class="req-grid">
      <div><div class="req-cell-label">Principal</div><div class="req-cell-value">${fmt(l.amount)}</div></div>
      <div><div class="req-cell-label">Monthly EMI</div><div class="req-cell-value">${fmt(l.emi)}</div></div>
      <div><div class="req-cell-label">First deduction</div><div class="req-cell-value">Jun 2026</div></div>
      <div><div class="req-cell-label">EMI % salary</div><div class="req-cell-value ${(l.emi / l.monthlyTakeHome * 100) > LOAN_EMI_MAX_PCT ? 'text-red' : ''}">${Math.round(l.emi / l.monthlyTakeHome * 100)}%</div></div>
    </div>
    <div style="background: ${l.ineligible ? 'var(--red-bg)' : 'var(--surface-subtle)'}; padding: 12px; border-radius: 8px; margin-top: 10px;">
      <div class="text-xs font-semibold ${l.ineligible ? 'text-red' : 'text-secondary'} mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Eligibility</div>
      ${l.ineligible ? `<div class="check-row fail"><i class="ti ti-x"></i><span>Tenure 8 months (≥ 1 year required)</span></div><div class="check-row fail"><i class="ti ti-x"></i><span>Active loan exists</span></div>` : `<div class="check-row pass"><i class="ti ti-check"></i><span>Tenure meets minimum</span></div><div class="check-row pass"><i class="ti ti-check"></i><span>EMI ${Math.round(l.emi / l.monthlyTakeHome * 100)}% · under ${LOAN_EMI_MAX_PCT}%</span></div><div class="check-row pass"><i class="ti ti-check"></i><span>No active loans</span></div>${l.urgent ? '<div class="check-row warn"><i class="ti ti-alert-circle"></i><span>Amount > ₹1L · CEO approval</span></div>' : ''}`}
    </div>
    <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border);">
      <button class="btn" onclick="openM('view-emi-schedule', {loanId: '${l.id}'})"><i class="ti ti-list"></i> Preview schedule</button>
      <div style="flex: 1;"></div>
      ${l.ineligible ? `<button class="btn btn-danger" onclick="openM('reject-loan', {loanId: '${l.id}'})">Reject</button><button class="btn" onclick="openM('override-approve', {loanId: '${l.id}'})">Override</button>` : `<button class="btn btn-danger" onclick="openM('reject-loan', {loanId: '${l.id}'})">Reject</button><button class="btn btn-success" onclick="openM('approve-loan', {loanId: '${l.id}'})"><i class="ti ti-check"></i> Approve</button>`}
    </div>
  </div>`).join('');
}

function rLoansActive() {
  return `<div class="card" style="padding: 0;"><table class="table">
    <thead><tr><th>Employee</th><th>Type</th><th>Progress</th><th class="text-right">EMI</th><th class="text-right">Outstanding</th><th>Period</th><th></th></tr></thead>
    <tbody>${LOANS_ACTIVE.map((l, i) => `<tr>
      <td><b>${l.emp}</b><br><span class="text-xs text-secondary">${l.empId} · ${l.entity}</span></td>
      <td>${l.type}<br><span class="text-xs text-secondary">${l.paid} of ${l.total}</span></td>
      <td><div class="progress" style="width: 100px"><div class="progress-fill" style="width: ${l.paid / l.total * 100}%"></div></div></td>
      <td class="text-right"><b>${fmt(l.emi)}</b></td>
      <td class="text-right"><b>${fmt(l.outstanding)}</b></td>
      <td class="text-xs text-secondary">${l.startDate} → ${l.endDate}</td>
      <td><button class="btn btn-sm" onclick="openM('active-loan-detail', {idx: ${i}})">View</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function rLoansCompleted() {
  return `<div class="card" style="padding: 0;"><table class="table">
    <thead><tr><th>Employee</th><th>Type</th><th>Period</th><th class="text-right">Principal</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td><b>Ravi Kumar</b><br><span class="text-xs text-secondary">EMP1042 · Premier</span></td><td>Emergency</td><td>Jun 25 — Apr 26</td><td class="text-right">${fmt(180000)}</td><td><span class="pill pill-green">Recovered</span></td></tr>
      <tr><td><b>Meera Krishnan</b><br><span class="text-xs text-secondary">EMP1080 · Premier</span></td><td>Festival</td><td>Sep 25 — Mar 26</td><td class="text-right">${fmt(50000)}</td><td><span class="pill pill-green">Recovered</span></td></tr>
      <tr><td><b>Suresh Babu</b><br><span class="text-xs text-secondary">EMP2007 · Nemo</span></td><td>Advance</td><td>Jan 26</td><td class="text-right">${fmt(25000)}</td><td><span class="pill pill-green">Recovered</span></td></tr>
    </tbody>
  </table></div>`;
}

// === ADMIN: RESIGNATION & OFFBOARDING ===
function rResignation() {
  if (S.resignSel !== null && RESIGNATIONS[S.resignSel]) return rResignationDetail(S.resignSel);
  const t = S.resignTab;
  const active = RESIGNATIONS.filter(r => r.status === 'in_progress' || r.status === 'on_hold');
  const ready = RESIGNATIONS.filter(r => r.status === 'ready_for_ff');
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Resignation & Offboarding</h1>
        <p class="page-sub">Resignation workflow, clearance steps and separation sync to greytHR | F&F processed in greytHR</p>
      </div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>MySlice orchestrates offboarding | greytHR processes F&F</b>
        After all clearances, MySlice sends final leave balance, LOP, and separation data to greytHR. Finance completes settlement in the greytHR portal.
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-clock"></i></div><div><div class="stat-label">In clearance</div><div class="stat-value">${active.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Ready for F&F</div><div class="stat-value">${ready.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Completed FY</div><div class="stat-value">${RESIGNATIONS_COMPLETED.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-alert-circle"></i></div><div><div class="stat-label">On hold</div><div class="stat-value">${RESIGNATIONS.filter(r => r.status === 'on_hold').length}</div></div></div>
    </div>
    <div class="tabs">
      <div class="tab ${t === 'active' ? 'active' : ''}" onclick="setT('resignTab', 'active')">In clearance · ${active.length}</div>
      <div class="tab ${t === 'ready' ? 'active' : ''}" onclick="setT('resignTab', 'ready')">Ready for F&F · ${ready.length}</div>
      <div class="tab ${t === 'completed' ? 'active' : ''}" onclick="setT('resignTab', 'completed')">Completed</div>
    </div>
    ${t === 'active' ? rResignationActiveList() : t === 'ready' ? rResignationReadyList() : rResignationCompletedList()}
  </div>`;
}

function rResignationStepper(r, compact) {
  return `<div style="display:flex;gap:${compact ? '6px' : '8px'};flex-wrap:wrap;margin-top:${compact ? '8px' : '12px'};">
    ${RESIGN_STEPS.map((step, i) => {
    const cls = resignStepClass(step, r);
    const blocked = r.steps[step.key]?.status === 'blocked';
    return `<div title="${step.label}" style="display:flex;align-items:center;gap:${compact ? '4px' : '6px'};font-size:${compact ? '10px' : '11px'};color:var(--text-secondary);">
        <div style="width:${compact ? '22px' : '28px'};height:${compact ? '22px' : '28px'};border-radius:50%;display:flex;align-items:center;justify-content:center;background:${cls === 'done' ? 'var(--green-bg)' : cls === 'active' ? 'var(--blue-bg)' : 'var(--surface-subtle)'};color:${cls === 'done' ? 'var(--green-text)' : cls === 'active' ? 'var(--blue-text)' : 'var(--text-tertiary)'};">
          <i class="ti ti-${cls === 'done' ? 'check' : blocked ? 'x' : cls === 'active' ? 'arrow-right' : 'circle'}" style="font-size:${compact ? '10px' : '12px'};"></i>
        </div>
        ${compact ? '' : `<span class="${cls === 'active' ? 'font-semibold text-blue' : ''}">${step.label}</span>`}
        ${i < RESIGN_STEPS.length - 1 && !compact ? '<i class="ti ti-chevron-right text-tertiary" style="font-size:10px;"></i>' : ''}
      </div>`;
  }).join('')}
  </div>`;
}

function rResignationActiveList() {
  const items = RESIGNATIONS.filter(r => r.status === 'in_progress' || r.status === 'on_hold');
  if (!items.length) return `<div class="card" style="text-align:center;padding:40px;color:var(--text-secondary);">No active offboarding cases</div>`;
  return items.map(r => {
    const idx = RESIGNATIONS.indexOf(r);
    return `<div class="req-card ${r.status === 'on_hold' ? 'urgent' : ''}">
      <div class="req-header">
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="avatar" style="background:var(--${r.avBg}-bg);color:var(--${r.avBg}-text);">${r.av}</div>
          <div>
            <div class="font-semibold">${r.emp}</div>
            <div class="text-sm text-secondary">${r.empId} | ${r.entityName} | LWD ${r.lwd}</div>
          </div>
        </div>
        <div style="text-align:right;">
          ${resignStatusPill(r)}
          <div class="text-xs text-tertiary mt-2">${r.reason}</div>
        </div>
      </div>
      ${rResignationStepper(r, true)}
      <div class="req-grid" style="margin-top:12px;">
        <div><div class="req-cell-label">Current step</div><div class="req-cell-value">${RESIGN_STEPS[r.currentStep - 1]?.label || '—'}</div></div>
        <div><div class="req-cell-label">Progress</div><div class="req-cell-value">${resignProgressPct(r)}%</div></div>
        <div><div class="req-cell-label">Leave balance</div><div class="req-cell-value">${r.leaveBalance} days</div></div>
        <div><div class="req-cell-label">Separation sync</div><div class="req-cell-value">${r.separationSync === 'synced' ? 'Synced' : r.separationSync === 'blocked' ? 'Blocked' : 'Pending'}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
        <button class="btn" onclick="goResign(${idx})"><i class="ti ti-eye"></i> Open workflow</button>
        ${r.status !== 'on_hold' ? `<button class="btn btn-primary" onclick="goResign(${idx})"><i class="ti ti-arrow-right"></i> Continue clearance</button>` : `<button class="btn" onclick="openM('ff-resolve-hold', {idx: ${FF_ACTIVE.indexOf(r)}})">Resolve hold</button>`}
      </div>
    </div>`;
  }).join('');
}

function rResignationReadyList() {
  const items = RESIGNATIONS.filter(r => r.status === 'ready_for_ff');
  if (!items.length) return `<div class="card" style="text-align:center;padding:40px;color:var(--text-secondary);">No employees ready for F&F</div>`;
  return `<div class="card" style="padding:0;">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
      <div class="font-semibold">Ready for F&F</div>
      <div class="text-xs text-secondary mt-2">Summary for Finance | settlement calculated and processed in greytHR</div>
    </div>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Last working date</th>
            <th class="center">Payable days</th>
            <th class="center">LOP</th>
            <th class="center">Encashable leave</th>
            <th class="text-right">Asset recovery</th>
            <th class="text-right">Loan outstanding</th>
            <th>Separation sync</th>
            <th>F&F status</th>
            <th class="center">Action</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r => {
    const idx = RESIGNATIONS.indexOf(r);
    const encash = r.leaveTypes.reduce((s, lt) => s + (lt.approvedEncash || 0), 0);
    return `<tr>
              <td><b>${r.emp}</b><br><span class="text-xs text-secondary">${r.empId}</span></td>
              <td>${r.lwd}</td>
              <td class="center-cell">${r.payrollDays.payableDays}</td>
              <td class="center-cell ${r.payrollDays.lop > 0 ? 'text-red' : ''}">${r.payrollDays.lop}</td>
              <td class="center-cell">${encash} days</td>
              <td class="text-right">${r.assetRecovery > 0 ? fmt(r.assetRecovery) : '—'}</td>
              <td class="text-right">${r.loanOutstanding > 0 ? fmt(r.loanOutstanding) : '—'}</td>
              <td>${lopSyncPill(r.separationSync === 'synced' ? 'synced' : 'pending')}</td>
              <td><span class="pill pill-blue">${r.ffStatus}</span></td>
              <td class="center-cell">
                <button class="btn btn-sm btn-primary" onclick="openM('open-greythr-ff', {idx: ${idx}})"><i class="ti ti-external-link"></i> Open greytHR F&F</button>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function rResignationCompletedList() {
  return `<div class="card" style="padding:0;"><table class="table">
    <thead><tr><th>Employee</th><th>Entity</th><th>LWD</th><th>Separated on</th><th>F&F status</th><th>Reason</th></tr></thead>
    <tbody>${RESIGNATIONS_COMPLETED.map(f => `<tr>
      <td><b>${f.emp}</b><br><span class="text-xs text-secondary">${f.empId}</span></td>
      <td>${f.entity}</td><td>${f.lwd}</td><td>${f.separationDate}</td>
      <td><span class="pill pill-green">${f.ffStatus}</span></td><td>${f.reason}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function rResignationDetail(idx) {
  const r = RESIGNATIONS[idx];
  if (!r) { S.resignSel = null; return rResignation(); }
  return `<div class="page">
    <div class="page-header">
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="icon-btn" onclick="setT('resignSel', null)"><i class="ti ti-arrow-left"></i></button>
        <div class="avatar" style="width:48px;height:48px;font-size:16px;background:var(--${r.avBg}-bg);color:var(--${r.avBg}-text);">${r.av}</div>
        <div>
          <h1 class="page-title" style="margin-bottom:4px">${r.emp}</h1>
          <p class="page-sub">${r.empId} | ${r.entityName} | LWD ${r.lwd} | ${resignStatusPill(r)}</p>
        </div>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        ${r.status === 'ready_for_ff' ? `<button class="btn btn-primary" onclick="openM('open-greythr-ff', {idx: ${idx}})"><i class="ti ti-external-link"></i> Open greytHR F&F</button>` : ''}
        ${r.status === 'in_progress' && r.currentStep >= 5 ? `<button class="btn btn-primary" onclick="openM('separation-sync', {idx: ${idx}})"><i class="ti ti-send"></i> Send separation</button>` : ''}
      </div>
    </div>
    <div class="card" style="padding:16px 20px;margin-bottom:16px;">
      <div class="font-semibold mb-2">Offboarding progress · ${resignProgressPct(r)}%</div>
      ${rResignationStepper(r, false)}
    </div>
    <div class="field-grid-2">
      ${rResignationStepCard(r, idx, 'request')}
      ${rResignationStepCard(r, idx, 'manager')}
      ${rResignationStepCard(r, idx, 'hrLeave')}
      ${rResignationStepCard(r, idx, 'itAssets')}
      ${rResignationStepCard(r, idx, 'finalDays')}
      ${rResignationStepCard(r, idx, 'finalAction')}
    </div>
    ${rFFLeaveEncashment(r, idx)}
  </div>`;
}

function rFFLeaveEncashment(r, idx) {
  const calc = E[r.entity]?.encashmentCalc || E.premier.encashmentCalc;
  const primary = getEncashPrimaryLeave(r);
  const maxEncashable = getMaxEncashableDays(r, primary);
  const dailyRate = calcDailySalaryRate(r);
  const approvedDays = primary?.approvedEncash ?? 0;
  const availableDays = primary?.balance ?? r.leaveBalance ?? 0;
  const forfeitedDays = Math.max(0, availableDays - approvedDays);
  const amount = approvedDays ? (r.encashAmount || calcLeaveEncashAmount(r)) : 0;
  const status = r.encashStatus || 'pending_review';
  const apiReady = isEncashApiValidated(r.entity);
  const managerDone = r.steps.manager?.status === 'done';
  const locked = r.status === 'on_hold' || ['syncing', 'ff_pending', 'ff_completed', 'closed'].includes(status);
  const canEdit = managerDone && !locked;
  const canSave = canEdit && ['pending_review', 'pending_approval', 'approved', 'ready_to_sync'].includes(status);
  const canApproveBtn = canEdit && ['pending_review', 'pending_approval', 'approved'].includes(status);
  const canSyncEnabled = status === 'ready_to_sync' && apiReady;
  const canSyncPending = status === 'ready_to_sync' && !apiReady;
  const canRetry = status === 'sync_failed';
  const inputDays = approvedDays || maxEncashable || 0;
  const inputRemarks = r.encashRemarks || '';
  return `<div class="card mt-3" id="leave-encashment-section">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon"><i class="ti ti-leaf"></i></span>Leave Encashment</div>
      ${encashStatusPill(status)}
    </div>
    <p class="text-xs text-secondary mb-3">Resignation &amp; F&amp;F → Employee request details → Leave encashment synchronization</p>
    <div class="info-grid mb-3">
      <div><div class="field-label">Employee name</div><div class="field-value">${r.emp}</div></div>
      <div><div class="field-label">Employee number</div><div class="field-value text-mono">${r.empId}</div></div>
      <div><div class="field-label">Last working date</div><div class="field-value">${r.lwd}</div></div>
      <div><div class="field-label">Eligible leave type</div><div class="field-value">${primary ? (primary.code || 'EL') + ' · ' + primary.name : '—'}</div></div>
      <div><div class="field-label">Current available leave balance</div><div class="field-value">${availableDays} days</div></div>
      <div><div class="field-label">Maximum encashable days (policy)</div><div class="field-value">${maxEncashable} days</div></div>
      <div><div class="field-label">HR-approved encashment days</div><div class="field-value font-semibold">${approvedDays || (canEdit ? '—' : '0')}</div></div>
      <div><div class="field-label">Lapsed / forfeited days</div><div class="field-value ${forfeitedDays ? 'text-orange' : ''}">${forfeitedDays}</div></div>
      <div><div class="field-label">Applicable daily salary rate</div><div class="field-value">${fmt(dailyRate)} <span class="text-xs text-secondary">(${calc.salaryBasisLabel} ÷ ${calc.divisor})</span></div></div>
      <div><div class="field-label">Calculated leave-encashment amount</div><div class="field-value font-semibold">${approvedDays ? fmt(amount) : '—'}</div></div>
      <div><div class="field-label">greytHR synchronization status</div><div class="field-value">${encashStatusPill(status)}</div></div>
      <div><div class="field-label">Last synchronization time</div><div class="field-value">${r.encashLastSynced || '—'}</div></div>
    </div>
    ${r.encashSyncError ? `<div class="alert-banner alert-red mb-3"><i class="ti ti-alert-triangle"></i><div><b>Synchronization error</b>${r.encashSyncError}</div></div>` : ''}
    ${!managerDone ? `<div class="alert-banner alert-blue mb-3"><i class="ti ti-info-circle"></i><div>Leave balance loaded from MySlice. HR review opens after manager approves the resignation.</div></div>` : ''}
    ${managerDone && !locked ? `<div style="background:var(--surface-subtle);padding:16px;border-radius:8px;margin-bottom:16px;">
      <div class="text-xs font-semibold text-secondary mb-3" style="text-transform:uppercase;">HR decision</div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Approved encashment days</label><input type="number" id="encash-days-${idx}" value="${inputDays}" min="0" max="${maxEncashable}" ${canEdit ? '' : 'disabled'} /><div class="text-xs text-secondary mt-1">Max ${maxEncashable} eligible days · Lapsed = ${availableDays} − approved</div></div>
        <div class="field"><label class="field-label">Remarks</label><textarea id="encash-remarks-${idx}" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" ${canEdit ? '' : 'disabled'}>${inputRemarks}</textarea></div>
      </div>
      <div class="text-sm text-secondary mt-2">Preview: <b>${fmt(Math.round(inputDays * dailyRate))}</b> · Forfeited: <b>${Math.max(0, availableDays - inputDays)}</b> days</div>
    </div>` : ''}
    ${canSyncPending ? `<div class="alert-banner alert-orange mb-3"><i class="ti ti-alert-triangle"></i><div><b>Pending API Validation</b>Sync to greytHR is disabled until the endpoint and payload are confirmed. Integration mapping supports sending either approved days or calculated amount — not both unless testing requires it.</div></div>` : ''}
    ${r.encashAudit?.length ? `<div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;">Audit history</div><div style="border:1px solid var(--border);border-radius:8px;margin-bottom:16px;">
      <table class="table" style="margin:0;"><thead><tr><th>Date</th><th>By</th><th>Action</th><th class="center">Original</th><th class="center">Modified</th><th>Remarks</th></tr></thead>
      <tbody>${r.encashAudit.slice(0, 8).map(a => `<tr><td class="text-sm">${a.date}</td><td class="text-sm">${a.by}</td><td class="text-sm">${a.action}</td><td class="center-cell">${a.originalValue ?? '—'}</td><td class="center-cell">${a.modifiedValue ?? '—'}</td><td class="text-sm text-secondary">${a.remarks || '—'}</td></tr>`).join('')}</tbody></table>
    </div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      ${canSave ? `<button class="btn btn-sm" onclick="saveEncashDecision(${idx})"><i class="ti ti-device-floppy"></i> Save Decision</button>` : ''}
      ${canApproveBtn ? `<button class="btn btn-sm btn-primary" onclick="approveLeaveEncashment(${idx})"><i class="ti ti-check"></i> Approve Leave Encashment</button>` : ''}
      ${canSyncEnabled ? `<button class="btn btn-sm btn-primary" onclick="pushLeaveEncashment(${idx})"><i class="ti ti-send"></i> Sync to greytHR</button>` : ''}
      ${canSyncPending ? `<button class="btn btn-sm btn-primary" disabled title="Pending API Validation"><i class="ti ti-send"></i> Sync to greytHR</button><span class="text-xs text-orange">Pending API Validation</span>` : ''}
      ${canRetry ? `<button class="btn btn-sm btn-primary" onclick="retryFFEncashment(${idx})" ${apiReady ? '' : 'disabled title="Pending API Validation"'}><i class="ti ti-refresh"></i> Retry Sync</button>` : ''}
      ${S.role === 'admin' ? viewSyncDetailsBtn(idx) : ''}
    </div>
  </div>`;
}

function rResignationStepCard(r, idx, key) {
  const step = RESIGN_STEPS.find(s => s.key === key);
  const st = r.steps[key] || {};
  const cls = resignStepClass(step, r);
  const blocked = st.status === 'blocked';
  let body = '';
  if (key === 'request') {
    body = `<div class="info-grid">
      <div><div class="field-label">Resignation date</div><div class="field-value">${r.resignationDate}</div></div>
      <div><div class="field-label">Proposed LWD</div><div class="field-value">${r.proposedLwd}</div></div>
      <div><div class="field-label">Reason</div><div class="field-value">${r.reason}</div></div>
      <div><div class="field-label">Remarks</div><div class="field-value">${r.remarks || '—'}</div></div>
    </div>`;
  } else if (key === 'manager') {
    body = blocked
      ? `<div class="alert-banner alert-red"><i class="ti ti-alert-triangle"></i><div>Manager approval blocked pending investigation. Nothing sent to greytHR.</div></div>`
      : `<div class="text-sm">${st.status === 'done' ? 'Approved by ' + st.by + ' on ' + st.date : st.status === 'active' ? 'Awaiting manager approval' : 'Pending previous steps'}</div>`;
  } else if (key === 'hrLeave') {
    body = blocked
      ? `<div class="alert-banner alert-red"><i class="ti ti-alert-triangle"></i><div>HR leave clearance blocked pending investigation.</div></div>`
      : st.status === 'done'
        ? `<div class="text-sm">Leave balances reviewed · encashment approved by ${st.by} on ${st.date}.</div><div class="text-xs text-secondary mt-2">Full encashment detail, calculation and greytHR sync are in the F&F Leave Encashment section below.</div>`
        : st.status === 'active'
          ? `<div class="text-sm">Awaiting HR review of leave balances and encashment policy.</div>${r.steps.manager?.status === 'done' ? `<div class="text-xs text-secondary mt-2">Use the <b>Leave Encashment</b> section below to save and approve the encashment decision.</div>` : ''}`
          : '<div class="text-sm text-secondary">Pending manager approval</div>';
  } else if (key === 'itAssets') {
    body = `<table class="table" style="margin-top:8px;">
      <thead><tr><th>Asset</th><th class="center">Returned</th><th>Damage</th><th class="text-right">Recovery</th></tr></thead>
      <tbody>${r.assets.map(a => `<tr><td>${a.name}</td><td class="center-cell">${a.returned ? '<span class="pill pill-green">Yes</span>' : '<span class="pill pill-orange">No</span>'}</td><td>${a.damage}</td><td class="text-right">${a.recovery > 0 ? fmt(a.recovery) : '—'}</td></tr>`).join('')}</tbody>
    </table><div class="text-sm text-secondary mt-2">Total recovery: ${fmt(r.assetRecovery)}</div>`;
  } else if (key === 'finalDays') {
    body = `<div class="info-grid">
      <div><div class="field-label">Payroll working days</div><div class="field-value">${r.payrollDays.workingDays}</div></div>
      <div><div class="field-label">Payable days</div><div class="field-value">${r.payrollDays.payableDays}</div></div>
      <div><div class="field-label">LOP days</div><div class="field-value ${r.payrollDays.lop > 0 ? 'text-red' : ''}">${r.payrollDays.lop}</div></div>
      <div><div class="field-label">Last working date</div><div class="field-value">${r.lwd}</div></div>
    </div><div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Final LOP will be sent via LOP Sync before separation API call.</div></div>`;
  } else if (key === 'finalAction') {
    body = `<div class="info-grid mb-3">
      <div><div class="field-label">Separation sync</div><div class="field-value">${lopSyncPill(r.separationSync === 'synced' ? 'synced' : r.separationSync === 'blocked' ? 'error' : 'pending')}</div></div>
      <div><div class="field-label">F&F status</div><div class="field-value">${r.ffStatus}</div></div>
      <div><div class="field-label">Loan outstanding</div><div class="field-value">${r.loanOutstanding > 0 ? fmt(r.loanOutstanding) : 'None'}</div></div>
      <div><div class="field-label">Asset recovery</div><div class="field-value">${r.assetRecovery > 0 ? fmt(r.assetRecovery) : 'None'}</div></div>
    </div>
    ${r.status === 'ready_for_ff' ? `<button class="btn btn-primary" onclick="openM('open-greythr-ff', {idx: ${idx}})"><i class="ti ti-external-link"></i> Open greytHR F&F</button><div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>After F&F, enable Alumni Portal in greytHR for ex-employee ESS access (payslips, Form 16).</div></div>` : r.status === 'in_progress' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn" onclick="toast('Offboarding without F&F marked')">Offboard without F&F</button>
      <button class="btn btn-primary" onclick="openM('separation-sync', {idx: ${idx}})" ${!['ff_pending', 'synced', 'ff_completed', 'closed'].includes(r.encashStatus) && r.encashSync !== 'synced' ? 'disabled title="Push leave encashment to greytHR first"' : ''}><i class="ti ti-send"></i> Initiate separation sync</button>
    </div>` : '<div class="text-sm text-secondary">Complete previous clearance steps first</div>'}`;
  }
  return `<div class="card">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon"><i class="ti ${step.icon}"></i></span>${step.label}</div>
      <span class="pill pill-${cls === 'done' ? 'green' : cls === 'active' ? 'blue' : blocked ? 'red' : 'gray'}">${cls === 'done' ? 'Done' : blocked ? 'Blocked' : cls === 'active' ? 'In progress' : 'Pending'}</span>
    </div>
    ${body}
  </div>`;
}

// === ADMIN: SETTINGS (with encashment policy config) ===
function rSettings() {
  const t = S.settingsTab || 'encashment';
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Settings</h1><p class="page-sub">${E[S.entity].name} · per-entity configuration</p></div>
    </div>
    <div class="tabs">
      <div class="tab ${t === 'encashment' ? 'active' : ''}" onclick="setSettingsTab('encashment')">Leave encashment</div>
      <div class="tab ${t === 'pay' ? 'active' : ''}" onclick="setSettingsTab('pay')">Pay cycle</div>
      <div class="tab ${t === 'approvals' ? 'active' : ''}" onclick="setSettingsTab('approvals')">Approvals</div>
      <div class="tab ${t === 'integration' ? 'active' : ''}" onclick="setSettingsTab('integration')">Integration</div>
    </div>
    ${t === 'encashment' ? rSettingsEncashment() : t === 'pay' ? rSettingsPay() : t === 'approvals' ? rSettingsApprovals() : rSettingsIntegration()}
  </div>`;
}

function rSettingsEncashment() {
  const current = E[S.entity].encashmentPolicy;
  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar-check"></i></span>Leave encashment policy · ${E[S.entity].name}</div></div>
    <p class="text-sm text-secondary mb-3">Controls leave encashment calculation during offboarding. Encashment is processed in MySlice and pushed to greytHR for F&F.</p>

    ${Object.entries(ENCASHMENT_POLICIES).map(([key, val]) => `<div class="policy-option ${current === key ? 'active' : ''}" onclick="setEntityPolicy('${key}')">
      <div class="policy-radio"></div>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <i class="ti ${val.icon}" style="color: var(--blue-text); font-size: 16px;"></i>
          <div class="font-semibold">${val.label}</div>
        </div>
        <div class="text-sm text-secondary">${val.desc}</div>
      </div>
    </div>`).join('')}

    <div class="alert-banner alert-blue mt-4"><i class="ti ti-info-circle"></i><div><b>F&F encashment formula</b>Approved encashable days × applicable daily salary rate. Daily rate uses ${E[S.entity].encashmentCalc.salaryBasisLabel} ÷ ${E[S.entity].encashmentCalc.divisor} (configured per entity, not hardcoded).</div></div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>Current month view</div></div>
    <div class="info-grid">
      <div><div class="field-label">Policy</div><div class="field-value">${ENCASHMENT_POLICIES[current].label}</div></div>
      <div><div class="field-label">Active month</div><div class="field-value">${S.monthSel === '2026-03' ? 'Mar 2026 (FY-end)' : S.monthSel === '2026-05' ? 'May 2026' : S.monthSel}</div></div>
      <div><div class="field-label">Encashment column shown?</div><div class="field-value">${showEncashmentColumn() ? '<span class="pill pill-green">Yes</span>' : '<span class="pill pill-gray">Hidden</span>'}</div></div>
      <div><div class="field-label">Auto-compute active?</div><div class="field-value">${isMarchAutoFill() ? '<span class="pill pill-teal">Auto-filled in March</span>' : '<span class="pill pill-gray">Manual entry</span>'}</div></div>
    </div>
    <div class="mt-3" style="display: flex; gap: 8px;">
      <button class="btn btn-sm" onclick="setMonth('2026-05'); nav('lop-sync')"><i class="ti ti-arrow-right"></i> Test in May LOP Sync</button>
      <button class="btn btn-sm" onclick="setMonth('2026-03'); nav('lop-sync')"><i class="ti ti-arrow-right"></i> Test in March LOP Sync</button>
    </div>
  </div>`;
}

function rSettingsPay() {
  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar"></i></span>Pay cycle · ${E[S.entity].name}</div></div>
    <div class="field-grid-2">
      <div class="field"><label class="field-label">Cycle type</label><select><option>1st — last day of month</option><option>26th — 25th of next month</option></select></div>
      <div class="field"><label class="field-label">Pay date</label><select><option>1st of next month</option><option>5th of next month</option><option>7th of next month</option></select></div>
    </div>
    <div class="field-grid-2">
      <div class="field"><label class="field-label">Attendance lock day</label><select><option>25th</option><option>26th</option><option>28th</option></select></div>
      <div class="field"><label class="field-label">Send to engine by</label><select><option>28th</option><option>29th</option><option>30th</option></select></div>
    </div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Changes apply from next pay cycle. Audit-logged.</div></div>
  </div>`;
}

function rSettingsApprovals() {
  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-user-check"></i></span>Approval thresholds</div></div>
    <div class="info-grid">
      <div><div class="field-label">Loan up to ₹25,000</div><div class="field-value">Finance Admin only</div></div>
      <div><div class="field-label">Loan ₹25K — ₹1L</div><div class="field-value">Finance Admin only</div></div>
      <div><div class="field-label">Loan above ₹1L</div><div class="field-value">Finance Admin + CEO</div></div>
      <div><div class="field-label">Annual hike</div><div class="field-value">Finance Admin</div></div>
      <div><div class="field-label">Off-cycle revision</div><div class="field-value">Finance Admin + CEO</div></div>
      <div><div class="field-label">F&F processing</div><div class="field-value">Finance Admin + CEO</div></div>
    </div>
  </div>`;
}

function rIntegrationMappingsEncashment() {
  const rows = getEncashmentMappingRows(S.entity);
  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-arrows-exchange"></i></span>Integration Mappings · F&F Leave Encashment</div><span class="pill pill-orange">Pending API Validation</span></div>
    <p class="text-sm text-secondary mb-3">Reusable component mapping only. Payroll month is set per employee F&F transaction, not here. MySlice will submit <b>either</b> approved days <b>or</b> calculated amount once the greytHR method is confirmed — not necessarily both.</p>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead><tr><th>MySlice field</th><th>greytHR component</th><th>Component code</th><th>Submission method</th><th class="center">Validation status</th><th class="center">Action</th></tr></thead>
        <tbody>
          ${rows.map(row => `<tr>
            <td><b>${row.mySliceField}</b></td>
            <td>${row.greytHRComponent}</td>
            <td>${row.componentCode ? `<span class="text-mono text-sm">${row.componentCode}</span>` : '<span class="text-tertiary">—</span>'}</td>
            <td><span class="pill pill-gray" style="padding:1px 8px;font-size:10px;">${row.submissionMethod}</span></td>
            <td class="center-cell">${encashMappingValidationPill(row.validationStatus)}</td>
            <td class="center-cell"><button class="btn btn-sm" onclick="openM('edit-encashment-mapping', {key:'${row.key}'})"><i class="ti ti-edit"></i> Edit</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div><b>Mapping vs employee F&F</b>This screen configures reusable greytHR components. Employee resignation detail shows available leave, approved days, forfeited days, encashment amount, sync status and F&F processing status per case.</div></div>
    <div class="mt-2"><button class="btn btn-sm" onclick="openM('integration-debug-panel')"><i class="ti ti-bug"></i> Technical details (repository ids)</button></div>
  </div>`;
}

function rSettingsIntegration() {
  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-link"></i></span>Payroll engine integration</div><span class="pill pill-green">Connected</span></div>
    <p class="text-sm text-secondary mb-3">Hidden backend. ${E[S.entity].name} integration with greytHR (white-labeled). Employees and admin never see the greytHR brand.</p>
    <div class="info-grid">
      <div><div class="field-label">Engine status</div><div class="field-value text-green">Operational</div></div>
      <div><div class="field-label">Last sync</div><div class="field-value">14 May, 11:22</div></div>
      <div><div class="field-label">Avg latency</div><div class="field-value">312ms</div></div>
      <div><div class="field-label">24h errors</div><div class="field-value text-green">0</div></div>
      <div><div class="field-label">API endpoint</div><div class="field-value text-mono" style="font-size: 11px;">api.greythr.com/payroll/v2</div></div>
      <div><div class="field-label">x-greythr-domain</div><div class="field-value text-mono" style="font-size: 11px;">premier-payroll.greythr.com</div></div>
    </div>
    <div class="mt-3" style="display: flex; gap: 8px;">
      <button class="btn btn-sm" onclick="openM('test-connection')"><i class="ti ti-refresh"></i> Test connection</button>
      <button class="btn btn-sm" onclick="openM('view-greythr-codes')"><i class="ti ti-list"></i> View item code map</button>
      <button class="btn btn-sm" onclick="openM('rotate-token')"><i class="ti ti-key"></i> Rotate access token</button>
      <button class="btn btn-sm" onclick="openM('integration-debug-panel')"><i class="ti ti-bug"></i> Integration debug</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>Custom item codes</div></div>
    <p class="text-sm text-secondary mb-3">Each greytHR customer account can define custom salary items beyond the standard repository. MySlice detects these on connection test and maps them automatically.</p>
    <div class="info-grid">
      <div><div class="field-label">Standard items active</div><div class="field-value">${Object.keys(GREYTHR_ITEM_CODES).length}</div></div>
      <div><div class="field-label">Custom items detected</div><div class="field-value text-orange">1 · API_TESTC</div></div>
      <div><div class="field-label">Last repository fetch</div><div class="field-value">14 May, 11:22</div></div>
      <div><div class="field-label">Account type</div><div class="field-value">Enterprise (per-entity)</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar-time"></i></span>Shifts module integration</div><span class="pill pill-green">Connected</span></div>
    <p class="text-sm text-secondary mb-3">Attendance (worked days, paid leave, LOP) auto-imported from MySlice Shifts when attendance is locked. Reverting attendance uses <span class="text-mono">DELETE /payroll/v2/attendance/snapshot/employees/{id}</span>.</p>
    <button class="btn btn-sm" onclick="openM('test-shifts-sync')"><i class="ti ti-refresh"></i> Test sync</button>
  </div>
  ${rIntegrationMappingsEncashment()}
  ${rEmployeeSynchronization()}`;
}

const EMP_SYNC_FAILED = [
  { id: 'ESF-1', name: 'Rahul Shah', code: 'EMP021', reason: 'Email already exists' },
  { id: 'ESF-2', name: 'Priya Reddy', code: 'EMP1071', reason: 'Missing PAN & bank' },
  { id: 'ESF-3', name: 'Vikram Mehta', code: 'EMP099', reason: 'Invalid date of joining' }
];

function validateEmpSync() {
  const s = S.empSync;
  toast(`Validated ${s.total} employees · ${s.failed} issue${s.failed === 1 ? '' : 's'} found`);
}

function startEmpSync() {
  const sync = S.empSync;
  sync.phase = 'syncing';
  sync.progressCurrent = sync.synced;
  R();
  const target = sync.total;
  const timer = setInterval(() => {
    sync.progressCurrent = Math.min(sync.progressCurrent + 5, target);
    R();
    if (sync.progressCurrent >= target) {
      clearInterval(timer);
      sync.phase = 'success';
      sync.synced = target - 3;
      sync.failed = 3;
      sync.pending = 0;
      sync.lastSync = { date: '14 May 2026, 11:22 AM', status: 'Completed', synced: sync.synced, failed: sync.failed };
      R();
    }
  }, 100);
}

function retryFailedEmpSync() {
  S.empSync.failed = 0;
  S.empSync.pending = 0;
  S.empSync.synced = S.empSync.total;
  S.empSync.phase = 'empty';
  S.empSync.lastSync = { date: '14 May 2026, 11:45 AM', status: 'Completed', synced: S.empSync.total, failed: 0 };
  ['SE-001', 'SE-002', 'SE-003'].forEach(id => {
    if (!S.resolvedSyncErrors.includes(id)) S.resolvedSyncErrors.push(id);
  });
  toast('Failed employees retried · all synchronized');
  R();
}

function retryEmpSyncOne(id) {
  toast('Retry queued for ' + (EMP_SYNC_FAILED.find(e => e.id === id)?.name || id));
}

function rEmployeeSynchronization() {
  const sync = S.empSync;
  const remaining = Math.max(sync.total - sync.progressCurrent, 0);
  const progressPct = sync.phase === 'syncing'
    ? Math.round((sync.progressCurrent / sync.total) * 100)
    : Math.round((sync.synced / sync.total) * 100);
  const showFailed = sync.phase === 'default' && sync.failed > 0;
  const isBusy = sync.phase === 'syncing';

  let stateBlock = '';
  if (sync.phase === 'syncing') {
    stateBlock = `<div class="card" style="padding:16px 18px;background:var(--surface-subtle);margin-bottom:16px;">
      <div class="font-semibold mb-2"><i class="ti ti-loader-2" style="margin-right:6px;"></i>Synchronizing Employees</div>
      <div class="progress mb-2"><div class="progress-fill" style="width:${progressPct}%;"></div></div>
      <div class="text-sm text-secondary mb-3">${sync.progressCurrent} / ${sync.total} completed</div>
      <div class="info-grid">
        <div><div class="field-label">Success</div><div class="field-value text-green">${sync.progressCurrent - 3 > 0 ? sync.progressCurrent - 3 : sync.progressCurrent}</div></div>
        <div><div class="field-label">Failed</div><div class="field-value text-red">3</div></div>
        <div><div class="field-label">Remaining</div><div class="field-value">${remaining}</div></div>
      </div>
    </div>`;
  } else if (sync.phase === 'success') {
    stateBlock = `<div class="alert-banner alert-blue mb-3" style="background:var(--green-bg);border-color:var(--green);">
      <i class="ti ti-circle-check text-green"></i>
      <div class="text-green"><b>Employee synchronization completed successfully.</b><br>${sync.total} employees processed · ${sync.synced} synchronized successfully · ${sync.failed} failed.</div>
    </div>
    <div class="mb-3"><button class="btn btn-sm" onclick="openM('emp-sync-report')"><i class="ti ti-file-text"></i> View Report</button></div>`;
  } else if (sync.phase === 'empty') {
    stateBlock = `<div class="alert-banner alert-blue mb-3" style="background:var(--green-bg);border-color:var(--green);">
      <i class="ti ti-circle-check text-green"></i>
      <div class="text-green"><b>All employees are synchronized with the payroll engine.</b><br>No additional action required. New employees created after initial setup sync automatically on onboarding.</div>
    </div>`;
  }

  const lastSyncBlock = sync.phase !== 'syncing' && sync.phase !== 'empty' ? `<div class="card" style="padding:14px 18px;background:var(--surface-subtle);margin-bottom:16px;">
    <div class="font-semibold text-sm mb-3">Last Synchronization</div>
    <div class="info-grid">
      <div><div class="field-label">Last Sync</div><div class="field-value">${sync.lastSync.date}</div></div>
      <div><div class="field-label">Status</div><div class="field-value">${sync.lastSync.status}</div></div>
      <div><div class="field-label">Synced</div><div class="field-value text-green">${sync.lastSync.synced}</div></div>
      <div><div class="field-label">Failed</div><div class="field-value ${sync.lastSync.failed ? 'text-red' : 'text-green'}">${sync.lastSync.failed}</div></div>
    </div>
  </div>` : '';

  const failedTable = showFailed ? `<div style="margin-top:4px;">
    <div class="font-semibold text-sm mb-2">Failed Employees</div>
    <div class="card" style="padding:0;">
      <table class="table">
        <thead><tr><th>Employee Name</th><th>Employee Code</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${EMP_SYNC_FAILED.map(e => `<tr>
          <td><b>${e.name}</b></td>
          <td><span class="item-code-tag">${e.code}</span></td>
          <td class="text-sm text-secondary">${e.reason}</td>
          <td><span class="pill pill-red" style="padding:1px 8px;font-size:11px;">Failed</span></td>
          <td><div class="actions-menu">
            <button class="btn btn-sm" onclick="retryEmpSyncOne('${e.id}')"><i class="ti ti-refresh"></i> Retry</button>
            <button class="btn btn-sm" onclick="openM('emp-sync-detail', {id:'${e.id}'})"><i class="ti ti-eye"></i> View Details</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>` : '';

  return `<div class="card">
    <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-users"></i></span>Employee Synchronization</div></div>
    <p class="text-sm text-secondary mb-3">Synchronize existing HRMS employees with the payroll engine. Newly created employees are synced automatically after onboarding.</p>

    <div class="stat-grid mb-3">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-users"></i></div><div><div class="stat-label">Total Employees</div><div class="stat-value">${sync.total}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Synced</div><div class="stat-value">${sync.synced}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-clock"></i></div><div><div class="stat-label">Pending</div><div class="stat-value">${sync.pending}</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-alert-circle"></i></div><div><div class="stat-label">Failed</div><div class="stat-value">${sync.failed}</div></div></div>
    </div>

    <div class="mb-3" style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-sm" onclick="validateEmpSync()" ${isBusy ? 'disabled' : ''}><i class="ti ti-checkup-list"></i> Validate Employees</button>
      <button class="btn btn-sm btn-primary" onclick="startEmpSync()" ${isBusy || sync.phase === 'empty' ? 'disabled' : ''}><i class="ti ti-refresh"></i> Sync Existing Employees</button>
      <button class="btn btn-sm" onclick="retryFailedEmpSync()" ${isBusy || sync.failed === 0 ? 'disabled' : ''}><i class="ti ti-reload"></i> Retry Failed</button>
    </div>

    ${stateBlock}
    ${lastSyncBlock}
    ${failedTable}
  </div>`;
}

// === ADMIN: STATUTORY COMPLIANCE ===
function rStatutory() {
  const monthCode = S.monthSel + '-01';
  const monthLabel = S.monthSel === '2026-05' ? 'May 2026' : S.monthSel === '2026-03' ? 'Mar 2026' : 'Apr 2026';
  // For demo: show last month's processed payroll (Apr 2026) since current month isn't paid yet
  const reportMonth = monthCode === '2026-05-01' ? '2026-04-01' : monthCode;
  const reportLabel = reportMonth === '2026-04-01' ? 'Apr 2026' : reportMonth === '2026-03-01' ? 'Mar 2026' : monthLabel;
  const s = getStatutorySummary(reportMonth);
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Statutory compliance</h1><p class="page-sub">${E[S.entity].name} · ${reportLabel} payroll · PF, ESI, PT, TDS remittances</p></div>
      <div class="page-actions">
        <select onchange="setMonth(this.value)" style="width: auto;">
          <option value="2026-05" ${S.monthSel === '2026-05' ? 'selected' : ''}>Latest (Apr 2026)</option>
          <option value="2026-03" ${S.monthSel === '2026-03' ? 'selected' : ''}>Mar 2026</option>
        </select>
        <button class="btn" onclick="openM('export-generate', {type: 'statutory-bundle', label: 'Statutory bundle'})"><i class="ti ti-download"></i> Export all</button>
      </div>
    </div>

    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>Compliance calendar · ${reportLabel} dues</b>
        PF + EDLI by 15 Jun · ESI by 15 Jun · Professional Tax by 30 Jun (state-specific) · TDS Q1 (Apr-Jun) by 31 Jul.
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-building-bank"></i></div><div><div class="stat-label">PF total due</div><div class="stat-value">${fmt(s.pf.total)}</div><div class="stat-meta">Due 15 Jun</div></div></div>
      <div class="stat-tile"><div class="stat-icon ${s.esi.total > 0 ? 'red' : 'green'}"><i class="ti ti-heart"></i></div><div><div class="stat-label">ESI total</div><div class="stat-value">${s.esi.total > 0 ? fmt(s.esi.total) : 'N/A'}</div><div class="stat-meta">${s.esi.total > 0 ? 'Due 15 Jun' : 'No employees < ₹21K wage'}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-map-pin"></i></div><div><div class="stat-label">PT total</div><div class="stat-value">${fmt(s.pt.total)}</div><div class="stat-meta">${Object.keys(s.pt.byState).length} states</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-coin"></i></div><div><div class="stat-label">TDS this month</div><div class="stat-value">${fmt(s.tds.total)}</div><div class="stat-meta">Q1 due 31 Jul</div></div></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon" style="background: var(--purple-bg); color: var(--purple-text);"><i class="ti ti-building-bank"></i></span>Provident Fund (EPF) · ${reportLabel}</div><span class="pill pill-orange"><i class="ti ti-clock"></i> Due 15 Jun</span></div>
      <div class="info-grid">
        <div><div class="field-label">Employee contribution (12%)</div><div class="field-value">${fmt(s.pf.employee)}</div></div>
        <div><div class="field-label">Employer contribution (12%)</div><div class="field-value">${fmt(s.pf.employer)}</div></div>
        <div><div class="field-label">EDLI premium (0.5%)</div><div class="field-value">${fmt(s.pf.edli)}</div></div>
        <div><div class="field-label">Total challan</div><div class="field-value font-bold text-purple">${fmt(s.pf.total)}</div></div>
      </div>
      <div class="mt-3" style="display: flex; gap: 8px;">
        <button class="btn" onclick="openM('pf-challan-detail', {month: '${reportMonth}'})"><i class="ti ti-list"></i> View detail</button>
        <button class="btn" onclick="openM('generate-pf-ecr', {month: '${reportMonth}'})"><i class="ti ti-download"></i> Generate ECR file</button>
        <button class="btn btn-primary" onclick="openM('mark-pf-paid', {month: '${reportMonth}'})"><i class="ti ti-check"></i> Mark as remitted</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon" style="background: var(--red-bg); color: var(--red-text);"><i class="ti ti-heart"></i></span>Employee State Insurance (ESI) · ${reportLabel}</div><span class="pill pill-gray">Not applicable</span></div>
      <p class="text-sm text-secondary">ESI applies only to employees with wages below ₹21,000/month. None of the current ${EMP.filter(e => e.entity === S.entity).length} employees in ${E[S.entity].name} qualify.</p>
      <div class="mt-3"><button class="btn btn-sm" onclick="openM('esi-eligibility')"><i class="ti ti-info-circle"></i> View eligibility rules</button></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon" style="background: var(--orange-bg); color: var(--orange-text);"><i class="ti ti-map-pin"></i></span>Professional Tax · ${reportLabel}</div><span class="pill pill-orange"><i class="ti ti-clock"></i> Due 30 Jun (varies by state)</span></div>
      <p class="text-sm text-secondary mb-3">State-specific. Each state has its own slabs and due dates.</p>
      ${Object.entries(s.pt.byState).map(([state, amt]) => `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><div><b>${state}</b><div class="text-xs text-secondary">${EMP.filter(e => e.entity === S.entity && e.workState === state).length} employees</div></div><div style="text-align: right;"><div class="font-bold">${fmt(amt)}</div><button class="btn btn-sm" onclick="openM('pt-register-state', {state: '${state}', month: '${reportMonth}'})" style="margin-top: 4px;">Register</button></div></div>`).join('')}
      <div class="mt-3" style="display: flex; gap: 8px;">
        <button class="btn" onclick="openM('export-generate', {type: 'pt-register', label: 'PT register · all states'})"><i class="ti ti-download"></i> Export all states</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon" style="background: var(--red-bg); color: var(--red-text);"><i class="ti ti-coin"></i></span>Income Tax (TDS) · ${reportLabel}</div><span class="pill pill-orange"><i class="ti ti-clock"></i> Q1 due 31 Jul</span></div>
      <p class="text-sm text-secondary mb-3">Monthly TDS deductions reported quarterly via Form 24Q.</p>
      <div class="info-grid">
        <div><div class="field-label">TDS deducted</div><div class="field-value">${fmt(s.tds.total)}</div></div>
        <div><div class="field-label">Quarter</div><div class="field-value">Q1 FY 2026-27</div></div>
        <div><div class="field-label">Form 24Q due</div><div class="field-value">31 Jul 2026</div></div>
        <div><div class="field-label">Employees with TDS</div><div class="field-value">${EMP.filter(e => e.entity === S.entity && computePayslip(e.id, reportMonth)?.deductions.incomeTax > 0).length}</div></div>
      </div>
      <div class="mt-3" style="display: flex; gap: 8px;">
        <button class="btn" onclick="openM('tds-summary', {month: '${reportMonth}'})"><i class="ti ti-list"></i> View detail</button>
        <button class="btn" onclick="openM('generate-form24q', {quarter: 'Q1', fy: '2026-27'})"><i class="ti ti-download"></i> Generate Form 24Q</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-history"></i></span>Compliance history · last 6 months</div></div>
      <table class="table">
        <thead><tr><th>Month</th><th class="text-right">PF</th><th class="text-right">ESI</th><th class="text-right">PT</th><th class="text-right">TDS</th><th>Status</th></tr></thead>
        <tbody>
          ${['2026-04', '2026-03', '2026-02', '2026-01', '2025-12'].map(mm => {
    const st = getStatutorySummary(mm + '-01');
    return `<tr><td><b>${mm}</b></td><td class="text-right">${fmt(st.pf.total)}</td><td class="text-right text-tertiary">N/A</td><td class="text-right">${fmt(st.pt.total)}</td><td class="text-right">${fmt(st.tds.total)}</td><td><span class="pill pill-green">Remitted</span></td></tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// === ADMIN: REPORTS ===
function rReports() {
  const t = S.reportsTab;
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Reports</h1><p class="page-sub">All entities · FY 2026-27</p></div>
      <div class="page-actions"><select style="width: auto;"><option>FY 2026-27</option><option>FY 2025-26</option></select></div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-currency-rupee"></i></div><div><div class="stat-label">YTD CTC sent</div><div class="stat-value">${fmtL(33475000)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-users"></i></div><div><div class="stat-label">Employees</div><div class="stat-value">9</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-package"></i></div><div><div class="stat-label">Batches</div><div class="stat-value">3</div></div></div>
      <div class="stat-tile"><div class="stat-icon teal"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">YTD encashment</div><div class="stat-value">${fmtL(168000)}</div><div class="stat-meta">March</div></div></div>
    </div>
    <div class="tabs">
      <div class="tab ${t === 'register' ? 'active' : ''}" onclick="setT('reportsTab', 'register')">Salary register</div>
      <div class="tab ${t === 'monthly' ? 'active' : ''}" onclick="setT('reportsTab', 'monthly')">Monthly summary</div>
      <div class="tab ${t === 'employee' ? 'active' : ''}" onclick="setT('reportsTab', 'employee')">Employee reports</div>
      <div class="tab ${t === 'exports' ? 'active' : ''}" onclick="setT('reportsTab', 'exports')">All exports</div>
    </div>
    ${rReportsContent(t)}
  </div>`;
}

function rReportsContent(t) {
  if (t === 'register') return `<div class="card" style="padding: 0;">
    <div style="padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
      <div class="font-semibold">Salary register · May 2026 · ${E[S.entity].name}</div>
      <button class="btn btn-sm" onclick="openM('export-register')"><i class="ti ti-download"></i> Excel</button>
    </div>
    <div style="overflow-x: auto;"><table class="inputs-table"><thead><tr><th>Employee</th><th class="right">CTC</th><th class="right">EMI</th><th class="right">Incentive</th><th class="right">Bonus</th><th class="right">OT</th><th class="right">Reimb</th><th class="right">Arrears</th><th class="right">Adjusted</th></tr></thead><tbody>
      ${EMP.filter(e => e.entity === S.entity).map(e => {
    const rT = reimbTotal(e.reimb);
    const aT = arrearsTotal(e.arrears);
    const adj = e.monthlyCTC + e.incentive + e.bonus + e.overtime + rT + aT - e.emi;
    return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td class="num-cell">${fmt(e.monthlyCTC)}</td><td class="num-cell ${e.emi > 0 ? 'text-red' : 'text-tertiary'}">${e.emi > 0 ? '-' + fmt(e.emi) : '—'}</td><td class="num-cell ${e.incentive > 0 ? 'text-green' : 'text-tertiary'}">${e.incentive > 0 ? '+' + fmt(e.incentive) : '—'}</td><td class="num-cell ${e.bonus > 0 ? 'text-green' : 'text-tertiary'}">${e.bonus > 0 ? '+' + fmt(e.bonus) : '—'}</td><td class="num-cell ${e.overtime > 0 ? 'text-green' : 'text-tertiary'}">${e.overtime > 0 ? '+' + fmt(e.overtime) : '—'}</td><td class="num-cell ${rT > 0 ? 'text-green' : 'text-tertiary'}">${rT > 0 ? '+' + fmt(rT) : '—'}</td><td class="num-cell">${aT !== 0 ? fmtS(aT) : '—'}</td><td class="num-cell"><b>${fmt(adj)}</b></td></tr>`;
  }).join('')}
    </tbody></table></div>
  </div>`;

  if (t === 'monthly') return `<div class="card">
    <div class="card-header"><div class="card-title">Monthly cost trend · 6 months</div></div>
    ${[['May 26', 12700000, false], ['Apr 26', 11375000, false], ['Mar 26', 14200000, true], ['Feb 26', 10900000, false], ['Jan 26', 10800000, false], ['Dec 25', 13900000, false]].map(x => `<div style="display: grid; grid-template-columns: 80px 1fr 120px 90px; gap: 12px; padding: 10px 0; align-items: center;"><div class="text-secondary">${x[0]}</div><div style="height: 14px; background: var(--surface-subtle); border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${x[1] / 15000000 * 100}%; background: var(--purple);"></div></div><div class="text-right font-semibold">${fmtL(x[1])}</div><div class="text-xs">${x[2] ? '<span class="pill pill-teal">+encash</span>' : ''}</div></div>`).join('')}
  </div>`;

  if (t === 'employee') return `<div class="card">
    <div class="card-header"><div class="card-title">Per-employee reports</div><p class="text-sm text-secondary">Annual tax documents fetched from the engine on demand.</p></div>
    ${EMP.filter(e => e.entity === S.entity).map(e => `<div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); align-items: center;"><div style="display: flex; gap: 10px; align-items: center;"><div class="avatar" style="background: var(--${e.avBg}-bg); color: var(--${e.avBg}-text);">${e.av}</div><div><b>${e.name}</b><div class="text-xs text-secondary">${e.id} · ${e.taxRegime === 'old' ? 'Old' : 'New'} regime</div></div></div><div style="display: flex; gap: 6px;"><button class="btn btn-sm" onclick="openM('form16-download', {empId: '${e.id}'})"><i class="ti ti-file-text"></i> Form 16</button><button class="btn btn-sm" onclick="openM('download-payslip', {empId: '${e.id}'})"><i class="ti ti-receipt"></i> Payslip</button><button class="btn btn-sm" onclick="openM('emp-report', {empId: '${e.id}'})">FY history</button></div></div>`).join('')}
  </div>`;

  if (t === 'exports') return `<div class="card">
    <div class="card-header"><div class="card-title">Available exports</div></div>
    ${[
      ['Salary register · monthly', 'All 11 input fields per employee', 'ti-file-spreadsheet', 'purple', 'salary-register'],
      ['Encashment register', 'Annual FY encashment by employee', 'ti-calendar-check', 'teal', 'encash-register'],
      ['Loan tracker', 'Active + completed loans', 'ti-cash', 'orange', 'loan-tracker'],
      ['F&F register', 'All exits with breakup', 'ti-door-exit', 'red', 'ff-register'],
      ['Form 16 · bulk', 'All employees · current FY (from engine)', 'ti-file-certificate', 'blue', 'form16-bulk'],
      ['Payslip archive', 'All employees · selected month (from engine)', 'ti-receipt', 'green', 'payslip-bulk'],
      ['Audit trail PDF', 'Signed compliance export', 'ti-history', 'green', 'audit-trail']
    ].map(x => `<div style="display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border); align-items: center;"><div class="stat-icon ${x[3]}" style="width: 38px; height: 38px;"><i class="ti ${x[2]}"></i></div><div style="flex: 1;"><div class="font-semibold">${x[0]}</div><div class="text-sm text-secondary">${x[1]}</div></div><button class="btn" onclick="openM('export-generate', {type: '${x[4]}', label: '${x[0]}'})"><i class="ti ti-download"></i> Generate</button></div>`).join('')}
  </div>`;

  return '';
}

// === ADMIN: SYNC HISTORY ===
function rSyncHistory() {
  const rows = getSyncHistoryRows();
  const allEntity = SYNC_HISTORY.filter(h => h.entity === S.entity);
  const completed = allEntity.filter(h => h.status === 'completed').length;
  const partial = allEntity.filter(h => h.status === 'partial').length;
  const failed = allEntity.filter(h => h.status === 'failed').length;
  const tab = S.syncHistoryTab;
  const tabs = [
    ['all', 'All'],
    ['employee', 'Employee'],
    ['lop', 'LOP'],
    ['encashment', 'Encashment'],
    ['loan', 'Loan'],
    ['separation', 'Separation']
  ];
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Sync History</h1>
        <p class="page-sub">${E[S.entity].name} | Employee, LOP, encashment, loan and separation syncs to greytHR</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        ${partial || failed ? `<button class="btn" onclick="nav('sync-errors')"><i class="ti ti-alert-circle"></i> View errors</button>` : ''}
        <button class="btn" onclick="openM('export-sync-history')"><i class="ti ti-download"></i> Export</button>
      </div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div>
        <b>Integration audit trail</b>
        Every batch sent to greytHR is logged here with record counts and outcome. Payroll processing, payslips and statutory remain in greytHR — this page tracks MySlice → greytHR handoffs only.
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-history"></i></div><div><div class="stat-label">Total runs</div><div class="stat-value">${allEntity.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Completed</div><div class="stat-value">${completed}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-alert-triangle"></i></div><div><div class="stat-label">Partial</div><div class="stat-value">${partial}</div></div></div>
      <div class="stat-tile"><div class="stat-icon ${failed ? 'red' : 'purple'}"><i class="ti ti-${failed ? 'x' : 'clock'}"></i></div><div><div class="stat-label">${failed ? 'Failed' : 'Showing'}</div><div class="stat-value">${failed || rows.length}</div></div></div>
    </div>
    <div class="card" style="padding: 12px 18px; margin-bottom: 16px;">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <span class="text-sm text-secondary">Type:</span>
        ${tabs.map(([id, label]) => `<button class="btn btn-sm ${tab === id ? 'btn-primary' : ''}" onclick="setT('syncHistoryTab', '${id}')">${label}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
        <div class="font-semibold">Sync runs</div>
        <div class="text-xs text-secondary mt-2">${rows.length} record${rows.length === 1 ? '' : 's'} · newest first</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="inputs-table">
          <thead>
            <tr>
              <th>Date / time</th>
              <th>Sync type</th>
              <th>Period / scope</th>
              <th class="center">Records</th>
              <th class="center">Success</th>
              <th class="center">Failed</th>
              <th>Triggered by</th>
              <th class="center">Status</th>
              <th class="center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(h => `<tr class="${h.failed > 0 ? 'flagged' : ''}">
              <td>
                <div class="font-semibold">${h.date}</div>
                <div class="text-xs text-secondary">${h.time}</div>
              </td>
              <td>
                <div class="font-semibold">${h.label}</div>
                <div class="text-xs text-mono text-secondary">${h.ref}</div>
              </td>
              <td class="text-sm">${h.period}</td>
              <td class="center-cell font-semibold">${h.total}</td>
              <td class="center-cell text-green">${h.success}</td>
              <td class="center-cell ${h.failed > 0 ? 'text-red font-semibold' : 'text-tertiary'}">${h.failed || '—'}</td>
              <td class="text-sm">${h.actor}</td>
              <td class="center-cell">${syncHistoryStatusPill(h.status)}</td>
              <td class="center-cell">
                <button class="btn btn-sm btn-icon-only" onclick="openM('sync-history-detail', {id:'${h.id}'})" title="View details"><i class="ti ti-eye"></i></button>
              </td>
            </tr>`).join('') : `<tr><td colspan="9" class="text-center text-secondary" style="padding:32px;">No sync runs for this filter.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// === ADMIN: SYNC ERRORS ===
function rSyncErrors() {
  const rows = getSyncErrorRows();
  const allOpen = SYNC_ERRORS.filter(e => e.entity === S.entity && !S.resolvedSyncErrors.includes(e.id));
  const critical = allOpen.filter(e => e.severity === 'critical').length;
  const employee = allOpen.filter(e => e.type === 'employee').length;
  const retryable = allOpen.filter(e => e.retryKind).length;
  const tab = S.syncErrorsTab;
  const tabs = [
    ['all', 'All'],
    ['employee', 'Employee'],
    ['lop', 'LOP'],
    ['encashment', 'Encashment'],
    ['separation', 'Separation']
  ];
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Sync Errors</h1>
        <p class="page-sub">${E[S.entity].name} | Failed greytHR synchronizations requiring correction or retry</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="nav('sync-history')"><i class="ti ti-history"></i> Sync history</button>
        ${retryable ? `<button class="btn btn-primary" onclick="retryAllSyncErrors()"><i class="ti ti-refresh"></i> Retry all</button>` : ''}
      </div>
    </div>
    ${allOpen.length ? `<div class="alert-banner alert-orange">
      <i class="ti ti-alert-triangle"></i>
      <div>
        <b>${allOpen.length} open error${allOpen.length === 1 ? '' : 's'}</b>
        ${critical ? critical + ' critical · ' : ''}Fix source data in MySlice (People, Shifts, Leave) then retry. Payroll processing in greytHR may be blocked for affected employees.
      </div>
    </div>` : `<div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div><b>No open sync errors</b>All greytHR handoffs for ${E[S.entity].name} are healthy.</div></div>`}
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-alert-circle"></i></div><div><div class="stat-label">Open errors</div><div class="stat-value">${allOpen.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-users"></i></div><div><div class="stat-label">Employee sync</div><div class="stat-value">${employee}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-refresh"></i></div><div><div class="stat-label">Retryable</div><div class="stat-value">${retryable}</div></div></div>
      <div class="stat-tile"><div class="stat-icon ${critical ? 'red' : 'green'}"><i class="ti ti-${critical ? 'alert-triangle' : 'check'}"></i></div><div><div class="stat-label">Critical</div><div class="stat-value">${critical}</div></div></div>
    </div>
    <div class="card" style="padding: 12px 18px; margin-bottom: 16px;">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <span class="text-sm text-secondary">Type:</span>
        ${tabs.map(([id, label]) => `<button class="btn btn-sm ${tab === id ? 'btn-primary' : ''}" onclick="setT('syncErrorsTab', '${id}')">${label}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="font-semibold">Open failures</div>
          <div class="text-xs text-secondary mt-2">${rows.length} error${rows.length === 1 ? '' : 's'} · newest first</div>
        </div>
        ${allOpen.length ? `<button class="btn btn-sm" onclick="openM('export-sync-errors')"><i class="ti ti-download"></i> Export</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="inputs-table">
          <thead>
            <tr>
              <th>Date / time</th>
              <th>Employee</th>
              <th>Sync type</th>
              <th>Scope</th>
              <th>Error</th>
              <th class="center">Severity</th>
              <th class="center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(e => `<tr class="flagged">
              <td>
                <div class="font-semibold">${e.date}</div>
                <div class="text-xs text-secondary">${e.time}</div>
              </td>
              <td>
                <div style="display:flex;gap:10px;align-items:center;">
                  <div class="avatar" style="width:30px;height:30px;font-size:11px;background:var(--${e.avBg}-bg);color:var(--${e.avBg}-text);">${e.av}</div>
                  <div>
                    <div class="font-semibold">${e.emp}</div>
                    <div class="text-xs text-secondary">${e.empId}</div>
                  </div>
                </div>
              </td>
              <td><span class="font-semibold">${syncHistoryTypeLabel(e.type)}</span>${e.batchRef ? `<div class="text-xs text-mono text-secondary">${e.batchRef}</div>` : ''}</td>
              <td class="text-sm">${e.scope}</td>
              <td class="text-sm"><span class="text-red">${e.reason}</span></td>
              <td class="center-cell">${syncErrorSeverityPill(e.severity)}</td>
              <td class="center-cell">
                <div style="display:flex;gap:4px;justify-content:center;">
                  <button class="btn btn-sm btn-icon-only" onclick="openM('sync-error-detail', {id:'${e.id}'})" title="Details"><i class="ti ti-eye"></i></button>
                  ${e.retryKind ? `<button class="btn btn-sm btn-icon-only" onclick="retrySyncError('${e.id}')" title="Retry"><i class="ti ti-refresh"></i></button>` : ''}
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="7" class="text-center text-secondary" style="padding:32px;">No open errors for this filter.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// === ADMIN: AUDIT LOG ===
function rAudit() {
  const t = S.auditTab;
  const filtered = t === 'all' ? AUD : AUD.filter(e => e.type === t);
  const grouped = {};
  filtered.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e); });
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Audit log</h1><p class="page-sub">All actions, system events, approvals, overrides</p></div>
      <div class="page-actions"><button class="btn" onclick="openM('export-audit')"><i class="ti ti-download"></i> Export PDF</button></div>
    </div>
    <div class="card" style="padding: 12px 18px;"><div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;"><span class="text-sm text-secondary">Filter:</span>${['all', 'action', 'system', 'approval', 'override', 'integration'].map(x => `<button class="btn btn-sm ${t === x ? 'btn-primary' : ''}" onclick="setT('auditTab', '${x}')">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></div>
    <div class="card">${Object.keys(grouped).map(d => `<div class="text-xs font-semibold text-secondary mt-3 mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">${d}</div><div class="timeline">${grouped[d].map(e => `<div class="timeline-event ${e.type === 'approval' ? 'green' : e.type === 'override' ? 'orange' : e.type === 'system' ? 'purple' : 'blue'}"><div class="timeline-dot"></div><div style="display: flex; justify-content: space-between; gap: 12px;"><div style="flex: 1;"><div class="timeline-title">${e.title} ${e.type === 'system' ? '<span class="pill pill-purple">System</span>' : e.type === 'override' ? '<span class="pill pill-orange">Override</span>' : e.type === 'approval' ? '<span class="pill pill-green">Approval</span>' : ''}</div><div class="timeline-meta"><b>${e.actor}</b> · ${e.meta}</div></div><div class="timeline-date">${e.time}</div></div></div>`).join('')}</div>`).join('')}</div>
  </div>`;
}

// === ADMIN: BATCH HISTORY ===
function rHistory() {
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Batch history</h1><p class="page-sub">Past batches sent to engine · approve, release, and generate bank files</p></div>
      <div class="page-actions">
        <button class="btn" onclick="openM('open-next-period')"><i class="ti ti-calendar-plus"></i> Open next period</button>
        <button class="btn" onclick="openM('approve-computed-payroll')"><i class="ti ti-shield-check"></i> Approve current</button>
        <button class="btn btn-primary" onclick="openM('generate-bank-file')"><i class="ti ti-cash-banknote"></i> Bank file</button>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Batches</div><div class="stat-value">${HISTORY.length}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-currency-rupee"></i></div><div><div class="stat-label">YTD CTC</div><div class="stat-value">${fmtL(HISTORY.reduce((s, h) => s + h.totalCTC, 0))}</div></div></div>
      <div class="stat-tile"><div class="stat-icon teal"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">YTD encashment</div><div class="stat-value">${fmt(HISTORY.reduce((s, h) => s + h.totalEncash, 0))}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-refresh"></i></div><div><div class="stat-label">Reversals</div><div class="stat-value">0</div></div></div>
    </div>
    <div class="card" style="padding: 0;">
      <div style="overflow-x: auto;"><table class="inputs-table">
        <thead><tr><th>Batch</th><th>Entity / Month</th><th class="center">Emp</th><th class="right">CTC</th><th class="right">EMI</th><th class="right">Inc</th><th class="right">Bonus</th><th class="right">Reimb</th><th class="right">Encash</th><th>Sent by</th><th></th></tr></thead>
        <tbody>${HISTORY.map((h, i) => `<tr ${h.hasEncashment ? 'style="background: var(--teal-bg);"' : ''}>
          <td class="text-mono text-secondary">${h.id}</td>
          <td><b>${E[h.entity].name.split(' ')[0]}</b><br><span class="text-xs text-secondary">${h.month}</span></td>
          <td class="center-cell">${h.empCount}</td>
          <td class="num-cell">${fmtL(h.totalCTC)}</td>
          <td class="num-cell text-red">-${fmt(h.totalEMI)}</td>
          <td class="num-cell text-green">+${fmt(h.totalIncentive)}</td>
          <td class="num-cell ${h.totalBonus > 0 ? 'text-green' : 'text-tertiary'}">${h.totalBonus > 0 ? '+' + fmt(h.totalBonus) : '—'}</td>
          <td class="num-cell ${h.totalReimb > 0 ? 'text-green' : 'text-tertiary'}">${h.totalReimb > 0 ? '+' + fmt(h.totalReimb) : '—'}</td>
          <td class="num-cell ${h.totalEncash > 0 ? 'text-teal font-bold' : 'text-tertiary'}" style="${h.totalEncash > 0 ? 'color: var(--teal-text);' : ''}">${h.totalEncash > 0 ? '+' + fmt(h.totalEncash) : '—'}</td>
          <td>${h.sentBy}<br><span class="text-xs text-secondary">${h.sentAt}</span></td>
          <td><button class="btn btn-sm" onclick="openM('batch-detail', {idx: ${i}})">View</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}
// === EMPLOYEE: DASHBOARD ===
function rEmpDash() {
  const me = getMe();
  const firstName = me.name.split(' ')[0];
  const myResignation = RESIGNATIONS.find(r => r.empId === me.id);
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Welcome, ${firstName}</h1><p class="page-sub">${me.role} · ${E[me.entity].name}</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="loginToGreytHRESS()"><i class="ti ti-external-link"></i> Open greytHR Portal</button></div>
    </div>
    <div class="alert-banner alert-blue">
      <i class="ti ti-info-circle"></i>
      <div><b>Payslips, Form 16, tax declarations and payroll documents</b> are available in the greytHR ESS portal. MySlice handles loans, resignation and sync to greytHR.</div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon teal"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">Leave balance</div><div class="stat-value">${me.leaveBalance}</div><div class="stat-meta">days in MySlice</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar-x"></i></div><div><div class="stat-label">LOP this month</div><div class="stat-value">${me.att.lop || 0}</div><div class="stat-meta">synced to greytHR</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-cash"></i></div><div><div class="stat-label">Active loan</div><div class="stat-value" style="font-size:14px">${me.hasActiveLoan ? 'Yes' : 'None'}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-door-exit"></i></div><div><div class="stat-label">Resignation</div><div class="stat-value" style="font-size:14px">${myResignation ? 'In progress' : 'None'}</div></div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-external-link"></i></span>greytHR Employee Self-Service</div></div>
          <p class="text-sm text-secondary mb-3">Passwordless login via SSO. Access payslips, IT declaration, IT statement, Form 16 and other payroll documents.</p>
          <div class="info-grid mb-3">
            <div><div class="field-label">greytHR ID</div><div class="field-value text-mono">${me.gretyId || 'Pending sync'}</div></div>
            <div><div class="field-label">Login method</div><div class="field-value">GUID / one-time token</div></div>
          </div>
          <button class="btn btn-primary" onclick="loginToGreytHRESS()"><i class="ti ti-login"></i> Login to ESS Portal</button>
        </div>
        ${me.hasActiveLoan ? `<div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-cash"></i></span>Active loan</div><span class="pill pill-green">EMI via greytHR</span></div>
          <p class="text-sm text-secondary mb-3">EMI is deducted by greytHR during payroll processing each month.</p>
          <button class="btn btn-sm" onclick="nav('loans')">View loan details</button>
        </div>` : ''}
      </div>
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-bolt"></i></span>Quick actions</div></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn" style="justify-content:flex-start;" onclick="nav('loans'); setT('showLoanRequest', true)"><i class="ti ti-plus"></i> Request a loan</button>
            <button class="btn" style="justify-content:flex-start;" onclick="nav('my-resignation')"><i class="ti ti-door-exit"></i> Submit / view resignation</button>
            <button class="btn" style="justify-content:flex-start;" onclick="loginToGreytHRESS()"><i class="ti ti-receipt"></i> View payslips in greytHR</button>
            <button class="btn" style="justify-content:flex-start;" onclick="openM('contact-hr')"><i class="ti ti-message"></i> Contact HR</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function rEmpGreytHRESS() {
  const me = getMe();
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">greytHR ESS Portal</h1><p class="page-sub">Passwordless SSO · ${me.name}</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="loginToGreytHRESS()"><i class="ti ti-login"></i> Login now</button></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-shield-lock"></i></span>How SSO works</div></div>
      <div class="ff-step done"><div class="ff-step-icon"><i class="ti ti-click"></i></div><div><div class="font-semibold">You click Login</div><div class="text-xs text-secondary">From MySlice employee portal</div></div></div>
      <div class="ff-step done"><div class="ff-step-icon"><i class="ti ti-api"></i></div><div><div class="font-semibold">MySlice calls greytHR SSO API</div><div class="text-xs text-secondary">POST /user/v2/users/{userid}/auth → GUID token</div></div></div>
      <div class="ff-step active"><div class="ff-step-icon"><i class="ti ti-external-link"></i></div><div><div class="font-semibold">Redirect to greytHR ESS</div><div class="text-xs text-secondary">No password required</div></div></div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Available in greytHR: IT Declaration, IT Statement, Payslips, Form 16, experience letters and other payroll documents.</div></div>
      <button class="btn btn-primary mt-3" onclick="loginToGreytHRESS()"><i class="ti ti-login"></i> Login to greytHR ESS Portal</button>
    </div>
  </div>`;
}

function rEmpResignation() {
  const me = getMe();
  const existing = RESIGNATIONS.find(r => r.empId === me.id);
  if (existing) {
    const idx = RESIGNATIONS.indexOf(existing);
    return `<div class="page">
      <div class="page-header"><div><h1 class="page-title">My resignation</h1><p class="page-sub">Status tracked in MySlice · F&F processed in greytHR</p></div></div>
      <div class="card">
        <div class="info-grid mb-3">
          <div><div class="field-label">Status</div><div class="field-value">${resignStatusPill(existing)}</div></div>
          <div><div class="field-label">Proposed LWD</div><div class="field-value">${existing.proposedLwd}</div></div>
          <div><div class="field-label">Reason</div><div class="field-value">${existing.reason}</div></div>
          <div><div class="field-label">Current step</div><div class="field-value">${RESIGN_STEPS[existing.currentStep - 1]?.label || '—'}</div></div>
        </div>
        ${rResignationStepper(existing, true)}
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Leave encashment is calculated in MySlice and pushed to greytHR. Final settlement is completed by Finance in greytHR.</div></div>
      </div>
    </div>`;
  }
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">Submit resignation</h1><p class="page-sub">Multi-level approval before separation sync to greytHR</p></div></div>
    <div class="card">
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Resignation date</label><input type="date" value="2026-05-17" /></div>
        <div class="field"><label class="field-label">Proposed last working date</label><input type="date" value="2026-06-16" /></div>
      </div>
      <div class="field"><label class="field-label">Reason</label><select><option>Better opportunity</option><option>Personal reasons</option><option>Relocation</option><option>Higher studies</option></select></div>
      <div class="field"><label class="field-label">Remarks</label><textarea rows="3" placeholder="Optional"></textarea></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>After submission: Manager approval → HR leave clearance → IT asset clearance → Final days sync → Separation in greytHR.</div></div>
      <button class="btn btn-primary mt-3" onclick="toast('Resignation submitted for manager approval')"><i class="ti ti-send"></i> Submit resignation</button>
    </div>
  </div>`;
}

// === EMPLOYEE: PAYROLL HISTORY ===
function rEmpPayroll() {
  const tab = ['salary-history', 'attendance'].includes(S.empTab) ? S.empTab : 'monthly';
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">My payroll history</h1><p class="page-sub">Every month's attendance, CTC, all adjustments, and salary changes</p></div>
    <div class="page-actions"><button class="btn" onclick="openM('emp-fy-download', {empId: 'EMP1003'})"><i class="ti ti-download"></i> Download FY 26-27</button><button class="btn btn-primary" onclick="openM('download-payslip', {empId: 'EMP1003'})"><i class="ti ti-receipt"></i> Latest payslip</button></div></div>
    <div class="tabs">
      <div class="tab ${tab === 'monthly' ? 'active' : ''}" onclick="setT('empTab', 'monthly')">Monthly history</div>
      <div class="tab ${tab === 'salary-history' ? 'active' : ''}" onclick="setT('empTab', 'salary-history')">Salary & hikes</div>
      <div class="tab ${tab === 'attendance' ? 'active' : ''}" onclick="setT('empTab', 'attendance')">Attendance</div>
    </div>
    ${tab === 'salary-history' ? `<div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-trending-up"></i></span>Your salary journey</div></div>
      <div class="timeline">${HIKES.map(h => `<div class="timeline-event ${h.type === 'Promotion' ? 'purple' : h.type === 'Joined' ? 'green' : 'blue'}"><div class="timeline-dot"></div><div class="timeline-title">${h.type}${h.pct !== null ? ' · +' + h.pct + '%' : ''}</div><div class="timeline-meta">${h.from > 0 ? fmtL(h.from) + ' → ' + fmtL(h.to) : 'Initial ' + fmtL(h.to)}${h.note ? ' · ' + h.note : ''}</div><div class="timeline-date">${h.date}</div></div>`).join('')}</div>
    </div>` : tab === 'attendance' ? `<div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Avg payable</div><div class="stat-value">28.9</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar-x"></i></div><div><div class="stat-label">Total LOP</div><div class="stat-value">${EMP_MONTHLY.reduce((s, m) => s + m.lop, 0)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-calendar-check"></i></div><div><div class="stat-label">Paid leave</div><div class="stat-value">${EMP_MONTHLY.reduce((s, m) => s + m.paid, 0)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon teal"><i class="ti ti-target"></i></div><div><div class="stat-label">Leave balance</div><div class="stat-value">8</div><div class="stat-meta">days</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar"></i></span>Monthly attendance</div></div>
      <table class="table">
        <thead><tr><th>Month</th><th>Distribution</th><th class="text-right">Worked</th><th class="text-right">Paid lv</th><th class="text-right">LOP</th><th class="text-right">Payable</th></tr></thead>
        <tbody>${EMP_MONTHLY.map(m => `<tr><td><b>${m.month}</b></td><td><div class="attendance-bar" style="width: 200px;"><div style="background: var(--green); flex: ${m.worked};"></div>${m.paid > 0 ? `<div style="background: var(--blue); flex: ${m.paid};"></div>` : ''}${m.lop > 0 ? `<div style="background: var(--orange); flex: ${m.lop};"></div>` : ''}<div style="background: var(--surface-subtle); flex: ${Math.max(0, 31 - m.worked - m.paid - m.lop)};"></div></div></td><td class="text-right">${m.worked}</td><td class="text-right">${m.paid}</td><td class="text-right ${m.lop > 0 ? 'text-red' : ''}">${m.lop || '—'}</td><td class="text-right"><b>${m.worked + m.paid}</b></td></tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="card" style="padding: 0;">
      <div style="padding: 14px 18px; border-bottom: 1px solid var(--border);"><div class="card-title"><span class="card-title-icon"><i class="ti ti-history"></i></span>Every month's inputs sent to engine · 11 fields</div></div>
      <div style="overflow-x: auto;"><table class="inputs-table">
        <thead><tr><th>Month</th><th class="center">Days</th><th class="right">CTC</th><th class="right">EMI</th><th class="right">Incentive</th><th class="right">Bonus</th><th class="right">OT</th><th class="right">Reimb</th><th class="right">Encash</th><th class="right">Arrears</th><th>Status</th><th></th></tr></thead>
        <tbody>${EMP_MONTHLY.map(m => `<tr ${m.hasEncashment ? 'style="background: var(--teal-bg);"' : ''}>
          <td><b>${m.month}</b>${m.hasEncashment ? '<br><span class="pill pill-teal" style="padding: 1px 5px; font-size: 9px;">+ encashment</span>' : ''}</td>
          <td class="center-cell">${m.worked + m.paid}${m.lop > 0 ? '<br><span class="text-xs text-secondary">+' + m.lop + ' LOP</span>' : ''}</td>
          <td class="num-cell">${fmt(m.monthlyCTC)}</td>
          <td class="num-cell ${m.emi > 0 ? 'text-red' : 'text-tertiary'}">${m.emi > 0 ? '-' + fmt(m.emi) : '—'}</td>
          <td class="num-cell ${m.incentive > 0 ? 'text-green' : 'text-tertiary'}">${m.incentive > 0 ? '+' + fmt(m.incentive) : '—'}</td>
          <td class="num-cell ${m.bonus > 0 ? 'text-green' : 'text-tertiary'}">${m.bonus > 0 ? '+' + fmt(m.bonus) : '—'}</td>
          <td class="num-cell ${m.overtime > 0 ? 'text-green' : 'text-tertiary'}">${m.overtime > 0 ? '+' + fmt(m.overtime) : '—'}</td>
          <td class="num-cell ${m.reimbTotal > 0 ? 'text-green' : 'text-tertiary'}">${m.reimbTotal > 0 ? '+' + fmt(m.reimbTotal) : '—'}</td>
          <td class="num-cell ${m.encashment > 0 ? 'font-bold' : 'text-tertiary'}" style="${m.encashment > 0 ? 'color: var(--teal-text);' : ''}">${m.encashment > 0 ? '+' + fmt(m.encashment) : '—'}</td>
          <td class="num-cell">${m.arrearsTotal !== 0 ? fmtS(m.arrearsTotal) : '—'}</td>
          <td>${m.status === 'paid' ? '<span class="pill pill-green">Paid</span>' : '<span class="pill pill-orange">Pending</span>'}</td>
          <td>${m.status === 'paid' ? `<button class="btn btn-sm" onclick="openM('download-payslip', {empId: 'EMP1003', month: '${m.month}'})"><i class="ti ti-receipt"></i></button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`}
  </div>`;
}

// === EMPLOYEE: MY LOANS ===
function rEmpLoans() {
  if (S.showLoanRequest) return rEmpLoanReq();
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">My loans</h1><p class="page-sub">Requests in MySlice · EMI applied by greytHR payroll</p></div>
    <div class="page-actions"><button class="btn btn-primary" onclick="setT('showLoanRequest', true)"><i class="ti ti-plus"></i> Request new loan</button></div></div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>On approval, loan is created in greytHR and EMI is deducted each payroll cycle. EMI must not exceed ${LOAN_EMI_MAX_PCT}% of salary.</div></div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-cash"></i></div><div><div class="stat-label">Active</div><div class="stat-value">1</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-arrow-down-right"></i></div><div><div class="stat-label">Outstanding</div><div class="stat-value">${fmt(16667)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-check"></i></div><div><div class="stat-label">Paid</div><div class="stat-value">4</div><div class="stat-meta">of 6</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Next EMI</div><div class="stat-value" style="font-size: 14px">1 Jun</div><div class="stat-meta">${fmt(8333)}</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-cash"></i></span>Active · Festival loan</div><span class="pill pill-green">On track</span></div>
      <div class="info-grid mb-3">
        <div><div class="field-label">Principal</div><div class="field-value">${fmt(50000)}</div></div>
        <div><div class="field-label">Tenure</div><div class="field-value">6 months</div></div>
        <div><div class="field-label">EMI</div><div class="field-value">${fmt(8333)}</div></div>
        <div><div class="field-label">Approved on</div><div class="field-value">28 Dec 2025</div></div>
      </div>
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span class="text-sm font-semibold">Progress</span><span class="text-sm text-secondary">${fmt(33333)} of ${fmt(50000)}</span></div>
        <div class="progress" style="height: 10px;"><div class="progress-fill" style="width: 67%"></div></div>
      </div>
      <div style="background: var(--surface-subtle); padding: 14px 16px; border-radius: 10px;">
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">EMI schedule</div>
        <table class="schedule-table">
          <thead><tr><th>Month</th><th class="num">EMI</th><th class="num">Outstanding</th><th>Status</th></tr></thead>
          <tbody>
            <tr class="paid"><td>Jan 2026</td><td class="num">${fmt(8333)}</td><td class="num">${fmt(41667)}</td><td><span class="pill pill-green">Paid</span></td></tr>
            <tr class="paid"><td>Feb 2026</td><td class="num">${fmt(8333)}</td><td class="num">${fmt(33333)}</td><td><span class="pill pill-green">Paid</span></td></tr>
            <tr class="paid"><td>Mar 2026</td><td class="num">${fmt(8333)}</td><td class="num">${fmt(25000)}</td><td><span class="pill pill-green">Paid</span></td></tr>
            <tr class="paid"><td>Apr 2026</td><td class="num">${fmt(8333)}</td><td class="num">${fmt(16667)}</td><td><span class="pill pill-green">Paid</span></td></tr>
            <tr class="current"><td>May 2026</td><td class="num">${fmt(8333)}</td><td class="num">${fmt(8334)}</td><td><span class="pill pill-orange">Processing</span></td></tr>
            <tr><td>Jun 2026</td><td class="num">${fmt(8334)}</td><td class="num">${fmt(0)}</td><td><span class="pill pill-gray">Upcoming</span></td></tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top: 14px; display: flex; gap: 8px;">
        <button class="btn" onclick="openM('download-loan-schedule')"><i class="ti ti-download"></i> Download schedule</button>
        <button class="btn" onclick="openM('foreclose-loan-emp')"><i class="ti ti-bolt"></i> Foreclose early</button>
      </div>
    </div>
  </div>`;
}

// === EMPLOYEE: LOAN REQUEST ===
function rEmpLoanReq() {
  const f = S.loanForm;
  const policy = {
    advance: { max: 64200, name: 'Salary advance', desc: 'Up to 50% take-home · 1-shot', icon: 'ti-coin', color: 'blue', tenures: [1] },
    festival: { max: 100000, name: 'Festival loan', desc: '3-6 months', icon: 'ti-gift', color: 'purple', tenures: [3, 4, 5, 6] },
    emergency: { max: 500000, name: 'Emergency loan', desc: '6-24 months', icon: 'ti-emergency-bed', color: 'red', tenures: [6, 12, 18, 24] }
  };
  const p = policy[f.type];
  const th = Math.round(getMe().monthlyCTC * 0.69);
  const emi = Math.round(f.amount / f.tenure);
  const pct = (emi / th) * 100;
  const eligible = pct <= LOAN_EMI_MAX_PCT && f.amount <= p.max;
  return `<div class="page">
    <div class="page-header"><div style="display: flex; gap: 14px; align-items: center;"><button class="icon-btn" onclick="setT('showLoanRequest', false)"><i class="ti ti-arrow-left"></i></button><div><h1 class="page-title">Request a loan</h1><p class="page-sub">Live eligibility check</p></div></div></div>
    <div class="two-col">
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-category"></i></span>1. Type</div></div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            ${Object.entries(policy).map(([k, v]) => `<div class="type-card ${f.type === k ? 'active' : ''}" onclick="setLoanForm('type', '${k}'); setLoanForm('amount', ${Math.min(v.max, k === 'festival' ? 60000 : k === 'advance' ? 40000 : 100000)}); setLoanForm('tenure', ${v.tenures[Math.floor(v.tenures.length / 2)]})"><div class="type-card-icon" style="background: var(--${v.color});"><i class="ti ${v.icon}" style="font-size: 18px;"></i></div><div><div class="font-semibold" style="font-size: 13px;">${v.name}</div><div class="text-xs text-secondary mt-2">${v.desc}</div><div class="text-xs text-tertiary mt-2">Max ${fmt(v.max)}</div></div></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-currency-rupee"></i></span>2. Amount & tenure</div></div>
          <div class="field">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><label class="field-label" style="margin: 0;">Amount</label><div class="font-bold" style="font-size: 18px;">${fmt(f.amount)}</div></div>
            <input type="range" min="${f.type === 'advance' ? 5000 : 10000}" max="${p.max}" step="5000" value="${f.amount}" oninput="setLoanForm('amount', parseInt(this.value))" />
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: var(--text-tertiary);"><span>${fmt(f.type === 'advance' ? 5000 : 10000)}</span><span>Max ${fmt(p.max)}</span></div>
          </div>
          <div class="field" style="margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><label class="field-label" style="margin: 0;">Tenure</label><div class="font-bold" style="font-size: 14px;">${f.tenure} ${f.tenure === 1 ? 'month' : 'months'}</div></div>
            <div style="display: grid; grid-template-columns: repeat(${p.tenures.length}, 1fr); gap: 6px;">${p.tenures.map(t => `<button class="tenure-btn ${f.tenure === t ? 'active' : ''}" onclick="setLoanForm('tenure', ${t})">${t} mo</button>`).join('')}</div>
          </div>
          <div class="field" style="margin-top: 16px;"><label class="field-label">Reason</label><textarea rows="3">Sister's wedding in July.</textarea></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calculator"></i></span>3. Preview</div></div>
          <div class="field-grid-4 mb-3">
            <div style="padding: 10px; background: var(--surface-subtle); border-radius: 8px;"><div class="field-label">Amount</div><div class="font-bold" style="font-size: 15px;">${fmt(f.amount)}</div></div>
            <div style="padding: 10px; background: var(--surface-subtle); border-radius: 8px;"><div class="field-label">Tenure</div><div class="font-bold" style="font-size: 15px;">${f.tenure} mo</div></div>
            <div style="padding: 10px; background: var(--surface-subtle); border-radius: 8px;"><div class="field-label">EMI</div><div class="font-bold" style="font-size: 15px;">${fmt(emi)}</div></div>
            <div style="padding: 10px; background: ${pct > LOAN_EMI_MAX_PCT ? 'var(--red-bg)' : 'var(--surface-subtle)'}; border-radius: 8px;"><div class="field-label">% salary</div><div class="font-bold ${pct > LOAN_EMI_MAX_PCT ? 'text-red' : ''}" style="font-size: 15px;">${pct.toFixed(1)}%</div></div>
          </div>
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-checkup-list"></i></span>Eligibility</div></div>
          <div class="check-row pass"><i class="ti ti-circle-check"></i><span>Tenure 4y 2m · meets 1y</span></div>
          <div class="check-row ${pct <= LOAN_EMI_MAX_PCT ? 'pass' : 'fail'}"><i class="ti ti-${pct <= LOAN_EMI_MAX_PCT ? 'circle-check' : 'circle-x'}"></i><span>EMI ${pct.toFixed(1)}% salary · ${pct <= LOAN_EMI_MAX_PCT ? 'OK' : 'over ' + LOAN_EMI_MAX_PCT + '%'}</span></div>
          <div class="check-row warn"><i class="ti ti-alert-circle"></i><span>1 active loan · ₹16,667 outstanding</span></div>
          <div class="check-row ${f.amount > 100000 ? 'warn' : 'pass'}"><i class="ti ti-${f.amount > 100000 ? 'alert-circle' : 'circle-check'}"></i><span>${f.amount > 100000 ? 'Amount > ₹1L · CEO approval' : 'Within HR threshold'}</span></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-route"></i></span>Approval flow</div></div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 10px; align-items: center;"><i class="ti ti-user-circle" style="color: var(--green); font-size: 18px;"></i><div style="font-size: 12px;"><b>You submit</b><div class="text-xs text-secondary">Today</div></div></div>
            <div style="display: flex; gap: 10px; align-items: center;"><i class="ti ti-shield-check" style="color: var(--purple); font-size: 18px;"></i><div style="font-size: 12px;"><b>Finance Admin reviews</b><div class="text-xs text-secondary">${f.amount > 100000 ? '+ CEO · 3 days' : '1-2 days'}</div></div></div>
            <div style="display: flex; gap: 10px; align-items: center;"><i class="ti ti-cash" style="color: var(--blue); font-size: 18px;"></i><div style="font-size: 12px;"><b>Created in greytHR</b><div class="text-xs text-secondary">EMI deducted in payroll</div></div></div>
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px;" onclick="openM('confirm-submit-loan', {type: '${p.name}', amount: ${f.amount}, tenure: ${f.tenure}, emi: ${emi}})" ${!eligible ? 'disabled style="opacity:0.5;width:100%;justify-content:center;padding:12px;"' : ''}><i class="ti ti-send"></i> Submit</button>
      </div>
    </div>
  </div>`;
}

// === EMPLOYEE: IT DECLARATION (Tax declaration) ===

// === EMPLOYEE: IT DECLARATION (v7 — proofs, approval workflow) ===

// === EMPLOYEE: TAX REGIME SELECTION ===
function rEmpRegime() {
  const me = getMe();
  const rs = getRegimeStatus(me.id);
  const fy = getFYWindow();
  const grossAnnual = me.monthlyCTC * 12;
  const itdec = getITDeclaration(me.id);
  const totApproved = totalITApproved(me.id);
  const taxOld = computeTaxOldRegime(grossAnnual, totApproved);
  const taxNew = computeTaxNewRegime(grossAnnual);
  const savingsOld = taxNew - taxOld;
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Tax regime · FY 2026-27</h1>
        <p class="page-sub">Choose how your income tax is calculated this financial year</p>
      </div>
      <div class="page-actions">
        ${rs.status === 'locked' && !rs.changeRequest ? `<button class="btn" onclick="openM('regime-request-change', {empId: '${me.id}'})"><i class="ti ti-refresh"></i> Request change</button>` : ''}
        ${rs.status === 'window_open' ? `<button class="btn btn-primary" onclick="openM('regime-select', {empId: '${me.id}'})"><i class="ti ti-check"></i> Confirm regime</button>` : ''}
      </div>
    </div>

    ${rs.status === 'window_open' ? `<div class="alert-banner alert-orange"><i class="ti ti-clock"></i><div><b>Selection window open until 30 Apr 2026</b>If you don't choose, the New regime applies by default (government default since FY 2023-24).</div></div>` : ''}

    ${rs.status === 'locked' && !rs.changeRequest ? `<div class="alert-banner alert-blue"><i class="ti ti-lock"></i><div><b>Your regime is locked for FY 2026-27</b>You selected <b>${rs.selectedRegime === 'old' ? 'Old' : 'New'} regime</b> on ${rs.selectedOn}. To change mid-year, raise a request — Finance Admin will review.</div></div>` : ''}

    ${rs.changeRequest ? `<div class="alert-banner alert-orange"><i class="ti ti-clock"></i><div><b>Change request pending admin approval</b>You requested switch from <b>${rs.changeRequest.fromRegime === 'old' ? 'Old' : 'New'}</b> to <b>${rs.changeRequest.toRegime === 'old' ? 'Old' : 'New'}</b> on ${rs.changeRequest.requestedOn}. <span class="text-secondary">Reason: ${rs.changeRequest.reason}</span></div></div>` : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="card ${rs.selectedRegime === 'old' ? '' : ''}" style="${rs.selectedRegime === 'old' ? 'border: 2px solid var(--purple);' : ''} padding: 24px;">
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div class="stat-icon purple" style="width: 40px; height: 40px;"><i class="ti ti-shield-check"></i></div>
          <div><div class="font-bold" style="font-size: 16px;">Old regime</div><div class="text-xs text-secondary">With all deductions & exemptions</div></div>
          ${rs.selectedRegime === 'old' ? '<span class="pill pill-purple" style="margin-left: auto;"><i class="ti ti-check"></i> Selected</span>' : ''}
        </div>
        <div style="background: var(--surface-subtle); padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <div class="text-xs font-semibold text-secondary" style="text-transform: uppercase; letter-spacing: 0.4px;">Your estimated annual tax</div>
          <div style="display: flex; align-items: baseline; gap: 8px;"><div class="font-bold" style="font-size: 24px; color: var(--purple-text);">${fmt(taxOld)}</div><div class="text-xs text-secondary">on ${fmt(grossAnnual)} CTC · with ${fmt(totApproved)} deductions</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Benefits</div>
        <ul style="font-size: 12px; padding-left: 20px; line-height: 1.7;">
          <li>Section 80C investments up to ₹1.5L</li>
          <li>Section 80D health insurance up to ₹50K</li>
          <li>HRA exemption (if paying rent)</li>
          <li>Section 24 home loan interest up to ₹2L</li>
          <li>Section 80CCD(1B) NPS up to ₹50K (extra)</li>
          <li>LTA exemption (2 trips per 4-yr block)</li>
          <li>Standard deduction ₹50,000</li>
        </ul>
        <div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform: uppercase; letter-spacing: 0.4px;">Trade-offs</div>
        <ul style="font-size: 12px; padding-left: 20px; line-height: 1.7;">
          <li>Higher slab rates than new regime</li>
          <li>Must submit proofs by Jan 15</li>
          <li>Year-end true-up if proofs don't match</li>
        </ul>
      </div>

      <div class="card" style="${rs.selectedRegime === 'new' ? 'border: 2px solid var(--blue);' : ''} padding: 24px;">
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div class="stat-icon blue" style="width: 40px; height: 40px;"><i class="ti ti-sparkles"></i></div>
          <div><div class="font-bold" style="font-size: 16px;">New regime <span class="pill pill-blue" style="padding: 1px 6px; font-size: 9px; margin-left: 6px;">Default</span></div><div class="text-xs text-secondary">Lower slabs, fewer deductions</div></div>
          ${rs.selectedRegime === 'new' ? '<span class="pill pill-blue" style="margin-left: auto;"><i class="ti ti-check"></i> Selected</span>' : ''}
        </div>
        <div style="background: var(--surface-subtle); padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <div class="text-xs font-semibold text-secondary" style="text-transform: uppercase; letter-spacing: 0.4px;">Your estimated annual tax</div>
          <div style="display: flex; align-items: baseline; gap: 8px;"><div class="font-bold" style="font-size: 24px; color: var(--blue-text);">${fmt(taxNew)}</div><div class="text-xs text-secondary">on ${fmt(grossAnnual)} CTC · no deductions</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Benefits</div>
        <ul style="font-size: 12px; padding-left: 20px; line-height: 1.7;">
          <li>Lower tax slabs at every level</li>
          <li>Standard deduction ₹75,000 (higher)</li>
          <li>Rebate u/s 87A up to ₹7L taxable</li>
          <li>No proof submission needed</li>
          <li>Employer NPS contribution (80CCD(2)) still allowed</li>
          <li>Simpler — no investment planning required</li>
        </ul>
        <div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform: uppercase; letter-spacing: 0.4px;">Trade-offs</div>
        <ul style="font-size: 12px; padding-left: 20px; line-height: 1.7;">
          <li>No 80C, 80D, HRA, home loan deductions</li>
          <li>FBP components mostly become taxable</li>
          <li>No LTA exemption</li>
        </ul>
      </div>
    </div>

    <div class="card" style="background: ${savingsOld > 0 ? 'var(--purple-bg)' : 'var(--blue-bg)'}; border-color: ${savingsOld > 0 ? 'var(--purple)' : 'var(--blue)'};">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-bulb"></i></span>Recommendation for you</div></div>
      <div style="display: flex; gap: 16px; align-items: center;">
        <div style="flex: 1;">
          <div class="font-bold" style="font-size: 16px; color: ${savingsOld > 0 ? 'var(--purple-text)' : 'var(--blue-text)'};">${savingsOld > 0 ? 'Old regime saves you ' + fmt(savingsOld) + ' annually' : 'New regime saves you ' + fmt(Math.abs(savingsOld)) + ' annually'}</div>
          <div class="text-sm text-secondary mt-2">${savingsOld > 0 ? 'Based on your declared deductions of ' + fmt(totApproved) + ', Old regime is cheaper.' : 'You do not have enough deductions to make Old regime worth it. Stick with New.'}</div>
          <div class="text-xs text-secondary mt-2"><i class="ti ti-info-circle"></i> Recommendation refines as you add more investments to your declaration.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-history"></i></span>Audit trail</div></div>
      ${rs.selectedOn ? `<div style="display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);">
        <div class="text-xs text-secondary" style="width: 100px;">${rs.selectedOn}</div>
        <div><b class="text-sm">Selected ${rs.selectedRegime === 'old' ? 'Old' : 'New'} regime for FY 2026-27</b><br><span class="text-xs text-secondary">By: ${me.name} · self-selected</span></div>
      </div>` : '<p class="text-sm text-secondary">No history yet. Selection window open.</p>'}
      ${rs.changeRequest ? `<div style="display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);">
        <div class="text-xs text-secondary" style="width: 100px;">${rs.changeRequest.requestedOn}</div>
        <div><b class="text-sm">Change request raised: ${rs.changeRequest.fromRegime === 'old' ? 'Old' : 'New'} → ${rs.changeRequest.toRegime === 'old' ? 'Old' : 'New'}</b><br><span class="text-xs text-secondary">Status: <span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Pending admin review</span></span></div>
      </div>` : ''}
    </div>
  </div>`;
}

// === EMPLOYEE: TAX DECLARATION (v8 — regime-aware, multi-tab) ===
function rEmpITDec() {
  const me = getMe();
  const rs = getRegimeStatus(me.id);
  const fy = getFYWindow();

  // If on New regime, show clean state
  if (rs.selectedRegime === 'new') {
    return rITDecNewRegime(me);
  }

  // If regime not yet selected, prompt
  if (!rs.selectedRegime) {
    return `<div class="page">
      <div class="page-header"><div><h1 class="page-title">Tax declaration</h1><p class="page-sub">Available for Old regime · select regime first</p></div></div>
      <div class="alert-banner alert-orange"><i class="ti ti-alert-circle"></i><div><b>Choose your tax regime first</b>Declarations are only relevant if you opt for Old regime. New regime employees don't need to declare investments.</div></div>
      <div class="card" style="padding: 24px; text-align: center;">
        <i class="ti ti-shield" style="font-size: 48px; color: var(--text-tertiary); display: block; margin-bottom: 12px;"></i>
        <div class="font-bold" style="font-size: 16px;">No regime selected for FY 2026-27</div>
        <p class="text-sm text-secondary mb-3 mt-2">Selection window: Apr 1 — Apr 30. Default after Apr 30: New regime.</p>
        <button class="btn btn-primary" onclick="nav('regime')"><i class="ti ti-arrow-right"></i> Go to Tax regime page</button>
      </div>
    </div>`;
  }

  // Old regime — full declaration UI with tabs
  const d = getITDeclaration(me.id);
  const tot = totalITDeclared(me.id);
  const totApproved = totalITApproved(me.id);
  const status = d.overallStatus;
  const slabSaving = Math.round(totApproved * 0.30);
  const statusPill = status === 'approved' ? '<span class="pill pill-green"><i class="ti ti-circle-check"></i> All approved</span>' :
    status === 'partially_approved' ? '<span class="pill pill-orange"><i class="ti ti-clock"></i> Partially approved</span>' :
      status === 'submitted' ? '<span class="pill pill-blue"><i class="ti ti-send"></i> Submitted · under review</span>' :
        status === 'rejected' ? '<span class="pill pill-red"><i class="ti ti-x"></i> Rejected · resubmit needed</span>' :
          status === 'locked' ? '<span class="pill pill-gray"><i class="ti ti-lock"></i> Locked for FY</span>' :
            status === 'draft' ? '<span class="pill pill-orange"><i class="ti ti-edit"></i> Draft</span>' :
              '<span class="pill pill-gray">Not started</span>';

  const tab = S.itdecTab || 'investments';
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Tax declaration · FY ${d.fy}</h1><p class="page-sub">Old regime · declare to optimize TDS · ${statusPill}</p></div>
      <div class="page-actions">
        ${status !== 'locked' && status !== 'approved' && status !== 'not_started' ? `<button class="btn" onclick="openM('itdec-save-draft', {empId: '${me.id}'})"><i class="ti ti-device-floppy"></i> Save draft</button>` : ''}
        ${status !== 'locked' ? `<button class="btn" onclick="openM('form12bb-download', {empId: '${me.id}'})"><i class="ti ti-file-download"></i> Form 12BB</button>` : ''}
        ${status !== 'locked' ? `<button class="btn btn-primary" onclick="openM('itdec-submit', {empId: '${me.id}'})"><i class="ti ti-send"></i> ${status === 'rejected' || status === 'partially_approved' ? 'Resubmit' : 'Submit declaration'}</button>` : ''}
      </div>
    </div>

    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Declarations are optional · they reduce your monthly TDS</b>Declare your planned investments → HR approves → engine recalculates TDS. Without declaration, full TDS is deducted; you can claim refund when filing ITR.</div></div>

    ${status === 'rejected' && d.rejectionNotes ? `<div class="alert-banner alert-red"><i class="ti ti-alert-circle"></i><div><b>Rejected by ${d.reviewedBy}</b>${d.rejectionNotes}</div></div>` : ''}
    ${status === 'partially_approved' && d.rejectionNotes ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-circle"></i><div><b>Partial approval · action needed</b>${d.rejectionNotes}</div></div>` : ''}
    ${fy.phase === 'proof_submission' ? `<div class="alert-banner alert-orange"><i class="ti ti-calendar"></i><div><b>Proof submission window · ends 15 Jan 2027</b>Upload actual proofs for declared investments. Engine will true-up TDS in Feb-Mar payroll.</div></div>` : ''}

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-receipt-tax"></i></div><div><div class="stat-label">Total declared</div><div class="stat-value">${fmt(tot.total)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Approved by HR</div><div class="stat-value">${fmt(totApproved)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-trending-down"></i></div><div><div class="stat-label">Tax saving (approved)</div><div class="stat-value">${fmt(slabSaving)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Proofs by</div><div class="stat-value" style="font-size: 13px;">15 Jan 2027</div></div></div>
    </div>

    <div class="card" style="padding: 0;">
      <div style="display: flex; border-bottom: 1px solid var(--border); padding: 0 4px;">
        <button class="tab-btn ${tab === 'investments' ? 'active' : ''}" onclick="setT('itdecTab', 'investments')"><i class="ti ti-pig-money"></i> Investments & deductions</button>
        <button class="tab-btn ${tab === 'other-income' ? 'active' : ''}" onclick="setT('itdecTab', 'other-income')"><i class="ti ti-coin"></i> Other income</button>
        <button class="tab-btn ${tab === 'lta' ? 'active' : ''}" onclick="setT('itdecTab', 'lta')"><i class="ti ti-plane"></i> LTA claims</button>
      </div>
      <div style="padding: 16px;">
        ${tab === 'investments' ? `${['80C', '80D', '80CCD_1B', '24', 'HRA', '80E', '80G', '80TTA'].map(sec => rITSection(me.id, sec, status)).join('')}` : ''}
        ${tab === 'other-income' ? rOtherIncomeSection(me.id, status) : ''}
        ${tab === 'lta' ? rLTASection(me.id, status) : ''}
      </div>
    </div>
  </div>`;
}

function rITDecNewRegime(me) {
  const grossAnnual = me.monthlyCTC * 12;
  const taxNew = computeTaxNewRegime(grossAnnual);
  const taxOldEmpty = computeTaxOldRegime(grossAnnual, 0);
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">Tax declaration · FY 2026-27</h1><p class="page-sub">New regime · no declarations needed</p></div></div>

    <div class="card" style="padding: 24px; background: var(--blue-bg); border-color: var(--blue);">
      <div style="display: flex; gap: 14px; align-items: flex-start;">
        <div class="stat-icon blue" style="width: 44px; height: 44px;"><i class="ti ti-sparkles"></i></div>
        <div style="flex: 1;">
          <div class="font-bold text-blue" style="font-size: 18px;">You're on New regime — nothing to declare</div>
          <p class="text-sm" style="margin-top: 8px; color: var(--blue-text);">The New regime gives you lower tax slabs and a higher standard deduction (₹75,000), but disallows most deductions — so there's no need to declare investments, submit rent receipts, or upload proofs.</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>What's automatically applied</div></div>
      <div style="display: grid; gap: 10px;">
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span class="text-sm">Standard deduction</span><b>₹75,000 / year</b></div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span class="text-sm">Rebate u/s 87A (if taxable income ≤ ₹7L)</span><b>Up to 100%</b></div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span class="text-sm">Employer NPS contribution · 80CCD(2)</span><b>Allowed</b></div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span class="text-sm">Meal coupons (if part of CTC)</span><b>Allowed</b></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-x"></i></span>What's NOT allowed (so don't bother declaring)</div></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${['Section 80C (PPF, ELSS, LIC, etc.)', 'Section 80D health insurance', 'HRA exemption', 'Section 24 home loan interest', 'Section 80CCD(1B) NPS extra', 'Section 80E education loan', 'Section 80G donations', 'LTA exemption', 'Most FBP allowances'].map(x => `<div style="display: flex; gap: 8px; align-items: center; padding: 8px; background: var(--surface-subtle); border-radius: 6px;"><i class="ti ti-x" style="color: var(--red); font-size: 16px;"></i><span class="text-sm">${x}</span></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-scale"></i></span>Would Old regime save you money?</div></div>
      <div class="info-grid">
        <div><div class="field-label">Your annual CTC</div><div class="field-value">${fmt(grossAnnual)}</div></div>
        <div><div class="field-label">Tax on New regime</div><div class="field-value text-blue">${fmt(taxNew)}</div></div>
        <div><div class="field-label">Tax on Old regime (zero deductions)</div><div class="field-value text-secondary">${fmt(taxOldEmpty)}</div></div>
        <div><div class="field-label">Difference</div><div class="field-value ${taxOldEmpty > taxNew ? 'text-green' : 'text-red'}">${taxOldEmpty > taxNew ? '+' : ''}${fmt(taxOldEmpty - taxNew)} ${taxOldEmpty > taxNew ? 'higher on Old' : 'lower on Old'}</div></div>
      </div>
      <p class="text-sm text-secondary mt-3"><i class="ti ti-info-circle"></i> Old regime would only beat New regime if you have substantial deductions (typically ₹3—4L combined: 80C maxed + 80D + HRA + home loan interest).</p>
      <button class="btn btn-primary mt-3" onclick="nav('regime')"><i class="ti ti-arrow-right"></i> Switch to Old regime</button>
    </div>
  </div>`;
}

function rITSection(empId, section, overallStatus) {
  const d = getITDeclaration(empId);
  const items = d.sections[section]?.items || [];
  const total = items.reduce((s, it) => s + (it.amount || 0), 0);
  const meta = {
    '80C': { label: 'Section 80C · Investments', icon: 'ti-pig-money', limit: 150000, hint: 'PPF, ELSS, LIC, ULIP, NSC, 5-yr FD, principal, tuition, Sukanya' },
    '80D': { label: 'Section 80D · Health insurance', icon: 'ti-heart-handshake', limit: 50000, hint: 'Self+family, parents, preventive check-up' },
    '80CCD_1B': { label: 'Section 80CCD(1B) · NPS', icon: 'ti-shield', limit: 50000, hint: 'Additional NPS Tier-1 over and above 80C' },
    '24': { label: 'Section 24 · Home loan interest', icon: 'ti-home', limit: 200000, hint: 'Self-occupied property limit ₹2L · let-out no limit' },
    'HRA': { label: 'HRA exemption', icon: 'ti-building', limit: null, hint: 'Monthly rent + landlord PAN if >₹1L annually' },
    '80E': { label: 'Section 80E · Education loan interest', icon: 'ti-school', limit: null, hint: 'No upper limit · 8 years from first repayment' },
    '80G': { label: 'Section 80G · Donations', icon: 'ti-heart', limit: null, hint: '50% or 100% deduction depending on donee' },
    '80TTA': { label: 'Section 80TTA · Savings interest', icon: 'ti-piggy-bank', limit: 10000, hint: 'Interest from savings bank accounts' }
  }[section];
  if (!meta) return '';
  const isOverLimit = meta.limit && total > meta.limit;
  return `<div class="card">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon"><i class="ti ${meta.icon}"></i></span>${meta.label}</div>
      <div>${meta.limit ? `<span class="font-bold ${total >= meta.limit ? 'text-green' : isOverLimit ? 'text-red' : ''}">${fmt(total)}</span> <span class="text-secondary text-xs">/ ${fmt(meta.limit)}</span>` : `<span class="font-bold">${fmt(total)}</span>`}</div>
    </div>
    <p class="text-xs text-secondary mb-3">${meta.hint}</p>
    ${meta.limit ? `<div class="progress mb-3" style="height: 6px;"><div class="progress-fill ${isOverLimit ? '' : total >= meta.limit ? '' : 'orange'}" style="${isOverLimit ? 'background: var(--red);' : ''} width: ${Math.min(100, total / meta.limit * 100)}%"></div></div>` : ''}
    ${isOverLimit ? `<div class="alert-banner alert-red" style="margin-bottom: 12px;"><i class="ti ti-alert-circle"></i><div>Amount exceeds annual limit of ₹${meta.limit.toLocaleString('en-IN')}. Excess won't be considered for tax computation.</div></div>` : ''}
    ${items.length === 0 ? `<p class="text-sm text-secondary" style="text-align: center; padding: 16px;">No declarations yet for this section.</p>` : items.map(it => `<div class="declared-card ${it.status}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="flex: 1;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <b class="text-sm">${it.subSection}</b>
            ${it.status === 'approved' ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;"><i class="ti ti-check"></i> Approved</span>' :
      it.status === 'rejected' ? '<span class="pill pill-red" style="padding: 1px 6px; font-size: 9px;"><i class="ti ti-x"></i> Rejected</span>' :
        it.status === 'pending' ? '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;"><i class="ti ti-clock"></i> Pending review</span>' :
          ''}
          </div>
          ${it.lender ? `<div class="text-xs text-secondary mt-2">Lender: ${it.lender} · ${it.propertyType}</div>` : ''}
          ${it.cityType ? `<div class="text-xs text-secondary mt-2">${it.cityType === 'metro' ? 'Metro (50% basic)' : 'Non-metro (40% basic)'} · Landlord PAN: ${it.landlordPan || 'pending'}</div>` : ''}
          <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
            ${it.proof ? `<span class="proof-tag ${it.proofStatus === 'verified' ? 'verified' : ''}"><i class="ti ti-paperclip"></i> ${it.proof}</span>` : '<span class="proof-tag missing"><i class="ti ti-alert-circle"></i> Proof missing</span>'}
          </div>
        </div>
        <div style="text-align: right;">
          <div class="font-bold" style="font-size: 16px;">${fmt(it.amount)}</div>
          ${overallStatus !== 'locked' && it.status !== 'approved' ? `<div style="display: flex; gap: 4px; margin-top: 6px;">
            <button class="btn btn-sm btn-icon-only" onclick="openM('itdec-edit-item', {empId: '${empId}', section: '${section}', itemId: '${it.id}'})" title="Edit"><i class="ti ti-pencil"></i></button>
            ${!it.proof ? `<button class="btn btn-sm btn-icon-only" onclick="openM('itdec-upload-proof', {empId: '${empId}', section: '${section}', itemId: '${it.id}'})" title="Upload proof"><i class="ti ti-upload"></i></button>` : ''}
            <button class="btn btn-sm btn-icon-only" onclick="openM('itdec-delete-item', {empId: '${empId}', section: '${section}', itemId: '${it.id}'})" title="Delete"><i class="ti ti-trash"></i></button>
          </div>` : ''}
        </div>
      </div>
    </div>`).join('')}
    ${overallStatus !== 'locked' && overallStatus !== 'approved' ? `<button class="btn btn-sm mt-2" onclick="openM('itdec-add-item', {empId: '${empId}', section: '${section}'})"><i class="ti ti-plus"></i> Add ${meta.label.split(' · ')[1] || 'item'}</button>` : ''}
  </div>`;
}

function rOtherIncomeSection(empId, status) {
  const oi = getOtherIncome(empId);
  return `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Declare income outside this salary</b>Previous employer income (mandatory if joined mid-FY), bank interest, rental income, dividends. Including these in declaration ensures TDS is right and avoids ITR shock.</div></div>
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-briefcase"></i></span>Previous employer income (Form 12B)</div></div>
      <p class="text-xs text-secondary mb-3">If you joined this FY, declare income from previous employer. They'll have issued Form 12B.</p>
      ${oi.items.filter(it => it.source === 'previous_employer').map(it => `<div class="declared-card ${it.status}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><b>${it.employerName}</b><br><span class="text-xs text-secondary">Gross: ${fmt(it.amount)} · TDS already deducted: ${fmt(it.tdsDeducted)}</span></div>
          <div style="text-align: right;"><span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Approved</span></div>
        </div>
      </div>`).join('')}
      ${status !== 'locked' ? `<button class="btn btn-sm" onclick="openM('other-income-add', {empId: '${empId}', source: 'previous_employer'})"><i class="ti ti-plus"></i> Add previous employer</button>` : ''}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-building-bank"></i></span>Interest income</div></div>
      <p class="text-xs text-secondary mb-3">Savings bank interest, FD interest. Note: ₹10K savings interest is deductible u/s 80TTA.</p>
      ${oi.items.filter(it => it.source === 'interest').map(it => `<div class="declared-card ${it.status}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><b>${it.label}</b></div>
          <div style="text-align: right;"><div class="font-bold">${fmt(it.amount)}</div></div>
        </div>
      </div>`).join('')}
      ${status !== 'locked' ? `<button class="btn btn-sm" onclick="openM('other-income-add', {empId: '${empId}', source: 'interest'})"><i class="ti ti-plus"></i> Add interest income</button>` : ''}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-home"></i></span>House property income</div></div>
      <p class="text-xs text-secondary mb-3">Rental income from a second house, or notional rent on let-out property. Section 24(b) interest deductible.</p>
      ${oi.items.filter(it => it.source === 'house_property').map(it => `<div class="declared-card ${it.status}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div><b>${it.label}</b><br><span class="text-xs text-secondary">Municipal tax: ${fmt(it.municipalTax || 0)} · Interest u/s 24(b): ${fmt(it.interest24b || 0)}</span></div>
          <div style="text-align: right;"><div class="font-bold">${fmt(it.amount)}</div></div>
        </div>
      </div>`).join('')}
      ${status !== 'locked' ? `<button class="btn btn-sm" onclick="openM('other-income-add', {empId: '${empId}', source: 'house_property'})"><i class="ti ti-plus"></i> Add house property income</button>` : ''}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-trending-up"></i></span>Other sources</div></div>
      <p class="text-xs text-secondary mb-3">Dividends, capital gains, freelance income, gifts. These will increase your TDS.</p>
      ${status !== 'locked' ? `<button class="btn btn-sm" onclick="openM('other-income-add', {empId: '${empId}', source: 'other'})"><i class="ti ti-plus"></i> Add other income</button>` : ''}
    </div>`;
}

function rLTASection(empId, status) {
  const lta = getLTAClaims(empId);
  const remaining = 2 - lta.journeysUsedInBlock;
  return `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>LTA exemption · 2 trips per 4-year block</b>Current block: ${lta.block}. You can claim exemption for 2 journeys within India. Air, rail, or road. Family included.</div></div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-calendar"></i></span>Block tracker · ${lta.block}</div></div>
      <div class="info-grid">
        <div><div class="field-label">Trips used in this block</div><div class="field-value">${lta.journeysUsedInBlock} / 2</div></div>
        <div><div class="field-label">Trips remaining</div><div class="field-value ${remaining > 0 ? 'text-green' : 'text-red'}">${remaining}</div></div>
        <div><div class="field-label">Carry forward from prev block</div><div class="field-value">${lta.prevBlockUnused > 0 ? lta.prevBlockUnused + ' trip' : '—'}</div></div>
        <div><div class="field-label">Block ends</div><div class="field-value">31 Dec 2029</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon"><i class="ti ti-plane"></i></span>Journeys claimed</div>
        ${status !== 'locked' && remaining > 0 ? `<button class="btn btn-sm" onclick="openM('lta-add-journey', {empId: '${empId}'})"><i class="ti ti-plus"></i> Add journey</button>` : ''}
      </div>
      ${lta.journeys.length === 0 ? '<p class="text-sm text-secondary" style="text-align: center; padding: 16px;">No LTA journeys claimed yet in this block.</p>' : lta.journeys.map(j => `<div class="declared-card ${j.status}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <b class="text-sm">${j.from} → ${j.to}</b>
              <span class="pill pill-blue" style="padding: 1px 6px; font-size: 9px;">${j.mode}</span>
              ${j.status === 'approved' ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;"><i class="ti ti-check"></i> Approved</span>' : '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Pending</span>'}
            </div>
            <div class="text-xs text-secondary mt-2">${j.travelDate} → ${j.returnDate} · ${j.familyMembers} traveller${j.familyMembers > 1 ? 's' : ''}</div>
            <div style="margin-top: 6px;"><span class="proof-tag verified"><i class="ti ti-paperclip"></i> ${j.proof}</span></div>
          </div>
          <div style="text-align: right;">
            <div class="font-bold">${fmt(j.amount)}</div>
            <div class="text-xs text-secondary">Claimed</div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
}

// === EMPLOYEE: FBP ALLOCATION (separate page) ===
function rEmpFBP() {
  const me = getMe();
  const rs = getRegimeStatus(me.id);
  const fbp = getFBPDeclaration(me.id);
  const allocated = fbp.items.reduce((s, it) => s + it.annual, 0);
  const remaining = fbp.annualEntitlement - allocated;
  const isNewRegime = rs.selectedRegime === 'new';
  const allFBPComponents = [
    { code: 'TEL_ALW', label: 'Telephone allowance', limit: 24000, exemptOnNew: false },
    { code: 'INT_REIMBURSEMENT', label: 'Internet allowance', limit: 24000, exemptOnNew: false },
    { code: 'LTA_REIMB', label: 'LTA', limit: 50000, exemptOnNew: false },
    { code: 'BOOKS_PERIODICAL', label: 'Books & periodicals', limit: 12000, exemptOnNew: false },
    { code: 'FM_A1600CC_REIMB', label: 'Fuel & maintenance', limit: 21600, exemptOnNew: false },
    { code: 'MEDICAL_REIMB', label: 'Medical reimbursement', limit: 15000, exemptOnNew: false },
    { code: 'MEAL_COUPON', label: 'Meal coupons (Sodexo)', limit: 26400, exemptOnNew: true },
    { code: 'UNIFORM_ALW', label: 'Uniform allowance', limit: 12000, exemptOnNew: true }
  ];
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">FBP allocation · FY ${fbp.fy}</h1><p class="page-sub">Split your annual flexi-pay across tax-exempt categories</p></div>
      <div class="page-actions">
        ${fbp.overallStatus !== 'approved' ? `<button class="btn" onclick="toast('Draft saved')"><i class="ti ti-device-floppy"></i> Save draft</button><button class="btn btn-primary" onclick="openM('fbp-declaration', {empId: '${me.id}'})"><i class="ti ti-send"></i> Submit for approval</button>` : ''}
      </div>
    </div>

    ${isNewRegime ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>You're on New regime — most FBP components become taxable</b>Telephone, internet, LTA, books, fuel, medical reimbursements lose their tax exemption on New regime. Only meal coupons and uniform allowance stay exempt. You can still allocate, but the tax benefit is minimal.</div></div>` : `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>How FBP works</b>Allocate annual amounts → HR approves → submit monthly bills against allocation → reimbursed in payroll as tax-exempt. Unused allocation becomes taxable at FY-end.</div></div>`}

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-target"></i></div><div><div class="stat-label">Annual entitlement</div><div class="stat-value">${fmt(fbp.annualEntitlement)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-arrow-down"></i></div><div><div class="stat-label">Allocated</div><div class="stat-value">${fmt(allocated)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Remaining</div><div class="stat-value">${fmt(remaining)}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-shield"></i></div><div><div class="stat-label">Status</div><div class="stat-value" style="font-size: 13px;">${fbp.overallStatus === 'approved' ? 'Approved' : fbp.overallStatus === 'submitted' ? 'Pending' : 'Not started'}</div></div></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-adjustments"></i></span>Component allocation</div></div>
      ${allFBPComponents.map(c => {
    const existing = fbp.items.find(it => it.component === c.code);
    const annual = existing ? existing.annual : 0;
    const status = existing ? existing.status : 'na';
    const isTaxableOnNew = isNewRegime && !c.exemptOnNew;
    return `<div style="display: grid; grid-template-columns: 1.5fr 130px 100px 120px; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); align-items: center; ${isTaxableOnNew ? 'opacity: 0.7;' : ''}">
          <div>
            <div style="display: flex; gap: 6px; align-items: center;"><b class="text-sm">${c.label}</b>${isTaxableOnNew ? '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Taxable on New</span>' : ''}${c.exemptOnNew ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Exempt on both</span>' : ''}</div>
            <div class="text-xs text-secondary">${c.code} · max ${fmt(c.limit)}/yr</div>
          </div>
          <input type="text" value="${annual > 0 ? annual.toLocaleString('en-IN') : ''}" placeholder="₹ annual" style="text-align: right;" />
          <div class="text-xs text-secondary text-right">${annual > 0 ? '~' + fmt(Math.round(annual / 12)) + '/mo' : '—'}</div>
          <div>${status === 'approved' ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Approved</span>' : status === 'pending' ? '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Pending</span>' : '<span class="pill pill-gray" style="padding: 1px 6px; font-size: 9px;">—</span>'}</div>
        </div>`;
  }).join('')}
      <div style="display: flex; justify-content: space-between; padding: 14px 0 0; font-weight: 700;">
        <span>Total allocated</span>
        <span class="${allocated > fbp.annualEntitlement ? 'text-red' : ''}">${fmt(allocated)} / ${fmt(fbp.annualEntitlement)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-info-circle"></i></span>How to use allocated FBP</div></div>
      <p class="text-sm">After your allocation is approved, go to <a onclick="nav('reimb')" style="color: var(--blue-text); cursor: pointer; font-weight: 600;">Reimbursement claims</a> and submit bills throughout the year. Each approved claim adds to next month's payroll as tax-exempt amount.</p>
    </div>
  </div>`;
}

// === EMPLOYEE: REIMBURSEMENT CLAIMS (refocused — bills only) ===
function rEmpReimb() {
  const me = getMe();
  const rs = getRegimeStatus(me.id);
  const fbp = getFBPDeclaration(me.id);
  const allocated = fbp.items.reduce((s, it) => s + it.annual, 0);
  const claims = [
    { id: 'RC-2026-04-01', category: 'Telephone', amount: 1200, billDate: '12 Apr 2026', status: 'paid', paidIn: 'Apr 2026 payroll', billRef: 'Airtel postpaid', proof: 'airtel-bill.pdf' },
    { id: 'RC-2026-04-02', category: 'Internet', amount: 2000, billDate: '15 Apr 2026', status: 'paid', paidIn: 'Apr 2026 payroll', billRef: 'ACT Fibernet', proof: 'act-bill.pdf' },
    { id: 'RC-2026-05-01', category: 'Books & periodicals', amount: 4500, billDate: '08 May 2026', status: 'pending_approval', paidIn: '—', billRef: 'OReilly subscription', proof: 'oreilly-invoice.pdf' },
    { id: 'RC-2026-05-02', category: 'Medical', amount: 8000, billDate: '12 May 2026', status: 'rejected', paidIn: '—', billRef: 'Apollo health checkup', proof: null, rejectionReason: 'Bill not in employee name. Please upload bill addressed to you.' },
    { id: 'RC-2026-03-01', category: 'Telephone', amount: 1100, billDate: '05 Mar 2026', status: 'paid', paidIn: 'Mar 2026 payroll', billRef: 'Airtel postpaid', proof: 'airtel-mar.pdf' }
  ];
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Reimbursement claims</h1><p class="page-sub">Submit monthly bills against your FBP allocation</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openM('reimb-submit-claim', {empId: '${me.id}'})" ${fbp.overallStatus !== 'approved' ? 'disabled style="opacity: 0.6;"' : ''}><i class="ti ti-plus"></i> Submit new claim</button>
      </div>
    </div>

    ${fbp.overallStatus !== 'approved' ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-circle"></i><div><b>FBP allocation not yet approved</b>You need approved FBP allocation before submitting bills. <a onclick="nav('fbp')" style="color: var(--blue-text); cursor: pointer; font-weight: 600;">Go to FBP allocation</a> to set it up.</div></div>` : `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>How this works</b>Upload bill → HR reviews → if approved, paid in next payroll as tax-exempt reimbursement against your FBP allocation.</div></div>`}

    <div class="card" style="padding: 0;">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div class="card-title"><span class="card-title-icon"><i class="ti ti-history"></i></span>My claims · FY 2026-27</div>
      </div>
      ${claims.map(c => `<div style="padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; gap: 14px; align-items: center;">
        <div style="flex: 1;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <b>${c.category}</b>
            ${c.status === 'paid' ? `<span class="pill pill-green"><i class="ti ti-check"></i> Paid · ${c.paidIn}</span>` :
      c.status === 'pending_approval' ? '<span class="pill pill-orange"><i class="ti ti-clock"></i> Pending HR</span>' :
        c.status === 'rejected' ? '<span class="pill pill-red"><i class="ti ti-x"></i> Rejected</span>' :
          '<span class="pill pill-red">Missing proof</span>'}
          </div>
          <div class="text-xs text-secondary mt-2">${c.id} · ${c.billRef} · ${c.billDate}</div>
          ${c.proof ? `<div style="margin-top: 6px;"><span class="proof-tag verified"><i class="ti ti-paperclip"></i> ${c.proof}</span></div>` : ''}
          ${c.status === 'rejected' && c.rejectionReason ? `<div class="text-xs text-red mt-2"><b>Why rejected:</b> ${c.rejectionReason}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div class="font-bold" style="font-size: 16px;">${fmt(c.amount)}</div>
          <div style="display: flex; gap: 4px; margin-top: 6px; justify-content: flex-end;">
            <button class="btn btn-sm" onclick="openM('reimb-claim-detail', {id: '${c.id}'})">View</button>
            ${c.status === 'rejected' ? `<button class="btn btn-sm btn-primary" onclick="openM('reimb-resubmit', {id: '${c.id}'})">Resubmit</button>` : ''}
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}
// === MODALS ===
// CRITICAL FIX: Modals look up data fresh from store using IDs, not from baked-in template values.
// This prevents the "modal not working" bug where ${e.name} got captured at render time of the source row.

const MODALS = {
  'send-to-engine': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const flag = emps.filter(e => e.flagged).length;
    const showEnc = showEncashmentColumn();
    const monthLabel = S.monthSel === '2026-03' ? 'Mar 2026 (FY-end)' : 'May 2026';
    const monthCode = S.monthSel + '-01';
    // Count total item codes across all employees
    const totalItems = emps.reduce((s, e) => s + buildGreytHRPayload(e, monthCode).length, 0);
    return {
      title: 'Send to greytHR · ' + monthLabel, icon: 'ti-send', large: true,
      body: `<p class="mb-3">Send <b>${monthLabel}</b> payroll inputs for <b>${E[S.entity].name}</b>. Each employee gets a separate greytHR sync call.</p>
        ${flag > 0 ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>${flag} flagged employee</b>Will sync with error status. Resolve and retry after batch.</div></div>` : ''}
        <div class="info-grid mt-3">
          <div><div class="field-label">Cycle</div><div class="field-value">${monthLabel}</div></div>
          <div><div class="field-label">Employees</div><div class="field-value">${emps.length}</div></div>
          <div><div class="field-label">API calls</div><div class="field-value">${emps.length} POST requests</div></div>
          <div><div class="field-label">Total item codes</div><div class="field-value">${totalItems}</div></div>
        </div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>After send, MySlice tracks success per employee. Failed employees stay in error state and can be retried individually.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button>${apiDetailsBtnInline('payroll-batch-sample', {})}<button class="btn btn-primary" onclick="closeM(); simulateSendBatch()"><i class="ti ti-send"></i> Send ${emps.length} POST requests</button>`
    };
  },

  'approve-loan': (d) => {
    const l = LOANS_PEND.find(x => x.id === d.loanId);
    if (!l) return { title: 'Approve loan', body: '<p>Loan not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Approve loan · ' + l.emp, icon: 'ti-check', large: true,
      body: `<div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div><b>Eligibility checks passed</b>EMI is ${Math.round(l.emi / l.monthlyTakeHome * 100)}% of salary (max ${LOAN_EMI_MAX_PCT}%). Approving creates the loan in greytHR; EMI is deducted in payroll.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Employee</div><div class="field-value">${l.emp}<br><span class="text-xs text-secondary">${l.empId}</span></div></div>
          <div><div class="field-label">Type</div><div class="field-value">${l.type}</div></div>
          <div><div class="field-label">Principal</div><div class="field-value">${fmt(l.amount)}</div></div>
          <div><div class="field-label">Tenure</div><div class="field-value">${l.tenure} months</div></div>
          <div><div class="field-label">Monthly EMI</div><div class="field-value">${fmt(l.emi)}</div></div>
          <div><div class="field-label">First deduction</div><div class="field-value">Jun 2026</div></div>
        </div>
        <div class="field mt-3"><label class="field-label">Approval note (audit trail)</label><textarea placeholder="Optional context..."></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-success" onclick="closeM(); toast('Loan approved · created in greytHR · EMI from Jun 2026')"><i class="ti ti-check"></i> Approve & create in greytHR</button>`
    };
  },

  'reject-loan': (d) => {
    const l = LOANS_PEND.find(x => x.id === d.loanId);
    const name = l ? l.emp : 'employee';
    return {
      title: 'Reject loan · ' + name, icon: 'ti-x',
      body: `<div class="field"><label class="field-label">Reason (visible to employee)</label><textarea rows="4" placeholder="Explain why..."></textarea></div>
        <div class="field"><label class="field-label">Suggested alternative</label><select><option>None</option><option>Smaller amount</option><option>Longer tenure</option><option>Reapply later</option></select></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Rejected · employee notified')">Reject</button>`
    };
  },

  'override-approve': (d) => {
    const l = LOANS_PEND.find(x => x.id === d.loanId);
    const name = l ? l.emp : 'employee';
    return {
      title: 'Override approve · ' + name, icon: 'ti-alert-triangle',
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Eligibility failed</b>Override will be logged as a policy exception.</div></div>
        <div class="field mt-3"><label class="field-label">Reason for override</label><textarea rows="4" placeholder="Required..."></textarea></div>
        <div class="field"><label class="field-label">Authorization</label><select><option>Finance Admin + CEO</option></select></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Approved with override')">Approve with override</button>`
    };
  },

  'view-emi-schedule': (d) => {
    const l = LOANS_PEND.find(x => x.id === d.loanId);
    if (!l) return { title: 'Schedule', body: '<p>Loan not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'EMI schedule preview · ' + l.emp, icon: 'ti-list', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Loan</div><div class="field-value">${l.type} · ${fmt(l.amount)}</div></div>
        <div><div class="field-label">Tenure</div><div class="field-value">${l.tenure} months</div></div>
        <div><div class="field-label">EMI</div><div class="field-value">${fmt(l.emi)}</div></div>
      </div>
      <table class="schedule-table"><thead><tr><th>Month</th><th class="num">EMI</th><th class="num">Outstanding</th></tr></thead><tbody>
        ${(function () { const months = ['Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27', 'Feb 27', 'Mar 27', 'Apr 27', 'May 27']; let o = l.amount; let r = ''; for (let i = 0; i < l.tenure; i++) { o -= l.emi; r += `<tr><td>${months[i]}</td><td class="num">${fmt(l.emi)}</td><td class="num text-secondary">${fmt(Math.max(0, o))}</td></tr>`; } return r; })()}
      </tbody></table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'active-loan-detail': (d) => {
    const l = LOANS_ACTIVE[d.idx];
    if (!l) return { title: 'Loan', body: '', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Active loan · ' + l.emp, icon: 'ti-cash', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${l.emp}<br><span class="text-xs text-secondary">${l.empId} · ${l.entity}</span></div></div>
        <div><div class="field-label">Type</div><div class="field-value">${l.type}</div></div>
        <div><div class="field-label">Principal</div><div class="field-value">${fmt(l.principal)}</div></div>
        <div><div class="field-label">EMI</div><div class="field-value">${fmt(l.emi)}</div></div>
        <div><div class="field-label">Paid</div><div class="field-value">${l.paid} of ${l.total}</div></div>
        <div><div class="field-label">Outstanding</div><div class="field-value">${fmt(l.outstanding)}</div></div>
      </div>
      <table class="schedule-table"><thead><tr><th>#</th><th class="num">EMI</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>
        ${(function () { let o = l.principal; let r = ''; for (let i = 1; i <= l.total; i++) { o -= l.emi; const p = i <= l.paid, c = i === l.paid + 1; r += `<tr class="${p ? 'paid' : c ? 'current' : ''}"><td>${i}</td><td class="num">${fmt(l.emi)}</td><td class="num">${fmt(Math.max(0, o))}</td><td>${p ? '<span class="pill pill-green">Paid</span>' : c ? '<span class="pill pill-orange">Processing</span>' : '<span class="pill pill-gray">Upcoming</span>'}</td></tr>`; } return r; })()}
      </tbody></table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'loan-schedule': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const l = LOANS_ACTIVE.find(x => x.empId === d.empId);
    if (!l) return { title: 'Loan schedule', body: '<p>No active loan.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Loan schedule · ' + l.emp, icon: 'ti-list', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Type</div><div class="field-value">${l.type}</div></div>
        <div><div class="field-label">EMI</div><div class="field-value">${fmt(l.emi)}</div></div>
        <div><div class="field-label">Outstanding</div><div class="field-value">${fmt(l.outstanding)}</div></div>
      </div>
      <table class="schedule-table"><thead><tr><th>#</th><th class="num">EMI</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>
        ${(function () { let o = l.principal; let r = ''; for (let i = 1; i <= l.total; i++) { o -= l.emi; const p = i <= l.paid, c = i === l.paid + 1; r += `<tr class="${p ? 'paid' : c ? 'current' : ''}"><td>${i}</td><td class="num">${fmt(l.emi)}</td><td class="num">${fmt(Math.max(0, o))}</td><td>${p ? '<span class="pill pill-green">Paid</span>' : c ? '<span class="pill pill-orange">Processing</span>' : '<span class="pill pill-gray">Upcoming</span>'}</td></tr>`; } return r; })()}
      </tbody></table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'foreclose-loan': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    return {
      title: 'Foreclose loan' + (e ? ' · ' + e.name : ''), icon: 'ti-bolt',
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>HR-initiated foreclosure. Outstanding balance recovered in next month's payroll.</div></div>
        <div class="field mt-3"><label class="field-label">Reason</label><textarea placeholder="Optional"></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Foreclosure initiated')">Initiate</button>`
    };
  },

  'foreclose-loan-emp': () => ({
    title: 'Foreclose loan early', icon: 'ti-bolt',
    body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Pay off remaining ₹16,667 in one go. Deducted from next month's salary. Goes to HR for approval.</div></div>
      <div class="field mt-3"><label class="field-label">Reason for early closure</label><textarea placeholder="Optional"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Submitted to HR')">Submit</button>`
  }),

  'hold-salary': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    return {
      title: 'Hold salary' + (e ? ' · ' + e.name : ''), icon: 'ti-pause',
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Payroll computed normally. Bank transfer blocked. For notice period, missing details, investigation.</div></div>
        <div class="field mt-3"><label class="field-label">Reason</label><select><option>Notice period serving</option><option>Missing bank details</option><option>Under investigation</option><option>Pending resignation acceptance</option></select></div>
        <div class="field"><label class="field-label">Expected release date</label><input type="date" /></div>
        <div class="field"><label class="field-label">Justification</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Hold applied')">Apply hold</button>`
    };
  },

  'stop-salary': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    return {
      title: 'Stop salary' + (e ? ' · ' + e.name : ''), icon: 'ti-player-stop',
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div>Excluded from payroll runs entirely. For absconding, long LWP, maternity LWP.</div></div>
        <div class="field mt-3"><label class="field-label">Reason</label><select><option>Absconding</option><option>Long unpaid leave</option><option>Maternity LWP</option><option>Sabbatical (unpaid)</option></select></div>
        <div class="field"><label class="field-label">Effective from</label><input type="date" value="2026-06-01" /></div>
        <div class="field"><label class="field-label">Expected return</label><input type="date" /></div>
        <div class="field"><label class="field-label">Justification</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Salary stopped')">Stop salary</button>`
    };
  },

  'initiate-ff': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    const lb = e ? e.leaveBalance : 0;
    const ten = e ? e.tenure : '';
    const loanInfo = e ? LOANS_ACTIVE.find(l => l.empId === e.id) : null;
    return {
      title: 'Initiate F&F · ' + name, icon: 'ti-door-exit', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-clock"></i><div><b>Legal deadline · 2 working days from LWD</b>Per Wages Code 2019. Settlement includes leave encashment (regardless of monthly encashment policy), gratuity if eligible, notice/loan recovery.</div></div>
        <div class="field-grid-2 mt-3">
          <div class="field"><label class="field-label">Last working day</label><input type="date" /></div>
          <div class="field"><label class="field-label">Reason</label><select><option>Resignation</option><option>Termination</option><option>Absconding</option><option>End of contract</option><option>Retirement</option><option>Death</option></select></div>
        </div>
        <div class="field"><label class="field-label">Notice period status</label><select><option>Full notice served</option><option>Partial · recover shortfall</option><option>Notice waived</option><option>Garden leave</option></select></div>
        <div class="field-grid-3">
          <div><div class="field-label">Leave balance</div><div class="field-value text-blue">${lb} days</div></div>
          <div><div class="field-label">Tenure</div><div class="field-value">${ten}</div></div>
          <div><div class="field-label">Loan outstanding</div><div class="field-value ${loanInfo ? 'text-red' : ''}">${loanInfo ? fmt(loanInfo.outstanding) : 'None'}</div></div>
        </div>
        <div class="field"><label class="field-label">Notes</label><textarea></textarea></div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>F&F preview auto-calculated next. You can adjust before processing.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); nav('resignation'); toast('Offboarding started for ${name}')"><i class="ti ti-arrow-right"></i> Start offboarding</button>`
    };
  },

  'initiate-ff-pick': () => ({
    title: 'Select employee for F&F', icon: 'ti-user-x',
    body: `<div class="field"><label class="field-label">Employee</label><select id="ff-pick"><option>Select...</option>${EMP.map(e => `<option value="${e.id}">${e.name} · ${e.id} · ${e.entity}</option>`).join('')}</select></div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Next: LWD, reason, notice status.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); openM('initiate-ff', {empId: 'EMP1003'})">Continue</button>`
  }),

  'ff-detail': (d) => {
    const f = FF_ACTIVE[d.idx];
    if (!f) return { title: 'F&F', body: '<p>F&F not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'F&F detail · ' + f.emp, icon: 'ti-door-exit', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${f.emp}<br><span class="text-xs text-secondary">${f.empId}</span></div></div>
        <div><div class="field-label">LWD</div><div class="field-value">${f.lwd}</div></div>
        <div><div class="field-label">Reason</div><div class="field-value">${f.reason}</div></div>
        <div><div class="field-label">Status</div><div class="field-value">${f.status === 'on_hold' ? '<span class="pill pill-red">On hold</span>' : '<span class="pill pill-orange">In progress</span>'}</div></div>
      </div>
      <div class="text-xs font-semibold text-secondary mb-2 mt-4" style="text-transform: uppercase; letter-spacing: 0.4px;">Workflow stages</div>
      <div class="ff-step done"><div class="ff-step-icon"><i class="ti ti-check"></i></div><div><div class="font-semibold">Initiated</div><div class="text-xs text-secondary">10 May · Priya Sharma</div></div></div>
      <div class="ff-step ${f.stage === 'calculation' ? 'active' : 'done'}"><div class="ff-step-icon"><i class="ti ti-${f.stage === 'calculation' ? 'arrow-right' : 'check'}"></i></div><div><div class="font-semibold">Calculation</div><div class="text-xs text-secondary">${f.stage === 'calculation' ? 'In progress' : 'Done'}</div></div></div>
      <div class="ff-step pending"><div class="ff-step-icon"><i class="ti ti-circle"></i></div><div><div class="font-semibold">Approval</div><div class="text-xs text-secondary">Pending CEO sign-off</div></div></div>
      <div class="ff-step pending"><div class="ff-step-icon"><i class="ti ti-circle"></i></div><div><div class="font-semibold">Process settlement</div><div class="text-xs text-secondary">Send to engine + bank transfer</div></div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); openM('ff-edit-calc', {idx: ${d.idx}})">Edit calculation</button>`
    };
  },

  'ff-edit-calc': (d) => {
    const f = FF_ACTIVE[d.idx];
    const name = f ? f.emp : 'employee';
    const lb = f ? f.leaveBalance : 0;
    return {
      title: 'Adjust F&F · ' + name, icon: 'ti-edit', large: true,
      body: `<p class="mb-3 text-sm text-secondary">Override line items. All changes audit-logged.</p>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Leave balance (days)</label><input type="number" value="${lb}" /></div>
          <div class="field"><label class="field-label">Encashment rate</label><select><option>Basic salary</option><option>Gross salary</option></select></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Notice shortfall (₹)</label><input type="number" value="0" /></div>
          <div class="field"><label class="field-label">Gratuity (manual override)</label><input type="number" value="0" placeholder="Auto if 5y+" /></div>
        </div>
        <div class="field"><label class="field-label">Additional deduction</label><input type="number" placeholder="Equipment, unrecovered advance, etc." /></div>
        <div class="field"><label class="field-label">Ex-gratia</label><input type="number" placeholder="Optional goodwill" /></div>
        <div class="field"><label class="field-label">Justification</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('F&F calculation updated')">Save</button>`
    };
  },

  'ff-process': (d) => {
    const f = FF_ACTIVE[d.idx];
    const name = f ? f.emp : 'employee';
    return {
      title: 'Process F&F · ' + name, icon: 'ti-send', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Final action</b>Sends the F&F settlement items (NOTICE_RECOVERY, GRATUITY, LEAVE_ENCASHMENT) to the engine as part of this employee's final payroll, with the LWD applied. Triggers bank transfer of net amount. Cannot be undone.</div></div>
        <div style="background: var(--blue-bg); padding: 16px 18px; border-radius: 10px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div class="text-blue font-semibold">Net settlement to bank</div>
          <div class="text-blue font-bold" style="font-size: 22px;">${fmt(d.net)}</div>
        </div>
        <div class="field mt-3"><label class="field-label">Final approver</label><select><option>Finance Admin + CEO sign-off</option></select></div>
        <div class="field"><label class="field-label">Settlement note</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('F&F sent to engine · bank transfer queued')"><i class="ti ti-send"></i> Process</button>`
    };
  },

  'ff-resolve-hold': (d) => {
    const f = FF_ACTIVE[d.idx];
    const name = f ? f.emp : 'employee';
    return {
      title: 'Resolve hold · ' + name, icon: 'ti-alert-circle',
      body: `<p class="mb-3">F&F is on hold pending investigation.</p>
        <div class="field"><label class="field-label">Resolution</label><select><option>Proceed with termination F&F</option><option>Mark as absconding · no F&F payout</option><option>Continue investigation</option></select></div>
        <div class="field"><label class="field-label">Notes</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Resolution applied')">Apply</button>`
    };
  },

  'revise-salary': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    const currentCTC = e ? e.monthlyCTC : 0;
    return {
      title: 'Revise CTC · ' + name, icon: 'ti-trending-up', large: true,
      body: `<div class="field-grid-2">
        <div class="field"><label class="field-label">Type</label><select><option>Annual hike</option><option>Promotion</option><option>Off-cycle adjustment</option><option>Market correction</option></select></div>
        <div class="field"><label class="field-label">Effective from</label><input type="date" value="2026-06-01" /></div>
      </div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Current monthly CTC</label><div class="field-value mt-2">${fmt(currentCTC)}</div></div>
        <div class="field"><label class="field-label">New monthly CTC</label><input type="text" placeholder="₹" /></div>
      </div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Current annual</label><div class="field-value mt-2">${fmtL(currentCTC * 12)}</div></div>
        <div class="field"><label class="field-label">Hike %</label><div class="field-value mt-2 text-tertiary">Auto-computed</div></div>
      </div>
      <div class="field"><label class="field-label">Justification</label><textarea placeholder="Performance basis, market reference, promotion notes..."></textarea></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>New CTC applies from next month's payroll inputs. Audit-logged with approver, justification, and old/new values.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Revision saved · effective Jun 2026')">Save revision</button>`
    };
  },

  'emp-setup': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Setup', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Edit setup · ' + e.name, icon: 'ti-settings',
      body: `<div class="field-grid-2">
        <div class="field"><label class="field-label">Monthly CTC</label><input type="text" value="${e.monthlyCTC.toLocaleString('en-IN')}" /></div>
        <div class="field"><label class="field-label">Annual CTC (auto)</label><div class="field-value mt-2 text-secondary">${fmtL(e.monthlyCTC * 12)}</div></div>
      </div>
      <div class="field"><label class="field-label">PF applicable</label><div style="display: flex; gap: 12px; padding: 10px 14px; background: var(--surface-subtle); border-radius: 8px; align-items: center;"><label class="toggle"><input type="checkbox" ${e.pf ? 'checked' : ''} /><span class="toggle-slider"></span></label><div style="flex: 1;"><div class="font-semibold text-sm">${e.pf ? 'With PF' : 'Without PF'}</div><div class="text-xs text-secondary">Sent as IS_PF_ELIGIBLE (id 107)</div></div></div></div>
      <div class="field"><label class="field-label">Tax regime</label><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><div class="policy-option ${e.taxRegime === 'new' ? 'active' : ''}" style="padding: 12px;"><div class="policy-radio"></div><div><div class="font-semibold text-sm">New regime (default)</div><div class="text-xs text-secondary">Lower rates, no deductions · TAX_REGIME = 2</div></div></div><div class="policy-option ${e.taxRegime === 'old' ? 'active' : ''}" style="padding: 12px;"><div class="policy-radio"></div><div><div class="font-semibold text-sm">Old regime</div><div class="text-xs text-secondary">80C, HRA, etc. exemptions · TAX_REGIME = 1</div></div></div></div></div>
      <div class="field"><label class="field-label">greytHR employee ID</label><input type="text" value="${e.gretyId}" /></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Changes take effect from next payroll cycle. PT auto-computed by greytHR using work state (${e.workState}).</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('Setup saved for ${e.name}')">Save</button>`
    };
  },

  'add-employee': () => ({
    title: 'Add employee to payroll', icon: 'ti-user-plus', large: true,
    body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Sets up payroll inputs only. Personal details from MySlice People.</div></div>
      <div class="field"><label class="field-label">Employee</label><select><option>Select from MySlice People...</option><option>EMP1098 · new joiner</option></select></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Monthly CTC</label><input type="text" placeholder="₹" /></div>
        <div class="field"><label class="field-label">PF applicable</label><select><option>With PF</option><option>Without PF</option></select></div>
      </div>
      <div class="field"><label class="field-label">greytHR employee ID</label><input type="text" placeholder="e.g., GHR-PRM-1098" /></div>
      <div class="field"><label class="field-label">Effective from</label><input type="date" value="2026-06-01" /></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Employee added · appears next month')">Add</button>`
  }),

  'bulk-import': () => ({
    title: 'Bulk import employees', icon: 'ti-upload',
    body: `<div style="padding: 24px; border: 2px dashed var(--border); border-radius: 10px; text-align: center;"><i class="ti ti-upload" style="font-size: 32px; color: var(--text-tertiary);"></i><div class="font-semibold mt-2">Drop .xlsx or .csv</div><div class="text-sm text-secondary mt-2">Up to 10MB</div></div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div><b>Required columns</b>Employee ID, Monthly CTC, PF (Yes/No), greytHR ID, Effective from</div></div>
      <div class="mt-3"><a href="#" style="font-size: 13px; color: var(--blue);"><i class="ti ti-download"></i> Download template</a></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Import started')">Import</button>`
  }),

  'bulk-incentive': () => ({
    title: 'Bulk add incentive or bonus', icon: 'ti-stack',
    body: `<p class="text-sm text-secondary mb-3">Add the same amount to multiple employees. Bonuses are sent with the correct greytHR item code based on type.</p>
      <div class="field"><label class="field-label">Apply to</label><select><option>All employees in entity</option><option>Senior band only</option><option>Mid band only</option><option>Selected employees</option></select></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Category</label><select><option value="incentive">Incentive (INCENTIVE · id 97)</option><option value="bonus">Bonus (typed · see below)</option></select></div>
        <div class="field"><label class="field-label">Amount each</label><input type="text" placeholder="₹" /></div>
      </div>
      <div class="field"><label class="field-label">Bonus type (if Bonus)</label><select>
        ${Object.entries(BONUS_TYPES).map(([k, v]) => `<option value="${k}">${v.label} (${v.code} · id ${GREYTHR_ITEM_CODES[v.code].id})</option>`).join('')}
      </select></div>
      <div class="field"><label class="field-label">Description (on payslip)</label><input type="text" placeholder="Q1 incentive 2026" /></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Each bonus type has distinct tax treatment. Joining/relocation bonuses may be subject to clawback if employee leaves within X months — track separately in MySlice.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Applied to ' + EMP.filter(e => e.entity === S.entity).length + ' employees')">Apply</button>`
  }),

  'refresh-attendance': () => ({
    title: 'Refresh attendance from Shifts', icon: 'ti-refresh',
    body: `<p class="mb-3">Pulls latest attendance from MySlice Shifts for the selected month.</p>
      <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This overwrites current values</b>Manual edits to worked days, paid leave, LOP will be replaced.</div></div>
      <div class="info-grid mt-3">
        <div><div class="field-label">Last refresh</div><div class="field-value">14 May, 11:22</div></div>
        <div><div class="field-label">Source</div><div class="field-value">MySlice Shifts</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Attendance refreshed')">Refresh</button>`
  }),

  'hr-new-loan': (d) => {
    const e = d.empId ? EMP.find(x => x.id === d.empId) : null;
    return {
      title: 'HR-created loan' + (e ? ' · ' + e.name : ''), icon: 'ti-plus', large: true,
      body: `<p class="mb-3 text-sm text-secondary">Bypass employee request flow. Creates loan directly.</p>
        <div class="field"><label class="field-label">Employee</label>${e ? `<div class="field-value mt-2">${e.name} · ${e.id}</div>` : `<select><option>Select...</option>${EMP.map(emp => `<option>${emp.name} · ${emp.id}</option>`).join('')}</select>`}</div>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Type</label><select><option>Salary advance</option><option>Festival</option><option>Emergency</option></select></div>
          <div class="field"><label class="field-label">Tenure (months)</label><select><option>1</option><option>3</option><option>6</option><option>12</option><option>24</option></select></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Amount</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">First deduction</label><select><option>Jun 2026</option><option>Jul 2026</option></select></div>
        </div>
        <div class="field"><label class="field-label">Reason (audit trail)</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Loan created · EMI auto-populates next month')">Create</button>`
    };
  },

  'handle-flagged': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    return {
      title: 'Handle flagged · ' + name, icon: 'ti-alert-triangle',
      body: `<div class="alert-banner alert-orange"><i class="ti ti-user-x"></i><div><b>${name}</b>5 days no punch. Last seen 19 May. Unreachable.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Days absent</div><div class="field-value">5</div></div>
          <div><div class="field-label">Contact attempts</div><div class="field-value">3 (email, call, WhatsApp)</div></div>
          <div><div class="field-label">Active loan</div><div class="field-value text-orange">₹33,333 outstanding</div></div>
          <div><div class="field-label">Manager confirmation</div><div class="field-value text-red">Unreachable</div></div>
        </div>
        <div class="field mt-3"><label class="field-label">Action</label><select><option>Send batch with 10 LOP, no salary</option><option>Exclude from this batch</option><option>Initiate F&F (termination)</option><option>Mark for further investigation</option></select></div>
        <div class="field"><label class="field-label">Justification</label><textarea></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Defer</button><button class="btn btn-primary" onclick="closeM(); toast('Action applied')">Apply</button>`
    };
  },

  'view-payroll-month': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const m = EMP_MONTHLY.find(x => x.month === d.month);
    if (!m || !e) return { title: 'Payroll', body: '<p>Month not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const p = computePayslip(e.id, m.monthCode);
    if (!p) return { title: 'Payroll', body: '<p>Payslip not yet computed.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Payslip · ' + m.month + ' · ' + e.name, icon: 'ti-receipt', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Month</div><div class="field-value">${m.month}</div></div>
        <div><div class="field-label">Status</div><div class="field-value"><span class="pill pill-${m.status === 'paid' ? 'green' : 'orange'}">${m.status === 'paid' ? 'Computed & paid' : 'Pending'}</span></div></div>
        <div><div class="field-label">Payable days</div><div class="field-value">${p.payableDays}${p.lopDays > 0 ? ' (LOP ' + p.lopDays + ')' : ''}</div></div>
        <div><div class="field-label">Pay date</div><div class="field-value">${p.processedDate || '—'}</div></div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Earnings (engine-computed)</div>
          <table class="schedule-table">
            <tbody>
              <tr><td>Basic</td><td class="num">${fmt(p.earnings.basic)}</td></tr>
              <tr><td>HRA</td><td class="num">${fmt(p.earnings.hra)}</td></tr>
              <tr><td>Conveyance</td><td class="num">${fmt(p.earnings.conveyance)}</td></tr>
              <tr><td>Special allowance</td><td class="num">${fmt(p.earnings.special)}</td></tr>
              ${p.earnings.incentive > 0 ? `<tr><td>Incentive</td><td class="num">${fmt(p.earnings.incentive)}</td></tr>` : ''}
              ${p.earnings.bonus > 0 ? `<tr><td>Bonus</td><td class="num">${fmt(p.earnings.bonus)}</td></tr>` : ''}
              ${p.earnings.overtime > 0 ? `<tr><td>Overtime</td><td class="num">${fmt(p.earnings.overtime)}</td></tr>` : ''}
              ${p.earnings.reimbursements > 0 ? `<tr><td>Reimbursements</td><td class="num">${fmt(p.earnings.reimbursements)}</td></tr>` : ''}
              ${p.earnings.encashment > 0 ? `<tr><td>Leave encashment</td><td class="num">${fmt(p.earnings.encashment)}</td></tr>` : ''}
              ${p.earnings.arrears !== 0 ? `<tr><td>Arrears</td><td class="num">${fmtS(p.earnings.arrears)}</td></tr>` : ''}
              <tr style="border-top: 2px solid var(--border); font-weight: 700;"><td>Gross earnings</td><td class="num text-green">${fmt(p.grossEarnings)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Deductions (engine-computed)</div>
          <table class="schedule-table">
            <tbody>
              ${p.deductions.pf > 0 ? `<tr><td>Provident Fund (12%)</td><td class="num">-${fmt(p.deductions.pf)}</td></tr>` : '<tr><td class="text-tertiary">PF (not applicable)</td><td class="num text-tertiary">—</td></tr>'}
              <tr><td>Professional Tax (${e.workState})</td><td class="num">-${fmt(p.deductions.profTax)}</td></tr>
              <tr><td>Income tax (${e.taxRegime === 'old' ? 'Old' : 'New'} regime)</td><td class="num">-${fmt(p.deductions.incomeTax)}</td></tr>
              ${p.deductions.loanEmi > 0 ? `<tr><td>Loan EMI</td><td class="num">-${fmt(p.deductions.loanEmi)}</td></tr>` : ''}
              <tr style="border-top: 2px solid var(--border); font-weight: 700;"><td>Total deductions</td><td class="num text-red">-${fmt(p.totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style="background: var(--green-bg); border-radius: 10px; padding: 16px 20px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="font-semibold text-green" style="font-size: 13px;">Net pay credited to bank</div>
          <div class="text-xs text-green" style="margin-top: 2px;">${m.status === 'paid' ? 'Paid on ' + p.processedDate : 'Will be paid on ' + (PAY_PERIODS.find(pp => pp.start === m.monthCode) || {}).payDate}</div>
        </div>
        <div class="font-bold text-green" style="font-size: 22px;">${fmt(p.netPay)}</div>
      </div>
      <div style="background: var(--surface-subtle); padding: 12px 16px; border-radius: 8px; margin-top: 12px;">
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Employer contributions (CTC context)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px;">
          ${p.employerContrib.pf > 0 ? `<div><span class="text-secondary">PF match:</span> <b>${fmt(p.employerContrib.pf)}</b></div>` : ''}
          ${p.employerContrib.edli > 0 ? `<div><span class="text-secondary">EDLI:</span> <b>${fmt(p.employerContrib.edli)}</b></div>` : ''}
          <div><span class="text-secondary">Gratuity accrual:</span> <b>${fmt(p.employerContrib.gratuity)}</b></div>
        </div>
      </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${m.status === 'paid' ? `<button class="btn" onclick="openM('download-payslip', {empId: '${e.id}', month: '${m.month}'})"><i class="ti ti-download"></i> Download PDF</button>` : ''}`
    };
  },

  'batch-detail': (d) => {
    const h = HISTORY[d.idx];
    if (!h) return { title: 'Batch', body: '<p>Not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Batch · ' + h.id, icon: 'ti-package', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Batch ID</div><div class="field-value text-mono">${h.id}</div></div>
        <div><div class="field-label">Status</div><div class="field-value"><span class="pill pill-green">Completed</span></div></div>
        <div><div class="field-label">Employees</div><div class="field-value">${h.empCount}</div></div>
        <div><div class="field-label">Total CTC</div><div class="field-value">${fmtL(h.totalCTC)}</div></div>
        <div><div class="field-label">Sent at</div><div class="field-value">${h.sentAt}</div></div>
        <div><div class="field-label">Sent by</div><div class="field-value">${h.sentBy}</div></div>
      </div>
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Engine response</div>
      <div style="background: var(--surface-subtle); padding: 12px 16px; border-radius: 8px; font-family: 'SF Mono', monospace; font-size: 11px; color: var(--text-secondary);">{<br>&nbsp;&nbsp;"batch_id": "${h.id}",<br>&nbsp;&nbsp;"received": ${h.empCount},<br>&nbsp;&nbsp;"accepted": ${h.empCount},<br>&nbsp;&nbsp;"rejected": 0,<br>&nbsp;&nbsp;"processing_ms": 2421,<br>&nbsp;&nbsp;"has_encashment": ${h.hasEncashment || false}<br>}</div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'emp-report': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    return {
      title: 'FY report · ' + name, icon: 'ti-file-text',
      body: `<div class="field"><label class="field-label">FY</label><select><option>FY 2026-27 (current)</option><option>FY 2025-26</option></select></div>
        <div class="field"><label class="field-label">Format</label><select><option>PDF</option><option>Excel</option></select></div>
        <div class="field"><label class="field-label">Include</label><div style="display: flex; flex-direction: column; gap: 6px;"><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Monthly inputs (all 11 fields)</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Salary changes</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Loan history</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Encashment record</label></div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating...')">Generate</button>`
    };
  },

  'export-register': () => ({
    title: 'Export salary register', icon: 'ti-download',
    body: `<div class="field"><label class="field-label">Month</label><select><option>May 2026</option><option>Apr 2026</option><option>Mar 2026 (with encashment)</option></select></div>
      <div class="field"><label class="field-label">Format</label><select><option>Excel</option><option>CSV</option></select></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating...')">Generate</button>`
  }),

  'export-audit': () => ({
    title: 'Export audit log', icon: 'ti-download',
    body: `<div class="field"><label class="field-label">Date range</label><div class="field-grid-2"><input type="date" /><input type="date" /></div></div>
      <div class="field"><label class="field-label">Format</label><select><option>PDF (signed)</option><option>Excel</option></select></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating...')">Export</button>`
  }),

  'export-dashboard': () => ({
    title: 'Export dashboard', icon: 'ti-download',
    body: `<p>Export current dashboard snapshot as PDF.</p>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Exporting...')">Export</button>`
  }),

  'absconding-alerts': () => ({
    title: 'Absconding alerts', icon: 'ti-user-x',
    body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>1 active case</b>Karthik Rao · 5 days no punch.</div></div>
      <div class="req-card mt-3"><div class="req-header"><div style="display: flex; gap: 12px; align-items: center;"><div class="avatar" style="background: var(--red-bg); color: var(--red-text);">KR</div><div><b>Karthik Rao</b><div class="text-sm text-secondary">EMP1019 · Premier · Bench Sales</div></div></div><span class="pill pill-red">5 days</span></div></div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); openM('handle-flagged', {empId: 'EMP1019'})">Review</button>`
  }),

  'notifications': () => ({
    title: 'Notifications', icon: 'ti-bell',
    body: `<div class="timeline" style="padding-left: 22px;">
      <div class="timeline-event orange"><div class="timeline-dot"></div><div class="timeline-title">3 loan requests need approval</div><div class="timeline-meta">1 emergency loan needs CEO</div><div class="timeline-date">2 hours ago</div></div>
      <div class="timeline-event red"><div class="timeline-dot"></div><div class="timeline-title">Karthik Rao flagged absconding</div><div class="timeline-meta">Resolve before May batch</div><div class="timeline-date">Today, 09:15</div></div>
      <div class="timeline-event purple"><div class="timeline-dot"></div><div class="timeline-title">Rohit Kapoor F&F initiated</div><div class="timeline-meta">LWD 31 May · settle by 2 Jun</div><div class="timeline-date">10 May</div></div>
      <div class="timeline-event green"><div class="timeline-dot"></div><div class="timeline-title">April batch confirmed</div><div class="timeline-meta">All 6 processed</div><div class="timeline-date">2 days ago</div></div>
    </div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button>`
  }),

  'confirm-submit-loan': (d) => ({
    title: 'Submit loan request', icon: 'ti-send',
    body: `<p class="mb-3">Submit this request for approval?</p>
      <div class="info-grid mt-3">
        <div><div class="field-label">Type</div><div class="field-value">${d.type}</div></div>
        <div><div class="field-label">Amount</div><div class="field-value">${fmt(d.amount)}</div></div>
        <div><div class="field-label">Tenure</div><div class="field-value">${d.tenure} months</div></div>
        <div><div class="field-label">Monthly EMI</div><div class="field-value">${fmt(d.emi)}</div></div>
      </div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Goes to Finance Admin. You'll be notified at each step.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); setT('showLoanRequest', false); toast('Submitted · check email for updates')"><i class="ti ti-send"></i> Submit</button>`
  }),

  'contact-hr': () => ({
    title: 'Contact HR', icon: 'ti-message',
    body: `<div class="field"><label class="field-label">Topic</label><select><option>Payroll question</option><option>Loan inquiry</option><option>Attendance dispute</option><option>Encashment query</option><option>Other</option></select></div>
      <div class="field"><label class="field-label">Message</label><textarea rows="5"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Sent to HR')">Send</button>`
  }),

  // === STATUTORY COMPLIANCE MODALS ===

  'pf-challan-detail': (d) => {
    const monthCode = d.month || '2026-04-01';
    const emps = EMP.filter(e => e.entity === S.entity);
    const s = getStatutorySummary(monthCode);
    return {
      title: 'PF challan detail · ' + (monthCode === '2026-04-01' ? 'Apr 2026' : monthCode), icon: 'ti-building-bank', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>EPF return · Form ECR</b>Employee + employer + EDLI contributions remitted via Electronic Challan Return (ECR) to EPFO. Due 15th of next month.</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Employee (12% of basic)</div><div class="field-value">${fmt(s.pf.employee)}</div></div>
          <div><div class="field-label">Employer (12% of basic)</div><div class="field-value">${fmt(s.pf.employer)}</div></div>
          <div><div class="field-label">EDLI premium (0.5%)</div><div class="field-value">${fmt(s.pf.edli)}</div></div>
          <div><div class="field-label">EPF admin charges (0.5%)</div><div class="field-value">${fmt(Math.round(s.pf.employer * 0.04))}</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Per employee</div>
        <table class="schedule-table">
          <thead><tr><th>Employee</th><th class="num">Wage</th><th class="num">EE 12%</th><th class="num">ER 12%</th><th class="num">EDLI</th></tr></thead>
          <tbody>
            ${emps.map(e => {
        const p = computePayslip(e.id, monthCode);
        if (!p || !e.pf) return `<tr><td><b>${e.name}</b></td><td class="num text-tertiary">N/A</td><td class="num text-tertiary">—</td><td class="num text-tertiary">—</td><td class="num text-tertiary">—</td></tr>`;
        return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td class="num">${fmt(p.earnings.basic)}</td><td class="num">${fmt(p.deductions.pf)}</td><td class="num">${fmt(p.employerContrib.pf)}</td><td class="num">${fmt(p.employerContrib.edli)}</td></tr>`;
      }).join('')}
            <tr style="background: var(--surface-subtle); font-weight: 700;"><td>Total</td><td class="num">—</td><td class="num">${fmt(s.pf.employee)}</td><td class="num">${fmt(s.pf.employer)}</td><td class="num">${fmt(s.pf.edli)}</td></tr>
          </tbody>
        </table>
        <div style="background: var(--purple-bg); padding: 14px 18px; border-radius: 10px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div><div class="font-semibold text-purple" style="font-size: 13px;">Total PF challan</div><div class="text-xs text-purple" style="margin-top: 2px;">Pay to EPFO via SBI by 15 Jun</div></div>
          <div class="font-bold text-purple" style="font-size: 20px;">${fmt(s.pf.total)}</div>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn" onclick="closeM(); openM('generate-pf-ecr', {month: '${monthCode}'})"><i class="ti ti-download"></i> Generate ECR</button><button class="btn btn-primary" onclick="closeM(); openM('mark-pf-paid', {month: '${monthCode}'})"><i class="ti ti-check"></i> Mark remitted</button>`
    };
  },

  'generate-pf-ecr': (d) => ({
    title: 'Generate ECR file for EPFO', icon: 'ti-file-export',
    body: `<p class="text-sm text-secondary mb-3">Generates the ECR (Electronic Challan Return) text file in EPFO's prescribed format. Upload to EPFO unified portal.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Month</div><div class="field-value">${d.month === '2026-04-01' ? 'Apr 2026' : d.month}</div></div>
        <div><div class="field-label">Establishment code</div><div class="field-value text-mono">${E[S.entity].name === 'Premier IT Solutions' ? 'TGHYD0123456000' : 'PENDING'}</div></div>
        <div><div class="field-label">Format</div><div class="field-value">ECR Text (.txt)</div></div>
        <div><div class="field-label">Employees</div><div class="field-value">${EMP.filter(e => e.entity === S.entity && e.pf).length}</div></div>
      </div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>UAN-validated. KYC-verified employees only. Mismatched UAN entries will be flagged.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('ECR file generated')"><i class="ti ti-download"></i> Generate</button>`
  }),

  'mark-pf-paid': (d) => ({
    title: 'Mark PF as remitted', icon: 'ti-check',
    body: `<p class="text-sm text-secondary mb-3">Record that the PF challan was paid to EPFO. Audit-logged for compliance.</p>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">TRRN number</label><input type="text" placeholder="From EPFO receipt" /></div>
        <div class="field"><label class="field-label">Payment date</label><input type="date" value="2026-06-15" /></div>
      </div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Amount paid</label><input type="text" placeholder="Auto from challan" /></div>
        <div class="field"><label class="field-label">Mode</label><select><option>Net banking</option><option>NEFT/RTGS</option></select></div>
      </div>
      <div class="field"><label class="field-label">Upload receipt</label><div style="padding: 14px; border: 2px dashed var(--border); border-radius: 8px; text-align: center;"><i class="ti ti-upload" style="font-size: 20px; color: var(--text-tertiary);"></i> <span class="text-sm text-secondary">Drop EPFO acknowledgement PDF</span></div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-success" onclick="closeM(); toast('PF marked as remitted · audit logged')"><i class="ti ti-check"></i> Mark paid</button>`
  }),

  'esi-eligibility': () => ({
    title: 'ESI eligibility rules', icon: 'ti-heart',
    body: `<p class="text-sm text-secondary mb-3">Employee State Insurance applies only to specific wage brackets.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Wage ceiling</div><div class="field-value">₹21,000/month</div></div>
        <div><div class="field-label">Employee share</div><div class="field-value">0.75% of wages</div></div>
        <div><div class="field-label">Employer share</div><div class="field-value">3.25% of wages</div></div>
        <div><div class="field-label">Coverage</div><div class="field-value">Medical, maternity, disability, dependent benefits</div></div>
      </div>
      <div class="alert-banner alert-orange"><i class="ti ti-info-circle"></i><div><b>Current employees</b>None of the ${EMP.filter(e => e.entity === S.entity).length} active employees in ${E[S.entity].name} have wages below ₹21,000/month. ESI is not applicable. If lower-wage employees are added later, ESI deductions will activate automatically.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button>`
  }),

  'pt-register-state': (d) => {
    const emps = EMP.filter(e => e.entity === S.entity && e.workState === d.state);
    return {
      title: 'PT register · ' + d.state, icon: 'ti-map-pin', large: true,
      body: `<p class="text-sm text-secondary mb-3">Professional Tax register for ${d.state}. Each state has its own slabs and remittance schedule.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">State</div><div class="field-value">${d.state}</div></div>
          <div><div class="field-label">Slabs</div><div class="field-value">${d.state === 'Telangana' || d.state === 'Karnataka' ? '₹200/mo flat (>₹15K wage)' : d.state === 'Maharashtra' ? '₹200/mo (>₹10K) or ₹300 (Feb)' : '₹200/mo'}</div></div>
          <div><div class="field-label">Remittance</div><div class="field-value">Monthly</div></div>
          <div><div class="field-label">Due date</div><div class="field-value">${d.state === 'Maharashtra' ? '30th of next month' : '10th of next month'}</div></div>
        </div>
        <table class="schedule-table">
          <thead><tr><th>Employee</th><th class="num">Wage</th><th class="num">PT deducted</th></tr></thead>
          <tbody>
            ${emps.map(e => {
        const p = computePayslip(e.id, d.month);
        return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td class="num">${fmt(e.monthlyCTC)}</td><td class="num">${fmt(p ? p.deductions.profTax : 0)}</td></tr>`;
      }).join('')}
            <tr style="background: var(--surface-subtle); font-weight: 700;"><td>Total · ${emps.length} employees</td><td class="num">—</td><td class="num">${fmt(emps.reduce((s, e) => { const p = computePayslip(e.id, d.month); return s + (p ? p.deductions.profTax : 0); }, 0))}</td></tr>
          </tbody>
        </table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('PT register for ${d.state} generated')"><i class="ti ti-download"></i> Export</button>`
    };
  },

  'tds-summary': (d) => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const monthCode = d.month || '2026-04-01';
    const total = emps.reduce((s, e) => { const p = computePayslip(e.id, monthCode); return s + (p ? p.deductions.incomeTax : 0); }, 0);
    return {
      title: 'TDS summary · ' + (monthCode === '2026-04-01' ? 'Apr 2026' : monthCode), icon: 'ti-coin', large: true,
      body: `<p class="text-sm text-secondary mb-3">Monthly TDS deductions. Reported quarterly via Form 24Q (challan + employee-wise breakup).</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Month total TDS</div><div class="field-value">${fmt(total)}</div></div>
          <div><div class="field-label">Quarter</div><div class="field-value">Q1 FY 2026-27</div></div>
          <div><div class="field-label">TAN</div><div class="field-value text-mono">HYDT06789F</div></div>
          <div><div class="field-label">Form 24Q due</div><div class="field-value">31 Jul 2026</div></div>
        </div>
        <table class="schedule-table">
          <thead><tr><th>Employee</th><th>PAN</th><th>Regime</th><th class="num">Gross</th><th class="num">TDS</th></tr></thead>
          <tbody>
            ${emps.map(e => {
        const p = computePayslip(e.id, monthCode);
        if (!p) return '';
        return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td class="text-mono text-xs">XXXXX${e.id.slice(-4)}A</td><td><span class="pill pill-${e.taxRegime === 'old' ? 'purple' : 'blue'}" style="padding: 1px 6px; font-size: 9px;">${e.taxRegime === 'old' ? 'Old' : 'New'}</span></td><td class="num">${fmt(p.grossEarnings)}</td><td class="num">${fmt(p.deductions.incomeTax)}</td></tr>`;
      }).join('')}
            <tr style="background: var(--surface-subtle); font-weight: 700;"><td colspan="4">Total</td><td class="num">${fmt(total)}</td></tr>
          </tbody>
        </table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn" onclick="closeM(); openM('generate-form24q', {quarter: 'Q1', fy: '2026-27'})"><i class="ti ti-download"></i> Generate Form 24Q</button>`
    };
  },

  'generate-form24q': (d) => ({
    title: 'Generate Form 24Q · ' + d.quarter + ' FY ' + d.fy, icon: 'ti-file-export',
    body: `<p class="text-sm text-secondary mb-3">Generates Form 24Q TDS return file in NSDL prescribed format. Upload to TIN-NSDL.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Quarter</div><div class="field-value">${d.quarter} ${d.fy}</div></div>
        <div><div class="field-label">Format</div><div class="field-value">.txt (NSDL FVU)</div></div>
        <div><div class="field-label">TAN</div><div class="field-value text-mono">HYDT06789F</div></div>
        <div><div class="field-label">Annexure I (challan)</div><div class="field-value"><i class="ti ti-check text-green"></i> Will include</div></div>
        <div><div class="field-label">Annexure II (deductee)</div><div class="field-value"><i class="ti ti-check text-green"></i> All employees with TDS</div></div>
        <div><div class="field-label">Due date</div><div class="field-value">31 Jul 2026</div></div>
      </div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Run NSDL FVU validation before upload. Output is a regulatory file — review carefully.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Form 24Q generated')"><i class="ti ti-download"></i> Generate</button>`
  }),

  // === IT DECLARATION MODALS ===

  'itdec-save-draft': (d) => ({
    title: 'Save tax declaration as draft', icon: 'ti-device-floppy',
    body: `<p class="text-sm text-secondary mb-3">Saves your current entries as a draft. You can keep editing until you submit.</p>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Drafts don't affect your monthly TDS. Submit when ready for the engine to recalculate.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Draft saved')">Save draft</button>`
  }),

  'itdec-submit': (d) => {
    const tot = totalITDeclared(d.empId);
    return {
      title: 'Submit tax declaration · FY 2026-27', icon: 'ti-send',
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Submitting for HR review</b>HR reviews each item, verifies proof, and approves or rejects. You can edit and resubmit rejected items until 15 Jan 2027.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Total declared</div><div class="field-value font-bold">${fmt(tot.total)}</div></div>
          <div><div class="field-label">After approval, sync to engine</div><div class="field-value">Within 24 hrs</div></div>
          <div><div class="field-label">80C</div><div class="field-value">${fmt(tot.c80)} <span class="text-xs text-secondary">/ ${fmt(150000)}</span></div></div>
          <div><div class="field-label">80D</div><div class="field-value">${fmt(tot.c80d)} <span class="text-xs text-secondary">/ ${fmt(50000)}</span></div></div>
          <div><div class="field-label">Section 24</div><div class="field-value">${fmt(tot.c24)} <span class="text-xs text-secondary">/ ${fmt(200000)}</span></div></div>
          <div><div class="field-label">80CCD(1B)</div><div class="field-value">${fmt(tot.c80ccd)} <span class="text-xs text-secondary">/ ${fmt(50000)}</span></div></div>
        </div>
        <div class="field mt-3"><label style="display: flex; gap: 8px; align-items: start; cursor: pointer;"><input type="checkbox" /> <span class="text-sm">I confirm these declarations are accurate. False declarations may attract penalty under IT Act.</span></label></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Declaration submitted to HR for review')"><i class="ti ti-send"></i> Submit for review</button>`
    };
  },

  'itdec-edit': (d) => ({
    title: 'Edit tax declaration', icon: 'ti-pencil',
    body: `<p class="text-sm text-secondary mb-3">You can edit individual sections from the declaration page. Use this to bulk-update or revoke entirely.</p>
      <div class="field"><label class="field-label">What to edit</label><select><option>Continue editing on declaration page</option><option>Revoke entire declaration (use only if drastically wrong)</option></select></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Edits update next month's TDS calculation. No retroactive change to past months.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM()">Continue editing</button>`
  }),

  // === IT DECLARATION ITEM MODALS (v7 — generic add/edit per section with proof) ===

  'itdec-add-item': (d) => {
    const meta = {
      '80C': { label: 'Section 80C', subOptions: ['PPF', 'EPF (VPF)', 'ELSS mutual funds', 'Life insurance premium', 'ULIP premium', '5-year tax-saver FD', 'NSC', 'Sukanya Samriddhi', 'Home loan principal', 'Children tuition fees'], limit: 150000 },
      '80D': { label: 'Section 80D · Health insurance', subOptions: ['Self+family premium', 'Parents (under 60)', 'Parents (senior 60+)', 'Preventive check-up'], limit: 50000 },
      '80CCD_1B': { label: 'Section 80CCD(1B) · NPS', subOptions: ['NPS Tier-1 additional'], limit: 50000 },
      '24': { label: 'Section 24 · Home loan interest', subOptions: ['Home loan interest'], limit: 200000 },
      'HRA': { label: 'HRA exemption', subOptions: ['Monthly rent paid'], limit: null },
      '80E': { label: 'Section 80E · Education loan', subOptions: ['Education loan interest'], limit: null },
      '80G': { label: 'Section 80G · Donations', subOptions: ['50% deduction donee', '100% deduction donee'], limit: null },
      '80TTA': { label: 'Section 80TTA · Savings interest', subOptions: ['Savings bank interest'], limit: 10000 }
    }[d.section];
    if (!meta) return { title: 'Add', body: '<p>Section not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Add to ' + meta.label, icon: 'ti-plus', large: true,
      body: `<p class="text-sm text-secondary mb-3">${meta.limit ? `Annual limit ₹${meta.limit.toLocaleString('en-IN')} for this section.` : 'No upper limit.'} Upload proof for HR approval.</p>
        <div class="field"><label class="field-label">Sub-component</label><select>${meta.subOptions.map(o => `<option>${o}</option>`).join('')}</select></div>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Annual amount (₹)</label><input type="text" placeholder="e.g., 50000" /></div>
          <div class="field"><label class="field-label">Investment date</label><input type="date" /></div>
        </div>
        ${d.section === '24' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">Property type</label><select><option>Self-occupied</option><option>Let-out</option><option>Deemed let-out</option></select></div>
          <div class="field"><label class="field-label">Lender name</label><input type="text" placeholder="e.g., HDFC Bank" /></div>
        </div>` : ''}
        ${d.section === 'HRA' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">City type</label><select><option value="metro">Metro (50% basic)</option><option value="non-metro">Non-metro (40% basic)</option></select></div>
          <div class="field"><label class="field-label">Landlord PAN (if rent > ₹1L)</label><input type="text" placeholder="ABCDE1234F" /></div>
        </div>` : ''}
        <div class="field"><label class="field-label">Proof / supporting document</label><div style="padding: 18px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 22px; color: var(--text-tertiary); display: block; margin-bottom: 4px;"></i><div class="text-sm">Click or drop PDF / JPEG</div><div class="text-xs text-secondary mt-2">Required: statement, premium receipt, certificate, etc.</div></div></div>
        <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>You can save without proof, but HR needs proof to approve. Add proof before submitting declaration.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Item added to ' + '${d.section}')"><i class="ti ti-plus"></i> Add item</button>`
    };
  },

  'itdec-edit-item': (d) => {
    const dec = getITDeclaration(d.empId);
    const item = dec.sections[d.section]?.items.find(i => i.id === d.itemId);
    if (!item) return { title: 'Edit', body: '<p>Item not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Edit declaration · ' + item.subSection, icon: 'ti-pencil',
      body: `<div class="field-grid-2">
        <div class="field"><label class="field-label">Sub-component</label><input type="text" value="${item.subSection}" /></div>
        <div class="field"><label class="field-label">Annual amount (₹)</label><input type="text" value="${item.amount}" /></div>
      </div>
      ${item.lender ? `<div class="field-grid-2">
        <div class="field"><label class="field-label">Property type</label><select><option ${item.propertyType === 'self-occupied' ? 'selected' : ''}>Self-occupied</option><option>Let-out</option></select></div>
        <div class="field"><label class="field-label">Lender</label><input type="text" value="${item.lender}" /></div>
      </div>` : ''}
      ${item.cityType ? `<div class="field-grid-2">
        <div class="field"><label class="field-label">City type</label><select><option value="metro" ${item.cityType === 'metro' ? 'selected' : ''}>Metro (50%)</option><option>Non-metro (40%)</option></select></div>
        <div class="field"><label class="field-label">Landlord PAN</label><input type="text" value="${item.landlordPan || ''}" /></div>
      </div>` : ''}
      <div class="field"><label class="field-label">Current proof</label>${item.proof ? `<div style="padding: 10px 12px; background: var(--surface-subtle); border-radius: 6px; display: flex; gap: 10px; align-items: center;"><i class="ti ti-paperclip"></i><span class="text-sm">${item.proof}</span><button class="btn btn-sm" style="margin-left: auto;" onclick="closeM(); openM('itdec-upload-proof', {empId: '${d.empId}', section: '${d.section}', itemId: '${d.itemId}'})">Replace</button></div>` : `<button class="btn" onclick="closeM(); openM('itdec-upload-proof', {empId: '${d.empId}', section: '${d.section}', itemId: '${d.itemId}'})"><i class="ti ti-upload"></i> Upload proof</button>`}</div>
      ${item.status === 'rejected' ? `<div class="alert-banner alert-red"><i class="ti ti-alert-circle"></i><div><b>Previously rejected</b>Make corrections and resubmit. HR will review again.</div></div>` : ''}`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Item updated')">Save changes</button>`
    };
  },

  'itdec-upload-proof': (d) => ({
    title: 'Upload proof', icon: 'ti-upload',
    body: `<p class="text-sm text-secondary mb-3">Upload supporting document. HR reviews proof along with declaration.</p>
      <div class="field"><label class="field-label">Document type</label><select><option>Investment statement</option><option>Premium receipt</option><option>Bank certificate</option><option>Rental agreement</option><option>Landlord declaration</option><option>Interest certificate</option><option>Other</option></select></div>
      <div class="field"><label class="field-label">File</label><div style="padding: 24px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 32px; color: var(--text-tertiary); display: block; margin-bottom: 8px;"></i><div class="font-semibold">Click or drop file</div><div class="text-xs text-secondary mt-2">PDF, JPG, PNG · max 5 MB</div></div></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Original copies may be required at FY-end. Keep them safe.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Proof uploaded')"><i class="ti ti-upload"></i> Upload</button>`
  }),

  'itdec-delete-item': (d) => ({
    title: 'Delete declaration item', icon: 'ti-trash',
    body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This removes the entry from your declaration</b>The amount will no longer be considered for tax savings. You can re-add it later if needed.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Item deleted')"><i class="ti ti-trash"></i> Delete</button>`
  }),

  'reimb-resubmit': (d) => ({
    title: 'Resubmit claim · ' + d.id, icon: 'ti-refresh',
    body: `<p class="text-sm text-secondary mb-3">Address the rejection reason and resubmit.</p>
      <div class="alert-banner alert-red"><i class="ti ti-alert-circle"></i><div><b>Why it was rejected</b>Bill not in employee name. Please upload bill addressed to you.</div></div>
      <div class="field"><label class="field-label">Updated proof</label><div style="padding: 20px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 24px; color: var(--text-tertiary); display: block; margin-bottom: 6px;"></i><div class="text-sm">Upload corrected bill</div></div></div>
      <div class="field"><label class="field-label">Additional notes for HR</label><textarea placeholder="Explain what was corrected"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Claim resubmitted to HR')"><i class="ti ti-send"></i> Resubmit</button>`
  }),

  // === REIMBURSEMENT CLAIM MODALS ===

  'reimb-submit-claim': (d) => ({
    title: 'Submit reimbursement claim', icon: 'ti-plus', large: true,
    body: `<p class="text-sm text-secondary mb-3">Upload bill, select category. HR reviews and approves. Amount added to next month's payroll as tax-exempt reimbursement (within entitlement).</p>
      <div class="field"><label class="field-label">Category</label><select>
        ${Object.entries(REIMB_CATEGORIES).filter(([k]) => k !== 'misc').map(([k, c]) => `<option value="${k}">${c.label} (entitlement varies)</option>`).join('')}
      </select></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Bill amount</label><input type="text" placeholder="₹" /></div>
        <div class="field"><label class="field-label">Bill date</label><input type="date" /></div>
      </div>
      <div class="field"><label class="field-label">Vendor / merchant</label><input type="text" placeholder="e.g., Airtel, Apollo Hospital" /></div>
      <div class="field"><label class="field-label">Description</label><textarea placeholder="Optional details"></textarea></div>
      <div class="field"><label class="field-label">Upload bill</label><div style="padding: 20px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 24px; color: var(--text-tertiary); display: block; margin-bottom: 6px;"></i><div class="text-sm">Click or drop PDF / JPEG</div><div class="text-xs text-secondary mt-2">Required for tax exemption claim</div></div></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Bill must be in your name and within FY 2026-27. Claims older than 90 days from bill date are rejected.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Claim submitted · awaiting HR approval')"><i class="ti ti-send"></i> Submit claim</button>`
  }),

  'reimb-claim-detail': (d) => ({
    title: 'Claim detail · ' + d.id, icon: 'ti-receipt',
    body: `<div class="info-grid mb-3">
      <div><div class="field-label">Claim ID</div><div class="field-value text-mono">${d.id}</div></div>
      <div><div class="field-label">Status</div><div class="field-value"><span class="pill pill-orange">Pending HR review</span></div></div>
      <div><div class="field-label">Category</div><div class="field-value">Books & periodicals</div></div>
      <div><div class="field-label">Amount</div><div class="field-value">${fmt(4500)}</div></div>
      <div><div class="field-label">Bill date</div><div class="field-value">08 May 2026</div></div>
      <div><div class="field-label">Submitted on</div><div class="field-value">10 May 2026</div></div>
    </div>
    <div class="field"><label class="field-label">Bill / proof</label><div style="padding: 12px; background: var(--surface-subtle); border-radius: 8px; display: flex; gap: 10px; align-items: center;"><i class="ti ti-file-text" style="font-size: 22px; color: var(--blue);"></i><div style="flex: 1;"><div class="font-semibold text-sm">oreilly-invoice-may2026.pdf</div><div class="text-xs text-secondary">123 KB</div></div><button class="btn btn-sm">View</button></div></div>
    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Will be processed in next payroll cycle if approved before lock date (26th).</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-danger" onclick="closeM(); toast('Claim withdrawn')">Withdraw</button>`
  }),

  // === v8 TAX REGIME MODALS ===

  'regime-select': (d) => {
    const e = EMP.find(x => x.id === d.empId) || getMe();
    const grossAnnual = e.monthlyCTC * 12;
    const taxOld = computeTaxOldRegime(grossAnnual, 0);
    const taxNew = computeTaxNewRegime(grossAnnual);
    return {
      title: 'Select tax regime for FY 2026-27', icon: 'ti-shield', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This choice locks for the financial year</b>You can request a change later, but it requires Finance Admin approval and creates retroactive TDS recompute. Choose carefully.</div></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;">
          <label style="cursor: pointer; padding: 16px; border: 2px solid var(--border); border-radius: 10px; display: block;" onclick="this.querySelector('input').checked = true; this.style.borderColor = 'var(--purple)'; this.parentElement.querySelectorAll('label').forEach(l => { if (l !== this) l.style.borderColor = 'var(--border)'; });">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;"><input type="radio" name="regime" value="old" /> <b>Old regime</b></div>
            <div class="text-xs text-secondary mb-2">All deductions & exemptions allowed</div>
            <div class="font-bold" style="font-size: 18px; color: var(--purple-text);">${fmt(taxOld)} <span class="text-xs font-normal text-secondary">tax (no deductions)</span></div>
          </label>
          <label style="cursor: pointer; padding: 16px; border: 2px solid var(--blue); border-radius: 10px; display: block;" onclick="this.querySelector('input').checked = true; this.style.borderColor = 'var(--blue)'; this.parentElement.querySelectorAll('label').forEach(l => { if (l !== this) l.style.borderColor = 'var(--border)'; });">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;"><input type="radio" name="regime" value="new" checked /> <b>New regime</b> <span class="pill pill-blue" style="padding: 1px 6px; font-size: 9px;">Default</span></div>
            <div class="text-xs text-secondary mb-2">Lower slabs, ₹75K standard deduction</div>
            <div class="font-bold" style="font-size: 18px; color: var(--blue-text);">${fmt(taxNew)} <span class="text-xs font-normal text-secondary">tax</span></div>
          </label>
        </div>
        <div class="field mt-3"><label style="display: flex; gap: 8px; align-items: start; cursor: pointer;"><input type="checkbox" /> <span class="text-sm">I understand this locks my regime for FY 2026-27 (until Apr 2027). Mid-year change requires admin approval.</span></label></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Regime confirmed and locked for FY 2026-27')"><i class="ti ti-check"></i> Confirm selection</button>`
    };
  },

  'regime-request-change': (d) => {
    const e = EMP.find(x => x.id === d.empId) || getMe();
    const rs = getRegimeStatus(e.id);
    const newRegime = rs.selectedRegime === 'old' ? 'new' : 'old';
    return {
      title: 'Request mid-year regime change', icon: 'ti-refresh', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Mid-year regime changes are rare and require admin approval</b>If approved, all prior payslips for this FY will be recomputed and TDS adjusted in next payroll. Form 24Q filings already submitted may need revision.</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Current regime</div><div class="field-value"><span class="pill pill-${rs.selectedRegime === 'old' ? 'purple' : 'blue'}">${rs.selectedRegime === 'old' ? 'Old' : 'New'}</span> (selected ${rs.selectedOn})</div></div>
          <div><div class="field-label">Requesting change to</div><div class="field-value"><span class="pill pill-${newRegime === 'old' ? 'purple' : 'blue'}">${newRegime === 'old' ? 'Old' : 'New'}</span></div></div>
        </div>
        <div class="field"><label class="field-label">Reason (required for admin review)</label><textarea rows="4" placeholder="e.g., I joined another job mid-year and now have substantial 80C investments; or, I realized I don't have deductions and Old regime is costing me more."></textarea></div>
        <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Alternative: you can choose either regime when filing your ITR at year-end. If the only reason is to optimize, that's usually simpler than mid-year change.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Change request raised · Finance Admin will review within 3 business days')"><i class="ti ti-send"></i> Submit request</button>`
    };
  },

  'other-income-add': (d) => {
    const sourceLabels = {
      previous_employer: 'Previous employer income (Form 12B)',
      interest: 'Interest income',
      house_property: 'House property income',
      other: 'Other income source'
    };
    return {
      title: 'Add · ' + sourceLabels[d.source], icon: 'ti-plus', large: true,
      body: `<p class="text-sm text-secondary mb-3">${d.source === 'previous_employer' ? 'Mandatory if you joined this FY. Get Form 12B from your previous employer.' : d.source === 'interest' ? 'Declare savings bank, FD, or RD interest. Section 80TTA gives ₹10K savings interest exemption.' : d.source === 'house_property' ? 'Rental income, or notional rent on let-out. Municipal tax and Section 24(b) interest are deductible.' : 'Capital gains, dividends, freelance income, gifts, etc.'}</p>
        ${d.source === 'previous_employer' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">Previous employer name</label><input type="text" placeholder="e.g., Infosys Ltd" /></div>
          <div class="field"><label class="field-label">PAN of employer (TAN)</label><input type="text" placeholder="ABCD12345E" /></div>
          <div class="field"><label class="field-label">Gross salary received</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">TDS already deducted</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Period from</label><input type="date" /></div>
          <div class="field"><label class="field-label">Period to</label><input type="date" /></div>
        </div>` : ''}
        ${d.source === 'interest' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">Source</label><select><option>Savings bank interest</option><option>Fixed deposit interest</option><option>Recurring deposit interest</option><option>Senior citizen savings scheme</option><option>Other</option></select></div>
          <div class="field"><label class="field-label">Annual amount</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Bank / institution</label><input type="text" placeholder="e.g., HDFC Bank" /></div>
          <div class="field"><label class="field-label">TDS deducted</label><input type="text" placeholder="₹ if any" /></div>
        </div>` : ''}
        ${d.source === 'house_property' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">Property type</label><select><option>Self-occupied (no rent)</option><option>Let-out</option><option>Deemed let-out</option></select></div>
          <div class="field"><label class="field-label">Property address</label><input type="text" placeholder="City, state" /></div>
          <div class="field"><label class="field-label">Annual rent received</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Municipal tax paid</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Interest on home loan (Section 24(b))</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Standard deduction (30% auto)</label><input type="text" disabled value="Auto-computed" /></div>
        </div>` : ''}
        ${d.source === 'other' ? `<div class="field-grid-2">
          <div class="field"><label class="field-label">Type</label><select><option>Capital gains (short-term)</option><option>Capital gains (long-term)</option><option>Dividends</option><option>Freelance / consulting</option><option>Gifts</option><option>Lottery / gaming</option><option>Other</option></select></div>
          <div class="field"><label class="field-label">Annual amount</label><input type="text" placeholder="₹" /></div>
          <div class="field"><label class="field-label">Description</label><input type="text" placeholder="e.g., Mutual fund STCG" /></div>
          <div class="field"><label class="field-label">TDS already deducted</label><input type="text" placeholder="₹" /></div>
        </div>` : ''}
        <div class="field"><label class="field-label">Supporting document</label><div style="padding: 20px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 22px; color: var(--text-tertiary); display: block; margin-bottom: 4px;"></i><div class="text-sm">${d.source === 'previous_employer' ? 'Upload Form 12B / Form 16' : d.source === 'interest' ? 'Bank statement or interest certificate' : d.source === 'house_property' ? 'Rental agreement, municipal tax receipt' : 'Supporting document'}</div></div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Added · will be considered in TDS computation')"><i class="ti ti-plus"></i> Add to declaration</button>`
    };
  },

  'lta-add-journey': (d) => ({
    title: 'Claim LTA exemption for journey', icon: 'ti-plane', large: true,
    body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>LTA rules</b>Only travel within India. Air (economy/AC II rail/first class rail). 2 trips per 4-year block (2026-29). Family includes spouse, children, parents, siblings (if dependent).</div></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">From (origin city)</label><input type="text" placeholder="e.g., Hyderabad" /></div>
        <div class="field"><label class="field-label">To (destination)</label><input type="text" placeholder="e.g., Goa" /></div>
        <div class="field"><label class="field-label">Travel date (onward)</label><input type="date" /></div>
        <div class="field"><label class="field-label">Return date</label><input type="date" /></div>
        <div class="field"><label class="field-label">Mode of travel</label><select><option>Air (economy class)</option><option>Rail (AC II / First class)</option><option>Road (bus / taxi)</option></select></div>
        <div class="field"><label class="field-label">Family members travelling</label><input type="number" placeholder="Including self" min="1" max="10" /></div>
      </div>
      <div class="field"><label class="field-label">Total amount claimed (₹)</label><input type="text" placeholder="Total ticket cost for self + family" /></div>
      <div class="field"><label class="field-label">Travel proofs (tickets, boarding passes)</label><div style="padding: 20px; border: 2px dashed var(--border); border-radius: 10px; text-align: center; cursor: pointer;"><i class="ti ti-upload" style="font-size: 22px; color: var(--text-tertiary); display: block; margin-bottom: 4px;"></i><div class="text-sm">Upload all tickets and proofs</div></div></div>
      <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div>Only travel cost is exempt — not hotel, food, or local commute. Indirect routes: exemption capped at shortest route fare.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('LTA claim submitted for HR review')"><i class="ti ti-send"></i> Submit claim</button>`
  }),

  'form12bb-download': (d) => {
    const e = EMP.find(x => x.id === d.empId) || getMe();
    const dec = getITDeclaration(e.id);
    const oi = getOtherIncome(e.id);
    const lta = getLTAClaims(e.id);
    const totalDecl = totalITDeclared(e.id);
    const allItems = Object.values(dec.sections).reduce((s, sd) => s + sd.items.length, 0);
    const withProof = Object.values(dec.sections).reduce((s, sd) => s + sd.items.filter(it => it.proof).length, 0);
    return {
      title: 'Download Form 12BB · FY 2026-27', icon: 'ti-file-download', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Form 12BB · Statement of particulars for claiming deductions</b>Standard Income Tax format. Submit to employer along with proofs by 15 Jan 2027. Required regulatory document for Old regime employees.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Employee</div><div class="field-value">${e.name}<br><span class="text-xs text-secondary">${e.id}</span></div></div>
          <div><div class="field-label">FY</div><div class="field-value">2026-27</div></div>
          <div><div class="field-label">Items declared</div><div class="field-value">${allItems}</div></div>
          <div><div class="field-label">Items with proof</div><div class="field-value ${withProof === allItems ? 'text-green' : 'text-orange'}">${withProof} / ${allItems}</div></div>
        </div>
        ${withProof < allItems ? `<div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-circle"></i><div><b>Some items missing proof</b>Form 12BB requires proof for all declared items. Upload remaining proofs before submitting to employer.</div></div>` : ''}
        <div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform: uppercase; letter-spacing: 0.4px;">Form contents</div>
        <div style="display: grid; gap: 6px;">
          ${['House rent allowance (HRA) — landlord PAN if rent > ₹1L', 'Leave travel concession (LTA) — journey details', 'Deduction of interest u/s 24 (home loan)', 'Section 80C / 80CCC / 80CCD investments', 'Section 80D / 80DD / 80E / 80G / others', 'Income from other sources (Form 12B from previous employer)'].map(x => `<div style="display: flex; gap: 8px; align-items: center; padding: 8px; background: var(--surface-subtle); border-radius: 6px;"><i class="ti ti-circle-check" style="color: var(--green); font-size: 16px;"></i><span class="text-sm">${x}</span></div>`).join('')}
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Form 12BB PDF generated')"><i class="ti ti-download"></i> Download Form 12BB</button>`
    };
  },

  // === Admin: Regime change requests inbox ===
  'regime-change-requests': () => {
    const requests = EMP.filter(e => e.entity === S.entity && getRegimeStatus(e.id).changeRequest)
      .map(e => ({ e, req: getRegimeStatus(e.id).changeRequest }));
    return {
      title: 'Tax regime change requests', icon: 'ti-refresh', large: true,
      body: `<p class="text-sm text-secondary mb-3">Employee-initiated regime change requests pending review.</p>
        ${requests.length === 0 ? '<div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div><b>No pending requests</b>All employees are on their selected regime.</div></div>' : requests.map(({ e, req }) => `<div style="border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 10px;">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px;">
            <div class="avatar" style="background: var(--${e.avBg}-bg); color: var(--${e.avBg}-text);">${e.av}</div>
            <div style="flex: 1;">
              <div class="font-semibold">${e.name}</div>
              <div class="text-xs text-secondary">${e.id} · requested ${req.requestedOn}</div>
            </div>
            <div style="text-align: right;">
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="pill pill-${req.fromRegime === 'old' ? 'purple' : 'blue'}">${req.fromRegime === 'old' ? 'Old' : 'New'}</span>
                <i class="ti ti-arrow-right" style="color: var(--text-tertiary);"></i>
                <span class="pill pill-${req.toRegime === 'old' ? 'purple' : 'blue'}">${req.toRegime === 'old' ? 'Old' : 'New'}</span>
              </div>
            </div>
          </div>
          <div style="background: var(--surface-subtle); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
            <div class="text-xs font-semibold text-secondary mb-2">Reason</div>
            <div class="text-sm">${req.reason}</div>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-sm" onclick="closeM(); openM('regime-change-reject', {empId: '${e.id}'})">Reject</button>
            <button class="btn btn-sm btn-success" onclick="closeM(); openM('regime-change-approve', {empId: '${e.id}'})"><i class="ti ti-check"></i> Approve</button>
          </div>
        </div>`).join('')}
        <div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-triangle"></i><div>Approving a regime change triggers retroactive TDS recompute for all prior payslips in FY. May require Form 24Q revision if already filed.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'regime-change-approve': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const req = getRegimeStatus(d.empId).changeRequest;
    if (!e || !req) return { title: 'Error', body: '<p>Request not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Approve regime change · ' + e.name, icon: 'ti-check', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This triggers retroactive TDS recompute</b>All prior payslips for FY 2026-27 will be recomputed. Difference adjusts in next payroll (May 2026).</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Change</div><div class="field-value"><span class="pill pill-${req.fromRegime === 'old' ? 'purple' : 'blue'}">${req.fromRegime === 'old' ? 'Old' : 'New'}</span> → <span class="pill pill-${req.toRegime === 'old' ? 'purple' : 'blue'}">${req.toRegime === 'old' ? 'Old' : 'New'}</span></div></div>
          <div><div class="field-label">Effective from</div><div class="field-value">1 Apr 2026 (retroactive)</div></div>
          <div><div class="field-label">Payslips affected</div><div class="field-value">2 (Apr, May)</div></div>
          <div><div class="field-label">Adjustment in May payroll</div><div class="field-value">Auto-computed</div></div>
        </div>
        <div class="field"><label class="field-label">Admin notes</label><textarea rows="2" placeholder="Internal notes for audit"></textarea></div>
        <div class="field"><label style="display: flex; gap: 8px; align-items: start; cursor: pointer;"><input type="checkbox" /> <span class="text-sm">I confirm the regime change and authorize retroactive recompute.</span></label></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-success" onclick="closeM(); toast('Regime change approved · TDS will recompute in next payroll')"><i class="ti ti-check"></i> Approve & recompute</button>`
    };
  },

  'regime-change-reject': (d) => ({
    title: 'Reject regime change request', icon: 'ti-x',
    body: `<p class="text-sm text-secondary mb-3">Employee will be notified. They can choose either regime when filing their ITR at year-end.</p>
      <div class="field"><label class="field-label">Reason for rejection</label><select><option>FY too far along — switch at ITR filing instead</option><option>Insufficient justification</option><option>Recompute impact too high</option><option>Already used regime change in past year</option><option>Other</option></select></div>
      <div class="field"><label class="field-label">Notes for employee</label><textarea rows="3" placeholder="Suggest alternative (e.g., switch at ITR filing)"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Request rejected · employee notified')"><i class="ti ti-x"></i> Reject</button>`
  }),

  // === Admin: Bulk Form 12BB ===
  'form12bb-bulk-export': () => {
    const oldRegimeEmps = EMP.filter(e => e.entity === S.entity && getRegimeStatus(e.id).selectedRegime === 'old');
    return {
      title: 'Bulk Form 12BB export', icon: 'ti-file-download', large: true,
      body: `<p class="text-sm text-secondary mb-3">Generate Form 12BB for all Old regime employees who have declared. ZIP file with one PDF per employee.</p>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Old regime employees</div><div class="field-value">${oldRegimeEmps.length}</div></div>
          <div><div class="field-label">With declarations</div><div class="field-value text-green">${oldRegimeEmps.filter(e => getITDeclaration(e.id).overallStatus !== 'not_started').length}</div></div>
          <div><div class="field-label">Without declarations</div><div class="field-value text-orange">${oldRegimeEmps.filter(e => getITDeclaration(e.id).overallStatus === 'not_started').length}</div></div>
          <div><div class="field-label">Format</div><div class="field-value">ZIP of PDFs</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Include in export</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" checked /> Form 12BB PDF per employee</label>
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" checked /> Attach proof documents</label>
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" /> Include Other Income declarations (Form 12B reference)</label>
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" /> Include LTA journey details</label>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating Form 12BB ZIP for ' + ${oldRegimeEmps.length} + ' employees')"><i class="ti ti-download"></i> Generate ZIP</button>`
    };
  },

  // === FBP DECLARATION ===

  'fbp-declaration': (d) => {
    const e = EMP.find(x => x.id === d.empId) || EMP[0];
    const fbp = getFBPDeclaration(e.id);
    const allocated = fbp.items.reduce((s, it) => s + it.annual, 0);
    const remaining = fbp.annualEntitlement - allocated;
    const allFBPComponents = [
      { code: 'TEL_ALW', label: 'Telephone allowance', limit: 24000 },
      { code: 'INT_REIMBURSEMENT', label: 'Internet allowance', limit: 24000 },
      { code: 'LTA_REIMB', label: 'LTA', limit: 50000 },
      { code: 'BOOKS_PERIODICAL', label: 'Books & periodicals', limit: 12000 },
      { code: 'FM_A1600CC_REIMB', label: 'Fuel & maintenance', limit: 21600 },
      { code: 'MEDICAL_REIMB', label: 'Medical reimbursement', limit: 15000 }
    ];
    return {
      title: 'FBP declaration · ' + e.name, icon: 'ti-adjustments', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>How FBP works</b>Allocate your annual entitlement across tax-exempt components. Submit → HR approves → Excel exports to engine. Underused allocation at FY-end becomes taxable.</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">FY</div><div class="field-value">${fbp.fy}</div></div>
          <div><div class="field-label">Status</div><div class="field-value">${fbp.overallStatus === 'approved' ? '<span class="pill pill-green">Approved</span>' : fbp.overallStatus === 'submitted' ? '<span class="pill pill-blue">Pending HR</span>' : '<span class="pill pill-gray">Not started</span>'}</div></div>
          <div><div class="field-label">Annual entitlement</div><div class="field-value font-bold">${fmt(fbp.annualEntitlement)}</div></div>
          <div><div class="field-label">Remaining</div><div class="field-value ${remaining > 0 ? 'text-green' : 'text-red'}">${fmt(remaining)}</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Component allocation</div>
        <div style="border: 1px solid var(--border); border-radius: 8px;">
          ${allFBPComponents.map(c => {
        const existing = fbp.items.find(it => it.component === c.code);
        const annual = existing ? existing.annual : 0;
        const status = existing ? existing.status : 'na';
        return `<div style="display: grid; grid-template-columns: 1fr 130px 110px 100px; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); align-items: center;">
              <div>
                <b class="text-sm">${c.label}</b>
                <div class="text-xs text-secondary">${c.code} · max ${fmt(c.limit)}/yr</div>
              </div>
              <input type="text" value="${annual > 0 ? annual.toLocaleString('en-IN') : ''}" placeholder="₹ annual" style="text-align: right;" />
              <div class="text-xs text-secondary text-right">${annual > 0 ? '~' + fmt(Math.round(annual / 12)) + '/mo' : '—'}</div>
              <div>${status === 'approved' ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Approved</span>' : status === 'pending' ? '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Pending</span>' : '<span class="pill pill-gray" style="padding: 1px 6px; font-size: 9px;">—</span>'}</div>
            </div>`;
      }).join('')}
        </div>
        <div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-triangle"></i><div>Once approved, FBP locks for the FY. Mid-year changes require admin override and don't apply retroactively.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn" onclick="closeM(); toast('FBP saved as draft')">Save draft</button><button class="btn btn-primary" onclick="closeM(); toast('FBP submitted for HR approval')"><i class="ti ti-send"></i> Submit for approval</button>`
    };
  },

  'fbp-admin-review': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    return {
      title: 'FBP declarations · admin review · FY 2026-27', icon: 'ti-adjustments', large: true,
      body: `<p class="text-sm text-secondary mb-3">Review and approve employee FBP allocations.</p>
        <table class="schedule-table">
          <thead><tr><th>Employee</th><th class="num">Entitlement</th><th class="num">Allocated</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${emps.map(e => {
        const fbp = getFBPDeclaration(e.id);
        const allocated = fbp.items.reduce((s, it) => s + it.annual, 0);
        return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td class="num">${fmt(fbp.annualEntitlement)}</td><td class="num">${fmt(allocated)}</td><td>${fbp.overallStatus === 'approved' ? '<span class="pill pill-green">Approved</span>' : fbp.overallStatus === 'submitted' ? '<span class="pill pill-blue">Pending</span>' : '<span class="pill pill-gray">Not started</span>'}</td><td><button class="btn btn-sm" onclick="closeM(); openM('fbp-declaration', {empId: '${e.id}'})">View</button></td></tr>`;
      }).join('')}
          </tbody>
        </table>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Approved FBP allocations export to engine via Excel (no public API for FBP).</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); openM('fbp-export-excel')"><i class="ti ti-file-spreadsheet"></i> Export Excel</button>`
    };
  },

  'fbp-export-excel': () => ({
    title: 'Export FBP to engine', icon: 'ti-file-spreadsheet',
    body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Engine sync via Excel (no public API)</b>Upload to greytHR admin: Payroll > Payroll Inputs > FBP Import.</div></div>
      <div class="info-grid mt-3 mb-3">
        <div><div class="field-label">FY</div><div class="field-value">2026-27</div></div>
        <div><div class="field-label">Format</div><div class="field-value">Excel (.xlsx)</div></div>
        <div><div class="field-label">Last sync</div><div class="field-value">Not yet</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('FBP Excel generated')"><i class="ti ti-download"></i> Generate</button>`
  }),

  // === REIMBURSEMENT ADMIN REVIEW ===

  'reimb-admin-review': () => {
    const claims = [
      { id: 'RC-2026-05-01', emp: 'Arjun Mehta', empId: 'EMP1003', category: 'Books', amount: 4500, status: 'pending_approval', billRef: 'OReilly subscription' },
      { id: 'RC-2026-05-02', emp: 'Arjun Mehta', empId: 'EMP1003', category: 'Medical', amount: 8000, status: 'pending_approval', billRef: 'Apollo health checkup' },
      { id: 'RC-2026-05-03', emp: 'Sneha Iyer', empId: 'EMP1058', category: 'Telephone', amount: 1500, status: 'pending_approval', billRef: 'Airtel postpaid' },
      { id: 'RC-2026-05-04', emp: 'Manish Patel', empId: 'EMP2014', category: 'Internet', amount: 2200, status: 'pending_approval', billRef: 'Jio Fiber' }
    ];
    return {
      title: 'Reimbursement claims · admin review', icon: 'ti-wallet', large: true,
      body: `<p class="text-sm text-secondary mb-3">Pending claims require HR approval. Approved claims add to next payroll cycle as tax-exempt reimbursement.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Pending</div><div class="field-value text-orange">${claims.length}</div></div>
          <div><div class="field-label">Total amount</div><div class="field-value">${fmt(claims.reduce((s, c) => s + c.amount, 0))}</div></div>
          <div><div class="field-label">Avg processing time</div><div class="field-value">1.2 days</div></div>
        </div>
        ${claims.map(c => `<div style="display: grid; grid-template-columns: auto 1fr auto auto; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; align-items: center;">
          <div class="avatar" style="background: var(--blue-bg); color: var(--blue-text);">${c.emp.split(' ').map(x => x[0]).join('')}</div>
          <div>
            <div class="font-semibold text-sm">${c.emp} · ${c.category}</div>
            <div class="text-xs text-secondary">${c.id} · ${c.billRef}</div>
          </div>
          <div class="font-bold">${fmt(c.amount)}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm" onclick="closeM(); openM('reimb-claim-detail', {id: '${c.id}'})">Review</button>
            <button class="btn btn-sm btn-icon-only" style="background: var(--green-bg); color: var(--green-text);" onclick="closeM(); toast('Claim approved · will be paid in next payroll')" title="Approve"><i class="ti ti-check"></i></button>
            <button class="btn btn-sm btn-icon-only" style="background: var(--red-bg); color: var(--red-text);" onclick="closeM(); openM('reimb-reject', {id: '${c.id}'})" title="Reject"><i class="ti ti-x"></i></button>
          </div>
        </div>`).join('')}`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-success" onclick="closeM(); toast('All ' + ${claims.length} + ' claims approved')"><i class="ti ti-check"></i> Approve all</button>`
    };
  },

  'reimb-reject': (d) => ({
    title: 'Reject reimbursement claim', icon: 'ti-x',
    body: `<p class="text-sm text-secondary mb-3">Employee will be notified and can resubmit.</p>
      <div class="field"><label class="field-label">Reason</label><select><option>Bill not in employee name</option><option>Bill date outside FY</option><option>Category mismatch</option><option>Exceeds entitlement</option><option>Proof unclear / illegible</option><option>Other (specify below)</option></select></div>
      <div class="field"><label class="field-label">Notes for employee</label><textarea rows="3" placeholder="Clearly explain what to fix"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Claim rejected · employee notified')"><i class="ti ti-x"></i> Reject</button>`
  }),

  // === BATCH LIFECYCLE MODALS ===

  'refresh-batch-status': () => ({
    title: 'Refresh batch status', icon: 'ti-refresh', large: true,
    body: `<p class="text-sm text-secondary mb-3">Pulls the latest processing state from the payroll engine for each employee in the current batch.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Batch month</div><div class="field-value">${S.monthSel === '2026-03' ? 'Mar 2026' : 'May 2026'}</div></div>
        <div><div class="field-label">Last refresh</div><div class="field-value">2 min ago</div></div>
        <div><div class="field-label">Employees</div><div class="field-value">${EMP.filter(e => e.entity === S.entity).length}</div></div>
        <div><div class="field-label">In flight</div><div class="field-value">${EMP.filter(e => e.entity === S.entity && e.syncStatus === 'sending').length}</div></div>
      </div>
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Engine processing states</div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface-subtle); border-radius: 6px;"><div class="sync-dot pending"><i class="ti ti-minus"></i></div><div style="flex: 1;"><b class="text-sm">Pending</b> <span class="text-xs text-secondary">— inputs not yet sent</span></div></div>
        <div style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface-subtle); border-radius: 6px;"><div class="sync-dot sending"><i class="ti ti-loader-2"></i></div><div style="flex: 1;"><b class="text-sm">Sending</b> <span class="text-xs text-secondary">— POST in flight to engine</span></div></div>
        <div style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface-subtle); border-radius: 6px;"><div class="sync-dot synced"><i class="ti ti-check"></i></div><div style="flex: 1;"><b class="text-sm">Synced</b> <span class="text-xs text-secondary">— received, awaiting payroll computation</span></div></div>
        <div style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface-subtle); border-radius: 6px;"><div class="sync-dot error"><i class="ti ti-x"></i></div><div style="flex: 1;"><b class="text-sm">Error</b> <span class="text-xs text-secondary">— engine rejected, see employee detail</span></div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('Batch status refreshed')"><i class="ti ti-refresh"></i> Refresh now</button>`
  }),

  'delete-salary-item': (d) => {
    const e = EMP.find(x => x.id === d.empId) || EMP[0];
    return {
      title: 'Delete salary item · ' + e.name, icon: 'ti-trash', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Destructive action</b>Removes the item code from greytHR entirely (not just sets to 0). Use only when an item was added by mistake.</div></div>
        <div class="field mt-3"><label class="field-label">Item code to delete</label><select>${Object.keys(GREYTHR_ITEM_CODES).map(c => `<option value="${c}">${c} · ${GREYTHR_ITEM_CODES[c].desc}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">Effective from</label><input type="date" value="2026-05-01" /></div>
        <div class="field"><label class="field-label">Reason</label><textarea placeholder="Required for audit"></textarea></div>
        <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Calls <span class="text-mono">DELETE /payroll/v2/employees/${e.id}</span> with the item body. Past months unaffected.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Item deleted from engine')"><i class="ti ti-trash"></i> Delete item</button>`
    };
  },

  'view-attendance-snapshot': (d) => {
    const e = EMP.find(x => x.id === d.empId) || EMP[0];
    return {
      title: 'Attendance snapshot from engine · ' + e.name, icon: 'ti-calendar-event', large: true,
      body: `<p class="text-sm text-secondary mb-3">Current attendance state as stored in the engine. Compared with MySlice Shifts source.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Period</div><div class="field-value">May 1 — 31, 2026</div></div>
          <div><div class="field-label">Status</div><div class="field-value text-green"><i class="ti ti-circle-check"></i> Match</div></div>
          <div><div class="field-label">MySlice (Shifts)</div><div class="field-value">${e.att.worked + e.att.paid} payable · ${e.att.lop} LOP</div></div>
          <div><div class="field-label">Engine</div><div class="field-value">${e.att.worked + e.att.paid} payable · ${e.att.lop} LOP</div></div>
        </div>
        <table class="schedule-table">
          <thead><tr><th>Date</th><th>Day type</th><th>Status</th><th class="num">Hours</th></tr></thead>
          <tbody>
            <tr><td>1 May</td><td>Weekday</td><td>Present</td><td class="num">8.5</td></tr>
            <tr><td>2 May</td><td>Weekday</td><td>Present</td><td class="num">8.2</td></tr>
            <tr><td>3 May</td><td>Sat</td><td>Off</td><td class="num">—</td></tr>
            <tr><td>4 May</td><td>Sun</td><td>Off</td><td class="num">—</td></tr>
            <tr><td colspan="4" style="text-align: center; padding: 12px;"><span class="text-secondary">...showing 4 of 31 days...</span></td></tr>
          </tbody>
        </table>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'pay-period-lookup': () => ({
    title: 'Pay period lookup', icon: 'ti-calendar-search',
    body: `<p class="text-sm text-secondary mb-3">Check which payroll period a specific date falls into. Useful for arrears entry, F&F LWD computation.</p>
      <div class="field"><label class="field-label">Input date</label><input type="date" value="2026-05-15" /></div>
      <div class="info-grid mt-3">
        <div><div class="field-label">Payroll month</div><div class="field-value">May 2026</div></div>
        <div><div class="field-label">Period start</div><div class="field-value">1 May 2026</div></div>
        <div><div class="field-label">Period end</div><div class="field-value">31 May 2026</div></div>
        <div><div class="field-label">Work days</div><div class="field-value">22</div></div>
        <div><div class="field-label">Attendance lock</div><div class="field-value">26 May 2026</div></div>
        <div><div class="field-label">Pay date</div><div class="field-value">1 Jun 2026</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button>`
  }),

  'pay-period-config': () => {
    const pp = E[S.entity].payPeriod;
    return {
      title: 'Pay period configuration · ' + E[S.entity].name, icon: 'ti-settings', large: true,
      body: `<p class="text-sm text-secondary mb-3">Configure when the pay period starts and ends, the attendance lock day, and pay date. Applies to all employees in this entity.</p>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Cutoff start (previous month day)</label><input type="number" value="${pp.cutoffStart}" min="1" max="31" /><div class="text-xs text-secondary mt-2">e.g., 26 means period starts on 26th of previous month</div></div>
          <div class="field"><label class="field-label">Cutoff end (current month day)</label><input type="number" value="${pp.cutoffEnd}" min="1" max="31" /><div class="text-xs text-secondary mt-2">e.g., 25 means period ends on 25th of current month</div></div>
        </div>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Attendance lock day</label><input type="number" value="${pp.attendanceLockDay}" min="1" max="31" /><div class="text-xs text-secondary mt-2">After this day, attendance can't be edited without revert</div></div>
          <div class="field"><label class="field-label">Pay date (next month day)</label><input type="number" value="${pp.payDate}" min="1" max="31" /><div class="text-xs text-secondary mt-2">When salary is credited to employee bank accounts</div></div>
        </div>
        <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Changes take effect from next pay period</b>Current in-progress payroll uses existing settings.</div></div>
        <div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform: uppercase; letter-spacing: 0.4px;">Preview for May 2026 cycle</div>
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: 8px; font-size: 12px;">
          <div>Period: <b>${pp.cutoffStart} Apr 2026 — ${pp.cutoffEnd} May 2026</b></div>
          <div style="margin-top: 4px;">Attendance locks on: <b>${pp.attendanceLockDay} May 2026</b></div>
          <div style="margin-top: 4px;">Pay date: <b>${pp.payDate} Jun 2026</b></div>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Pay period config saved')">Save</button>`
    };
  },

  'attendance-issues': () => {
    const flagged = EMP.filter(e => e.entity === S.entity && (e.flagged || e.att.lop > 0));
    return {
      title: 'Attendance issues · ' + E[S.entity].name, icon: 'ti-alert-triangle', large: true,
      body: `<p class="text-sm text-secondary mb-3">Employees with LOP or flagged attendance for the current pay period. Fix in MySlice Shifts module if needed.</p>
        ${flagged.length === 0 ? '<div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div><b>No issues found</b>All employees have clean attendance for this period.</div></div>' : flagged.map(e => `<div style="display: flex; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; align-items: center;">
          <div class="avatar" style="background: var(--${e.avBg}-bg); color: var(--${e.avBg}-text);">${e.av}</div>
          <div style="flex: 1;">
            <div class="font-semibold">${e.name}</div>
            <div class="text-xs text-secondary">${e.id} · ${e.flagged ? '<span class="text-red">Flagged ' + (e.flag || 'attendance issue') + '</span>' : e.att.lop + ' LOP days'}</div>
          </div>
          <button class="btn btn-sm" onclick="closeM(); openM('attendance-detail', {empId: '${e.id}'})">View</button>
          ${e.flagged ? `<button class="btn btn-sm" onclick="closeM(); openM('handle-flagged', {empId: '${e.id}'})">Resolve</button>` : ''}
        </div>`).join('')}`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  'attendance-detail': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Attendance', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Attendance detail · ' + e.name, icon: 'ti-calendar', large: true,
      body: `<p class="text-sm text-secondary mb-3">Per-day attendance for current pay period · source: MySlice Shifts</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Worked days</div><div class="field-value">${e.att.worked}</div></div>
          <div><div class="field-label">Paid leaves</div><div class="field-value">${e.att.paid}</div></div>
          <div><div class="field-label">LOP days</div><div class="field-value ${e.att.lop > 0 ? 'text-red' : ''}">${e.att.lop}</div></div>
          <div><div class="field-label">Payable</div><div class="field-value font-bold">${e.att.worked + e.att.paid}</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Per-day breakdown (Shifts data)</div>
        <table class="schedule-table">
          <thead><tr><th>Date</th><th>Day</th><th>Status</th><th class="num">Hours</th><th>Note</th></tr></thead>
          <tbody>
            <tr><td>1 May</td><td>Thu</td><td><span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Present</span></td><td class="num">8.5</td><td class="text-secondary">—</td></tr>
            <tr><td>2 May</td><td>Fri</td><td><span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Present</span></td><td class="num">8.2</td><td class="text-secondary">—</td></tr>
            <tr><td>3 May</td><td>Sat</td><td><span class="pill pill-gray" style="padding: 1px 6px; font-size: 9px;">Off</span></td><td class="num">—</td><td class="text-secondary">—</td></tr>
            <tr><td>4 May</td><td>Sun</td><td><span class="pill pill-gray" style="padding: 1px 6px; font-size: 9px;">Off</span></td><td class="num">—</td><td class="text-secondary">—</td></tr>
            <tr><td>5 May</td><td>Mon</td><td><span class="pill pill-blue" style="padding: 1px 6px; font-size: 9px;">Paid leave</span></td><td class="num">—</td><td class="text-secondary">Sick leave (approved)</td></tr>
            ${e.att.lop > 0 ? '<tr><td>6 May</td><td>Tue</td><td><span class="pill pill-red" style="padding: 1px 6px; font-size: 9px;">LOP</span></td><td class="num">—</td><td class="text-red">No punch · no leave</td></tr>' : ''}
            <tr><td colspan="5" style="text-align: center; padding: 10px; color: var(--text-tertiary);">...showing 5 of 31 days...</td></tr>
          </tbody>
        </table>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>To fix attendance, edit in <b>MySlice Shifts</b> module. After fixing, return here and click Recompute attendance.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn" onclick="closeM(); toast('Opening Shifts module...')"><i class="ti ti-external-link"></i> Open in Shifts</button>`
    };
  },

  'confirm-lop-sync': () => {
    const employees = EMP.filter(e => e.entity === S.entity);
    const totalLOP = employees.reduce((s, e) => s + (e.att.lop || 0), 0);
    const flagged = employees.filter(e => e.flagged).length;
    return {
      title: 'Send LOP to greytHR · ' + lopMonthLabel(), icon: 'ti-send', large: true,
      body: `<p class="mb-3">Send <b>LOP days only</b> for <b>${employees.length}</b> employees in <b>${E[S.entity].name}</b>. greytHR will use its configured payroll working days to derive payable days.</p>
        ${flagged ? `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>${flagged} employee(s) flagged</b>May fail sync until resolved in Shifts.</div></div>` : ''}
        <div class="info-grid mt-3">
          <div><div class="field-label">Payroll month</div><div class="field-value">${lopMonthLabel()}</div></div>
          <div><div class="field-label">Total LOP days</div><div class="field-value">${totalLOP}</div></div>
          <div><div class="field-label">Employees</div><div class="field-value">${employees.length}</div></div>
          <div><div class="field-label">Sync type</div><div class="field-value">LOP only</div></div>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button>${apiDetailsBtnInline('lop-batch-sample', {})}<button class="btn btn-primary" onclick="confirmSendLopSync()"><i class="ti ti-send"></i> Send ${employees.length} LOP updates</button>`
    };
  },

  'edit-resignation-step': (d) => {
    const rows = getResignationWorkflowRows();
    const s = rows.find(x => x.id === d.id);
    if (!s) return { title: 'Edit step', body: '<p>Step not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Edit clearance step · ' + s.label, icon: 'ti-git-branch', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Step</div><div class="field-value">${s.order}. ${s.label}</div></div>
        <div><div class="field-label">greytHR action</div><div class="field-value">${s.greytHRAction}</div></div>
      </div>
      <div class="field"><label class="field-label">Approver role</label><input type="text" id="rw-approver" value="${s.approver}" placeholder="e.g. HR Admin" /></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">SLA (business days)</label><input type="number" id="rw-sla" value="${s.slaDays != null ? s.slaDays : ''}" placeholder="Optional" min="0" /></div>
        <div class="field"><label class="field-label">Required step</label><select id="rw-required"><option value="yes" ${s.required ? 'selected' : ''}>Yes</option><option value="no" ${!s.required ? 'selected' : ''}>No</option></select></div>
      </div>
      <div class="field"><label class="field-label">Enabled</label><select id="rw-enabled"><option value="yes" ${s.enabled ? 'selected' : ''}>Yes</option><option value="no" ${!s.enabled ? 'selected' : ''}>No</option></select></div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Changes apply to new offboarding cases in ${E[S.entity].name}. Active cases keep their current step state.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="saveResignationStep('${s.id}')"><i class="ti ti-check"></i> Save step</button>`
    };
  },

  'edit-resignation-policy': () => {
    const p = RESIGNATION_POLICY;
    return {
      title: 'Edit offboarding policy', icon: 'ti-settings', large: true,
      body: `<p class="text-sm text-secondary mb-3">Entity-level rules for ${E[S.entity].name}. Controls separation sync prerequisites.</p>
      <div class="field"><label class="field-label">Standard notice period (days)</label><input type="number" id="rp-notice" value="${p.noticePeriodDays}" min="0" /></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Require encashment push before separation</label><select id="rp-encash"><option value="yes" ${p.requireEncashmentBeforeSeparation ? 'selected' : ''}>Yes</option><option value="no" ${!p.requireEncashmentBeforeSeparation ? 'selected' : ''}>No</option></select></div>
        <div class="field"><label class="field-label">Require LOP sync before separation</label><select id="rp-lop"><option value="yes" ${p.requireLopSyncBeforeSeparation ? 'selected' : ''}>Yes</option><option value="no" ${!p.requireLopSyncBeforeSeparation ? 'selected' : ''}>No</option></select></div>
      </div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Allow exclude from F&F</label><select id="rp-exclude"><option value="yes" ${p.allowExcludeFromFF ? 'selected' : ''}>Yes</option><option value="no" ${!p.allowExcludeFromFF ? 'selected' : ''}>No</option></select></div>
        <div class="field"><label class="field-label">Enable alumni portal after F&F</label><select id="rp-alumni"><option value="yes" ${p.alumniPortalAfterFF ? 'selected' : ''}>Yes</option><option value="no" ${!p.alumniPortalAfterFF ? 'selected' : ''}>No</option></select></div>
      </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="saveResignationPolicy()"><i class="ti ti-check"></i> Save policy</button>`
    };
  },

  'sync-error-detail': (d) => {
    const e = SYNC_ERRORS.find(x => x.id === d.id);
    if (!e) return { title: 'Sync error', body: '<p>Record not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const action = syncActionLabel(e.type, e.scope);
    return {
      title: 'Sync failure · ' + e.emp, icon: 'ti-alert-triangle', large: true,
      body: `<div style="display:flex;gap:14px;align-items:center;padding:14px 16px;background:var(--surface-subtle);border-radius:10px;margin-bottom:14px;">
        <div style="transform:scale(1.4);">${syncErrorSeverityPill(e.severity)}</div>
        <div style="flex:1;">
          <div class="font-semibold">${e.emp} · ${action}</div>
          <div class="text-sm text-secondary">Last attempt: ${e.date} · ${e.time}</div>
        </div>
      </div>
      <div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${e.emp} (${e.empId})</div></div>
        <div><div class="field-label">Action</div><div class="field-value">${action}</div></div>
        <div><div class="field-label">Status</div><div class="field-value"><span class="pill pill-red"><i class="ti ti-x"></i> Failed</span></div></div>
        <div><div class="field-label">Scope</div><div class="field-value">${e.scope}</div></div>
        <div><div class="field-label">Error</div><div class="field-value text-red">${e.reason}</div></div>
        <div><div class="field-label">Last attempt</div><div class="field-value">${e.date} · ${e.time}</div></div>
        ${e.batchRef ? `<div><div class="field-label">Batch reference</div><div class="field-value text-mono">${e.batchRef}</div></div>` : ''}
      </div>
      <div class="alert-banner alert-orange mb-3"><i class="ti ti-tool"></i><div><b>How to fix</b>${e.fixHint}</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('sync-error', { id: e.id })}<button class="btn" onclick="closeM(); resolveSyncError('${e.id}')"><i class="ti ti-check"></i> Mark resolved</button>${e.fixNav ? `<button class="btn" onclick="closeM(); nav('${e.fixNav}')"><i class="ti ti-arrow-right"></i> Open fix page</button>` : ''}${e.retryKind ? `<button class="btn btn-primary" onclick="closeM(); retrySyncError('${e.id}')"><i class="ti ti-refresh"></i> Retry</button>` : ''}`
    };
  },

  'export-sync-errors': () => ({
    title: 'Export sync errors', icon: 'ti-download',
    body: `<p class="mb-3">Download open sync failures for <b>${E[S.entity].name}</b> as CSV for IT / HR review.</p>
      <div class="info-grid">
        <div><div class="field-label">Open errors</div><div class="field-value">${getSyncErrorRows().length}</div></div>
        <div><div class="field-label">Includes</div><div class="field-value">Employee, LOP, encashment, separation</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Sync errors export queued')"><i class="ti ti-download"></i> Export CSV</button>`
  }),

  'export-sync-history': () => ({
    title: 'Export sync history', icon: 'ti-download',
    body: `<p class="mb-3">Download sync runs for <b>${E[S.entity].name}</b> as CSV or PDF for compliance review.</p>
      <div class="info-grid">
        <div><div class="field-label">Records</div><div class="field-value">${SYNC_HISTORY.filter(h => h.entity === S.entity).length} runs</div></div>
        <div><div class="field-label">Date range</div><div class="field-value">Apr — May 2026</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Sync history export queued')"><i class="ti ti-download"></i> Export CSV</button>`
  }),

  'sync-history-detail': (d) => {
    const h = SYNC_HISTORY.find(x => x.id === d.id);
    if (!h) return { title: 'Sync detail', body: '<p>Record not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const navTarget = h.type === 'lop' ? 'lop-sync' : h.type === 'employee' ? 'employees' : h.type === 'loan' ? 'loans' : h.type === 'separation' || h.type === 'encashment' ? 'resignation' : null;
    return {
      title: h.label + ' · ' + h.period, icon: 'ti-history', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Reference</div><div class="field-value text-mono">${h.ref}</div></div>
        <div><div class="field-label">Entity</div><div class="field-value">${E[h.entity].name}</div></div>
        <div><div class="field-label">Date / time</div><div class="field-value">${h.date} · ${h.time}</div></div>
        <div><div class="field-label">Triggered by</div><div class="field-value">${h.actor}</div></div>
        <div><div class="field-label">Records</div><div class="field-value">${h.success} synced${h.failed ? ' · ' + h.failed + ' failed' : ''} of ${h.total}</div></div>
        <div><div class="field-label">Status</div><div class="field-value">${syncHistoryStatusPill(h.status)}</div></div>
      </div>
      ${h.detail ? `<div class="alert-banner ${h.failed ? 'alert-orange' : 'alert-blue'} mb-3"><i class="ti ti-${h.failed ? 'alert-triangle' : 'info-circle'}"></i><div>${h.detail}</div></div>` : ''}
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Sync summary</div>
      <div class="info-grid">
        <div><div class="field-label">Action</div><div class="field-value">${h.label}</div></div>
        <div><div class="field-label">Period</div><div class="field-value">${h.period}</div></div>
        <div><div class="field-label">Result</div><div class="field-value">${h.success} synced${h.failed ? ' · ' + h.failed + ' failed' : ''} of ${h.total}</div></div>
        <div><div class="field-label">Sample record</div><div class="field-value">${describeSyncPayload(h.type, h.payload)}</div></div>
      </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('sync-history', { id: h.id })}${navTarget ? `<button class="btn btn-primary" onclick="closeM(); nav('${navTarget}')"><i class="ti ti-arrow-right"></i> Open ${syncHistoryTypeLabel(h.type === 'encashment' ? 'separation' : h.type)}</button>` : ''}${h.failed ? `<button class="btn" onclick="closeM(); nav('sync-errors')"><i class="ti ti-refresh"></i> View errors</button>` : ''}`
    };
  },

  'edit-encashment-mapping': (d) => {
    const rows = getEncashmentMappingRows(S.entity);
    const row = rows.find(r => r.key === d.key);
    if (!row) return { title: 'Edit mapping', body: '<p>Row not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const repoNote = row.repositoryId ? `Repository id ${row.repositoryId} (admin only)` : 'Repository id not assigned until greytHR component is confirmed';
    return {
      title: 'Edit encashment mapping · ' + row.mySliceField, icon: 'ti-arrows-exchange', large: true,
      body: `<div class="alert-banner alert-orange mb-3"><i class="ti ti-alert-triangle"></i><div>Mapping is not live until API validation completes. Only the confirmed submission path (days <b>or</b> amount) will be used per employee F&F.</div></div>
      <div class="info-grid mb-3">
        <div><div class="field-label">MySlice field</div><div class="field-value">${row.mySliceField}</div></div>
        <div><div class="field-label">Validation status</div><div class="field-value">${encashMappingValidationPill(row.validationStatus)}</div></div>
        <div><div class="field-label">Submission method</div><div class="field-value">${row.submissionMethod}</div></div>
        <div><div class="field-label">Technical</div><div class="field-value text-xs text-secondary">${repoNote}</div></div>
      </div>
      <div class="field"><label class="field-label">greytHR component name</label><input type="text" id="em-greythr-component" value="${row.greytHRComponent}" placeholder="e.g. Leave Encashment" /></div>
      <div class="field"><label class="field-label">Component code</label><input type="text" id="em-component-code" value="${row.componentCode || ''}" placeholder="${row.key === 'days' ? 'Assigned after API validation' : 'LEAVE_ENCASHMENT'}" ${row.key === 'days' ? '' : ''} /></div>
      ${row.key === 'days' ? '<div class="text-xs text-secondary mt-2">Leave blank until greytHR confirms the leave/F&F days input component.</div>' : '<div class="text-xs text-secondary mt-2">Update if your greytHR salary repository uses a different code for the hand-entry component.</div>'}`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="saveEncashmentMapping('${row.key}')"><i class="ti ti-check"></i> Save mapping</button>`
    };
  },

  'lop-sync-detail': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'LOP sync detail', body: 'Employee not found', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const status = getLopSyncStatus(e.id);
    return {
      title: 'LOP sync · ' + e.name, icon: 'ti-calendar-stats', large: true,
      body: `<div style="display:flex;gap:14px;align-items:center;padding:14px 16px;background:var(--surface-subtle);border-radius:10px;margin-bottom:14px;">
        <div style="transform:scale(1.4);">${lopSyncPill(status)}</div>
        <div style="flex:1;">
          <div class="font-semibold">${e.name} · LOP sync</div>
          <div class="text-sm text-secondary">${status === 'synced' ? 'Synced to greytHR' : status === 'error' ? 'Sync failed' : 'Pending sync'}</div>
        </div>
      </div>
      <div class="info-grid mb-3">
          <div><div class="field-label">Employee</div><div class="field-value">${e.name} (${e.id})</div></div>
          <div><div class="field-label">Action</div><div class="field-value">LOP sync</div></div>
          <div><div class="field-label">Status</div><div class="field-value">${lopSyncPill(status)}</div></div>
          <div><div class="field-label">LOP days (sent)</div><div class="field-value font-bold ${e.att.lop > 0 ? 'text-red' : ''}">${e.att.lop || 0}</div></div>
          <div><div class="field-label">Payroll month</div><div class="field-value">${lopMonthLabel()}</div></div>
          <div><div class="field-label">greytHR ID</div><div class="field-value text-mono">${e.gretyId || '—'}</div></div>
        </div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Payable days are calculated inside greytHR using configured payroll working days minus this LOP value.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('lop', { empId: e.id })}${status === 'error' ? `<button class="btn btn-primary" onclick="closeM(); retryLopSync('${e.id}')"><i class="ti ti-refresh"></i> Retry</button>` : ''}`
    };
  },

  'confirm-submit-payroll': () => {
    const employees = EMP.filter(e => e.entity === S.entity);
    const monthCode = S.monthSel + '-01';
    const net = employees.reduce((s, e) => { const p = computePayslip(e.id, monthCode); return s + (p ? p.netPay : 0); }, 0);
    return {
      title: 'Confirm payroll submission', icon: 'ti-shield-check', large: true,
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Final action · cannot be undone without reverse</b>Submits all ${employees.length} employees to payroll engine. Locks the batch. Generates payslips. Releases bank file.</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Employees</div><div class="field-value">${employees.length}</div></div>
          <div><div class="field-label">Net to bank</div><div class="field-value font-bold text-green">${fmt(net)}</div></div>
          <div><div class="field-label">Pay date</div><div class="field-value">${E[S.entity].payPeriod.payDate} ${S.monthSel === '2026-05' ? 'Jun' : 'Next month'} 2026</div></div>
          <div><div class="field-label">Engine</div><div class="field-value">${employees.length} API calls</div></div>
        </div>
        <div class="field"><label style="display: flex; gap: 8px; align-items: start; cursor: pointer;"><input type="checkbox" /> <span class="text-sm">I have reviewed all inputs and computed amounts. I authorize this submission.</span></label></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-success" onclick="confirmSendLopSync()"><i class="ti ti-check"></i> Send LOP</button>`
    };
  },

  // === ADMIN ACTION MODALS ===

  'approve-computed-payroll': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const total = emps.reduce((s, e) => { const p = computePayslip(e.id, '2026-05-01'); return s + (p ? p.netPay : 0); }, 0);
    return {
      title: 'Approve computed payroll · May 2026', icon: 'ti-shield-check', large: true,
      body: `<p class="text-sm text-secondary mb-3">Review the engine's computed payroll before releasing to bank. Approval locks the batch.</p>
        <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This is the final review</b>After approval, payslips publish to employees and bank file generates. To make changes after this point, you must Reverse-and-Reprocess.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Employees</div><div class="field-value">${emps.length}</div></div>
          <div><div class="field-label">Gross earnings</div><div class="field-value">${fmt(emps.reduce((s, e) => { const p = computePayslip(e.id, '2026-05-01'); return s + (p ? p.grossEarnings : 0); }, 0))}</div></div>
          <div><div class="field-label">Total deductions</div><div class="field-value text-red">${fmt(emps.reduce((s, e) => { const p = computePayslip(e.id, '2026-05-01'); return s + (p ? p.totalDeductions : 0); }, 0))}</div></div>
          <div><div class="field-label">Net bank transfer</div><div class="field-value font-bold text-green">${fmt(total)}</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform: uppercase; letter-spacing: 0.4px;">Variance vs last month</div>
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: 8px;">
          <div class="text-sm">Net pay change: <b class="text-green">+${fmt(125000)}</b> (driven by Q1 bonuses)</div>
          <div class="text-sm">Employee count change: <b>+0</b></div>
          <div class="text-sm">LOP change: <b class="text-red">+10 days</b> (Karthik Rao flagged)</div>
        </div>
        <div class="field mt-3"><label style="display: flex; gap: 8px; align-items: start; cursor: pointer;"><input type="checkbox" /> <span class="text-sm">I have reviewed the variance and confirm the computed payroll is correct</span></label></div>
        <div class="field"><label class="field-label">Approver authority</label><select><option>Finance Admin + CEO</option></select></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-success" onclick="closeM(); toast('Payroll approved · payslips published · bank file ready')"><i class="ti ti-check"></i> Approve & release</button>`
    };
  },

  'reprocess-employee': (d) => {
    const e = EMP.find(x => x.id === d.empId) || EMP[0];
    return {
      title: 'Reprocess employee · ' + e.name, icon: 'ti-refresh', large: true,
      body: `<p class="text-sm text-secondary mb-3">Re-trigger engine computation for this employee without resending the whole batch. Use when inputs were corrected after batch sent.</p>
        <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Engine will recompute</b>Updates this employee's payslip, deductions, and net pay. Other employees in batch unaffected.</div></div>
        <div class="info-grid mt-3">
          <div><div class="field-label">Current sync</div><div class="field-value">${e.syncStatus === 'synced' ? '<span class="pill pill-green">Synced</span>' : '<span class="pill pill-orange">' + e.syncStatus + '</span>'}</div></div>
          <div><div class="field-label">Batch month</div><div class="field-value">May 2026</div></div>
        </div>
        <div class="field mt-3"><label class="field-label">Reason</label><select><option>Corrected attendance after lock</option><option>Adjusted incentive amount</option><option>Tax regime change</option><option>Loan EMI correction</option><option>Other</option></select></div>
        <div class="field"><label class="field-label">Justification</label><textarea placeholder="Audit trail"></textarea></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Reprocessing ${e.name}...')"><i class="ti ti-refresh"></i> Reprocess</button>`
    };
  },

  'lock-attendance': () => ({
    title: 'Lock attendance · May 2026', icon: 'ti-lock', large: true,
    body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This locks attendance for the entire entity</b>After lock, MySlice Shifts no longer pushes updates for May 2026 to the payroll engine. To re-open, you'd need to Revert.</div></div>
      <div class="info-grid mt-3">
        <div><div class="field-label">Entity</div><div class="field-value">${E[S.entity].name}</div></div>
        <div><div class="field-label">Month</div><div class="field-value">May 2026</div></div>
        <div><div class="field-label">Employees affected</div><div class="field-value">${EMP.filter(e => e.entity === S.entity).length}</div></div>
        <div><div class="field-label">Lock date target</div><div class="field-value">26 May 2026</div></div>
      </div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>After lock: continue editing salary/loan inputs, then "Send to engine". Attendance edits require unlock.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Attendance locked for May 2026')"><i class="ti ti-lock"></i> Lock attendance</button>`
  }),

  'open-next-period': () => ({
    title: 'Open next pay period · Jun 2026', icon: 'ti-calendar-plus',
    body: `<p class="text-sm text-secondary mb-3">Opens June 2026 in MySlice for input editing. Doesn't affect engine state.</p>
      <div class="info-grid">
        <div><div class="field-label">New period</div><div class="field-value">Jun 2026</div></div>
        <div><div class="field-label">Start date</div><div class="field-value">1 Jun 2026</div></div>
        <div><div class="field-label">End date</div><div class="field-value">30 Jun 2026</div></div>
        <div><div class="field-label">Work days</div><div class="field-value">22</div></div>
        <div><div class="field-label">Pay date</div><div class="field-value">1 Jul 2026</div></div>
        <div><div class="field-label">Send by</div><div class="field-value">28 Jun 2026</div></div>
      </div>
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Standing inputs (CTC, PF, regime, active loans) auto-carry over. Verify before sending.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Jun 2026 opened for input editing')"><i class="ti ti-arrow-right"></i> Open period</button>`
  }),

  'bulk-tax-regime': () => ({
    title: 'Bulk update tax regime', icon: 'ti-shield', large: true,
    body: `<p class="text-sm text-secondary mb-3">Apply tax regime change to multiple employees at once. Typically done at start of FY after employees indicate their choice.</p>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Tax regime can be changed once per FY for salaried employees. greytHR re-runs TDS calculation for affected month.</div></div>
      <div class="field mt-3"><label class="field-label">Apply to</label><select><option>All employees in entity (${EMP.filter(e => e.entity === S.entity).length})</option><option>Only employees still on Old regime</option><option>Only employees still on New regime</option><option>Selected employees</option></select></div>
      <div class="field"><label class="field-label">New regime</label><select><option value="new">New regime (TAX_REGIME = 2)</option><option value="old">Old regime (TAX_REGIME = 1)</option></select></div>
      <div class="field"><label class="field-label">Effective from</label><select><option>1 Apr 2026 (FY 2026-27 start)</option><option>Next month</option></select></div>
      <div class="field"><label class="field-label">Notify employees via email</label><div style="display: flex; gap: 8px; align-items: center; padding: 10px 14px; background: var(--surface-subtle); border-radius: 8px;"><label class="toggle"><input type="checkbox" checked /><span class="toggle-slider"></span></label><span class="text-sm">Send notification email with regime comparison</span></div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Tax regime updated for ' + EMP.filter(e => e.entity === S.entity).length + ' employees')">Apply</button>`
  }),

  'generate-bank-file': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const total = emps.reduce((s, e) => { const p = computePayslip(e.id, '2026-04-01'); return s + (p ? p.netPay : 0); }, 0);
    return {
      title: 'Generate bank transfer file', icon: 'ti-cash-banknote', large: true,
      body: `<p class="text-sm text-secondary mb-3">Generates NEFT/RTGS/IFT bank file for upload to the company bank portal.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Company bank</div><div class="field-value">HDFC Bank · A/c ••••8401</div></div>
          <div><div class="field-label">Period</div><div class="field-value">Apr 2026 payroll</div></div>
          <div><div class="field-label">Employees</div><div class="field-value">${emps.length}</div></div>
          <div><div class="field-label">Total transfer</div><div class="field-value font-bold text-green">${fmt(total)}</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">File format</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label class="policy-option active" style="padding: 12px;"><div class="policy-radio"></div><div><b class="text-sm">HDFC Bank format (recommended)</b><div class="text-xs text-secondary">Direct upload to NetBanking · auto-validates IFSC</div></div></label>
          <label class="policy-option" style="padding: 12px;"><div class="policy-radio"></div><div><b class="text-sm">Generic NEFT (.txt)</b><div class="text-xs text-secondary">Universal format · works with most banks</div></div></label>
          <label class="policy-option" style="padding: 12px;"><div class="policy-radio"></div><div><b class="text-sm">Excel (manual review)</b><div class="text-xs text-secondary">Use for spot-checking before bank upload</div></div></label>
        </div>
        <div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-triangle"></i><div>Confirm bank balance covers the transfer before uploading to bank portal.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Bank file generated · ' + fmt(total))"><i class="ti ti-download"></i> Generate file</button>`
    };
  },

  // === ADMIN: REVIEW EMPLOYEE IT DECLARATIONS ===

  'itdec-admin-review': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const counts = {
      approved: emps.filter(e => getITDeclaration(e.id).overallStatus === 'approved').length,
      submitted: emps.filter(e => getITDeclaration(e.id).overallStatus === 'submitted').length,
      partial: emps.filter(e => getITDeclaration(e.id).overallStatus === 'partially_approved').length,
      rejected: emps.filter(e => getITDeclaration(e.id).overallStatus === 'rejected').length,
      notStarted: emps.filter(e => getITDeclaration(e.id).overallStatus === 'not_started').length
    };
    return {
      title: 'IT declarations · admin review · FY 2026-27', icon: 'ti-receipt-tax', large: true,
      body: `<p class="text-sm text-secondary mb-3">Review and approve employee tax declarations. Approved declarations get exported to engine via Excel sync.</p>
        <div class="stat-grid mb-3">
          <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Approved</div><div class="stat-value">${counts.approved}</div></div></div>
          <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-clock"></i></div><div><div class="stat-label">Pending review</div><div class="stat-value">${counts.submitted}</div></div></div>
          <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-alert-circle"></i></div><div><div class="stat-label">Partial</div><div class="stat-value">${counts.partial}</div></div></div>
          <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-x"></i></div><div><div class="stat-label">Rejected</div><div class="stat-value">${counts.rejected}</div></div></div>
        </div>
        <table class="schedule-table">
          <thead><tr><th>Employee</th><th>Regime</th><th>Status</th><th class="num">Declared</th><th class="num">Approved</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            ${emps.map(e => {
        const d = getITDeclaration(e.id);
        const tot = totalITDeclared(e.id);
        const ap = totalITApproved(e.id);
        const statusBadge = d.overallStatus === 'approved' ? '<span class="pill pill-green">Approved</span>' :
          d.overallStatus === 'submitted' ? '<span class="pill pill-blue">Pending</span>' :
            d.overallStatus === 'partially_approved' ? '<span class="pill pill-orange">Partial</span>' :
              d.overallStatus === 'rejected' ? '<span class="pill pill-red">Rejected</span>' :
                '<span class="pill pill-gray">Not started</span>';
        return `<tr><td><b>${e.name}</b><br><span class="text-xs text-secondary">${e.id}</span></td><td><span class="pill pill-${e.taxRegime === 'old' ? 'purple' : 'blue'}" style="padding: 1px 6px; font-size: 9px;">${e.taxRegime === 'old' ? 'Old' : 'New'}</span></td><td>${statusBadge}</td><td class="num">${fmt(tot.total)}</td><td class="num text-green">${fmt(ap)}</td><td>${d.submittedOn || '—'}</td><td>${d.overallStatus === 'submitted' || d.overallStatus === 'partially_approved' ? `<button class="btn btn-sm btn-primary" onclick="closeM(); openM('itdec-review-employee', {empId: '${e.id}'})">Review</button>` : `<button class="btn btn-sm" onclick="closeM(); openM('itdec-review-employee', {empId: '${e.id}'})">View</button>`}</td></tr>`;
      }).join('')}
          </tbody>
        </table>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Employees on New regime don't need to declare. Approved declarations export to engine via Excel sync (no public API).</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn" onclick="closeM(); toast('Reminder emails sent')"><i class="ti ti-mail"></i> Send reminders</button><button class="btn btn-primary" onclick="closeM(); openM('itdec-export-excel')"><i class="ti ti-file-spreadsheet"></i> Export Excel for engine</button>`
    };
  },

  'itdec-review-employee': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const dec = getITDeclaration(d.empId);
    if (!e) return { title: 'Review', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const sectionLabels = { '80C': 'Section 80C', '80D': 'Section 80D', '80CCD_1B': 'NPS 80CCD(1B)', '24': 'Home loan (Sec 24)', 'HRA': 'HRA', '80E': '80E', '80G': '80G', '80TTA': '80TTA' };
    return {
      title: 'Review declaration · ' + e.name, icon: 'ti-receipt-tax', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${e.name}<br><span class="text-xs text-secondary">${e.id}</span></div></div>
        <div><div class="field-label">Tax regime</div><div class="field-value"><span class="pill pill-${e.taxRegime === 'old' ? 'purple' : 'blue'}">${e.taxRegime === 'old' ? 'Old regime' : 'New regime'}</span></div></div>
        <div><div class="field-label">Submitted</div><div class="field-value">${dec.submittedOn || '—'}</div></div>
        <div><div class="field-label">Status</div><div class="field-value">${dec.overallStatus}</div></div>
      </div>
      ${Object.entries(dec.sections).filter(([sec, s]) => s.items.length > 0).map(([sec, sd]) => `<div style="margin-bottom: 16px;">
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">${sectionLabels[sec] || sec}</div>
        ${sd.items.map(it => `<div class="declared-card ${it.status}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="flex: 1;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <b class="text-sm">${it.subSection}</b>
                ${it.status === 'approved' ? '<span class="pill pill-green" style="padding: 1px 6px; font-size: 9px;">Approved</span>' : it.status === 'rejected' ? '<span class="pill pill-red" style="padding: 1px 6px; font-size: 9px;">Rejected</span>' : '<span class="pill pill-orange" style="padding: 1px 6px; font-size: 9px;">Pending</span>'}
              </div>
              <div style="margin-top: 6px;">${it.proof ? `<span class="proof-tag verified"><i class="ti ti-paperclip"></i> ${it.proof}</span>` : '<span class="proof-tag missing"><i class="ti ti-alert-circle"></i> No proof</span>'}</div>
            </div>
            <div style="text-align: right; display: flex; gap: 6px; align-items: center;">
              <div class="font-bold">${fmt(it.amount)}</div>
              ${it.status !== 'approved' ? `<button class="btn btn-sm btn-icon-only" style="background: var(--green-bg); color: var(--green-text);" onclick="closeM(); toast('Approved · ' + '${it.subSection}'); openM('itdec-review-employee', {empId: '${d.empId}'})" title="Approve"><i class="ti ti-check"></i></button>` : ''}
              ${it.status !== 'rejected' ? `<button class="btn btn-sm btn-icon-only" style="background: var(--red-bg); color: var(--red-text);" onclick="closeM(); openM('itdec-reject-item', {empId: '${d.empId}', itemId: '${it.id}'})" title="Reject"><i class="ti ti-x"></i></button>` : ''}
            </div>
          </div>
        </div>`).join('')}
      </div>`).join('')}
      <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Approving items here marks them for inclusion in the next Excel export to engine. Rejection notifies the employee to resubmit.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Back</button><button class="btn btn-success" onclick="closeM(); toast('All pending items approved')"><i class="ti ti-check"></i> Approve all pending</button>`
    };
  },

  'itdec-reject-item': (d) => ({
    title: 'Reject declaration item', icon: 'ti-x',
    body: `<p class="text-sm text-secondary mb-3">Employee will be notified to fix and resubmit.</p>
      <div class="field"><label class="field-label">Reason for rejection</label><select><option>Proof missing</option><option>Proof not in employee name</option><option>Amount exceeds Section limit</option><option>Incorrect category</option><option>Investment not eligible under this section</option><option>Other (specify below)</option></select></div>
      <div class="field"><label class="field-label">Notes for employee</label><textarea placeholder="Clearly explain what needs to change" rows="3"></textarea></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Item rejected · employee notified')"><i class="ti ti-x"></i> Reject</button>`
  }),

  'itdec-export-excel': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    const approvedCount = emps.filter(e => totalITApproved(e.id) > 0).length;
    return {
      title: 'Export IT declarations to engine', icon: 'ti-file-spreadsheet', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Engine sync via Excel (no public API)</b>Generates an Excel file in greytHR's IT Declarations Plan Importer format. Finance Admin downloads and uploads to greytHR admin portal: Payroll > Published Info > IT Declaration > Import.</div></div>
        <div class="info-grid mt-3 mb-3">
          <div><div class="field-label">Employees with approved items</div><div class="field-value">${approvedCount}</div></div>
          <div><div class="field-label">FY</div><div class="field-value">2026-27</div></div>
          <div><div class="field-label">Format</div><div class="field-value">Excel (.xlsx) · greytHR plan importer</div></div>
          <div><div class="field-label">Last sync</div><div class="field-value">Not yet synced for this FY</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Export includes</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" checked /> Approved items only (recommended)</label>
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" /> Include pending items (for HR pre-review)</label>
          <label style="display: flex; gap: 8px; align-items: center;"><input type="checkbox" /> Include rejected items (for audit only)</label>
        </div>
        <div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-triangle"></i><div>Engine TDS recalculates only after the upload completes. Typical 24-hour sync window.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Excel file generated · ' + approvedCount + ' employees')"><i class="ti ti-download"></i> Generate Excel</button>`
    };
  },

  // === v5 NEW MODALS — greytHR integration ===

  'reimbursement-breakup': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Reimbursements', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const total = reimbTotal(e.reimb);
    return {
      title: 'Reimbursement breakdown · ' + e.name, icon: 'ti-receipt', large: true,
      body: `<p class="text-sm text-secondary mb-3">Each category maps to a distinct greytHR item code. Most are tax-exempt up to a limit; "Other" is taxable.</p>
        ${Object.entries(REIMB_CATEGORIES).map(([key, cat]) => `<div style="display: grid; grid-template-columns: 1fr 140px 100px; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; align-items: center;">
          <div>
            <div class="font-semibold text-sm">${cat.label}</div>
            <div class="text-xs text-secondary">${cat.taxable ? 'Taxable · no limit' : 'Tax-exempt up to ₹' + cat.limit.toLocaleString('en-IN') + '/yr'}</div>
          </div>
          <div><span class="item-code-tag">${cat.code}</span><span class="text-xs text-tertiary" style="margin-left: 6px;">id ${GREYTHR_ITEM_CODES[cat.code].id}</span></div>
          <input type="text" value="${e.reimb[key] > 0 ? e.reimb[key].toLocaleString('en-IN') : ''}" placeholder="0" style="text-align: right;" id="reimb-${key}" />
        </div>`).join('')}
        <div style="display: flex; justify-content: space-between; padding: 14px 16px; background: var(--surface-subtle); border-radius: 8px; margin-top: 12px; font-weight: 700;"><span>Total reimbursement</span><span>${fmt(total)}</span></div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Each non-zero category sent as a separate item code in the POST payload to greytHR.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Reimbursement breakdown saved for ${e.name}')">Save breakdown</button>`
    };
  },

  'arrears-breakup': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Arrears', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const total = arrearsTotal(e.arrears);
    return {
      title: 'Arrears breakdown · ' + e.name, icon: 'ti-arrows-diff', large: true,
      body: `<p class="text-sm text-secondary mb-3">greytHR splits arrears by salary component for correct tax treatment. Use negative values for recoveries (e.g., excess paid in previous months).</p>
        ${Object.entries(ARREARS_COMPONENTS).map(([key, comp]) => `<div style="display: grid; grid-template-columns: 1fr 140px 100px; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; align-items: center;">
          <div>
            <div class="font-semibold text-sm">${comp.label}</div>
            <div class="text-xs text-secondary">${comp.desc}</div>
          </div>
          <div><span class="item-code-tag">${comp.code}</span><span class="text-xs text-tertiary" style="margin-left: 6px;">id ${GREYTHR_ITEM_CODES[comp.code].id}</span></div>
          <input type="text" value="${e.arrears[key] !== 0 ? (e.arrears[key] > 0 ? '+' : '') + e.arrears[key].toLocaleString('en-IN') : ''}" placeholder="0" style="text-align: right;" />
        </div>`).join('')}
        <div style="display: flex; justify-content: space-between; padding: 14px 16px; background: var(--surface-subtle); border-radius: 8px; margin-top: 12px; font-weight: 700;"><span>Net arrears</span><span class="${total < 0 ? 'text-red' : total > 0 ? 'text-green' : ''}">${total !== 0 ? fmtS(total) : '—'}</span></div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>Positive = arrears owed to employee (paid out). Negative = excess recovery from previous months.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Arrears breakdown saved for ${e.name}')">Save breakdown</button>`
    };
  },

  'bonus-type-edit': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Bonus', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Bonus · ' + e.name, icon: 'ti-gift', large: true,
      body: `<p class="text-sm text-secondary mb-3">Each bonus type maps to a distinct greytHR item code with different tax treatment.</p>
        <div class="field"><label class="field-label">Bonus type</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${Object.entries(BONUS_TYPES).map(([key, bt]) => `<div class="policy-option ${e.bonusType === key ? 'active' : ''}" style="padding: 12px;">
              <div class="policy-radio"></div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="font-semibold text-sm">${bt.label}</div>
                  <span class="item-code-tag">${bt.code}</span>
                  <span class="text-xs text-tertiary">id ${GREYTHR_ITEM_CODES[bt.code].id}</span>
                </div>
                <div class="text-xs text-secondary mt-2">${bt.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>
        <div class="field"><label class="field-label">Amount</label><input type="text" value="${e.bonus > 0 ? e.bonus.toLocaleString('en-IN') : ''}" placeholder="₹" /></div>
        <div class="field"><label class="field-label">Description (on payslip)</label><input type="text" placeholder="e.g., Q2 retention bonus" /></div>
        <div class="alert-banner alert-orange"><i class="ti ti-alert-circle"></i><div><b>Tax note</b>Joining/Relocation/Referral bonuses may have clawback clauses if employee leaves within a tenure period. Track separately in MySlice loan module if applicable.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button>${e.bonus > 0 ? '<button class="btn btn-danger" onclick="closeM(); toast(\'Bonus removed\')">Remove</button>' : ''}<button class="btn btn-primary" onclick="closeM(); toast('Bonus saved for ${e.name}')">Save</button>`
    };
  },

  'verify-with-engine': () => {
    const emps = EMP.filter(e => e.entity === S.entity);
    return {
      title: 'Verify with greytHR · ' + E[S.entity].name, icon: 'ti-circle-check', large: true,
      body: `<p class="mb-3">Pulls current state from <span class="text-mono">GET /payroll/v2/employees/handentry</span> and compares with MySlice values. Shows which items in greytHR already match, which differ, and which exist only in MySlice or only in greytHR.</p>
        <div class="info-grid mt-3">
          <div><div class="field-label">Employees to check</div><div class="field-value">${emps.length}</div></div>
          <div><div class="field-label">API calls</div><div class="field-value">1 batch GET</div></div>
          <div><div class="field-label">Last verification</div><div class="field-value">${emps.some(e => e.syncStatus === 'synced') ? 'After last send' : 'Never'}</div></div>
        </div>
        <div style="margin-top: 16px;">
          <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Sample diff · ${emps[0] ? emps[0].name : ''}</div>
          ${emps[0] ? (function () {
          const mySlice = buildGreytHRPayload(emps[0], '2026-05-01');
          const inGreytHR = mockGreytHRCurrentValues(emps[0]);
          const itemNames = [...new Set([...mySlice.map(x => x.item), ...inGreytHR.map(x => x.item)])];
          return `<div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
              <div class="diff-row" style="background: var(--surface-subtle); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px;"><span>Item code</span><span style="text-align: right;">MySlice</span><span style="text-align: right;">greytHR</span><span style="text-align: center;">Status</span></div>
              ${itemNames.slice(0, 8).map(itemName => {
            const ms = mySlice.find(x => x.item === itemName);
            const gh = inGreytHR.find(x => x.item === itemName);
            const msV = ms ? ms.value : null;
            const ghV = gh ? gh.value : null;
            const match = msV === ghV;
            const cls = !ms ? 'mismatch' : !gh ? 'new' : match ? 'match' : 'mismatch';
            const status = !ms ? '<span class="pill pill-red">Only in greytHR</span>' : !gh ? '<span class="pill pill-green">New in MySlice</span>' : match ? '<span class="pill pill-green"><i class="ti ti-check"></i></span>' : '<span class="pill pill-orange">Differs</span>';
            return `<div class="diff-row ${cls}"><span class="item-code-tag">${itemName}</span><span style="text-align: right; font-variant-numeric: tabular-nums;">${msV !== null ? msV.toLocaleString('en-IN') : '—'}</span><span style="text-align: right; font-variant-numeric: tabular-nums;">${ghV !== null ? ghV.toLocaleString('en-IN') : '—'}</span><span style="text-align: center;">${status}</span></div>`;
          }).join('')}
              <div style="padding: 8px 12px; font-size: 11px; color: var(--text-tertiary); text-align: center; background: var(--surface-subtle);">Showing 8 of ${itemNames.length} item codes</div>
            </div>`;
        })() : ''}
        </div>
        <div class="alert-banner alert-blue mt-3"><i class="ti ti-info-circle"></i><div>If items exist only in greytHR (someone entered manually in greytHR UI), MySlice will preserve them — POST only adds/updates, never deletes. Use the dedicated delete endpoint if needed.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('Verification complete · ' + emps.length + ' employees checked')"><i class="ti ti-refresh"></i> Run verification</button>`
    };
  },

  'emp-sync-detail': (d) => {
    const e = EMP_SYNC_FAILED.find(x => x.id === d.id) || EMP_SYNC_FAILED[0];
    return {
      title: 'Sync failure · ' + e.name, icon: 'ti-alert-triangle',
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${e.name}</div></div>
        <div><div class="field-label">Code</div><div class="field-value"><span class="item-code-tag">${e.code}</span></div></div>
        <div><div class="field-label">Failure reason</div><div class="field-value text-red">${e.reason}</div></div>
        <div><div class="field-label">API endpoint</div><div class="field-value text-mono" style="font-size:11px;">POST /payroll/v2/employees</div></div>
      </div>
      <div class="alert-banner alert-orange"><i class="ti ti-info-circle"></i><div>Resolve the issue in HRMS, then use <b>Retry</b> to push this employee to greytHR again.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); retryEmpSyncOne('${e.id}')"><i class="ti ti-refresh"></i> Retry</button>`
    };
  },

  'emp-sync-report': () => {
    const sync = S.empSync;
    return {
      title: 'Employee synchronization report', icon: 'ti-file-text', large: true,
      body: `<div class="info-grid mb-3">
        <div><div class="field-label">Entity</div><div class="field-value">${E[S.entity].name}</div></div>
        <div><div class="field-label">Completed</div><div class="field-value">${sync.lastSync.date}</div></div>
        <div><div class="field-label">Processed</div><div class="field-value">${sync.total}</div></div>
        <div><div class="field-label">Synchronized</div><div class="field-value text-green">${sync.synced}</div></div>
        <div><div class="field-label">Failed</div><div class="field-value text-red">${sync.failed}</div></div>
        <div><div class="field-label">Status</div><div class="field-value">${sync.lastSync.status}</div></div>
      </div>
      ${sync.failed ? `<div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Failed employees</div>
        <div style="border:1px solid var(--border);border-radius:8px;">${EMP_SYNC_FAILED.map(e => `<div class="item-code-row"><span><b>${e.name}</b><br><span class="text-xs text-secondary">${e.code}</span></span><span class="text-sm text-red">${e.reason}</span></div>`).join('')}</div>` : '<div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div>All employees synchronized successfully.</div></div>'}`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('Report exported')"><i class="ti ti-download"></i> Export</button>`
    };
  },

  'test-connection': () => ({
    title: 'Test greytHR connection', icon: 'ti-plug-connected', large: true,
    body: `<p class="mb-3">Hits <span class="text-mono">GET /payroll/v2/salary/repository</span> — a no-op read that verifies credentials, latency, and lists active item codes for <b>${E[S.entity].name}</b>.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Endpoint</div><div class="field-value text-mono" style="font-size: 11px;">api.greythr.com</div></div>
        <div><div class="field-label">x-greythr-domain</div><div class="field-value text-mono" style="font-size: 11px;">premier-payroll.greythr.com</div></div>
        <div><div class="field-label">Auth header</div><div class="field-value">ACCESS-TOKEN · ••••2f4a</div></div>
        <div><div class="field-label">Result</div><div class="field-value text-green"><i class="ti ti-circle-check"></i> 200 OK · 287ms</div></div>
      </div>
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Item codes active in this customer's greytHR account</div>
      <div style="border: 1px solid var(--border); border-radius: 8px; max-height: 280px; overflow-y: auto;">
        ${['WORKDAYS', 'LOP', 'MONTHLY_CTC', 'ANNUAL_CTC', 'IS_PF_ELIGIBLE', 'LOAN', 'SAL_ADV', 'INCENTIVE', 'BONUS', 'OT_PAYOUT', 'TEL_REIMB', 'MEDICAL_REIMB', 'LTA_REIMB', 'BOOKS_PERIODICAL', 'LEAVE_ENCASHMENT', 'ENCASH_DAYS', 'BASIC_A', 'HRA_A', 'TAX_REGIME'].map(code => GREYTHR_ITEM_CODES[code] ? `<div class="item-code-row"><span class="item-code-tag">${code}</span><span>${GREYTHR_ITEM_CODES[code].desc}</span><span class="text-mono text-tertiary" style="text-align: right; font-size: 11px;">id ${GREYTHR_ITEM_CODES[code].id}</span></div>` : '').join('')}
        <div class="item-code-row custom"><span class="item-code-tag">API_TESTC</span><span>API test component <span class="pill pill-orange" style="padding: 0 6px; font-size: 9px;">CUSTOM</span></span><span class="text-mono text-tertiary" style="text-align: right; font-size: 11px;">id 228</span></div>
      </div>
      <div class="alert-banner alert-green mt-3"><i class="ti ti-circle-check"></i><div><b>Connection healthy</b>${Object.keys(GREYTHR_ITEM_CODES).length} standard items + 1 custom item detected. All MySlice fields can be mapped.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); toast('Connection test passed')"><i class="ti ti-refresh"></i> Run again</button>`
  }),

  'view-greythr-codes': () => ({
    title: 'greytHR item code reference', icon: 'ti-list', large: true,
    body: `<p class="text-sm text-secondary mb-3">All MySlice fields and how they map to greytHR item codes. Sent in the body of <span class="text-mono">POST /payroll/v2/employees/{id}</span>.</p>
      ${[
        ['Attendance', ['WORKDAYS', 'LOP']],
        ['Salary base', ['MONTHLY_CTC', 'ANNUAL_CTC', 'IS_PF_ELIGIBLE', 'TAX_REGIME']],
        ['Loans & advances', ['LOAN', 'SAL_ADV']],
        ['Earnings', ['INCENTIVE', 'MON_INCE', 'OT_PAYOUT']],
        ['Bonuses (typed)', ['BONUS', 'RET_BONUS', 'REF_BONUS', 'RE_BONUS', 'JOIN_BONUS']],
        ['Reimbursements (by category)', ['TEL_REIMB', 'MEDICAL_REIMB', 'LTA_REIMB', 'BOOKS_PERIODICAL', 'FM_A1600CC_REIMB', 'INT_REIMBURSEMENT', 'MISC_REIM']],
        ['Arrears (by component)', ['BASIC_A', 'HRA_A', 'CONVEYANCE_A', 'SPECIAL_ALLOW_A', 'LTA_A']],
        ['Leave encashment', ['ENCASH_DAYS', 'LEAVE_ENCASHMENT']],
        ['F&F specific', ['NOTICE_DAYS', 'NOTICE_RECOVERY', 'GRATUITY']]
      ].map(([group, codes]) => `<div style="margin-bottom: 16px;">
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">${group}</div>
        <div style="border: 1px solid var(--border); border-radius: 8px;">${codes.map(c => GREYTHR_ITEM_CODES[c] ? `<div class="item-code-row"><span class="item-code-tag">${c}</span><span><b>${GREYTHR_ITEM_CODES[c].desc}</b><br><span class="text-xs text-secondary">${GREYTHR_ITEM_CODES[c].mySliceField}</span></span><span class="text-mono text-tertiary" style="text-align: right; font-size: 11px;">id ${GREYTHR_ITEM_CODES[c].id}</span></div>` : '').join('')}</div>
      </div>`).join('')}`,
    footer: `<button class="btn" onclick="closeM()">Close</button>`
  }),

  'finance-master-detail': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Finance master', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const f = getFinance(e.id);
    const errs = financeValidationErrors(e.id);
    return {
      title: 'Finance master · ' + e.name, icon: 'ti-building-bank', large: true,
      body: `<div style="display:flex;gap:14px;align-items:center;padding:14px 16px;background:var(--surface-subtle);border-radius:10px;margin-bottom:14px;">
        <div style="transform:scale(1.4);">${financeSyncPill(f.syncStatus)}</div>
        <div style="flex:1;">
          <div class="font-semibold">${f.syncStatus === 'synced' ? 'Finance data synced to greytHR' : f.syncStatus === 'error' ? 'greytHR rejected finance master sync' : f.syncStatus === 'sending' ? 'Syncing finance data...' : 'Not yet synced to greytHR'}</div>
          <div class="text-sm text-secondary">${f.lastSynced ? 'Last sync: ' + f.lastSynced : 'Complete validation in People before first sync'}</div>
        </div>
      </div>
      ${errs.length ? `<div class="alert-banner alert-red mb-3"><i class="ti ti-alert-triangle"></i><div><b>Validation errors</b><ul style="margin:6px 0 0 18px;padding:0;">${errs.map(x => '<li>' + x + '</li>').join('')}</ul></div></div>` : ''}
      ${f.syncStatus === 'error' && !errs.length ? `<div class="alert-banner alert-red mb-3"><i class="ti ti-alert-triangle"></i><div><b>Sync failed</b>greytHR rejected the finance payload. Check employee status in greytHR and retry.</div></div>` : ''}
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Bank account</div>
      <div class="info-grid mb-3">
        <div><div class="field-label">Bank name</div><div class="field-value">${f.bankName || '—'}</div></div>
        <div><div class="field-label">Account number</div><div class="field-value text-mono">${f.accountNo ? maskAccount(f.accountNo) : '—'}</div></div>
        <div><div class="field-label">IFSC</div><div class="field-value text-mono">${f.ifsc || '—'}</div></div>
      </div>
      <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Statutory identifiers</div>
      <div class="info-grid mb-3">
        <div><div class="field-label">PAN</div><div class="field-value text-mono">${f.pan || '—'}</div></div>
        <div><div class="field-label">UAN</div><div class="field-value text-mono">${f.uan || (f.pfApplicable ? '—' : 'N/A')}</div></div>
        <div><div class="field-label">PF applicable</div><div class="field-value">${f.pfApplicable ? 'Yes' : 'No'}</div></div>
        <div><div class="field-label">ESI applicable</div><div class="field-value">${f.esiApplicable ? 'Yes' : 'No'}</div></div>
        <div><div class="field-label">ESIC IP number</div><div class="field-value text-mono">${f.esicNo || '—'}</div></div>
        <div><div class="field-label">Professional tax state</div><div class="field-value">${f.ptState || '—'}</div></div>
      </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('finance', { empId: e.id })}<button class="btn" onclick="closeM(); openM('edit-finance-master', {empId:'${e.id}'})"><i class="ti ti-pencil"></i> Edit</button>${!errs.length ? `<button class="btn btn-primary" onclick="closeM(); retryFinanceSync('${e.id}')"><i class="ti ti-refresh"></i> Sync</button>` : ''}`
    };
  },

  'edit-finance-master': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Edit finance master', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const f = getFinance(e.id);
    return {
      title: 'Edit finance master · ' + e.name, icon: 'ti-pencil', large: true,
      body: `<div class="alert-banner alert-blue mb-3"><i class="ti ti-info-circle"></i><div>In production this opens People employee profile. Demo saves locally and marks record pending sync.</div></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Bank name</label><input class="input" id="fin-bank" value="${f.bankName || ''}" placeholder="HDFC Bank"></div>
        <div class="field"><label class="field-label">Account number</label><input class="input" id="fin-acct" value="${f.accountNo || ''}" placeholder="5010012344582"></div>
        <div class="field"><label class="field-label">IFSC</label><input class="input" id="fin-ifsc" value="${f.ifsc || ''}" placeholder="HDFC0001234"></div>
        <div class="field"><label class="field-label">PAN</label><input class="input" id="fin-pan" value="${f.pan || ''}" placeholder="ABCDE1234F"></div>
        <div class="field"><label class="field-label">UAN</label><input class="input" id="fin-uan" value="${f.uan || ''}" placeholder="100234567890"></div>
        <div class="field"><label class="field-label">Professional tax state</label><input class="input" id="fin-pt" value="${f.ptState || ''}" placeholder="Telangana"></div>
        <div class="field"><label class="field-label">PF applicable</label><select class="input" id="fin-pf"><option value="yes" ${f.pfApplicable ? 'selected' : ''}>Yes</option><option value="no" ${!f.pfApplicable ? 'selected' : ''}>No</option></select></div>
        <div class="field"><label class="field-label">ESI applicable</label><select class="input" id="fin-esi"><option value="no" ${!f.esiApplicable ? 'selected' : ''}>No</option><option value="yes" ${f.esiApplicable ? 'selected' : ''}>Yes</option></select></div>
        <div class="field"><label class="field-label">ESIC IP number</label><input class="input" id="fin-esic" value="${f.esicNo || ''}" placeholder="Optional"></div>
      </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="saveFinanceMaster('${e.id}')"><i class="ti ti-device-floppy"></i> Save</button>`
    };
  },

  'sync-status-detail': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Sync status', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const f = getFinance(e.id);
    const lastAttempt = e.syncStatus === 'synced' ? (empLastSyncedLabel(e) || '14 May 2026, 11:22 AM') : e.syncStatus === 'error' ? '14 May 2026, 11:22 AM · failed' : '—';
    const errorMsg = e.syncStatus === 'error' ? 'Employee marked as absconding — greytHR rejected sync while employee is in stopped state.' : '';
    return {
      title: 'Sync status · ' + e.name, icon: 'ti-activity', large: true,
      body: `<div style="display: flex; gap: 14px; align-items: center; padding: 14px 16px; background: var(--surface-subtle); border-radius: 10px; margin-bottom: 14px;">
        <div style="transform: scale(1.6);">${syncIcon(e.syncStatus)}</div>
        <div style="flex: 1;">
          <div class="font-semibold">${e.name} · Employee sync</div>
          <div class="text-sm text-secondary">Last attempt: ${lastAttempt}</div>
        </div>
      </div>
      <div class="info-grid mb-3">
        <div><div class="field-label">Employee</div><div class="field-value">${e.name} (${e.id})</div></div>
        <div><div class="field-label">Action</div><div class="field-value">Employee profile sync</div></div>
        <div><div class="field-label">Status</div><div class="field-value">${lopSyncPill(e.syncStatus)}</div></div>
        <div><div class="field-label">greytHR ID</div><div class="field-value text-mono">${e.gretyId || 'Not assigned'}</div></div>
        <div><div class="field-label">Entity</div><div class="field-value">${E[e.entity].name}</div></div>
        <div><div class="field-label">Last attempt</div><div class="field-value">${lastAttempt}</div></div>
        <div><div class="field-label">MySlice status</div><div class="field-value">${empMySliceStatus(e)}</div></div>
        <div><div class="field-label">Finance sync</div><div class="field-value">${financeSyncPill(f.syncStatus)}</div></div>
        <div><div class="field-label">LOP this month</div><div class="field-value">${e.att?.lop || 0} day(s)</div></div>
      </div>
      ${errorMsg ? `<div class="alert-banner alert-red"><i class="ti ti-alert-triangle"></i><div><b>Error</b>${errorMsg}</div></div>` : ''}`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('employee-sync', { empId: e.id })}${e.syncStatus === 'error' || e.syncStatus === 'pending' ? `<button class="btn btn-primary" onclick="closeM(); retryEmployeeSync('${e.id}')"><i class="ti ti-refresh"></i> Retry</button>` : ''}`
    };
  },

  'open-greythr-ff': (d) => {
    const r = RESIGNATIONS[d.idx];
    if (!r) return { title: 'greytHR F&F', body: '<p>Case not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const encash = r.leaveTypes.reduce((s, lt) => s + (lt.approvedEncash || 0), 0);
    return {
      title: 'Open greytHR F&F · ' + r.emp, icon: 'ti-external-link', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>F&F is processed in greytHR</b>MySlice provides this summary. Finance completes notice recovery, leave encashment, loan deductions, tax and final payable in the greytHR portal.</div></div>
        <div class="info-grid mb-3 mt-3">
          <div><div class="field-label">Employee</div><div class="field-value">${r.emp}<br><span class="text-xs text-secondary">${r.empId}</span></div></div>
          <div><div class="field-label">Last working date</div><div class="field-value">${r.lwd}</div></div>
          <div><div class="field-label">Payable days</div><div class="field-value">${r.payrollDays.payableDays}</div></div>
          <div><div class="field-label">LOP</div><div class="field-value">${r.payrollDays.lop} days</div></div>
          <div><div class="field-label">Encashable leave</div><div class="field-value">${encash} days · ${fmt(r.encashAmount || calcLeaveEncashAmount(r))}</div></div>
          <div><div class="field-label">Loan outstanding</div><div class="field-value">${r.loanOutstanding > 0 ? fmt(r.loanOutstanding) : 'None'}</div></div>
          <div><div class="field-label">Asset recovery</div><div class="field-value">${r.assetRecovery > 0 ? fmt(r.assetRecovery) : 'None'}</div></div>
          <div><div class="field-label">Separation sync</div><div class="field-value">${r.separationSync === 'synced' ? 'Synced' : 'Pending'}</div></div>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn btn-primary" onclick="closeM(); openGreytHRPortal()"><i class="ti ti-external-link"></i> Open greytHR F&F portal</button>`
    };
  },

  'separation-sync': (d) => {
    const r = RESIGNATIONS[d.idx];
    if (!r) return { title: 'Separation sync', body: '<p>Case not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    const encashDays = r.leaveTypes.reduce((s, lt) => s + (lt.approvedEncash || 0), 0);
    const encashAmt = r.encashAmount || calcLeaveEncashAmount(r);
    const sepStatus = r.separationSync === 'synced' ? 'Synced' : r.separationSync === 'syncing' ? 'In progress' : 'Pending';
    return {
      title: 'Send separation to greytHR · ' + r.emp, icon: 'ti-send', large: true,
      body: `<div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Final sequence: Leave encashment → Final LOP sync → Employee separation → Mark ready for F&F in greytHR.</div></div>
        <div style="display:flex;gap:14px;align-items:center;padding:14px 16px;background:var(--surface-subtle);border-radius:10px;margin:16px 0;">
          <div style="transform:scale(1.4);">${r.separationSync === 'synced' ? '<span class="pill pill-green"><i class="ti ti-check"></i> Synced</span>' : '<span class="pill pill-orange"><i class="ti ti-clock"></i> Pending</span>'}</div>
          <div style="flex:1;">
            <div class="font-semibold">${r.emp} · Separation sync</div>
            <div class="text-sm text-secondary">Status: ${sepStatus}</div>
          </div>
        </div>
        <div class="info-grid mb-3">
          <div><div class="field-label">Employee</div><div class="field-value">${r.emp} (${r.empId})</div></div>
          <div><div class="field-label">Action</div><div class="field-value">Separation sync</div></div>
          <div><div class="field-label">Status</div><div class="field-value">${r.separationSync === 'synced' ? '<span class="pill pill-green">Synced</span>' : '<span class="pill pill-orange">Pending</span>'}</div></div>
          <div><div class="field-label">Last working date</div><div class="field-value">${r.lwd}</div></div>
          <div><div class="field-label">Leaving reason</div><div class="field-value">${r.reason}</div></div>
          <div><div class="field-label">Final LOP</div><div class="field-value">${r.payrollDays.lop} days</div></div>
          <div><div class="field-label">Leave encashment</div><div class="field-value">${encashDays} days · ${fmt(encashAmt)} · ${r.encashSync === 'synced' ? 'synced' : 'pending'}</div></div>
          <div><div class="field-label">Asset recovery</div><div class="field-value">${r.assetRecovery > 0 ? fmt(r.assetRecovery) : 'None'}</div></div>
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button>${apiDetailsBtnInline('separation', { idx: d.idx })}<button class="btn btn-primary" onclick="closeM(); confirmSeparationSync(${d.idx})"><i class="ti ti-send"></i> Send separation</button>`
    };
  },

  'resettlement-check': (d) => {
    const f = FF_ACTIVE[d.idx];
    if (!f) return { title: 'Resettlement', body: '<p>F&F not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Resettlement check · ' + f.emp, icon: 'ti-circle-check', large: true,
      body: `<p class="text-sm text-secondary mb-3">Pre-flight check before processing F&F in greytHR.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Employee</div><div class="field-value">${f.emp}<br><span class="text-xs text-secondary">${f.empId}</span></div></div>
          <div><div class="field-label">LWD</div><div class="field-value">${f.lwd}</div></div>
          <div><div class="field-label">Payroll month checked</div><div class="field-value">${S.monthSel === '2026-05' ? 'May 2026' : S.monthSel}</div></div>
          <div><div class="field-label">greytHR status</div><div class="field-value text-green"><i class="ti ti-circle-check"></i> Ready for settlement</div></div>
          <div><div class="field-label">Expected settlement date</div><div class="field-value">2 Jun 2026</div></div>
          <div><div class="field-label">Settlement status</div><div class="field-value"><span class="pill pill-orange">Pending</span></div></div>
          <div><div class="field-label">Remarks</div><div class="field-value">F&F initiated · awaiting final inputs</div></div>
        </div>
        <div class="alert-banner alert-orange mt-3"><i class="ti ti-alert-triangle"></i><div><b>Pre-flight checks</b><span style="color: var(--green-text);"><i class="ti ti-check"></i> Employee in stopped/notice state</span> &nbsp; <span style="color: var(--green-text);"><i class="ti ti-check"></i> No pending salary cycles</span> &nbsp; <span style="color: var(--green-text);"><i class="ti ti-check"></i> Loans flagged for recovery</span> &nbsp; <span style="color: var(--green-text);"><i class="ti ti-check"></i> Leave balance computed</span></div></div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${apiDetailsBtnInline('resettlement', { idx: d.idx })}<button class="btn btn-primary" onclick="closeM(); openM('ff-process', {idx: ${d.idx}, net: 165400})"><i class="ti ti-arrow-right"></i> Continue to F&F</button>`
    };
  },

  'api-debug-detail': (d) => {
    const ctx = getApiDebugContext(d);
    const reqJson = ctx.request != null ? JSON.stringify(ctx.request, null, 2) : '';
    const resJson = ctx.response != null ? JSON.stringify(ctx.response, null, 2) : '';
    return {
      title: ctx.title || 'API details', icon: 'ti-code', large: true,
      body: `<div class="alert-banner alert-orange mb-3"><i class="ti ti-shield-lock"></i><div><b>Developer / integration view</b>Raw request and response for troubleshooting. Not shown to employees.</div></div>
        <div class="info-grid mb-3">
          <div><div class="field-label">Method</div><div class="field-value text-mono">${ctx.method}</div></div>
          <div><div class="field-label">Endpoint</div><div class="field-value text-mono" style="font-size:11px;">${ctx.endpoint}</div></div>
        </div>
        ${ctx.request != null ? `<div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Request</div><div class="payload-json">${fmtJSON(ctx.request)}</div>` : ''}
        ${ctx.response != null ? `<div class="text-xs font-semibold text-secondary mb-2 mt-3" style="text-transform:uppercase;letter-spacing:0.4px;">Response</div><div class="payload-json">${fmtJSON(ctx.response)}</div>` : ''}`,
      footer: `<button class="btn" onclick="closeM()">Close</button>${reqJson ? `<button class="btn btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(reqJson)}); toast('Request copied')"><i class="ti ti-copy"></i> Copy request</button>` : ''}${resJson ? `<button class="btn btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(resJson)}); toast('Response copied')"><i class="ti ti-copy"></i> Copy response</button>` : ''}`
    };
  },

  'integration-debug-panel': () => {
    const runs = SYNC_HISTORY.filter(h => h.entity === S.entity).slice(0, 8);
    const errors = SYNC_ERRORS.filter(e => e.entity === S.entity && !S.resolvedSyncErrors.includes(e.id)).slice(0, 5);
    return {
      title: 'Integration debug panel', icon: 'ti-bug', large: true,
      body: `<p class="text-sm text-secondary mb-3">Inspect raw greytHR API request/response traces. Restricted to integration admins and developers.</p>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;">Recent sync runs</div>
        <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:16px;">
          ${runs.map(h => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);gap:12px;">
            <div><div class="font-semibold text-sm">${h.label}</div><div class="text-xs text-secondary">${h.date} · ${h.ref}</div></div>
            <button class="btn btn-sm" onclick="openM('api-debug-detail', {kind:'sync-history', id:'${h.id}'})"><i class="ti ti-code"></i> API trace</button>
          </div>`).join('')}
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;">Open error logs</div>
        <div style="border:1px solid var(--border);border-radius:8px;">
          ${errors.length ? errors.map(e => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);gap:12px;">
            <div><div class="font-semibold text-sm">${e.emp} · ${e.reason}</div><div class="text-xs text-secondary">${e.date} · ${e.apiError}</div></div>
            <button class="btn btn-sm" onclick="openM('api-debug-detail', {kind:'sync-error', id:'${e.id}'})"><i class="ti ti-code"></i> Request/response</button>
          </div>`).join('') : '<div class="text-sm text-secondary" style="padding:16px;">No open sync errors.</div>'}
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button><button class="btn" onclick="closeM(); nav('sync-history')"><i class="ti ti-history"></i> Sync history</button><button class="btn" onclick="closeM(); nav('sync-errors')"><i class="ti ti-alert-circle"></i> Error logs</button>`
    };
  },

  'view-payload-preview': (d) => {
    return MODALS['api-debug-detail']({ kind: 'employee-sync', empId: d.empId });
  },

  'form16-download': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    return {
      title: 'Download Form 16 · ' + name, icon: 'ti-file-certificate',
      body: `<p class="text-sm text-secondary mb-3">Pulls Form 16 from <span class="text-mono">POST /payroll/v2/form16/download</span>. greytHR generates Part A (TDS summary) and Part B (income breakup) PDFs.</p>
        <div class="field"><label class="field-label">Financial year</label><select><option>FY 2025-26 (latest)</option><option>FY 2024-25</option><option>FY 2023-24</option></select></div>
        <div class="field"><label class="field-label">Format</label><div style="display: flex; flex-direction: column; gap: 6px;"><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Part A · TDS summary (PDF)</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Part B · Income breakup (PDF)</label><label style="display: flex; gap: 8px;"><input type="checkbox" /> Combined single PDF</label></div></div>
        <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Available only after FY closes and greytHR generates Form 16 in the system (typically Apr-May post FY end).</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Form 16 downloading...')"><i class="ti ti-download"></i> Download</button>`
    };
  },

  'download-payslip': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    return {
      title: 'Download payslip · ' + name, icon: 'ti-receipt',
      body: `<p class="text-sm text-secondary mb-3">Pulls payslip from <span class="text-mono">GET /payroll/v2/payslip/download?encoded=true</span>. greytHR generates the PDF on demand.</p>
        <div class="field-grid-2">
          <div class="field"><label class="field-label">Month</label><select>${EMP_MONTHLY.filter(m => m.status === 'paid').map(m => `<option value="${m.payrollId}">${m.month}</option>`).join('')}</select></div>
          <div class="field"><label class="field-label">Format</label><select><option>PDF (signed)</option><option>PDF (unsigned)</option></select></div>
        </div>
        <div class="field"><label class="field-label">Delivery</label><div style="display: flex; flex-direction: column; gap: 6px;"><label style="display: flex; gap: 8px;"><input type="radio" name="delivery" checked /> Download now</label><label style="display: flex; gap: 8px;"><input type="radio" name="delivery" /> Email to employee</label></div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Payslip downloading...')"><i class="ti ti-download"></i> Download</button>`
    };
  },

  'revert-attendance': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    const name = e ? e.name : 'employee';
    return {
      title: 'Revert attendance snapshot · ' + name, icon: 'ti-arrow-back-up',
      body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Destructive action</b>Calls <span class="text-mono">DELETE /payroll/v2/attendance/snapshot/employees/${e ? e.id : ''}</span>. Removes attendance data from greytHR for the selected range.</div></div>
        <div class="field-grid-2 mt-3">
          <div class="field"><label class="field-label">From date</label><input type="date" value="2026-05-01" /></div>
          <div class="field"><label class="field-label">To date</label><input type="date" value="2026-05-31" /></div>
        </div>
        <div class="field"><label class="field-label">Reason for revert</label><textarea placeholder="e.g., Re-sync from updated Shifts data"></textarea></div>
        <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>After revert, return to payroll Step 1 and click "Recompute attendance" to pull the latest from Shifts backend.</div></div>`,
      footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-danger" onclick="closeM(); toast('Attendance reverted in greytHR')"><i class="ti ti-arrow-back-up"></i> Revert</button>`
    };
  },

  'hike-preview-diff': (d) => {
    const e = EMP.find(x => x.id === d.empId);
    if (!e) return { title: 'Hike diff', body: '<p>Employee not found.</p>', footer: `<button class="btn" onclick="closeM()">Close</button>` };
    return {
      title: 'Salary revision diff · ' + e.name, icon: 'ti-arrows-diff', large: true,
      body: `<p class="text-sm text-secondary mb-3">Pulled from <span class="text-mono">GET /payroll/v2/salary/revision/difference/employees/${e.id}</span>. Shows item-by-item change between current and previous revision.</p>
        <div class="info-grid mb-3">
          <div><div class="field-label">Previous revision</div><div class="field-value">1 Apr 2025<br><span class="text-xs text-secondary">${fmtL(2000000)} annual</span></div></div>
          <div><div class="field-label">Current revision</div><div class="field-value text-green">1 Apr 2026<br><span class="text-xs text-secondary">${fmtL(2240000)} annual</span></div></div>
          <div><div class="field-label">Change</div><div class="field-value text-green">+${fmtL(240000)} · +12.0%</div></div>
          <div><div class="field-label">Payout month</div><div class="field-value">Apr 2026</div></div>
        </div>
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform: uppercase; letter-spacing: 0.4px;">Component diff</div>
        <div style="border: 1px solid var(--border); border-radius: 8px;">
          <div class="diff-row" style="background: var(--surface-subtle); font-weight: 600; font-size: 11px;"><span>Component</span><span style="text-align: right;">Previous</span><span style="text-align: right;">Current</span><span style="text-align: center;">Diff</span></div>
          ${[['BASIC', 800000, 896000], ['HRA', 320000, 358400], ['CONVEYANCE', 19200, 19200], ['SPECIAL_ALLOW', 860800, 966400]].map(([k, p, c]) => `<div class="diff-row ${c > p ? 'new' : 'match'}"><span class="item-code-tag">${k}</span><span style="text-align: right; font-variant-numeric: tabular-nums;">${p.toLocaleString('en-IN')}</span><span style="text-align: right; font-variant-numeric: tabular-nums;">${c.toLocaleString('en-IN')}</span><span style="text-align: center;" class="${c > p ? 'text-green' : ''}">${c > p ? '+' + (c - p).toLocaleString('en-IN') : '—'}</span></div>`).join('')}
        </div>`,
      footer: `<button class="btn" onclick="closeM()">Close</button>`
    };
  },

  // === Updated/added supporting modals ===

  'rotate-token': () => ({
    title: 'Rotate greytHR access token', icon: 'ti-key',
    body: `<div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>Connection will be interrupted briefly</b>Old token invalidated immediately. New token activates within seconds.</div></div>
      <div class="field mt-3"><label class="field-label">Reason</label><select><option>Scheduled rotation</option><option>Security incident</option><option>Personnel change at greytHR admin</option></select></div>
      <div class="field"><label class="field-label">Notify</label><div style="display: flex; flex-direction: column; gap: 6px;"><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Audit log</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Email Finance Admin</label></div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Token rotated successfully')">Rotate</button>`
  }),

  'test-shifts-sync': () => ({
    title: 'Test Shifts → Payroll sync', icon: 'ti-refresh',
    body: `<p class="text-sm text-secondary mb-3">Verifies that attendance data flows from MySlice Shifts to greytHR via <span class="text-mono">POST /payroll/v2/attendance/snapshot/employees/{id}</span>.</p>
      <div class="info-grid mb-3">
        <div><div class="field-label">Shifts module</div><div class="field-value text-green"><i class="ti ti-circle-check"></i> Healthy</div></div>
        <div><div class="field-label">Last full sync</div><div class="field-value">14 May, 11:22</div></div>
        <div><div class="field-label">Pending records</div><div class="field-value">0</div></div>
        <div><div class="field-label">Failed records (24h)</div><div class="field-value text-green">0</div></div>
      </div>
      <div class="alert-banner alert-green"><i class="ti ti-circle-check"></i><div><b>Sync operational</b>Attendance auto-syncs daily and on attendance lock.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Close</button>`
  }),

  'export-generate': (d) => ({
    title: 'Generate · ' + d.label, icon: 'ti-download',
    body: `<p class="text-sm text-secondary mb-3">${d.type.startsWith('form16') || d.type.startsWith('payslip') ? 'Pulls from greytHR API (' + (d.type.startsWith('form16') ? 'POST /payroll/v2/form16/download' : 'GET /payroll/v2/payslip/download') + ') for each employee, packages into a zip.' : 'Generates from MySlice data.'}</p>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Scope</label><select><option>${E[S.entity].name}</option><option>All entities</option></select></div>
        <div class="field"><label class="field-label">Period</label><select>${d.type.startsWith('form16') ? '<option>FY 2025-26</option><option>FY 2024-25</option>' : '<option>May 2026</option><option>Apr 2026</option><option>Last 3 months</option>'}</select></div>
      </div>
      <div class="field"><label class="field-label">Format</label><select>${d.type.startsWith('form16') || d.type.startsWith('payslip') ? '<option>PDF zip (one per employee)</option>' : '<option>Excel (xlsx)</option><option>CSV</option><option>PDF (signed)</option>'}</select></div>
      <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div>Large exports run async. You'll get an email when ready.</div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating ${d.label}...')"><i class="ti ti-download"></i> Generate</button>`
  }),

  'emp-fy-download': (d) => ({
    title: 'Download FY 2026-27 history', icon: 'ti-download',
    body: `<p class="text-sm text-secondary mb-3">Includes all monthly inputs, salary changes, attendance, loans, and tax docs for the current FY.</p>
      <div class="field"><label class="field-label">Format</label><select><option>Combined PDF</option><option>Excel (xlsx)</option><option>Zip (separate files)</option></select></div>
      <div class="field"><label class="field-label">Include</label><div style="display: flex; flex-direction: column; gap: 6px;"><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Monthly payroll inputs</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Salary revisions</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> Attendance history</label><label style="display: flex; gap: 8px;"><input type="checkbox" checked /> All payslips</label><label style="display: flex; gap: 8px;"><input type="checkbox" /> Form 16 (when available)</label></div></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Generating...')">Generate</button>`
  }),

  'download-loan-schedule': () => ({
    title: 'Download loan schedule', icon: 'ti-download',
    body: `<p class="text-sm text-secondary mb-3">Schedule with payment status, outstanding balance, and projected closure date.</p>
      <div class="field"><label class="field-label">Format</label><select><option>PDF</option><option>Excel</option></select></div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Downloading...')">Download</button>`
  }),

  'recompute-encashment': () => ({
    title: 'Recompute encashment', icon: 'ti-refresh',
    body: `<p class="mb-3">Recompute leave encashment for all employees in March payroll inputs.</p>
      <div class="alert-banner alert-orange"><i class="ti ti-alert-triangle"></i><div><b>This overwrites manual edits</b>Any HR overrides to encashment will be replaced with auto-computed values.</div></div>
      <div class="info-grid mt-3">
        <div><div class="field-label">Formula</div><div class="field-value">Basic × leave_balance / 21</div></div>
        <div><div class="field-label">Sent as</div><div class="field-value">ENCASH_DAYS + LEAVE_ENCASHMENT (paired)</div></div>
      </div>`,
    footer: `<button class="btn" onclick="closeM()">Cancel</button><button class="btn btn-primary" onclick="closeM(); toast('Encashment recomputed for ' + EMP.filter(e => e.entity === S.entity).length + ' employees')"><i class="ti ti-refresh"></i> Recompute</button>`
  })

};

function rModal() {
  if (!S.modal) return '';
  const fn = MODALS[S.modal];
  if (!fn) return `<div class="modal-overlay" onclick="closeM()"><div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><div class="modal-title">${S.modal}</div><button class="icon-btn" onclick="closeM()"><i class="ti ti-x"></i></button></div><div class="modal-body"><p class="text-sm text-secondary">Modal: ${S.modal}</p></div><div class="modal-footer"><button class="btn" onclick="closeM()">Close</button></div></div></div>`;
  const m = fn(S.mdata);
  return `<div class="modal-overlay" onclick="closeM()"><div class="modal ${m.large ? 'modal-large' : ''}" onclick="event.stopPropagation()">
    <div class="modal-header"><div class="modal-title"><i class="ti ${m.icon || 'ti-circle'}"></i> ${m.title}</div><button class="icon-btn" onclick="closeM()"><i class="ti ti-x"></i></button></div>
    <div class="modal-body">${m.body}</div>
    <div class="modal-footer">${m.footer}</div>
  </div></div>`;
}

// === INTEGRATION PLACEHOLDERS ===
function rPlaceholder(title, desc, icon) {
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">${title}</h1><p class="page-sub">${desc}</p></div></div>
    <div class="card" style="padding: 48px; text-align: center; color: var(--text-secondary);">
      <i class="ti ${icon || 'ti-tool'}" style="font-size: 40px; margin-bottom: 12px; display: block; color: var(--text-tertiary);"></i>
      <div class="font-semibold" style="color: var(--text-primary); margin-bottom: 6px;">Coming in the next step</div>
      <div class="text-sm">This section will be built as part of the greytHR integration rollout.</div>
    </div>
  </div>`;
}

function rGreytHRSettings() {
  return `<div class="page">
    <div class="page-header"><div><h1 class="page-title">greytHR Settings</h1><p class="page-sub">${E[S.entity].name} · connection, mapping and integration controls</p></div></div>
    ${rSettingsIntegration()}
  </div>`;
}

// === MAIN RENDER ===
function R() {
  let content = '';
  if (S.role === 'admin') {
    if (S.nav === 'dashboard') content = rDash();
    else if (S.nav === 'employees') content = S.empSel ? rEmpDetail() : rEmpsList();
    else if (S.nav === 'lop-sync') content = rLOPSync();
    else if (S.nav === 'loans') content = rLoans();
    else if (S.nav === 'resignation') content = rResignation();
    else if (S.nav === 'greythr-settings') content = rGreytHRSettings();
    else if (S.nav === 'resignation-workflow') content = rResignationWorkflow();
    else if (S.nav === 'sync-history') content = rSyncHistory();
    else if (S.nav === 'sync-errors') content = rSyncErrors();
    else if (S.nav === 'audit') content = rAudit();
    else content = rDash();
  } else {
    if (S.nav === 'dashboard') content = rEmpDash();
    else if (S.nav === 'loans') content = rEmpLoans();
    else if (S.nav === 'my-resignation') content = rEmpResignation();
    else if (S.nav === 'greythr-ess') content = rEmpGreytHRESS();
    else content = rEmpDash();
  }
  document.getElementById('root').innerHTML = `<div class="layout">${rSide()}<div class="main">${rTop()}${content}</div></div>${rModal()}${S.toast ? `<div class="toast"><i class="ti ti-check"></i> ${S.toast}</div>` : ''}`;
}

R();
