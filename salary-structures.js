// === SALARY STRUCTURES MODULE ===
// Fixed CTC split only — no variable pay, bonuses, or custom components.

const SS_MANDATORY_KEYS = ['basic', 'hra', 'special'];
const SS_PF_KEYS = ['er_pf', 'ee_pf'];

const SS_COMPONENT_META = {
  basic: { label: 'Basic Salary', group: 'earnings', section: 'Earnings', greytCode: 'BASIC', mandatory: true },
  hra: { label: 'House Rent Allowance (HRA)', group: 'earnings', section: 'Earnings', greytCode: 'HRA', mandatory: true },
  special: { label: 'Special Allowance', group: 'earnings', section: 'Earnings', greytCode: 'SPECIAL', mandatory: true },
  er_pf: { label: 'Employer PF', group: 'employer', section: 'Employer Contributions', greytCode: 'ER_PF', optional: true, tooltip: 'Employer Provident Fund contribution. Typically 12% of Basic, capped at wage ceiling. Included in CTC when enabled.' },
  gratuity: { label: 'Gratuity', group: 'employer', section: 'Employer Contributions', greytCode: 'GRATUITY', optional: true, tooltip: 'Statutory gratuity accrual at 4.81% of Basic. Included in CTC when enabled.' },
  ee_pf: { label: 'Employee PF', group: 'deductions', section: 'Employee Deductions', greytCode: 'EE_PF', optional: true, pfLinked: true, tooltip: 'Employee Provident Fund deduction. Enabled or disabled together with Employer PF.' },
  pt: { label: 'Professional Tax', group: 'deductions', section: 'Employee Deductions', greytCode: 'PT', optional: true, tooltip: 'State-specific professional tax. Applied based on employee work state during payroll run.' },
  esi: { label: 'ESI', group: 'deductions', section: 'Employee Deductions', greytCode: 'ESI', optional: true, tooltip: 'Employee State Insurance. Applies when gross wages are below ₹21,000/month.' },
  tds: { label: 'Income Tax (TDS)', group: 'deductions', section: 'Employee Deductions', greytCode: 'TDS', optional: true, engineComputed: true, tooltip: 'Income tax deducted at source. Computed by the payroll engine based on declarations.' }
};

const DEFAULT_SS_COMPONENTS = {
  basic: { calcType: 'pct', value: 40, basedOn: 'Annual CTC', inCTC: true, taxable: true, enabled: true },
  hra: { calcType: 'pct', value: 50, basedOn: 'Basic', inCTC: true, taxable: true, enabled: true },
  special: { calcType: 'balancing', value: null, basedOn: 'Remaining CTC', inCTC: true, taxable: true, enabled: true },
  er_pf: { calcType: 'pct', value: 12, basedOn: 'Basic', inCTC: true, taxable: false, enabled: true },
  gratuity: { calcType: 'pct', value: 4.81, basedOn: 'Basic', inCTC: true, taxable: false, enabled: true },
  ee_pf: { calcType: 'pct', value: 12, basedOn: 'Basic', inCTC: false, taxable: false, enabled: true },
  pt: { calcType: 'statutory', value: null, basedOn: 'Work state', inCTC: false, taxable: false, enabled: true },
  esi: { calcType: 'pct', value: 0.75, basedOn: 'Gross', inCTC: false, taxable: false, enabled: false },
  tds: { calcType: 'engine', value: null, basedOn: 'Engine computed', inCTC: false, taxable: false, enabled: true }
};

const DEFAULT_SS_RULES = {
  includeEmployerInCTC: true,
  rounding: 'nearest',
  calcBasis: 'annual'
};

const SS_PF_WAGE_CEILING = 15000;

const SALARY_STRUCTURES = [
  {
    id: 'SS-PREMIER-STD', code: 'PREMIER-STD', name: 'Premier Standard CTC',
    description: 'Default full-time structure for Premier IT Solutions. Splits CTC into Basic, HRA, Special Allowance with statutory employer contributions included in CTC.',
    entity: 'premier', empType: 'Full-time', effectiveDate: '2022-04-01', status: 'active',
    empCount: 5, createdBy: 'Priya Sharma', lastUpdated: '14 May 2026',
    components: JSON.parse(JSON.stringify(DEFAULT_SS_COMPONENTS)),
    rules: { ...DEFAULT_SS_RULES },
    assignments: [
      { empId: 'EMP1003', dept: 'Engineering', designation: 'Team Lead', annualCTC: 2240000, effectiveDate: '2026-04-01' },
      { empId: 'EMP1042', dept: 'Sales', designation: 'Sr. Bench Sales', annualCTC: 1850000, effectiveDate: '2026-04-01' },
      { empId: 'EMP1058', dept: 'Recruitment', designation: 'US IT Recruiter', annualCTC: 820000, effectiveDate: '2026-04-01' },
      { empId: 'EMP1019', dept: 'Sales', designation: 'Bench Sales', annualCTC: 580000, effectiveDate: '2026-04-01' },
      { empId: 'EMP1080', dept: 'Recruitment', designation: 'Sr. Recruiter', annualCTC: 1180000, effectiveDate: '2026-04-01' }
    ],
    versions: [
      { version: 'v3', date: '14 May 2026', reason: 'Updated PF wage ceiling to ₹15,000', status: 'active' },
      { version: 'v2', date: '1 Apr 2025', reason: 'Annual review — gratuity enabled', status: 'superseded' },
      { version: 'v1', date: '1 Apr 2022', reason: 'Initial structure created', status: 'superseded' }
    ]
  },
  {
    id: 'SS-PREMIER-CON', code: 'PREMIER-CON', name: 'Premier Consultant (No PF)',
    description: 'For consultants without PF. Higher special allowance balancing component.',
    entity: 'premier', empType: 'Consultant', effectiveDate: '2023-06-01', status: 'active',
    empCount: 1, createdBy: 'Vasu Devalla', lastUpdated: '2 Mar 2026',
    components: {
      ...JSON.parse(JSON.stringify(DEFAULT_SS_COMPONENTS)),
      er_pf: { ...DEFAULT_SS_COMPONENTS.er_pf, enabled: false },
      ee_pf: { ...DEFAULT_SS_COMPONENTS.ee_pf, enabled: false },
      gratuity: { ...DEFAULT_SS_COMPONENTS.gratuity, enabled: false },
      basic: { calcType: 'pct', value: 50, basedOn: 'Annual CTC', inCTC: true, taxable: true, enabled: true },
      hra: { calcType: 'pct', value: 40, basedOn: 'Basic', inCTC: true, taxable: true, enabled: true }
    },
    rules: { ...DEFAULT_SS_RULES },
    assignments: [
      { empId: 'EMP1071', dept: 'Recruitment', designation: 'Recruiter', annualCTC: 620000, effectiveDate: '2026-05-17' }
    ],
    versions: [
      { version: 'v1', date: '1 Jun 2023', reason: 'Created for consultant hires', status: 'active' }
    ]
  },
  {
    id: 'SS-NEMO-STD', code: 'NEMO-STD', name: 'Nemo Standard CTC',
    description: 'Standard structure for Nemo IT Solutions full-time employees.',
    entity: 'nemo', empType: 'Full-time', effectiveDate: '2022-04-01', status: 'active',
    empCount: 2, createdBy: 'Priya Sharma', lastUpdated: '28 Apr 2026',
    components: JSON.parse(JSON.stringify(DEFAULT_SS_COMPONENTS)),
    rules: { ...DEFAULT_SS_RULES },
    assignments: [
      { empId: 'EMP1067', dept: 'Sales', designation: 'Sr. Bench Sales', annualCTC: 1640000, effectiveDate: '2026-04-01' },
      { empId: 'EMP2014', dept: 'Recruitment', designation: 'Recruiter', annualCTC: 700000, effectiveDate: '2026-04-01' }
    ],
    versions: [{ version: 'v1', date: '1 Apr 2022', reason: 'Initial structure', status: 'active' }]
  },
  {
    id: 'SS-INV-STD', code: 'INV-STD', name: 'Invicktus Standard',
    description: 'Default structure for Invicktus with ESI disabled.',
    entity: 'invicktus', empType: 'Full-time', effectiveDate: '2024-04-01', status: 'active',
    empCount: 1, createdBy: 'Priya Sharma', lastUpdated: '10 May 2026',
    components: JSON.parse(JSON.stringify(DEFAULT_SS_COMPONENTS)),
    rules: { ...DEFAULT_SS_RULES },
    assignments: [
      { empId: 'EMP3022', dept: 'Recruitment', designation: 'Recruiter', annualCTC: 740000, effectiveDate: '2026-04-01' }
    ],
    versions: [{ version: 'v1', date: '1 Apr 2024', reason: 'Entity onboarding', status: 'active' }]
  },
  {
    id: 'SS-PREMIER-INT', code: 'PREMIER-INT', name: 'Premier Intern Stipend',
    description: 'Draft structure for intern stipends. Under review by Finance.',
    entity: 'premier', empType: 'Intern', effectiveDate: '2026-07-01', status: 'draft',
    empCount: 0, createdBy: 'Priya Sharma', lastUpdated: '12 May 2026',
    components: {
      basic: { calcType: 'pct', value: 100, basedOn: 'Annual CTC', inCTC: true, taxable: true, enabled: true },
      hra: { calcType: 'pct', value: 0, basedOn: 'Basic', inCTC: true, taxable: true, enabled: true },
      special: { calcType: 'balancing', value: null, basedOn: 'Remaining CTC', inCTC: true, taxable: true, enabled: true },
      er_pf: { ...DEFAULT_SS_COMPONENTS.er_pf, enabled: false },
      gratuity: { ...DEFAULT_SS_COMPONENTS.gratuity, enabled: false },
      ee_pf: { ...DEFAULT_SS_COMPONENTS.ee_pf, enabled: false },
      pt: { ...DEFAULT_SS_COMPONENTS.pt, enabled: false },
      esi: { ...DEFAULT_SS_COMPONENTS.esi, enabled: false },
      tds: DEFAULT_SS_COMPONENTS.tds
    },
    rules: { ...DEFAULT_SS_RULES, includeEmployerInCTC: false },
    assignments: [],
    versions: [{ version: 'v1', date: '12 May 2026', reason: 'Draft for FY 2026-27 intern program', status: 'draft' }]
  }
];

