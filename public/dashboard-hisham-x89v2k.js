/* ============================================================
   لوحة تحكم الدكتور - Admin Dashboard
   د. هشام هاشم - كلية العلوم جامعة طنطا - مقرر الحرارة
   ============================================================ */

// =============================================
// Configuration
// =============================================
const API_BASE = '/api';

// =============================================
// State
// =============================================
let authToken = null;
let lecturesCache = [];
let statsCache = null;
let currentQrPayload = null;

// =============================================
// Authentication
// =============================================
function checkAuth() {
  authToken = sessionStorage.getItem('admin_token');
  if (authToken) {
    showDashboard();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> جاري الدخول...';

  try {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      sessionStorage.setItem('admin_token', authToken);
      showDashboard();
      showToast('success', 'مرحباً د. هشام! تم تسجيل الدخول بنجاح');
    } else {
      document.getElementById('login-error').innerHTML = `
        <div class="alert alert-error">
          <span class="alert-icon">⚠️</span>
          <span>${data.error || 'كلمة المرور غير صحيحة'}</span>
        </div>
      `;
    }
  } catch (err) {
    document.getElementById('login-error').innerHTML = `
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span>خطأ في الاتصال بالخادم</span>
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔓 دخول';
  }
}

function handleLogout() {
  authToken = null;
  sessionStorage.removeItem('admin_token');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');
  document.getElementById('login-password').value = '';
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('lec-date').value = today;

  // Load data
  loadLectures();
  loadStats();
}

// =============================================
// Tab Navigation
// =============================================
function switchTab(tabId) {
  // Deactivate all tabs
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // Activate selected
  document.getElementById(tabId).classList.add('active');

  // Activate corresponding button
  const tabIndex = ['tab-lectures', 'tab-audit', 'tab-analytics', 'tab-export'].indexOf(tabId);
  document.querySelectorAll('.tab-btn')[tabIndex]?.classList.add('active');

  // Load tab-specific data
  if (tabId === 'tab-analytics') loadStats();
  if (tabId === 'tab-audit') populateAuditSelect();
  if (tabId === 'tab-export') populateExportSelect();
}

// =============================================
// Lectures Management
// =============================================
async function loadLectures() {
  try {
    const res = await fetch(`${API_BASE}/lectures`);
    const data = await res.json();

    if (data.success) {
      lecturesCache = data.lectures || [];
      renderLectures();
      populateAuditSelect();
      populateExportSelect();
    }
  } catch (err) {
    console.error('Load lectures error:', err);
  }
}

function renderLectures() {
  const container = document.getElementById('lectures-list');
  
  if (lecturesCache.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p>لا توجد محاضرات حتى الآن</p>
        <button class="btn btn-primary mt-20" onclick="showCreateLectureModal()">➕ إنشاء أول محاضرة</button>
      </div>
    `;
    return;
  }

  container.innerHTML = lecturesCache.map(lec => `
    <div class="lecture-item">
      <div class="lecture-info">
        <div class="lecture-title">${escapeHtml(lec.title)}</div>
        <div class="lecture-meta">
          <span>📅 ${formatDate(lec.lecture_date)}</span>
          <span>👥 ${lec.attendance_count || 0} حضور</span>
          <span>${lec.is_active 
            ? '<span class="badge badge-success">🟢 مفعّلة</span>' 
            : '<span class="badge badge-danger">🔴 مغلقة</span>'
          }</span>
        </div>
      </div>
      <div class="lecture-actions">
        <button class="btn btn-sm btn-primary" onclick='showQR(${JSON.stringify(JSON.stringify({
          lecture_id: lec.id,
          lecture_date: lec.lecture_date,
          signature: lec.qr_token,
          title: lec.title
        }))}, "${escapeHtml(lec.title)}", "${lec.lecture_date}")' title="عرض QR">
          📱 QR
        </button>
        <button class="btn btn-sm ${lec.is_active ? 'btn-danger' : 'btn-success'}" 
                onclick="toggleLecture('${lec.id}', ${!lec.is_active})"
                title="${lec.is_active ? 'إغلاق' : 'تفعيل'}">
          ${lec.is_active ? '🔒 إغلاق' : '🔓 تفعيل'}
        </button>
      </div>
    </div>
  `).join('');
}

