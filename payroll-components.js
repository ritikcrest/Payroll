// === ADDITIONAL PAY MODULE ===
// Variable payroll items — not salary structure components.

const PC_CATEGORIES = [
  'Bonus', 'Incentive', 'Reimbursement', 'Overtime', 'Arrears',
  'Leave Encashment', 'Other Earnings', 'Other Deductions'
];

const PC_GREYTHR_EXCLUDE = ['WORKDAYS', 'LOP', 'ANNUAL_CTC', 'MONTHLY_CTC', 'IS_PF_ELIGIBLE', 'TAX_REGIME'];

const PAYROLL_COMPONENTS = [
  {
    id: 'PC-001', code: 'JOIN-BONUS', name: 'Joining Bonus',
    description: 'One-time sign-on bonus paid on employee joining.',
    category: 'Bonus', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'JOIN_BONUS', lastUpdated: '10 May 2026',
    usage: { monthlyInputs: true, salaryRevisions: true, ff: false }
  },
  {
    id: 'PC-002', code: 'PERF-BONUS', name: 'Performance Bonus',
    description: 'Quarterly and annual performance-linked bonus.',
    category: 'Bonus', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'BONUS', lastUpdated: '14 May 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  },
  {
    id: 'PC-003', code: 'SALES-INCENTIVE', name: 'Sales Incentive',
    description: 'Monthly sales target incentive for revenue teams.',
    category: 'Incentive', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'INCENTIVE', lastUpdated: '8 May 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  },
  {
    id: 'PC-004', code: 'TEL-REIMB', name: 'Telephone Reimbursement',
    description: 'Monthly telephone bill reimbursement up to policy limit.',
    category: 'Reimbursement', type: 'earning', valueType: 'manual', taxable: false, active: true,
    greytHRCode: 'TEL_REIMB', lastUpdated: '2 Apr 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  },
  {
    id: 'PC-005', code: 'OVERTIME', name: 'Overtime Payout',
    description: 'Overtime hours payout entered from attendance module.',
    category: 'Overtime', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'OT_PAYOUT', lastUpdated: '28 Apr 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  },
  {
    id: 'PC-006', code: 'BASIC-ARREARS', name: 'Basic Salary Arrears',
    description: 'Arrear payout for Basic due to retrospective revision.',
    category: 'Arrears', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'BASIC_A', lastUpdated: '15 May 2026',
    usage: { monthlyInputs: true, salaryRevisions: true, ff: false }
  },
  {
    id: 'PC-007', code: 'LEAVE-ENCASH', name: 'Leave Encashment',
    description: 'Leave balance encashment amount for F&F and policy months.',
    category: 'Leave Encashment', type: 'earning', valueType: 'manual', taxable: true, active: true,
    greytHRCode: 'LEAVE_ENCASHMENT', lastUpdated: '1 Mar 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: true }
  },
  {
    id: 'PC-008', code: 'SHIFT-ALLOWANCE', name: 'Shift Allowance',
    description: 'Ad-hoc shift allowance outside fixed CTC.',
    category: 'Other Earnings', type: 'earning', valueType: 'fixed', defaultAmount: 2500, taxable: true, active: true,
    greytHRCode: 'MISC_REIM', lastUpdated: '20 Apr 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  },
  {
    id: 'PC-009', code: 'NOTICE-RECOVERY', name: 'Notice Period Recovery',
    description: 'Recovery for notice period shortfall on exit.',
    category: 'Other Deductions', type: 'deduction', valueType: 'manual', taxable: false, active: true,
    greytHRCode: 'NOTICE_RECOVERY', lastUpdated: '5 May 2026',
    usage: { monthlyInputs: false, salaryRevisions: false, ff: true }
  },
  {
    id: 'PC-010', code: 'CAB-DEDUCTION', name: 'Cab Recovery',
    description: 'Transport recovery for company cab usage.',
    category: 'Other Deductions', type: 'deduction', valueType: 'fixed', defaultAmount: 1500, taxable: false, active: false,
    greytHRCode: 'LOAN', lastUpdated: '12 Jan 2026',
    usage: { monthlyInputs: true, salaryRevisions: false, ff: false }
  }
];

function getPC(id) { return PAYROLL_COMPONENTS.find(c => c.id === id); }

function pcGreytOptions() {
  return Object.entries(GREYTHR_ITEM_CODES).filter(([k]) => !PC_GREYTHR_EXCLUDE.includes(k));
}

function pcGreytLabel(code) {
  const item = GREYTHR_ITEM_CODES[code];
  return item ? `${item.desc} (${code} · id ${item.id})` : code;
}

function pcStatusPill(active) {
  return active
    ? '<span class="pill pill-green">Active</span>'
    : '<span class="pill pill-gray">Inactive</span>';
}

function pcTypePill(type) {
  return type === 'earning'
    ? '<span class="pill pill-blue">Earning</span>'
    : '<span class="pill pill-red">Deduction</span>';
}

function pcCategoryType(cat) {
  return cat === 'Other Deductions' ? 'deduction' : 'earning';
}

function generatePCCode(name) {
  const slug = (name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'COMP-' + Date.now().toString(36).toUpperCase();
}

function navPC() { S.pcSel = null; S.pcForm = null; S.pcFormData = null; nav('payroll-components'); }

function viewPC(id) { S.pcSel = id; S.pcForm = null; S.pcFormData = null; S.nav = 'payroll-components'; R(); }

function createPC() {
  S.pcSel = null;
  S.pcForm = 'create';
  S.pcFormData = {
    name: '', code: '', description: '', category: 'Bonus', type: 'earning',
    valueType: 'manual', defaultAmount: 0, taxable: true, active: true, greytHRCode: 'BONUS'
  };
  S.nav = 'payroll-components';
  R();
}

function editPC(id) {
  const c = getPC(id);
  if (!c) return;
  S.pcSel = id;
  S.pcForm = 'edit';
  S.pcFormData = JSON.parse(JSON.stringify({
    name: c.name, code: c.code, description: c.description, category: c.category,
    type: c.type, valueType: c.valueType, defaultAmount: c.defaultAmount || 0,
    greytHRCode: c.greytHRCode
  }));
  S.nav = 'payroll-components';
  R();
}

function updatePCField(field, value) {
  if (!S.pcFormData) return;
  S.pcFormData[field] = value;
  if (field === 'name' && S.pcForm === 'create') {
    S.pcFormData.code = generatePCCode(value);
  }
  if (field === 'category') {
    S.pcFormData.type = pcCategoryType(value);
  }
  R();
}

function togglePCActive(id, active) {
  const c = getPC(id);
  if (!c) return;
  c.active = active;
  toast(c.name + (active ? ' activated' : ' deactivated'));
  R();
}

function savePC() {
  if (!S.pcFormData) return;
  if (!S.pcFormData.name.trim()) { toast('Component name is required'); return; }
  if (!S.pcFormData.code.trim()) { toast('Component code is required'); return; }
  toast(S.pcForm === 'create' ? 'Additional pay item created' : 'Additional pay item updated');
  navPC();
}

function rPayrollComponents() {
  const f = S.pcFilter;
  let list = PAYROLL_COMPONENTS.filter(c => {
    if (f.type !== 'all' && c.type !== f.type) return false;
    if (f.status === 'active' && !c.active) return false;
    if (f.status === 'inactive' && c.active) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const total = PAYROLL_COMPONENTS.length;
  const earnings = PAYROLL_COMPONENTS.filter(c => c.type === 'earning').length;
  const deductions = PAYROLL_COMPONENTS.filter(c => c.type === 'deduction').length;
  const active = PAYROLL_COMPONENTS.filter(c => c.active).length;

  return `<div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Additional Pay</h1>
        <p class="page-sub">Manage reusable payroll earnings and deductions</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="createPC()"><i class="ti ti-plus"></i> Add Pay Item</button>
      </div>
    </div>

    <div class="alert-banner alert-blue mb-3"><i class="ti ti-info-circle"></i><div><b>Additional pay items</b>Reusable definitions for bonuses, incentives, reimbursements, overtime, arrears, and deductions. Not part of Salary Structure calculations — monthly values are entered during payroll processing.</div></div>

    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-icon blue"><i class="ti ti-components"></i></div><div><div class="stat-label">Total Components</div><div class="stat-value">${total}</div></div></div>
      <div class="stat-tile"><div class="stat-icon green"><i class="ti ti-arrow-up"></i></div><div><div class="stat-label">Earnings</div><div class="stat-value">${earnings}</div></div></div>
      <div class="stat-tile"><div class="stat-icon red"><i class="ti ti-arrow-down"></i></div><div><div class="stat-label">Deductions</div><div class="stat-value">${deductions}</div></div></div>
      <div class="stat-tile"><div class="stat-icon purple"><i class="ti ti-circle-check"></i></div><div><div class="stat-label">Active Components</div><div class="stat-value">${active}</div></div></div>
    </div>

    <div class="filter-bar">
      <i class="ti ti-search text-secondary"></i>
      <input type="text" placeholder="Search name, code..." value="${f.search}" oninput="S.pcFilter.search=this.value; R();" style="flex:1;min-width:200px;" />
      <select onchange="S.pcFilter.type=this.value; R();"><option value="all" ${f.type === 'all' ? 'selected' : ''}>All nature</option><option value="earning" ${f.type === 'earning' ? 'selected' : ''}>Earning</option><option value="deduction" ${f.type === 'deduction' ? 'selected' : ''}>Deduction</option></select>
      <select onchange="S.pcFilter.status=this.value; R();"><option value="all" ${f.status === 'all' ? 'selected' : ''}>All statuses</option><option value="active" ${f.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${f.status === 'inactive' ? 'selected' : ''}>Inactive</option></select>
    </div>

    <div class="card" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="table">
          <thead><tr>
            <th>Component Name</th><th>Component Code</th><th>Nature</th><th>Category</th><th style="text-align:center;">Status</th><th>Last Updated</th><th>Actions</th>
          </tr></thead>
          <tbody>${list.map(c => `<tr>
            <td><b>${c.name}</b></td>
            <td><span class="item-code-tag">${c.code}</span></td>
            <td>${pcTypePill(c.type)}</td>
            <td>${c.category}</td>
            <td style="text-align:center;"><label class="toggle"><input type="checkbox" ${c.active ? 'checked' : ''} onchange="togglePCActive('${c.id}', this.checked)" /><span class="toggle-slider"></span></label></td>
            <td class="text-xs text-secondary">${c.lastUpdated}</td>
            <td><div class="actions-menu">
              <button class="btn btn-sm btn-icon-only" onclick="viewPC('${c.id}')" title="View"><i class="ti ti-eye"></i></button>
              <button class="btn btn-sm btn-icon-only" onclick="editPC('${c.id}')" title="Edit"><i class="ti ti-pencil"></i></button>
              <button class="btn btn-sm btn-icon-only" onclick="toast('Component duplicated')" title="Duplicate"><i class="ti ti-copy"></i></button>
              <button class="btn btn-sm btn-icon-only btn-danger" onclick="toast('${c.name} deleted')" title="Delete"><i class="ti ti-trash"></i></button>
            </div></td>
          </tr>`).join('')}${list.length ? '' : '<tr><td colspan="7" class="text-secondary text-center" style="padding:32px;">No components match your filters</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function rPCForm() {
  const d = S.pcFormData || {};
  const isEdit = S.pcForm === 'edit';
  const title = isEdit ? 'Edit Component' : 'Add Pay Item';
  const greytOpts = pcGreytOptions();

  return `<div class="page">
    <div class="page-header">
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="icon-btn" onclick="navPC()"><i class="ti ti-arrow-left"></i></button>
        <div><h1 class="page-title">${title}</h1><p class="page-sub">Reusable payroll earning or deduction definition</p></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><span class="card-title-icon"><i class="ti ti-file-description"></i></span>Basic Information</div></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Component Name *</label><input type="text" value="${d.name || ''}" placeholder="e.g., Joining Bonus" oninput="updatePCField('name', this.value)" /></div>
        <div class="field"><label class="field-label">Component Code</label><input type="text" value="${d.code || ''}" placeholder="Auto-generated" oninput="updatePCField('code', this.value)" /><div class="text-xs text-secondary mt-2">Auto-generated from name · editable</div></div>
      </div>
      <div class="field"><label class="field-label">Description</label><textarea rows="2" placeholder="Purpose and when this component is used" oninput="updatePCField('description', this.value)">${d.description || ''}</textarea></div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Category</label><select onchange="updatePCField('category', this.value)">${PC_CATEGORIES.map(cat => `<option value="${cat}" ${d.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">Nature</label><select onchange="updatePCField('type', this.value)"><option value="earning" ${d.type === 'earning' ? 'selected' : ''}>Earning</option><option value="deduction" ${d.type === 'deduction' ? 'selected' : ''}>Deduction</option></select></div>
      </div>
      <div class="field-grid-2">
        <div class="field"><label class="field-label">Default Value Type</label><select onchange="updatePCField('valueType', this.value)"><option value="fixed" ${d.valueType === 'fixed' ? 'selected' : ''}>Fixed Amount</option><option value="manual" ${d.valueType === 'manual' ? 'selected' : ''}>Manual Entry</option></select></div>
        ${d.valueType === 'fixed' ? `<div class="field"><label class="field-label">Default Amount</label><input type="text" value="${(d.defaultAmount || 0).toLocaleString('en-IN')}" oninput="updatePCField('defaultAmount', parseInt(this.value.replace(/[^0-9]/g,''))||0)" placeholder="₹" /></div>` : '<div></div>'}
      </div>
      <div class="field"><label class="field-label">greytHR Mapping</label><select onchange="updatePCField('greytHRCode', this.value)">${greytOpts.map(([k]) => `<option value="${k}" ${d.greytHRCode === k ? 'selected' : ''}>${pcGreytLabel(k)}</option>`).join('')}</select><div class="text-xs text-secondary mt-2">Mapped to greytHR salary item for sync during payroll processing</div></div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
      <button class="btn" onclick="navPC()">Cancel</button>
      <button class="btn btn-primary" onclick="savePC()"><i class="ti ti-check"></i> Save Component</button>
    </div>
  </div>`;
}

function rPCDetail() {
  const c = getPC(S.pcSel);
  if (!c) { S.pcSel = null; return rPayrollComponents(); }

  const usageRows = [
    ['Monthly Inputs', c.usage.monthlyInputs],
    ['Salary Revisions', c.usage.salaryRevisions],
    ['F&F Settlement', c.usage.ff]
  ];

  return `<div class="page">
    <div class="page-header">
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="icon-btn" onclick="navPC()"><i class="ti ti-arrow-left"></i></button>
        <div>
          <h1 class="page-title">${c.name}</h1>
          <p class="page-sub">${c.code} · ${c.category} · ${pcStatusPill(c.active)}</p>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="editPC('${c.id}')"><i class="ti ti-pencil"></i> Edit</button>
        <button class="btn btn-primary" onclick="toast('Component duplicated')"><i class="ti ti-copy"></i> Duplicate</button>
      </div>
    </div>

    <div class="field-grid-2 mb-3">
      <div class="card">
        <div class="card-header"><div class="card-title">Overview</div>${pcTypePill(c.type)}</div>
        <div class="info-grid">
          <div><div class="field-label">Component Name</div><div class="field-value">${c.name}</div></div>
          <div><div class="field-label">Code</div><div class="field-value"><span class="item-code-tag">${c.code}</span></div></div>
          <div><div class="field-label">Category</div><div class="field-value">${c.category}</div></div>
          <div><div class="field-label">Nature</div><div class="field-value">${c.type === 'earning' ? 'Earning' : 'Deduction'}</div></div>
          <div><div class="field-label">Value Type</div><div class="field-value">${c.valueType === 'fixed' ? 'Fixed Amount' + (c.defaultAmount ? ' · ' + fmt(c.defaultAmount) : '') : 'Manual Entry'}</div></div>
          <div><div class="field-label">Status</div><div class="field-value">${c.active ? 'Active' : 'Inactive'}</div></div>
          <div><div class="field-label">greytHR Mapping</div><div class="field-value text-sm">${pcGreytLabel(c.greytHRCode)}</div></div>
        </div>
        ${c.description ? `<p class="text-sm text-secondary mt-3">${c.description}</p>` : ''}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Usage</div></div>
        <table class="table" style="margin:0;">
          <tbody>${usageRows.map(([label, on]) => `<tr><td>${label}</td><td>${on ? '<span class="pill pill-green" style="padding:1px 8px;font-size:11px;">Yes</span>' : '<span class="pill pill-gray" style="padding:1px 8px;font-size:11px;">No</span>'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="alert-banner alert-blue"><i class="ti ti-info-circle"></i><div><b>Business rules</b>Components created here are reusable and not part of Salary Structure calculations. Bonus, reimbursements, incentives, overtime, arrears, and leave encashment use these definitions. Monthly values are entered during payroll processing and mapped to the corresponding greytHR salary item.</div></div>
  </div>`;
}