function getSS(id) { return SALARY_STRUCTURES.find(s => s.id === id); }

function roundSS(n, method) {
  if (method === 'floor') return Math.floor(n);
  if (method === 'ceil') return Math.ceil(n);
  return Math.round(n);
}

const SS_CALC_MODE_LABELS = {
  pct_ctc: '% of Annual CTC',
  pct_basic: '% of Basic Salary',
  pct_gross: '% of Gross Salary',
  fixed: 'Fixed Amount',
  balancing: 'Balancing Component',
  statutory: 'Statutory',
  engine: 'Engine computed'
};

const SS_COMPONENT_CALC_MODES = {
  basic: ['pct_ctc', 'pct_basic', 'pct_gross', 'fixed'],
  hra: ['pct_ctc', 'pct_basic', 'pct_gross', 'fixed'],
  special: ['balancing'],
  er_pf: ['pct_basic', 'fixed'],
  gratuity: ['pct_basic', 'fixed'],
  ee_pf: ['pct_basic', 'fixed'],
  pt: ['statutory'],
  esi: ['pct_gross', 'fixed'],
  tds: ['engine']
};

function isSSMandatory(key) { return SS_MANDATORY_KEYS.includes(key); }

function ssCalcModeFromComp(comp) {
  if (comp.calcType === 'balancing') return 'balancing';
  if (comp.calcType === 'fixed') return 'fixed';
  if (comp.calcType === 'statutory') return 'statutory';
  if (comp.calcType === 'engine') return 'engine';
  if (comp.basedOn === 'Annual CTC') return 'pct_ctc';
  if (comp.basedOn === 'Gross') return 'pct_gross';
  return 'pct_basic';
}

function setSSCalcMode(key, mode) {
  if (!S.ssWizardData) return;
  const comp = S.ssWizardData.components[key];
  if (mode === 'balancing') {
    comp.calcType = 'balancing';
    comp.basedOn = 'Remaining CTC';
    comp.value = null;
  } else if (mode === 'fixed') {
    comp.calcType = 'fixed';
    comp.basedOn = 'Monthly';
    if (comp.value == null) comp.value = 0;
  } else if (mode === 'pct_ctc') {
    comp.calcType = 'pct';
    comp.basedOn = 'Annual CTC';
  } else if (mode === 'pct_basic') {
    comp.calcType = 'pct';
    comp.basedOn = 'Basic';
  } else if (mode === 'pct_gross') {
    comp.calcType = 'pct';
    comp.basedOn = 'Gross';
  }
  R();
}

function ssCalcMonthly(comp, ctx, rounding) {
  if (comp.calcType === 'fixed') return roundSS(comp.value || 0, rounding);
  if (comp.calcType === 'pct') {
    if (comp.basedOn === 'Annual CTC') return roundSS((ctx.annualCTC * comp.value / 100) / 12, rounding);
    if (comp.basedOn === 'Basic') return roundSS(ctx.basicMonthly * comp.value / 100, rounding);
    if (comp.basedOn === 'Gross') return roundSS(ctx.grossMonthly * comp.value / 100, rounding);
  }
  return 0;
}