function showCreateLectureModal() {
  document.getElementById('modal-create-lecture').classList.remove('hidden');
  document.getElementById('create-lecture-error').innerHTML = '';
}

async function createLecture(event) {
  if (event) event.preventDefault();

  const title = document.getElementById('lec-title').value.trim() || 'مقرر الحرارة';
  const date = document.getElementById('lec-date').value;
  const startTime = document.getElementById('lec-start').value || null;
  const endTime = document.getElementById('lec-end').value || null;

  if (!date) {
    document.getElementById('create-lecture-error').innerHTML = `
      <div class="alert alert-error"><span class="alert-icon">⚠️</span><span>تاريخ المحاضرة مطلوب</span></div>
    `;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lectures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        lecture_date: date,
        time_window_start: startTime,
        time_window_end: endTime
      })
    });

    const data = await res.json();

    if (data.success) {
      closeModal('modal-create-lecture');
      showToast('success', 'تم إنشاء المحاضرة بنجاح!');
      loadLectures();

      // Show QR immediately
      setTimeout(() => {
        showQR(data.qr_data, title, date);
      }, 500);
    } else {
      document.getElementById('create-lecture-error').innerHTML = `
        <div class="alert alert-error"><span class="alert-icon">⚠️</span><span>${data.error}</span></div>
      `;
    }
  } catch (err) {
    document.getElementById('create-lecture-error').innerHTML = `
      <div class="alert alert-error"><span class="alert-icon">⚠️</span><span>خطأ في الاتصال</span></div>
    `;
  }
}

