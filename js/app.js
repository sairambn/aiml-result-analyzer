/**
 * AIML Result Analyzer — Anna University grade-based
 * Supports CSV, Excel, and Anna University COE PDF uploads
 */

const GRADE_POINTS = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6,
  'C+': 5, 'C': 4, 'U': 0, 'UA': 0, 'W': 0, 'I': 0,
  'S': 10, 'WH': 0, 'WH1': 0,
};

const FAIL_GRADES = new Set(['U', 'UA', 'W', 'I', 'WH', 'WH1']);

let students = [];
let subjects = [];
let charts = {};

function normalizeGrade(g) {
  if (g == null || g === '') return null;
  const s = String(g).trim().toUpperCase();
  if (s === 'A+' || s === 'B+' || s === 'C+') return s;
  if (GRADE_POINTS.hasOwnProperty(s)) return s;
  if (s === 'AP' || s === 'A +') return 'A+';
  if (s === 'BP' || s === 'B +') return 'B+';
  if (s === 'CP' || s === 'C +') return 'C+';
  return s;
}

function isFail(g) { return FAIL_GRADES.has(g); }
function gradePoint(g) { return GRADE_POINTS[g] ?? null; }
function normalizeHeader(h) { return String(h || '').trim().toLowerCase().replace(/[\s_\-]+/g, ''); }

function detectCol(headers, aliases) {
  for (const h of headers) {
    if (aliases.includes(normalizeHeader(h))) return h;
  }
  return null;
}

function parseRows(rawRows, headers) {
  if (!rawRows?.length) throw new Error('File is empty.');
  const colRoll = detectCol(headers, ['regno', 'regnumber', 'rollno', 'rollnumber', 'registrationno', 'id']);
  const colName = detectCol(headers, ['name', 'studentname', 'studname', 'fullname', 'student']);
  const colSem  = detectCol(headers, ['semester', 'sem', 'semesterno']);
  const known = new Set([colRoll, colName, colSem].filter(Boolean));
  const subjectCols = headers.filter(h => !known.has(h) && String(h).trim());
  const records = [];
  for (const row of rawRows) {
    const roll = colRoll ? String(row[colRoll] ?? '').trim() : '';
    const name = colName ? String(row[colName] ?? '').trim() : '';
    if (!roll && !name) continue;
    const grades = {};
    let pointsSum = 0, creditCount = 0;
    const arrears = [];
    for (const sc of subjectCols) {
      const raw = row[sc];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      const g = normalizeGrade(raw);
      if (!g) continue;
      grades[sc] = g;
      const pt = gradePoint(g);
      if (pt !== null) { pointsSum += pt; creditCount++; }
      if (isFail(g)) arrears.push(sc);
    }
    if (!Object.keys(grades).length) continue;
    const gpa = creditCount ? Math.round((pointsSum / creditCount) * 100) / 100 : 0;
    records.push({
      roll: roll || `S${records.length + 1}`,
      name: name || 'Unknown',
      semester: colSem ? String(row[colSem] ?? '').trim() : '',
      grades, gpa,
      arrearCount: arrears.length,
      arrears,
      result: arrears.length === 0 ? 'pass' : 'arrear',
    });
  }
  if (!records.length) throw new Error('No student records with grades found. Check column headers.');
  subjects = subjectCols.filter(sc => records.some(r => r.grades[sc]));
  return records;
}