function rSSCalcSelect(key, comp, fieldsDisabled) {
  const modes = SS_COMPONENT_CALC_MODES[key] || [];
  const current = ssCalcModeFromComp(comp);
  const locked = modes.length === 1;
  const opts = modes.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${SS_CALC_MODE_LABELS[m]}</option>`).join('');
  return `<select ${fieldsDisabled || locked ? 'disabled' : ''} class="ss-calc-select" onchange="setSSCalcMode('${key}', this.value)">${opts}</select>`;
}

function rSSValueInput(key, comp, fieldsDisabled) {
  const mode = ssCalcModeFromComp(comp);
  if (mode === 'balancing') return `<input type="text" value="" placeholder="Auto" disabled class="ss-value-input" />`;
  if (mode === 'statutory' || mode === 'engine') return `<input type="text" value="" placeholder="—" disabled class="ss-value-input" />`;
  if (mode === 'fixed') return `<input type="text" value="${comp.value != null ? comp.value : ''}" placeholder="₹/mo" ${fieldsDisabled ? 'disabled' : ''} class="ss-value-input" oninput="updateSSComponent('${key}','value',this.value.replace(/[^0-9.]/g,''))" />`;
  return `<input type="text" value="${comp.value != null ? comp.value : ''}" placeholder="%" ${fieldsDisabled ? 'disabled' : ''} class="ss-value-input" oninput="updateSSComponent('${key}','value',this.value.replace(/[^0-9.]/g,''))" />`;
}

function computeSSBreakup(structure, annualCTC) {
  const c = structure.components;
  const r = structure.rules;
  const rounding = r.rounding || 'nearest';
  const ctx = { annualCTC, basicMonthly: 0, grossMonthly: 0 };

  const basicMonthly = ssCalcMonthly(c.basic, ctx, rounding);
  ctx.basicMonthly = basicMonthly;

  const hraMonthly = ssCalcMonthly(c.hra, ctx, rounding);

  const pfEnabled = c.er_pf.enabled && c.ee_pf.enabled;
  const pfWageMonthly = pfEnabled ? Math.min(basicMonthly, SS_PF_WAGE_CEILING) : 0;
  const erPFMonthly = pfEnabled
    ? (c.er_pf.calcType === 'fixed' ? roundSS(c.er_pf.value || 0, rounding) : Math.min(roundSS(pfWageMonthly * (c.er_pf.value / 100), rounding), 1800))
    : 0;
  const erPFAnnual = erPFMonthly * 12;

  const gratuityMonthly = c.gratuity.enabled
    ? (c.gratuity.calcType === 'fixed' ? roundSS(c.gratuity.value || 0, rounding) : roundSS(basicMonthly * (c.gratuity.value / 100), rounding))
    : 0;
  const gratuityAnnual = gratuityMonthly * 12;

  const basicAnnual = basicMonthly * 12;
  const hraAnnual = hraMonthly * 12;
  const fixedInCTC = basicAnnual + hraAnnual + (r.includeEmployerInCTC ? (erPFAnnual + gratuityAnnual) : 0);
  const specialAnnual = Math.max(0, annualCTC - fixedInCTC);
  const specialMonthly = roundSS(specialAnnual / 12, rounding);

  const grossMonthly = basicMonthly + hraMonthly + specialMonthly;
  ctx.grossMonthly = grossMonthly;

  const eePFMonthly = pfEnabled
    ? (c.ee_pf.calcType === 'fixed' ? roundSS(c.ee_pf.value || 0, rounding) : Math.min(roundSS(pfWageMonthly * (c.ee_pf.value / 100), rounding), 1800))
    : 0;
  const ptMonthly = c.pt.enabled ? 200 : 0;
  const esiMonthly = c.esi.enabled ? ssCalcMonthly(c.esi, ctx, rounding) : 0;

  const employerMonthly = (c.er_pf.enabled ? erPFMonthly : 0) + (c.gratuity.enabled ? gratuityMonthly : 0);
  const deductionsMonthly = (c.ee_pf.enabled ? eePFMonthly : 0) + (c.pt.enabled ? ptMonthly : 0) + (c.esi.enabled ? esiMonthly : 0);
  const takeHomeMonthly = grossMonthly - deductionsMonthly;

  const rows = [];
  rows.push({ key: 'basic', ...SS_COMPONENT_META.basic, monthly: basicMonthly, annual: basicMonthly * 12, inCTC: true });
  rows.push({ key: 'hra', ...SS_COMPONENT_META.hra, monthly: hraMonthly, annual: hraMonthly * 12, inCTC: true });
  rows.push({ key: 'special', ...SS_COMPONENT_META.special, monthly: specialMonthly, annual: specialMonthly * 12, inCTC: true });
  if (c.er_pf.enabled) rows.push({ key: 'er_pf', ...SS_COMPONENT_META.er_pf, monthly: erPFMonthly, annual: erPFAnnual, inCTC: true });
  if (c.gratuity.enabled) rows.push({ key: 'gratuity', ...SS_COMPONENT_META.gratuity, monthly: gratuityMonthly, annual: gratuityAnnual, inCTC: true });
  if (c.ee_pf.enabled) rows.push({ key: 'ee_pf', ...SS_COMPONENT_META.ee_pf, monthly: eePFMonthly, annual: eePFMonthly * 12, inCTC: false, isDeduction: true });
  if (c.pt.enabled) rows.push({ key: 'pt', ...SS_COMPONENT_META.pt, monthly: ptMonthly, annual: ptMonthly * 12, inCTC: false, isDeduction: true });
  if (c.esi.enabled) rows.push({ key: 'esi', ...SS_COMPONENT_META.esi, monthly: esiMonthly, annual: esiMonthly * 12, inCTC: false, isDeduction: true });

  const ctcCheck = roundSS(basicAnnual + hraAnnual + specialAnnual + (r.includeEmployerInCTC ? erPFAnnual + gratuityAnnual : 0), rounding);
  const pfExceedsCeiling = pfEnabled && basicMonthly > SS_PF_WAGE_CEILING;
  const pfMismatch = c.er_pf.enabled !== c.ee_pf.enabled;

  return {
    annualCTC, monthlyCTC: roundSS(annualCTC / 12, rounding),
    grossMonthly, grossAnnual: grossMonthly * 12,
    employerMonthly, employerAnnual: employerMonthly * 12,
    deductionsMonthly, deductionsAnnual: deductionsMonthly * 12,
    takeHomeMonthly, takeHomeAnnual: takeHomeMonthly * 12,
    rows, ctcCheck, pfExceedsCeiling, pfMismatch,
    balancingCount: c.special.calcType === 'balancing' ? 1 : 0,
    disabledOptional: Object.keys(c).filter(k => !isSSMandatory(k) && !c[k].enabled)
  };
}

function ssStatusPill(status) {
  if (status === 'active') return '<span class="pill pill-green">Active</span>';
  if (status === 'draft') return '<span class="pill pill-orange">Draft</span>';
  return '<span class="pill pill-gray">Inactive</span>';
}

function ssCalcDisplayLabel(comp) {
  const mode = ssCalcModeFromComp(comp);
  return SS_CALC_MODE_LABELS[mode] || ssCalcLabel(comp);
}

function ssCalcLabel(comp) {
  if (comp.calcType === 'balancing') return 'Balancing';
  if (comp.calcType === 'statutory') return 'Statutory';
  if (comp.calcType === 'fixed') return 'Fixed';
  if (comp.calcType === 'engine') return 'Engine';
  return '% of ' + (comp.basedOn || 'CTC');
}

function ssValueLabel(comp) {
  if (comp.calcType === 'balancing') return 'Auto';
  if (comp.calcType === 'engine') return '—';
  if (comp.calcType === 'statutory') return 'By state';
  if (comp.calcType === 'fixed') return fmt(comp.value) + '/mo';
  return comp.value + '%';
}

function toggleSSComponent(key, enabled) {
  if (!S.ssWizardData || isSSMandatory(key)) return;
  const c = S.ssWizardData.components;
  if (SS_PF_KEYS.includes(key)) {
    c.er_pf.enabled = enabled;
    c.ee_pf.enabled = enabled;
  } else {
    c[key].enabled = enabled;
  }
  R();
}

function updateSSComponent(key, field, value) {
  if (!S.ssWizardData) return;
  const comp = S.ssWizardData.components[key];
  if (isSSMandatory(key) && field === 'enabled') return;
  if (field === 'value') comp.value = value === '' ? null : parseFloat(value) || 0;
  else if (field === 'inCTC' || field === 'taxable') comp[field] = value;
  R();
}

function toggleSSComponentFlag(key, field, value) {
  updateSSComponent(key, field, value);
}

function getSSRowPreview(components, rules, annualCTC, key) {
  const comp = components[key];
  const meta = SS_COMPONENT_META[key];
  if (!comp.enabled && !isSSMandatory(key)) return '<span class="text-tertiary">—</span>';
  if (meta.engineComputed) return '<span class="text-xs text-secondary">Engine</span>';
  const b = computeSSBreakup({ components, rules }, annualCTC);
  const row = b.rows.find(r => r.key === key);
  return row ? `<span class="ss-preview-amt">${fmt(row.monthly)}</span>` : '<span class="text-tertiary">—</span>';
}

function ssComponentValidations(data) {
  const v = [];
  const c = data.components;
  const r = data.rules;
  const previewCTC = S.ssPreviewCTC || 1200000;
  const b = computeSSBreakup(data, previewCTC);

  v.push({ type: 'pass', text: 'Mandatory components (Basic, HRA, Special Allowance) are always enabled' });
  v.push({ type: b.balancingCount === 1 ? 'pass' : 'fail', text: b.balancingCount === 1 ? 'Exactly one balancing component (Special Allowance)' : 'Must have exactly one balancing component' });

  if (b.pfMismatch) v.push({ type: 'fail', text: 'Employer PF and Employee PF must be enabled or disabled together' });
  else if (!c.er_pf.enabled) v.push({ type: 'pass', text: 'PF components disabled — excluded from preview' });
  else if (b.pfExceedsCeiling) v.push({ type: 'warn', text: 'Basic exceeds standard PF wage ceiling (₹' + SS_PF_WAGE_CEILING.toLocaleString('en-IN') + '/mo) — preview PF capped' });
  if (c.pt.enabled) v.push({ type: 'pass', text: 'Professional Tax eligibility uses employee work state during onboarding' });
  if (c.esi.enabled) v.push({ type: 'pass', text: 'ESI eligibility is determined during employee onboarding' });
  if (b.disabledOptional.length) v.push({ type: 'pass', text: b.disabledOptional.length + ' disabled component(s) excluded from breakup preview' });

  const diff = Math.abs(b.ctcCheck - b.annualCTC);
  v.push({ type: diff <= 12 ? 'pass' : 'warn', text: diff <= 12 ? 'Total salary equals Annual CTC (sample ₹' + previewCTC.toLocaleString('en-IN') + ')' : 'CTC split mismatch on sample CTC (diff ' + fmt(diff) + ')' });

  return v;
}

// Navigation helpers
function navSS() { S.ssSel = null; S.ssWizard = null; S.ssWizardStep = 1; nav('salary-structures'); }
function viewSS(id) { S.ssSel = id; S.ssWizard = null; S.ssTab = 'overview'; S.nav = 'salary-structures'; R(); }
function isSSMultiEntity() { return Object.keys(E).length > 1; }

function generateSSCode(name, entity) {
  const slug = (name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return 'STRUCTURE-' + Date.now().toString(36).toUpperCase();
  if (entity && isSSMultiEntity()) {
    const prefix = entity.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return prefix + '-' + slug;
  }
  return slug;
}

function updateSSBasic(field, value) {
  if (!S.ssWizardData) return;
  S.ssWizardData[field] = value;
  if (field === 'name' && S.ssWizard === 'create') {
    S.ssWizardData.code = generateSSCode(value, S.entity || S.ssWizardData.entity);
  }
  R();
}

function saveSSStructure(status) {
  if (!S.ssWizardData) return;
  if (!S.ssWizardData.name.trim()) { toast('Structure name is required'); return; }
  S.ssWizardData.status = status;
  S.ssWizardData.rules = normalizeSSRules(S.ssWizardData.rules);
  if (S.ssWizard === 'create') S.ssWizardData.entity = S.entity || Object.keys(E)[0];
  if (!S.ssWizardData.code) S.ssWizardData.code = generateSSCode(S.ssWizardData.name, S.ssWizardData.entity);
  toast(status === 'active' ? 'Salary structure published' : 'Saved as draft');
  navSS();
}

function createSS() { S.ssSel = null; S.ssWizard = 'create'; S.ssWizardStep = 1; S.ssPreviewCTC = 1200000; S.ssWizardData = { name: '', code: '', description: '', entity: S.entity || 'premier', effectiveDate: '2026-06-01', status: 'draft', components: JSON.parse(JSON.stringify(DEFAULT_SS_COMPONENTS)), rules: { ...DEFAULT_SS_RULES } }; SS_MANDATORY_KEYS.forEach(k => { S.ssWizardData.components[k].enabled = true; }); S.nav = 'salary-structures'; R(); }
function normalizeSSRules(rules) {
  return {
    includeEmployerInCTC: rules?.includeEmployerInCTC !== false,
    rounding: rules?.rounding || 'nearest',
    calcBasis: rules?.calcBasis || 'annual'
  };
}

function editSS(id) { const s = getSS(id); if (!s) return; S.ssSel = id; S.ssWizard = 'edit'; S.ssWizardStep = 1; S.ssWizardData = JSON.parse(JSON.stringify({ name: s.name, code: s.code, description: s.description, entity: s.entity, effectiveDate: s.effectiveDate, status: s.status, components: s.components, rules: normalizeSSRules(s.rules) })); SS_MANDATORY_KEYS.forEach(k => { S.ssWizardData.components[k].enabled = true; }); S.nav = 'salary-structures'; R(); }
function ssWizardGo(n) { if (n >= 1 && n <= 3) { S.ssWizardStep = n; R(); } }
function ssWizardNext() { if (S.ssWizardStep < 3) { S.ssWizardStep++; R(); } }
function ssWizardPrev() { if (S.ssWizardStep > 1) { S.ssWizardStep--; R(); } }
function openSSDrawer(mode, id) { S.ssDrawer = mode; S.ssDrawerId = id; S.ssAssignForm = { empId: '', annualCTC: 1200000, effectiveDate: '2026-06-01' }; R(); }
function closeSSDrawer() { S.ssDrawer = null; S.ssDrawerId = null; R(); }
function setSSPreviewCTC(v) { S.ssPreviewCTC = parseInt(v) || 0; R(); }

function ssValidations(structure, breakup) {
  const v = [];
  const diff = Math.abs(breakup.ctcCheck - breakup.annualCTC);
  v.push({ type: diff <= 12 ? 'pass' : 'fail', text: diff <= 12 ? 'Total salary equals Annual CTC' : 'CTC split does not equal Annual CTC (diff ' + fmt(diff) + ')' });
  v.push({ type: breakup.balancingCount === 1 ? 'pass' : 'fail', text: breakup.balancingCount === 1 ? 'Exactly one balancing component configured' : 'Must have exactly one balancing component' });
  if (breakup.pfMismatch) v.push({ type: 'fail', text: 'Employer PF and Employee PF must be enabled or disabled together' });
  if (breakup.pfExceedsCeiling) v.push({ type: 'warn', text: 'Basic exceeds standard PF wage ceiling — preview PF capped' });
  if (breakup.disabledOptional.length) v.push({ type: 'pass', text: breakup.disabledOptional.map(k => SS_COMPONENT_META[k].label).join(', ') + ' excluded from preview' });
  return v;
}

function rSSWizardBar(step) {
  const steps = [
    { label: 'Basic Details', sub: 'Name, description, date' },
    { label: 'Salary Components', sub: 'Earnings, deductions' },
    { label: 'Preview & Save', sub: 'Verify and publish' }
  ];
  return `<div class="ss-wizard-bar">${steps.map((s, i) => {
    const n = i + 1;
    const cls = n === step ? 'active' : n < step ? 'done' : '';
    const dotContent = n < step ? '' : n;
    return `<div class="ss-wizard-step ${cls}"><div class="ss-wizard-dot">${dotContent}</div><div class="ss-wizard-text"><div class="ss-wizard-label">${s.label}</div><div class="ss-wizard-sub">${s.sub}</div></div></div>`;
  }).join('')}</div>`;
}

function rSSComponentSection(groupKey, title, data, expanded) {
  const keys = Object.keys(SS_COMPONENT_META).filter(k => SS_COMPONENT_META[k].group === groupKey);
  const previewCTC = S.ssPreviewCTC || 1200000;
  return `<div class="ss-section">
    <div class="ss-section-head" onclick="S.ssExpanded_${groupKey}=${!expanded}; R();">
      <b><i class="ti ti-${groupKey === 'earnings' ? 'currency-rupee' : groupKey === 'employer' ? 'building' : 'minus'}"></i> ${title}</b>
      <i class="ti ti-chevron-${expanded ? 'up' : 'down'} text-secondary"></i>
    </div>
    <div class="ss-section-body ${expanded ? '' : 'collapsed'}">
      <div class="ss-comp-row head"><span>Component</span><span>Status</span><span>Calculation</span><span>Value</span><span>In CTC</span><span>Taxable</span><span class="ss-preview-cell">Monthly</span></div>
      ${keys.map(k => {
    const meta = SS_COMPONENT_META[k];
    const comp = data.components[k];
    const mandatory = isSSMandatory(k);
    const rowDisabled = !mandatory && !comp.enabled;
    const mode = ssCalcModeFromComp(comp);
    const fieldsDisabled = rowDisabled || mode === 'balancing' || mode === 'statutory' || mode === 'engine';
    const pfToggleKey = meta.pfLinked ? 'er_pf' : k;
    const statusCell = mandatory
      ? `<span class="ss-status-lock" title="Mandatory — cannot be disabled"><i class="ti ti-lock"></i> Enabled</span>`
      : `<label class="toggle" title="${meta.tooltip || ''}"><input type="checkbox" ${comp.enabled ? 'checked' : ''} onchange="toggleSSComponent('${pfToggleKey}', this.checked)" /><span class="toggle-slider"></span></label>`;
    const tooltipIcon = meta.tooltip ? `<i class="ti ti-info-circle ss-tip" title="${meta.tooltip}"></i>` : '';
    return `<div class="ss-comp-row ${rowDisabled ? 'disabled' : ''}">
          <div class="ss-comp-name">${meta.label}${tooltipIcon}${mode === 'engine' ? '<span class="text-xs">Computed by payroll engine</span>' : ''}${meta.pfLinked ? '<span class="text-xs">Linked to Employer PF</span>' : ''}</div>
          <div class="ss-status-cell">${statusCell}</div>
          ${rSSCalcSelect(k, comp, rowDisabled)}
          ${rSSValueInput(k, comp, fieldsDisabled)}
          <span class="center-cell"><label class="toggle"><input type="checkbox" ${comp.inCTC ? 'checked' : ''} ${rowDisabled ? 'disabled' : ''} onchange="toggleSSComponentFlag('${k}', 'inCTC', this.checked)" /><span class="toggle-slider"></span></label></span>
          <span class="center-cell text-sm ${rowDisabled ? 'text-secondary' : ''}">${comp.taxable ? 'Yes' : 'No'}</span>
          <span class="ss-preview-cell">${getSSRowPreview(data.components, data.rules, previewCTC, k)}</span>
        </div>`;
  }).join('')}
    </div>
  </div>`;
}

// === LISTING ===
function rSalaryStructuresContent() {
  const f = S.ssFilter;
  let list = SALARY_STRUCTURES.filter(s => {
    if (f.status !== 'all' && s.status !== f.status) return false;
    if (f.entity !== 'all' && s.entity !== f.entity) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const total = SALARY_STRUCTURES.length;
  const active = SALARY_STRUCTURES.filter(s => s.status === 'active').length;
  const assigned = SALARY_STRUCTURES.reduce((sum, s) => sum + s.empCount, 0);
  const drafts = SALARY_STRUCTURES.filter(s => s.status === 'draft').length;

  return `<div class="alert-banner alert-blue mb-3"><i class="ti ti-info-circle"></i><div><b>Fixed salary only</b>This module configures predefined earnings, employer contributions, and statutory deductions. Bonuses, incentives, reimbursements, arrears, overtime, and leave encashment are managed separately in Monthly Inputs.</div></div>

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-layout-grid"></i></div><div><div class="stat-label">Total Structures</div><div class="stat-value">${total}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Active</div><div class="stat-value">${active}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-users"></i></div><div><div class="stat-label">Employees Assigned</div><div class="stat-value">${assigned}</div></div></div>
      <div class="stat-tile"><div class="stat-icon orange"><i class="ti ti-edit"></i></div><div><div class="stat-label">Draft</div><div class="stat-value">${drafts}</div></div></div>
    </div>

    <div class="filter-bar">
      <i class="ti ti-search text-secondary"></i>
      <input type="text" placeholder="Search name, description..." value="${f.search}" oninput="S.ssFilter.search=this.value; R();" style="flex:1;min-width:200px;" />
      <select onchange="S.ssFilter.status=this.value; R();"><option value="all" ${f.status === 'all' ? 'selected' : ''}>All statuses</option><option value="active" ${f.status === 'active' ? 'selected' : ''}>Active</option><option value="draft" ${f.status === 'draft' ? 'selected' : ''}>Draft</option><option value="inactive" ${f.status === 'inactive' ? 'selected' : ''}>Inactive</option></select>
      <select onchange="S.ssFilter.entity=this.value; R();"><option value="all" ${f.entity === 'all' ? 'selected' : ''}>All entities</option><option value="premier" ${f.entity === 'premier' ? 'selected' : ''}>Premier</option><option value="nemo" ${f.entity === 'nemo' ? 'selected' : ''}>Nemo</option><option value="invicktus" ${f.entity === 'invicktus' ? 'selected' : ''}>Invicktus</option></select>
    </div>

    <div class="card" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="table">
          <thead><tr>
            <th>Structure Name</th><th>Description</th><th>Employees</th><th>Effective Date</th><th>Status</th><th>Last Updated</th><th>Actions</th>
          </tr></thead>
          <tbody>${list.map(s => `<tr>
            <td><b>${s.name}</b></td>
            <td style="max-width:280px;"><span class="text-sm text-secondary">${s.description.slice(0, 80)}${s.description.length > 80 ? '…' : ''}</span></td>
            <td><b>${s.empCount}</b></td>
            <td>${new Date(s.effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td>${ssStatusPill(s.status)}</td>
            <td class="text-xs text-secondary">${s.lastUpdated}</td>
            <td><div class="actions-menu">
              <button class="btn btn-sm btn-icon-only" onclick="viewSS('${s.id}')" title="View"><i class="ti ti-eye"></i></button>
              <button class="btn btn-sm btn-icon-only" onclick="editSS('${s.id}')" title="Edit"><i class="ti ti-pencil"></i></button>
              <button class="btn btn-sm btn-icon-only" onclick="toast('Structure duplicated as draft')" title="Duplicate"><i class="ti ti-copy"></i></button>
              <button class="btn btn-sm btn-icon-only" onclick="openSSDrawer('assign','${s.id}')" title="Assign employees"><i class="ti ti-user-plus"></i></button>
              ${s.status === 'active' ? `<button class="btn btn-sm btn-icon-only btn-danger" onclick="toast('${s.name} deactivated')" title="Deactivate"><i class="ti ti-ban"></i></button>` : ''}
            </div></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function rSalaryStructures() {
  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Salary Structures</h1>
        <p class="page-sub">Configure how Annual CTC is split into fixed salary components · synced to greytHR</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="createSS()"><i class="ti ti-plus"></i> Create Salary Structure</button>
      </div>
    </div>
    ${rSalaryStructuresContent()}
  </div>`;
}

// === WIZARD ===
function rSSWizardContent() {
  const step = S.ssWizardStep;
  const data = S.ssWizardData || { components: DEFAULT_SS_COMPONENTS, rules: DEFAULT_SS_RULES };

  let body = '';
  if (step === 1) {
    body = `<div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-file-description"></i></span>Basic Details</div></div>
      <div class="field"><label class="field-label">Structure Name *</label><input type="text" value="${data.name}" placeholder="e.g., Premier Standard CTC" oninput="updateSSBasic('name', this.value)" /></div>
      <div class="field"><label class="field-label">Description</label><textarea rows="3" placeholder="Purpose and applicability of this structure" oninput="updateSSBasic('description', this.value)">${data.description || ''}</textarea></div>
      <div class="field"><label class="field-label">Effective Date *</label><input type="date" value="${data.effectiveDate}" onchange="updateSSBasic('effectiveDate', this.value)" /></div>
    </div>`;
  } else if (step === 2) {
    const struct = { components: data.components, rules: data.rules };
    body = `<div class="alert-banner alert-blue mb-3"><i class="ti ti-lock"></i><div><b>Predefined components only</b>Configure calculation for fixed salary components. Mandatory earnings cannot be disabled. Optional statutory components can be toggled — disabled components are excluded from the breakup preview.</div></div>
      <div class="field" style="max-width:280px;margin-bottom:16px;"><label class="field-label">Sample CTC for row preview</label><input type="text" value="${(S.ssPreviewCTC || 1200000).toLocaleString('en-IN')}" oninput="setSSPreviewCTC(this.value.replace(/[^0-9]/g,''))" placeholder="₹12,00,000" /><div class="text-xs text-secondary mt-2">Monthly column updates live · disabled components show —</div></div>
      ${rSSComponentSection('earnings', 'Earnings', struct, S.ssExpanded_earnings !== false)}
      ${rSSComponentSection('employer', 'Employer Contributions', struct, S.ssExpanded_employer !== false)}
      ${rSSComponentSection('deductions', 'Employee Deductions', struct, S.ssExpanded_deductions !== false)}
      <div class="card" style="margin-top:16px;"><div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-checkup-list"></i></span>Validations</div></div>
        ${ssComponentValidations(struct).map(v => `<div class="ss-validation ${v.type}"><i class="ti ti-${v.type === 'pass' ? 'circle-check' : v.type === 'warn' ? 'alert-triangle' : 'circle-x'}"></i> ${v.text}</div>`).join('')}
      </div>`;
  } else {
    const struct = { components: data.components, rules: data.rules };
    const b = computeSSBreakup(struct, S.ssPreviewCTC);
    body = `<div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-eye"></i></span>Preview with sample CTC</div></div>
      <div class="field" style="max-width:320px;"><label class="field-label">Sample Annual CTC</label><input type="text" value="${S.ssPreviewCTC.toLocaleString('en-IN')}" oninput="setSSPreviewCTC(this.value.replace(/[^0-9]/g,''))" placeholder="₹12,00,000" /></div>
      ${b.disabledOptional.length ? `<div class="alert-banner alert-blue mb-3" style="padding:10px 14px;"><i class="ti ti-eye-off"></i><div><b>${b.disabledOptional.length} component(s) hidden</b>${b.disabledOptional.map(k => SS_COMPONENT_META[k].label).join(', ')} — disabled in Salary Components and excluded from totals below.</div></div>` : ''}
      <div class="stat-grid mb-3">
        <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-calendar"></i></div><div><div class="stat-label">Monthly CTC</div><div class="stat-value">${fmt(b.monthlyCTC)}</div></div></div>
        <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-currency-rupee"></i></div><div><div class="stat-label">Gross Salary</div><div class="stat-value">${fmt(b.grossMonthly)}</div><div class="stat-meta">/ month</div></div></div>
        <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-building"></i></div><div><div class="stat-label">Employer Contribution</div><div class="stat-value">${fmt(b.employerMonthly)}</div><div class="stat-meta">/ month</div></div></div>
        <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-minus"></i></div><div><div class="stat-label">Employee Deductions</div><div class="stat-value">${fmt(b.deductionsMonthly)}</div><div class="stat-meta">excl. TDS</div></div></div>
      </div>
      <div style="background:var(--green-bg);padding:16px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div><div class="font-semibold text-green">Estimated Take Home</div><div class="text-xs text-green">Before income tax (TDS computed by engine)</div></div>
        <div class="font-bold text-green" style="font-size:22px;">${fmt(b.takeHomeMonthly)}<span class="text-sm font-normal"> / mo</span></div>
      </div>
      <div style="overflow-x:auto;">
        <table class="inputs-table">
          <thead><tr><th>Component</th><th class="right">Monthly</th><th class="right">Annual</th></tr></thead>
          <tbody>${b.rows.filter(r => !r.isDeduction).map(r => `<tr><td><b>${r.label}</b><br><span class="text-xs text-secondary">${r.section}</span></td><td class="num-cell">${fmt(r.monthly)}</td><td class="num-cell">${fmt(r.annual)}</td></tr>`).join('')}
          <tr style="background:var(--surface-subtle);font-weight:700;"><td>Employer contributions</td><td class="num-cell">${fmt(b.employerMonthly)}</td><td class="num-cell">${fmt(b.employerAnnual)}</td></tr>
          ${b.rows.filter(r => r.isDeduction).map(r => `<tr><td><b>${r.label}</b> <span class="text-xs text-red">(deduction)</span></td><td class="num-cell text-red">-${fmt(r.monthly)}</td><td class="num-cell text-red">-${fmt(r.annual)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${ssValidations(struct, b).map(v => `<div class="ss-validation ${v.type}"><i class="ti ti-${v.type === 'pass' ? 'circle-check' : v.type === 'warn' ? 'alert-triangle' : 'circle-x'}"></i> ${v.text}</div>`).join('')}`;
  }

  return `${rSSWizardBar(step)}
    ${body}
    <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <button class="btn" onclick="${step === 1 ? 'navSS()' : 'ssWizardPrev()'}"><i class="ti ti-arrow-left"></i> ${step === 1 ? 'Cancel' : 'Back'}</button>
      <div style="display:flex;gap:8px;">
        ${step === 3 ? `<button class="btn" onclick="saveSSStructure('draft')"><i class="ti ti-device-floppy"></i> Save Draft</button><button class="btn btn-primary" onclick="saveSSStructure('active')"><i class="ti ti-check"></i> Publish</button>` : `<button class="btn btn-primary" onclick="ssWizardNext()">Continue <i class="ti ti-arrow-right"></i></button>`}
      </div>
    </div>`;
}

function rSSWizard() {
  const step = S.ssWizardStep;
  const title = S.ssWizard === 'edit' ? 'Edit Salary Structure' : 'Create Salary Structure';
  return `<div class="page">
    <div class="page-header">
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="icon-btn" onclick="navSS()"><i class="ti ti-arrow-left"></i></button>
        <div><h1 class="page-title">${title}</h1><p class="page-sub">Step ${step} of 3 · Fixed salary components only</p></div>
      </div>
    </div>
    ${rSSWizardContent()}
  </div>`;
}

// === VIEW DETAIL ===
function rSSDetailContent() {
  const s = getSS(S.ssSel);
  if (!s) { S.ssSel = null; return rSalaryStructuresContent(); }
  const tab = S.ssTab || 'overview';
  const preview = computeSSBreakup(s, 1200000);

  const tabs = [['overview', 'Overview'], ['components', 'Components'], ['employees', 'Assigned Employees'], ['history', 'Version History']];

  let tabContent = '';
  if (tab === 'overview') {
    tabContent = `<div class="field-grid-2 mb-3">
      <div class="card"><div class="card-header"><div class="card-title">Structure Information</div>${ssStatusPill(s.status)}</div>
        <div class="info-grid">
          <div><div class="field-label">Name</div><div class="field-value">${s.name}</div></div>
          <div><div class="field-label">Code</div><div class="field-value"><span class="item-code-tag">${s.code}</span></div></div>
          <div><div class="field-label">Company</div><div class="field-value">${E[s.entity]?.name}</div></div>
          <div><div class="field-label">Effective Date</div><div class="field-value">${new Date(s.effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
          <div><div class="field-label">Employees Assigned</div><div class="field-value font-bold">${s.empCount}</div></div>
          <div><div class="field-label">Created By</div><div class="field-value">${s.createdBy}</div></div>
          <div><div class="field-label">Last Updated</div><div class="field-value">${s.lastUpdated}</div></div>
        </div>
        <p class="text-sm text-secondary mt-3">${s.description}</p>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">Sample Breakup · ₹12L CTC</div></div>
        <div class="stat-grid" style="grid-template-columns:1fr 1fr;">
          <div><div class="field-label">Monthly CTC</div><div class="field-value">${fmt(preview.monthlyCTC)}</div></div>
          <div><div class="field-label">Gross Salary</div><div class="field-value">${fmt(preview.grossMonthly)}</div></div>
          <div><div class="field-label">Employer Cost</div><div class="field-value">${fmt(preview.employerMonthly)}</div></div>
          <div><div class="field-label">Est. Take Home</div><div class="field-value text-green">${fmt(preview.takeHomeMonthly)}</div></div>
        </div>
        <button class="btn btn-sm mt-3" onclick="setT('ssTab','components'); R();">View full breakup</button>
      </div>
    </div>
    <div class="alert-banner alert-blue"><i class="ti ti-link"></i><div>Component amounts sync to greytHR via <span class="text-mono">POST /payroll/v2/employees/{id}</span> when employee CTC is assigned or revised.</div></div>`;
  } else if (tab === 'components') {
    const groups = ['earnings', 'employer', 'deductions'];
    tabContent = groups.map(g => {
      const keys = Object.keys(SS_COMPONENT_META).filter(k => SS_COMPONENT_META[k].group === g);
      const sectionTitle = g === 'earnings' ? 'Earnings' : g === 'employer' ? 'Employer Contributions' : 'Employee Deductions';
      return `<div class="card" style="padding:0;margin-bottom:14px;"><div style="padding:12px 16px;background:var(--surface-subtle);font-weight:600;font-size:13px;">${sectionTitle}</div>
        <table class="inputs-table"><thead><tr><th>Component</th><th>Calculation</th><th>Value</th><th class="center">In CTC</th><th class="center">Taxable</th><th class="center">Status</th></tr></thead>
        <tbody>${keys.map(k => { const meta = SS_COMPONENT_META[k]; const comp = s.components[k]; return `<tr class="${!comp.enabled ? 'opacity-55' : ''}"><td><b>${meta.label}</b></td><td>${ssCalcDisplayLabel(comp)}</td><td>${ssValueLabel(comp)}</td><td class="center-cell">${comp.inCTC ? 'Yes' : 'No'}</td><td class="center-cell">${comp.taxable ? 'Yes' : 'No'}</td><td class="center-cell">${comp.enabled ? '<span class="pill pill-green" style="padding:1px 6px;font-size:9px;">On</span>' : '<span class="pill pill-gray" style="padding:1px 6px;font-size:9px;">Off</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
    }).join('');
  } else if (tab === 'employees') {
    tabContent = `<div class="card" style="padding:0;">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div class="font-semibold">${s.empCount} employees on this structure</div>
        <button class="btn btn-sm btn-primary" onclick="openSSDrawer('assign','${s.id}')"><i class="ti ti-user-plus"></i> Assign Employee</button>
      </div>
      <table class="table"><thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Annual CTC</th><th>Effective Date</th></tr></thead>
      <tbody>${s.assignments.length ? s.assignments.map(a => { const e = EMP.find(x => x.id === a.empId); return `<tr><td><b>${e?.name || a.empId}</b><br><span class="text-xs text-secondary">${a.empId}</span></td><td>${a.dept}</td><td>${a.designation}</td><td><b>${fmtL(a.annualCTC)}</b></td><td>${new Date(a.effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>`; }).join('') : '<tr><td colspan="5" class="text-secondary text-center" style="padding:32px;">No employees assigned yet</td></tr>'}</tbody></table>
    </div>`;
  } else {
    tabContent = `<div class="card"><div class="timeline">${s.versions.map(v => `<div class="timeline-event ${v.status === 'active' ? 'green' : 'blue'}"><div class="timeline-dot"></div><div class="timeline-title">${v.version} · ${v.reason}</div><div class="timeline-meta">${ssStatusPill(v.status === 'active' ? 'active' : 'inactive')}</div><div class="timeline-date">${v.date}</div></div>`).join('')}</div></div>`;
  }

  return `<div class="tabs">${tabs.map(t => `<div class="tab ${tab === t[0] ? 'active' : ''}" onclick="setT('ssTab','${t[0]}'); R();">${t[1]}</div>`).join('')}</div>
    ${tabContent}`;
}

function rSSDetail() {
  const s = getSS(S.ssSel);
  if (!s) { S.ssSel = null; return rSalaryStructures(); }
  return `<div class="page">
    <div class="page-header">
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="icon-btn" onclick="navSS()"><i class="ti ti-arrow-left"></i></button>
        <div>
          <h1 class="page-title">${s.name}</h1>
          <p class="page-sub">${s.code} · ${E[s.entity]?.name} · ${ssStatusPill(s.status)}</p>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openSSDrawer('assign','${s.id}')"><i class="ti ti-user-plus"></i> Assign Employees</button>
        <button class="btn" onclick="editSS('${s.id}')"><i class="ti ti-pencil"></i> Edit</button>
        <button class="btn btn-primary" onclick="toast('Structure duplicated')"><i class="ti ti-copy"></i> Duplicate</button>
      </div>
    </div>
    ${rSSDetailContent()}
  </div>`;
}

// === ASSIGN DRAWER ===
function rSSDrawer() {
  if (!S.ssDrawer) return '';
  const s = getSS(S.ssDrawerId);
  if (!s) return '';

  const form = S.ssAssignForm;
  const emp = EMP.find(e => e.id === form.empId);
  const preview = emp ? computeSSBreakup(s, form.annualCTC) : null;
  const unassigned = EMP.filter(e => e.entity === s.entity && !s.assignments.some(a => a.empId === e.id));

  return `<div class="drawer-overlay" onclick="closeSSDrawer()"></div>
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="drawer-header">
      <div class="drawer-title"><i class="ti ti-user-plus"></i> Assign Employees</div>
      <button class="icon-btn" onclick="closeSSDrawer()"><i class="ti ti-x"></i></button>
    </div>
    <div class="drawer-body">
      <div class="alert-banner alert-blue mb-3"><i class="ti ti-info-circle"></i><div>Assign <b>${s.name}</b> to an employee. Enter Annual CTC — all components auto-calculated from structure rules.</div></div>
      <div class="field"><label class="field-label">Salary Structure</label><div class="field-value">${s.name} <span class="item-code-tag">${s.code}</span></div></div>
      <div class="field"><label class="field-label">Employee *</label><select onchange="S.ssAssignForm.empId=this.value; R();"><option value="">Select employee...</option>${unassigned.map(e => `<option value="${e.id}" ${form.empId === e.id ? 'selected' : ''}>${e.name} · ${e.id} · ${e.role}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label">Annual CTC *</label><input type="text" value="${form.annualCTC.toLocaleString('en-IN')}" oninput="S.ssAssignForm.annualCTC=parseInt(this.value.replace(/[^0-9]/g,''))||0; R();" placeholder="₹" /></div>
      <div class="field"><label class="field-label">Effective Date *</label><input type="date" value="${form.effectiveDate}" onchange="S.ssAssignForm.effectiveDate=this.value;" /></div>
      ${preview && form.empId ? `<div class="card" style="background:var(--surface-subtle);">
        <div class="text-xs font-semibold text-secondary mb-2" style="text-transform:uppercase;letter-spacing:0.4px;">Salary Preview · ${emp.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div><div class="field-label">Monthly CTC</div><div class="field-value font-bold">${fmt(preview.monthlyCTC)}</div></div>
          <div><div class="field-label">Gross Salary</div><div class="field-value">${fmt(preview.grossMonthly)}</div></div>
          <div><div class="field-label">Deductions</div><div class="field-value text-red">-${fmt(preview.deductionsMonthly)}</div></div>
          <div><div class="field-label">Est. Take Home</div><div class="field-value text-green font-bold">${fmt(preview.takeHomeMonthly)}</div></div>
        </div>
        <table class="schedule-table"><thead><tr><th>Component</th><th class="num">Monthly</th></tr></thead><tbody>
          ${preview.rows.filter(r => !r.isDeduction).slice(0, 5).map(r => `<tr><td>${r.label}</td><td class="num">${fmt(r.monthly)}</td></tr>`).join('')}
        </tbody></table>
        <div class="text-xs text-secondary mt-2"><i class="ti ti-info-circle"></i> TDS computed by engine after assignment</div>
      </div>` : ''}
    </div>
    <div class="drawer-footer">
      <button class="btn" onclick="closeSSDrawer()">Cancel</button>
      <button class="btn btn-primary" onclick="closeSSDrawer(); toast('${emp ? emp.name : 'Employee'} assigned to ${s.code}')" ${!form.empId ? 'disabled style="opacity:0.5;"' : ''}><i class="ti ti-check"></i> Confirm Assignment</button>
    </div>
  </div>`;
}

// === SALARY REVISIONS PLACEHOLDER ===
function rSalaryRevisions() {
  return `<div class="page">
    <div class="page-header">
      <div><h1 class="page-title">Salary Revisions</h1><p class="page-sub">Manage CTC changes, promotions, and off-cycle revisions</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="toast('New revision wizard — coming next')"><i class="ti ti-plus"></i> New Revision</button></div>
    </div>
    <div class="card" style="padding:48px;text-align:center;">
      <i class="ti ti-trending-up" style="font-size:48px;color:var(--text-tertiary);display:block;margin-bottom:12px;"></i>
      <div class="font-bold" style="font-size:16px;">Salary Revisions module</div>
      <p class="text-sm text-secondary mt-2 mb-3">Record hikes and revisions against assigned salary structures. Uses structure rules to recalculate components automatically.</p>
      <button class="btn" onclick="navSS()"><i class="ti ti-layout-grid"></i> Go to Salary Structures</button>
    </div>
  </div>`;
}

R();