async function toggleLecture(lectureId, isActive) {
  try {
    const res = await fetch(`${API_BASE}/toggle-lecture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lecture_id: lectureId, is_active: isActive })
    });

    const data = await res.json();
    if (data.success) {
      showToast('success', isActive ? 'تم تفعيل المحاضرة' : 'تم إغلاق المحاضرة');
      loadLectures();
    }
  } catch (err) {
    showToast('error', 'خطأ في تغيير حالة المحاضرة');
  }
}

// =============================================
// QR Code Display
// =============================================
function showQR(qrData, title, date) {
  // بناء رابط يحتوي على بيانات المحاضرة في الـ URL Parameters
  const baseUrl = window.location.origin;
  
  // إذا كانت qrData عبارة عن JSON القديم (للتوافقية مع المحاضرات القديمة)
  let qrInfo = qrData;
  if (typeof qrData === 'string') {
    try { qrInfo = JSON.parse(qrData); } catch(e) {}
  }
  
  const lectureId = qrInfo.id || qrInfo.lecture_id;
  const lectureDate = qrInfo.date || qrInfo.lecture_date;
  const signature = qrInfo.sig || qrInfo.signature;
  const lectureTitle = title || qrInfo.title;

  const urlParams = new URLSearchParams({
    id: lectureId,
    d: lectureDate,
    s: signature
  });
  
  currentQrPayload = `${baseUrl}/?${urlParams.toString()}`;
  
  document.getElementById('qr-lecture-title').textContent = lectureTitle;
  document.getElementById('qr-lecture-date').textContent = `📅 ${formatDate(date)}`;
  document.getElementById('modal-qr').classList.remove('hidden');

  // Generate QR using local qrcode.js
  const qrContainer = document.getElementById('qr-canvas');
  qrContainer.innerHTML = ''; // مسح أي QR قديم
  
  new QRCode(qrContainer, {
    text: currentQrPayload,
    width: 350,
    height: 350,
    colorDark: "#0a1628",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function downloadQR() {
  const container = document.getElementById('qr-canvas');
  const img = container.querySelector('img') || container.querySelector('canvas');
  if (!img) return;
  
  const link = document.createElement('a');
  link.download = `qr-lecture-${new Date().toISOString().split('T')[0]}.png`;
  link.href = img.src || img.toDataURL('image/png');
  link.click();
}

function fullscreenQR() {
  const container = document.getElementById('qr-canvas');
  const element = container.querySelector('img') || container.querySelector('canvas') || container;
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  }
}

// =============================================
// Absence Audit (جرد الغياب)
// =============================================
function populateAuditSelect() {
  const select = document.getElementById('audit-lecture-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- اختر محاضرة --</option>';
  lecturesCache.forEach(lec => {
    select.innerHTML += `<option value="${lec.id}">${escapeHtml(lec.title)} - ${formatDate(lec.lecture_date)}</option>`;
  });
  if (currentVal) select.value = currentVal;
}

async function runAudit() {
  const lectureId = document.getElementById('audit-lecture-select').value;
  const container = document.getElementById('audit-results');

  if (!lectureId) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<div class="text-center mt-20"><span class="spinner"></span> جاري تحميل البيانات...</div>';

  try {
    const res = await fetch(`${API_BASE}/audit-absence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lecture_id: lectureId })
    });

    const data = await res.json();

    if (data.success) {
      // Summary cards
      let html = `
        <div class="stats-grid mb-20">
          <div class="stat-card">
            <div class="stat-icon blue">👥</div>
            <div class="stat-content">
              <div class="stat-value">${data.total_students}</div>
              <div class="stat-label">إجمالي الطلاب</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">✅</div>
            <div class="stat-content">
              <div class="stat-value">${data.present_count}</div>
              <div class="stat-label">حاضرون</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">❌</div>
            <div class="stat-content">
              <div class="stat-value">${data.absent_count}</div>
              <div class="stat-label">غائبون</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon gold">📊</div>
            <div class="stat-content">
              <div class="stat-value">${data.attendance_rate}%</div>
              <div class="stat-label">نسبة الحضور</div>
              <div class="progress-bar">
                <div class="progress-fill ${getProgressClass(data.attendance_rate)}" style="width: ${data.attendance_rate}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Present students table
      if (data.present_students.length > 0) {
        html += `
          <div class="card mb-20">
            <div class="card-header">
              <h3><span class="icon">✅</span> الطلاب الحاضرون (${data.present_count})</h3>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>م</th>
                    <th>الاسم</th>
                    <th>الرقم القومي</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.present_students.map((s, i) => `
                    <tr>
                      <td class="row-num">${i + 1}</td>
                      <td>${escapeHtml(s.full_name)}</td>
                      <td style="font-family: var(--font-mono); direction: ltr; text-align: left;">${s.national_id}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      // Absent students table
      if (data.absent_students.length > 0) {
        html += `
          <div class="card">
            <div class="card-header">
              <h3><span class="icon">❌</span> الطلاب الغائبون (${data.absent_count})</h3>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>م</th>
                    <th>الاسم</th>
                    <th>الرقم القومي</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.absent_students.map((s, i) => `
                    <tr>
                      <td class="row-num">${i + 1}</td>
                      <td>${escapeHtml(s.full_name)}</td>
                      <td style="font-family: var(--font-mono); direction: ltr; text-align: left;">${s.national_id}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (data.present_students.length > 0) {
        html += `
          <div class="alert alert-success">
            <span class="alert-icon">🎉</span>
            <span>جميع الطلاب المسجلين حضروا هذه المحاضرة!</span>
          </div>
        `;
      }

      container.innerHTML = html;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span>خطأ في تحميل بيانات الحضور</span>
      </div>
    `;
  }
}

// =============================================
// Statistics & Analytics
// =============================================
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();

    if (data.success) {
      statsCache = data;

      // Update overview cards
      document.getElementById('stat-students').textContent = data.overview.total_students;
      document.getElementById('stat-lectures').textContent = data.overview.total_lectures;
      document.getElementById('stat-attendance').textContent = data.overview.total_attendance_records;
      document.getElementById('stat-rate').textContent = data.overview.overall_rate + '%';

      // Render chart
      renderLectureChart(data.lecture_stats);

      // Render top attending
      renderStudentList('top-attending', data.top_attending, 'attended', true);

      // Render most absent
      renderStudentList('most-absent', data.most_absent, 'missed', false);
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

function renderLectureChart(lectureStats) {
  const container = document.getElementById('lecture-chart');
  
  if (!lectureStats || lectureStats.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>لا توجد بيانات كافية للرسم البياني</p></div>';
    return;
  }

  const maxCount = Math.max(...lectureStats.map(l => l.attendance_count), 1);
  
  // Show last 12 lectures max
  const displayStats = lectureStats.slice(0, 12).reverse();

  container.innerHTML = displayStats.map(lec => {
    const heightPercent = (lec.attendance_count / maxCount) * 100;
    const hue = (parseFloat(lec.attendance_rate) / 100) * 120; // 0=red, 120=green
    return `
      <div class="chart-bar" 
           style="height: ${Math.max(heightPercent, 5)}%; background: linear-gradient(to top, hsl(${hue}, 60%, 35%), hsl(${hue}, 70%, 50%));"
           title="${lec.title} - ${formatDate(lec.lecture_date)}: ${lec.attendance_count} حضور (${lec.attendance_rate}%)">
        <span class="bar-value">${lec.attendance_count}</span>
        <span class="bar-label">${lec.lecture_date.slice(5)}</span>
      </div>
    `;
  }).join('');
}

function renderStudentList(containerId, students, countKey, isPositive) {
  const container = document.getElementById(containerId);
  
  if (!students || students.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>لا توجد بيانات</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>م</th>
            <th>الاسم</th>
            <th>${isPositive ? 'حضور' : 'غياب'}</th>
            <th>النسبة</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s, i) => `
            <tr>
              <td class="row-num">${i + 1}</td>
              <td>${escapeHtml(s.full_name)}</td>
              <td>
                <span class="badge ${isPositive ? 'badge-success' : 'badge-danger'}">
                  ${s[countKey] || s.count || 0}
                </span>
              </td>
              <td>
                ${s.attendance_rate ? `
                  <span class="badge ${parseFloat(s.attendance_rate) >= 50 ? 'badge-success' : 'badge-danger'}">
                    ${s.attendance_rate}%
                  </span>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// =============================================
// Export Functions
// =============================================
function populateExportSelect() {
  const select = document.getElementById('export-lecture-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- اختر محاضرة --</option>';
  lecturesCache.forEach(lec => {
    select.innerHTML += `<option value="${lec.id}" data-title="${escapeHtml(lec.title)}" data-date="${lec.lecture_date}">${escapeHtml(lec.title)} - ${formatDate(lec.lecture_date)}</option>`;
  });
  if (currentVal) select.value = currentVal;
}

async function getExportData(lectureId) {
  const res = await fetch(`${API_BASE}/export?lecture_id=${lectureId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

async function exportToExcel() {
  const lectureId = document.getElementById('export-lecture-select').value;
  if (!lectureId) {
    showToast('error', 'اختر محاضرة أولاً');
    return;
  }

  try {
    const data = await getExportData(lectureId);
    
    const wsData = [
      ['نظام حضور وغياب الطلاب - د. هشام هاشم'],
      ['كلية العلوم - جامعة طنطا - قسم الفيزياء - مقرر الحرارة'],
      [],
      [`المحاضرة: ${data.lecture.title || ''}`],
      [`التاريخ: ${formatDate(data.lecture.lecture_date)}`],
      [`إجمالي الحضور: ${data.total}`],
      [],
      ['م', 'الاسم بالكامل', 'الرقم القومي', 'وقت التسجيل']
    ];

    data.records.forEach(r => {
      wsData.push([
        r.row_number,
        r.full_name,
        r.national_id,
        r.scanned_at ? new Date(r.scanned_at).toLocaleString('ar-EG') : ''
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Column widths
    ws['!cols'] = [
      { wch: 5 },
      { wch: 35 },
      { wch: 18 },
      { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
    XLSX.writeFile(wb, `حضور_${data.lecture.lecture_date || 'report'}.xlsx`);
    
    showToast('success', 'تم تصدير الملف بنجاح');
  } catch (err) {
    showToast('error', 'خطأ في تصدير البيانات');
    console.error(err);
  }
}

async function exportToPDF() {
  const lectureId = document.getElementById('export-lecture-select').value;
  if (!lectureId) {
    showToast('error', 'اختر محاضرة أولاً');
    return;
  }

  try {
    const data = await getExportData(lectureId);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Dr. Hisham Hashem - Faculty of Science - Tanta University', 105, 28, { align: 'center' });
    doc.text('Physics Department - Thermodynamics Course', 105, 34, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Lecture: ${data.lecture.title || 'Thermodynamics'}`, 20, 45);
    doc.text(`Date: ${data.lecture.lecture_date}`, 20, 51);
    doc.text(`Total Attendance: ${data.total}`, 20, 57);

    // Line separator
    doc.setDrawColor(43, 108, 176);
    doc.setLineWidth(0.5);
    doc.line(20, 62, 190, 62);

    // Table
    const tableData = data.records.map(r => [
      r.row_number,
      r.full_name,
      r.national_id,
      r.scanned_at ? new Date(r.scanned_at).toLocaleString('en-US') : ''
    ]);

    doc.autoTable({
      startY: 67,
      head: [['#', 'Full Name', 'National ID', 'Scan Time']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        halign: 'center'
      },
      headStyles: {
        fillColor: [10, 22, 40],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 245, 250]
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 60, halign: 'left' },
        2: { cellWidth: 40 },
        3: { cellWidth: 45 }
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`attendance_${data.lecture.lecture_date || 'report'}.pdf`);
    showToast('success', 'تم تصدير PDF بنجاح');
  } catch (err) {
    showToast('error', 'خطأ في تصدير PDF');
    console.error(err);
  }
}

async function exportFullReportExcel() {
  try {
    showToast('success', 'جاري تحضير الكشف الشامل...');
    
    const statsRes = await fetch(`${API_BASE}/stats`);
    const statsData = await statsRes.json();
    
    if (!statsData.success) throw new Error('Failed to load stats');
    
    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview
    const overviewData = [
      ['نظام حضور وغياب الطلاب - د. هشام هاشم'],
      ['كلية العلوم - جامعة طنطا - قسم الفيزياء - مقرر الحرارة'],
      [],
      ['ملخص عام'],
      ['إجمالي الطلاب', statsData.overview.total_students],
      ['إجمالي المحاضرات', statsData.overview.total_lectures],
      ['سجلات الحضور', statsData.overview.total_attendance_records],
      ['نسبة الحضور العامة', statsData.overview.overall_rate + '%'],
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    wsOverview['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsOverview, 'ملخص');

    // Sheet 2: Lecture stats
    const lecData = [
      ['م', 'المحاضرة', 'التاريخ', 'عدد الحضور', 'نسبة الحضور']
    ];
    statsData.lecture_stats.forEach((l, i) => {
      lecData.push([i + 1, l.title, l.lecture_date, l.attendance_count, l.attendance_rate + '%']);
    });
    const wsLectures = XLSX.utils.aoa_to_sheet(lecData);
    wsLectures['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsLectures, 'المحاضرات');

    // Sheet 3: Top Attending
    if (statsData.top_attending?.length > 0) {
      const topData = [['م', 'الاسم', 'الرقم القومي', 'عدد الحضور']];
      statsData.top_attending.forEach((s, i) => {
        topData.push([i + 1, s.full_name, s.national_id, s.count]);
      });
      const wsTop = XLSX.utils.aoa_to_sheet(topData);
      wsTop['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsTop, 'الأكثر حضوراً');
    }

    // Sheet 4: Most Absent
    if (statsData.most_absent?.length > 0) {
      const absentData = [['م', 'الاسم', 'الرقم القومي', 'حضور', 'غياب', 'النسبة']];
      statsData.most_absent.forEach((s, i) => {
        absentData.push([i + 1, s.full_name, s.national_id, s.attended, s.missed, s.attendance_rate + '%']);
      });
      const wsAbsent = XLSX.utils.aoa_to_sheet(absentData);
      wsAbsent['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsAbsent, 'الأكثر غياباً');
    }

    XLSX.writeFile(wb, `كشف_شامل_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('success', 'تم تصدير الكشف الشامل بنجاح');
  } catch (err) {
    showToast('error', 'خطأ في تصدير الكشف الشامل');
    console.error(err);
  }
}

async function exportFullReportPDF() {
  try {
    showToast('success', 'جاري تحضير التقرير الشامل...');
    
    const statsRes = await fetch(`${API_BASE}/stats`);
    const statsData = await statsRes.json();
    
    if (!statsData.success) throw new Error('Failed');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Comprehensive Attendance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Dr. Hisham Hashem - Faculty of Science - Tanta University', 105, 28, { align: 'center' });
    doc.text('Physics Department - Thermodynamics Course', 105, 34, { align: 'center' });
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-US')}`, 105, 40, { align: 'center' });

    doc.setDrawColor(43, 108, 176);
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    // Overview
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, 55);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Students: ${statsData.overview.total_students}`, 20, 63);
    doc.text(`Total Lectures: ${statsData.overview.total_lectures}`, 20, 69);
    doc.text(`Total Attendance Records: ${statsData.overview.total_attendance_records}`, 20, 75);
    doc.text(`Overall Attendance Rate: ${statsData.overview.overall_rate}%`, 20, 81);

    // Lecture stats table
    if (statsData.lecture_stats?.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Lecture Statistics', 20, 93);

      const lecTableData = statsData.lecture_stats.map((l, i) => [
        i + 1, l.title, l.lecture_date, l.attendance_count, l.attendance_rate + '%'
      ]);

      doc.autoTable({
        startY: 97,
        head: [['#', 'Lecture', 'Date', 'Attendance', 'Rate']],
        body: lecTableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [10, 22, 40] }
      });
    }

    // Top attending
    if (statsData.top_attending?.length > 0) {
      const topY = doc.lastAutoTable?.finalY + 15 || 150;
      
      if (topY > 250) doc.addPage();
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Attending Students', 20, topY > 250 ? 20 : topY);

      doc.autoTable({
        startY: (topY > 250 ? 25 : topY + 5),
        head: [['#', 'Name', 'National ID', 'Count']],
        body: statsData.top_attending.map((s, i) => [i + 1, s.full_name, s.national_id, s.count]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 167, 69] }
      });
    }

    // Most absent
    if (statsData.most_absent?.length > 0) {
      const absentY = doc.lastAutoTable?.finalY + 15 || 200;
      
      if (absentY > 250) doc.addPage();
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Most Absent Students', 20, absentY > 250 ? 20 : absentY);

      doc.autoTable({
        startY: (absentY > 250 ? 25 : absentY + 5),
        head: [['#', 'Name', 'National ID', 'Attended', 'Missed', 'Rate']],
        body: statsData.most_absent.map((s, i) => [
          i + 1, s.full_name, s.national_id, s.attended, s.missed, s.attendance_rate + '%'
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [220, 53, 69] }
      });
    }

    // Page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`comprehensive_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('success', 'تم تصدير التقرير الشامل بنجاح');
  } catch (err) {
    showToast('error', 'خطأ في تصدير التقرير');
    console.error(err);
  }
}

// =============================================
// Modal Helpers
// =============================================
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.add('hidden');
  }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }
});

// =============================================
// Utility Functions
// =============================================
function showToast(type, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getProgressClass(rate) {
  const r = parseFloat(rate);
  if (r >= 70) return 'high';
  if (r >= 40) return 'medium';
  return 'low';
}

// =============================================
// Initialize
// =============================================
document.addEventListener('DOMContentLoaded', checkAuth);