function computeStats(list = students) {
  if (!list.length) return null;
  const n = list.length;
  const clearPass = list.filter(s => s.result === 'pass').length;
  const withArrears = n - clearPass;
  const avgGpa = list.reduce((a, s) => a + s.gpa, 0) / n;
  const gradeDist = {};
  list.forEach(s => {
    Object.values(s.grades).forEach(g => { gradeDist[g] = (gradeDist[g] || 0) + 1; });
  });
  const subjectStats = {};
  subjects.forEach(sub => {
    const vals = list.map(s => s.grades[sub]).filter(Boolean);
    if (!vals.length) return;
    const fail = vals.filter(isFail).length;
    const pass = vals.length - fail;
    const counts = {};
    vals.forEach(g => { counts[g] = (counts[g] || 0) + 1; });
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    subjectStats[sub] = {
      appeared: vals.length, pass, fail,
      passPct: Math.round((pass / vals.length) * 1000) / 10,
      mostCommon,
    };
  });
  const top = [...list].sort((a, b) => b.gpa - a.gpa || a.arrearCount - b.arrearCount).slice(0, 10);
  const arrearStudents = list.filter(s => s.arrearCount > 0).sort((a, b) => b.arrearCount - a.arrearCount);
  const totalArrearPapers = arrearStudents.reduce((a, s) => a + s.arrearCount, 0);
  let hardest = '—', worstPct = 101;
  Object.entries(subjectStats).forEach(([name, st]) => {
    if (st.passPct < worstPct) { worstPct = st.passPct; hardest = name; }
  });
  return {
    total: n, clearPass,
    clearPassPct: Math.round((clearPass / n) * 1000) / 10,
    withArrears,
    avgGpa: Math.round(avgGpa * 100) / 100,
    gradeDist, subjectStats, top, arrearStudents, totalArrearPapers, hardest,
  };
}

function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch (_) {} });
  charts = {};
}

function renderCharts(stats) {
  destroyCharts();
  const order = ['O', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'U', 'UA', 'S'];
  const labels = order.filter(g => stats.gradeDist[g]);
  Object.keys(stats.gradeDist).forEach(g => { if (!labels.includes(g)) labels.push(g); });
  const data = labels.map(g => stats.gradeDist[g] || 0);
  const colors = labels.map(g => {
    if (g === 'O' || g === 'S') return '#22c55e';
    if (g === 'A+' || g === 'A') return '#3b82f6';
    if (g === 'B+' || g === 'B') return '#a855f7';
    if (g === 'C+' || g === 'C') return '#f59e0b';
    return '#ef4444';
  });
  charts.grade = new Chart(document.getElementById('gradeChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', stepSize: 1 }, beginAtZero: true },
      },
    },
  });
  charts.passFail = new Chart(document.getElementById('passFailChart'), {
    type: 'doughnut',
    data: {
      labels: ['Clear Pass', 'Has Arrears'],
      datasets: [{ data: [stats.clearPass, stats.withArrears], backgroundColor: ['#22c55e', '#f59e0b'], borderWidth: 0, hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, usePointStyle: true } } },
      cutout: '62%',
    },
  });
  const subNames = Object.keys(stats.subjectStats);
  const passPcts = subNames.map(s => stats.subjectStats[s].passPct);
  charts.subject = new Chart(document.getElementById('subjectChart'), {
    type: 'bar',
    data: { labels: subNames, datasets: [{ label: 'Pass %', data: passPcts, backgroundColor: '#3b82f6', borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } },
        y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' }, beginAtZero: true, max: 100 },
      },
    },
  });
  const passCtx = document.getElementById('subjectPassChart');
  if (passCtx) {
    charts.subjectPass = new Chart(passCtx, {
      type: 'bar',
      data: { labels: subNames, datasets: [{ label: 'Pass %', data: passPcts, backgroundColor: '#22c55e', borderRadius: 6, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' }, beginAtZero: true, max: 100 },
          y: { grid: { display: false }, ticks: { color: '#94a3b8' } },
        },
      },
    });
  }
}

function updateKPIs(stats) {
  document.getElementById('kpiStudents').textContent = stats.total;
  document.getElementById('kpiPass').textContent = stats.clearPassPct + '%';
  document.getElementById('kpiGpa').textContent = stats.avgGpa.toFixed(2);
  document.getElementById('kpiArrears').textContent = stats.withArrears;
}

function renderTopTable(top) {
  const tbody = document.querySelector('#topTable tbody');
  tbody.innerHTML = top.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(s.roll)}</td>
      <td>${esc(s.name)}</td>
      <td>${s.gpa.toFixed(2)}</td>
      <td>${s.arrearCount}</td>
      <td><span class="badge badge-${s.result === 'pass' ? 'pass' : 'arrear'}">${s.result === 'pass' ? 'Clear' : 'Arrears'}</span></td>
    </tr>`).join('');
}

function renderStudentsTable(list) {
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = list.map(s => `
    <tr>
      <td>${esc(s.roll)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.semester || '—')}</td>
      <td>${s.gpa.toFixed(2)}</td>
      <td>${s.arrearCount}</td>
      <td><span class="badge badge-${s.result === 'pass' ? 'pass' : 'arrear'}">${s.result === 'pass' ? 'Clear' : 'Arrears'}</span></td>
      <td><button class="link-btn" data-roll="${esc(s.roll)}">View</button></td>
    </tr>`).join('');
  document.getElementById('studentsCount').textContent = `${list.length} student${list.length !== 1 ? 's' : ''}`;
  tbody.querySelectorAll('.link-btn').forEach(btn => {
    btn.addEventListener('click', () => openStudentModal(btn.dataset.roll));
  });
}

function renderSubjectsTable(stats) {
  const tbody = document.querySelector('#subjectsTable tbody');
  tbody.innerHTML = Object.entries(stats.subjectStats).map(([name, st]) => `
    <tr>
      <td>${esc(name)}</td>
      <td>${st.appeared}</td>
      <td>${st.pass}</td>
      <td>${st.fail}</td>
      <td>${st.passPct}%</td>
      <td><span class="grade-pill ${isFail(st.mostCommon) ? 'fail' : ''} ${st.mostCommon === 'O' ? 'o' : ''}">${st.mostCommon}</span></td>
    </tr>`).join('');
}

function renderArrears(stats) {
  document.getElementById('arrStudents').textContent = stats.withArrears;
  document.getElementById('arrPapers').textContent = stats.totalArrearPapers;
  document.getElementById('arrHardest').textContent = stats.hardest;
  const tbody = document.querySelector('#arrearsTable tbody');
  tbody.innerHTML = stats.arrearStudents.map(s => `
    <tr>
      <td>${esc(s.roll)}</td>
      <td>${esc(s.name)}</td>
      <td>${s.arrearCount}</td>
      <td>${s.arrears.map(a => `<span class="grade-pill fail">${esc(a)}</span>`).join(' ')}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No arrears — all clear!</td></tr>';
}

function applyStudentFilters() {
  const res = document.getElementById('filterResult').value;
  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  let list = students;
  if (res === 'pass') list = list.filter(s => s.result === 'pass');
  if (res === 'arrear') list = list.filter(s => s.result === 'arrear');
  if (q) list = list.filter(s => s.roll.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  renderStudentsTable(list);
}

function openStudentModal(roll) {
  const s = students.find(st => st.roll === roll);
  if (!s) return;
  document.getElementById('modalTitle').textContent = s.name;
  const gradesHtml = Object.entries(s.grades).map(([k, v]) =>
    `<div class="mark-row"><span>${esc(k)}</span><span class="grade-pill ${isFail(v) ? 'fail' : ''} ${v === 'O' ? 'o' : ''}">${v}</span></div>`
  ).join('');
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Reg No</label><span>${esc(s.roll)}</span></div>
      <div class="detail-item"><label>Semester</label><span>${esc(s.semester || '—')}</span></div>
      <div class="detail-item"><label>GPA</label><span>${s.gpa.toFixed(2)}</span></div>
      <div class="detail-item"><label>Result</label><span class="badge badge-${s.result === 'pass' ? 'pass' : 'arrear'}">${s.result === 'pass' ? 'Clear Pass' : s.arrearCount + ' Arrear(s)'}</span></div>
    </div>
    <div class="subject-marks"><h4>Subject Grades</h4>${gradesHtml}</div>
  `;
  document.getElementById('studentModal').classList.add('open');
}

function closeModal() { document.getElementById('studentModal').classList.remove('open'); }

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function onDataLoaded(records) {
  students = records;
  const stats = computeStats();
  ['dashEmpty','studentsEmpty','subjectsEmpty','arrearsEmpty'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  ['dashContent','studentsContent','subjectsContent','arrearsContent'].forEach(id => {
    document.getElementById(id).style.display = 'block';
  });
  document.getElementById('exportBtn').style.display = 'inline-flex';
  const status = document.getElementById('dataStatus');
  status.classList.add('loaded');
  status.querySelector('span:last-child').textContent = `${students.length} students loaded`;
  updateKPIs(stats);
  renderCharts(stats);
  renderTopTable(stats.top);
  renderStudentsTable(students);
  renderSubjectsTable(stats);
  renderArrears(stats);
  switchView('dashboard');
}

async function extractPdfText(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF library not loaded. Refresh the page and try again.');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({
      str: it.str,
      x: it.transform ? it.transform[4] : 0,
      y: it.transform ? it.transform[5] : 0,
    }));
    items.sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 3) return dy;
      return a.x - b.x;
    });
    let lineY = null;
    let line = [];
    const lines = [];
    for (const it of items) {
      if (lineY === null || Math.abs(it.y - lineY) < 3) {
        line.push(it.str);
        lineY = lineY === null ? it.y : lineY;
      } else {
        if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
        line = [it.str];
        lineY = it.y;
      }
    }
    if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
    pages.push({ page: i, text: lines.join('\n'), lines });
  }
  return pages;
}

function parseAnnaUniversityPdfPages(pages) {
  const gradeToken = /^(O|A\+|A|B\+|B|C\+|C|UA|U|S|W|I|WH1|WH)$/i;
  const regRe = /\b(3108\d{8})\b/;
  const semRe = /Semester\s*No\.?\s*:?\s*0*(\d+)/i;
  const subjectCodeRe = /\b([A-Z]{2,4}\d{2,4}[A-Z]?\d?)\b/g;

  let currentSem = '';
  let currentSubjects = [];
  const byStudent = new Map();

  function ensureStudent(reg, name, sem) {
    const key = reg + '|' + (sem || '');
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        roll: reg,
        name: (name || '').trim() || 'Unknown',
        semester: String(sem || ''),
        grades: {},
        gpa: 0,
        arrearCount: 0,
        arrears: [],
        result: 'pass',
      });
    } else if (name && byStudent.get(key).name === 'Unknown') {
      byStudent.get(key).name = name.trim();
    }
    return byStudent.get(key);
  }

  for (const pg of pages) {
    const full = pg.text;
    const semMatch = full.match(semRe);
    if (semMatch) currentSem = semMatch[1];

    const headerCandidates = pg.lines.filter(l =>
      (l.match(subjectCodeRe) || []).length >= 3 && !regRe.test(l)
    );
    if (headerCandidates.length) {
      const codes = [];
      let m;
      const re = /\b([A-Z]{2,4}\d{2,4}[A-Z]?\d?)\b/g;
      while ((m = re.exec(headerCandidates[0])) !== null) codes.push(m[1]);
      if (codes.length) currentSubjects = codes;
    }

    for (const line of pg.lines) {
      const regMatch = line.match(regRe);
      if (!regMatch) continue;
      const reg = regMatch[1];
      const after = line.slice(line.indexOf(reg) + reg.length).trim();
      const tokens = after.split(/\s+/).filter(Boolean);
      const nameParts = [];
      const gradesFound = [];
      for (const t of tokens) {
        const up = t.toUpperCase().replace(/[^A-Z0-9+]/g, '');
        if (gradeToken.test(up) || gradeToken.test(t)) {
          gradesFound.push(normalizeGrade(t));
        } else if (!/^\d+$/.test(t) && gradesFound.length === 0) {
          nameParts.push(t);
        }
      }
      if (!gradesFound.length) {
        const gMatches = after.match(/\b(O|A\+|A|B\+|B|C\+|C|UA|U|S|W|I)\b/gi);
        if (gMatches) gMatches.forEach(g => gradesFound.push(normalizeGrade(g)));
      }
      const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
      const stu = ensureStudent(reg, name, currentSem);
      if (currentSubjects.length && gradesFound.length) {
        if (gradesFound.length === currentSubjects.length) {
          currentSubjects.forEach((code, i) => {
            if (gradesFound[i]) stu.grades[code] = gradesFound[i];
          });
        } else {
          gradesFound.forEach((g, i) => {
            const code = currentSubjects[i] || ('SUBJ_' + (i + 1));
            stu.grades[code] = g;
          });
        }
      } else if (gradesFound.length) {
        gradesFound.forEach((g, i) => {
          stu.grades['SUBJ_' + (i + 1)] = g;
        });
      }
    }
  }

  const records = [];
  const subjSet = new Set();
  for (const stu of byStudent.values()) {
    let pointsSum = 0, creditCount = 0;
    const arrears = [];
    for (const [code, g] of Object.entries(stu.grades)) {
      subjSet.add(code);
      const pt = gradePoint(g);
      if (pt !== null) { pointsSum += pt; creditCount++; }
      if (isFail(g)) arrears.push(code);
    }
    if (!Object.keys(stu.grades).length) continue;
    stu.gpa = creditCount ? Math.round((pointsSum / creditCount) * 100) / 100 : 0;
    stu.arrearCount = arrears.length;
    stu.arrears = arrears;
    stu.result = arrears.length === 0 ? 'pass' : 'arrear';
    records.push(stu);
  }
  subjects = [...subjSet];
  if (!records.length) {
    throw new Error(
      'Could not extract student grades from this PDF. ' +
      'Use a text-based Anna University COE PDF, or upload CSV/Excel. ' +
      'You can also click “Load AIML Sem-4 Sample”.'
    );
  }
  return records;
}

async function handlePdfFile(arrayBuffer) {
  const pages = await extractPdfText(arrayBuffer);
  const joined = pages.map(p => p.text).join('\n');
  if (!/ANNA UNIVERSITY|3108\d{8}|Provisional Results/i.test(joined)) {
    throw new Error(
      'This does not look like an Anna University COE result PDF. ' +
      'Upload the provisional results PDF or use CSV/Excel.'
    );
  }
  return parseAnnaUniversityPdfPages(pages);
}

function handleFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let records;
      if (name.endsWith('.pdf')) {
        records = await handlePdfFile(e.target.result);
      } else if (name.endsWith('.csv')) {
        const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        records = parseRows(parsed.data, parsed.meta.fields || Object.keys(parsed.data[0] || {}));
      } else {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        records = parseRows(json, json.length ? Object.keys(json[0]) : []);
      }
      onDataLoaded(records);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  if (name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function loadSample() {
  fetch('data/aiml_sem4_sample.csv')
    .then(r => r.text())
    .then(text => {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const records = parseRows(parsed.data, parsed.meta.fields);
      onDataLoaded(records);
    })
    .catch(() => alert('Could not load sample file. Make sure data/aiml_sem4_sample.csv is present.'));
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (nav) nav.classList.add('active');
  const titles = {
    dashboard: ['Dashboard', 'B.E. CSE (AIML) · Semester results overview'],
    students:  ['Students', 'Browse GPA, arrears and individual grades'],
    subjects:  ['Subjects', 'Subject-wise pass rates and grade trends'],
    arrears:   ['Arrears', 'Students and papers with U / UA grades'],
    upload:    ['Upload Data', 'Import Anna University grade sheets (PDF / CSV / Excel)'],
  };
  const t = titles[viewId] || ['', ''];
  document.getElementById('pageTitle').textContent = t[0];
  document.getElementById('pageSubtitle').textContent = t[1];
}

function exportCSV() {
  if (!students.length) return;
  const headers = ['Reg No', 'Name', 'Semester', 'GPA', 'Arrear Count', 'Result', ...subjects];
  const rows = students.map(s => [
    s.roll, s.name, s.semester, s.gpa, s.arrearCount, s.result,
    ...subjects.map(sub => s.grades[sub] ?? ''),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aiml_result_analysis.csv';
  a.click();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.goto)));
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  document.getElementById('browseBtn').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  document.getElementById('loadSampleBtn').addEventListener('click', loadSample);
  document.getElementById('filterResult').addEventListener('change', applyStudentFilters);
  document.getElementById('studentSearch').addEventListener('input', applyStudentFilters);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('studentModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  switchView('upload');
});
