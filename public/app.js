/* ============================================================
   نظام تسجيل حضور الطلاب - الماسح الضوئي (Student Scanner)
   د. هشام هاشم - كلية العلوم جامعة طنطا - مقرر الحرارة
   ============================================================ */

// =============================================
// Global Configuration
// =============================================
const API_BASE = '/api';

// =============================================
// State Management
// =============================================
let currentScanData = null;

// =============================================
// IndexedDB for Device Locking
// =============================================
const DB_NAME = 'AttendanceTracker';
const DB_VERSION = 1;
const STORE_NAME = 'scanned_lectures';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'lecture_id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function hasScannedLecture(lectureId) {
  try {
    // Check localStorage first (fast)
    const lsKey = `att_${lectureId}`;
    if (localStorage.getItem(lsKey)) return true;

    // Check IndexedDB
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(lectureId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  } catch {
    // Fallback to localStorage only
    return !!localStorage.getItem(`att_${lectureId}`);
  }
}

async function markLectureScanned(lectureId) {
  try {
    // Save to localStorage
    localStorage.setItem(`att_${lectureId}`, Date.now().toString());

    // Save to IndexedDB
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ lecture_id: lectureId, scanned_at: new Date().toISOString() });
  } catch {
    // localStorage is sufficient as fallback
    localStorage.setItem(`att_${lectureId}`, Date.now().toString());
  }
}

// =============================================
// Device Fingerprint (Simple)
// =============================================
function getDeviceFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const canvasHash = canvas.toDataURL().slice(-50);

  const info = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvasHash
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < info.length; i++) {
    const char = info.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit
  }
  return Math.abs(hash).toString(36);
}

// =============================================
// URL Parameter Processor
// =============================================
window.onload = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const lecture_id = urlParams.get('id');
  const lecture_date = urlParams.get('d');
  const signature = urlParams.get('s');
  
  if (!lecture_id || !lecture_date || !signature) {
    // If no params, stay on the home screen showing the instruction message
    return;
  }

  try {
    // Check if today's date matches
    const today = new Date().toISOString().split('T')[0];
    if (lecture_date !== today) {
      document.querySelector('#step-scanner .alert').innerHTML = '<span class="alert-icon" style="font-size: 40px; display: block; margin-bottom: 15px;">❌</span><h3 style="margin-bottom: 10px;">كود المحاضرة منتهي الصلاحية</h3><p>التاريخ لا يتطابق مع اليوم. برجاء مسح الكود الجديد المعروض في القاعة.</p>';
      return;
    }

    // Check device lock
    const alreadyScanned = await hasScannedLecture(lecture_id);
    if (alreadyScanned) {
      showSection('step-already');
      return;
    }

    // Save scan data and show the form
    currentScanData = { lecture_id, lecture_date, signature };

    // Update lecture info banner
    document.getElementById('scanned-lecture-title').textContent = 'مقرر الحرارة';
    document.getElementById('scanned-lecture-date').textContent = `📅 ${formatDate(lecture_date)}`;

    // Auto-fill from previous data
    const savedName = localStorage.getItem('student_name');
    const savedNid = localStorage.getItem('student_nid');
    if (savedName) document.getElementById('input-name').value = savedName;
    if (savedNid) document.getElementById('input-national-id').value = savedNid;

    showSection('step-form');

  } catch (err) {
    console.error('URL Parse error:', err);
  }
};

// =============================================
// Submit Attendance (Optimized for 500+ concurrent users)
// =============================================
let isSubmitting = false; // قفل لمنع الضغط المتكرر

async function submitAttendance(event) {
  event.preventDefault();

  // منع الضغط المتكرر
  if (isSubmitting) return;

  const nameInput = document.getElementById('input-name');
  const nidInput = document.getElementById('input-national-id');
  const btnSubmit = document.getElementById('btn-submit');
  const formStatus = document.getElementById('form-status');

  const fullName = nameInput.value.trim();
  const nationalId = nidInput.value.trim().replace(/\s/g, '');

  // Validation - قبل ما نبعت للسيرفر
  if (!fullName || fullName.length < 5) {
    showStatus('form-status', 'error', '❌ أدخل الاسم بالكامل (5 حروف على الأقل)');
    nameInput.classList.add('error');
    nameInput.focus();
    return;
  }

  if (!/^\d{14}$/.test(nationalId)) {
    showStatus('form-status', 'error', '❌ الرقم القومي يجب أن يكون 14 رقم بالضبط');
    nidInput.classList.add('error');
    nidInput.focus();
    return;
  }

  if (!currentScanData) {
    showStatus('form-status', 'error', '❌ لم يتم مسح كود QR - أعد المسح');
    return;
  }

  // فحص التكرار مرة تانية قبل الإرسال
  const alreadyDone = await hasScannedLecture(currentScanData.lecture_id);
  if (alreadyDone) {
    showSection('step-already');
    return;
  }

  // Remove error styling
  nameInput.classList.remove('error');
  nidInput.classList.remove('error');

  // قفل الإرسال
  isSubmitting = true;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="spinner"></span> جاري التسجيل...';
  formStatus.innerHTML = '';

  // =============================================
  // Random Jitter: تأخير عشوائي 0-2 ثانية
  // عشان 500 طالب ما يضربوش السيرفر في نفس الملي ثانية
  // =============================================
  const jitterMs = Math.floor(Math.random() * 2000);
  await new Promise(resolve => setTimeout(resolve, jitterMs));

  // =============================================
  // Retry with Exponential Backoff
  // 3 محاولات مع تأخير متزايد
  // =============================================
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/scan-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: currentScanData.lecture_id,
          lecture_date: currentScanData.lecture_date,
          signature: currentScanData.signature,
          national_id: nationalId,
          full_name: fullName,
          device_fingerprint: getDeviceFingerprint()
        })
      });

      const result = await response.json();

      if (result.success) {
        // حفظ بيانات الطالب
        localStorage.setItem('student_name', fullName);
        localStorage.setItem('student_nid', nationalId);

        // تسجيل المحاضرة كمسجلة
        await markLectureScanned(currentScanData.lecture_id);

        // عرض النجاح
        document.getElementById('success-details').innerHTML = `
          <strong>${fullName}</strong><br>
          المحاضرة: ${result.data?.lecture_title || currentScanData.title}<br>
          التاريخ: ${formatDate(currentScanData.lecture_date)}<br>
          وقت التسجيل: ${formatTime(result.data?.scanned_at || new Date().toISOString())}
        `;

        showSection('step-success');
        showToast('success', 'تم تسجيل حضورك بنجاح ✅');
        isSubmitting = false;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '✅ تسجيل الحضور';
        return; // ✅ نجاح - خروج
      }

      // أخطاء لا تحتاج retry
      if (response.status === 409) {
        await markLectureScanned(currentScanData.lecture_id);
        showSection('step-already');
        isSubmitting = false;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '✅ تسجيل الحضور';
        return;
      }

      if (response.status === 403 || response.status === 404) {
        showStatus('form-status', 'error', `❌ ${result.error || 'حدث خطأ'}`);
        isSubmitting = false;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '✅ تسجيل الحضور';
        return;
      }

      // خطأ 500 - حاول مرة تانية
      lastError = result.error || 'خطأ في الخادم';

    } catch (err) {
      lastError = 'خطأ في الاتصال بالخادم';
      console.error(`Attempt ${attempt + 1} failed:`, err);
    }

    // تأخير قبل المحاولة التالية (exponential backoff)
    if (attempt < MAX_RETRIES - 1) {
      const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      btnSubmit.innerHTML = `<span class="spinner"></span> إعادة المحاولة (${attempt + 2}/${MAX_RETRIES})...`;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // فشل كل المحاولات
  showStatus('form-status', 'error', `❌ ${lastError}. حاول مرة أخرى بعد لحظات.`);
  isSubmitting = false;
  btnSubmit.disabled = false;
  btnSubmit.innerHTML = '✅ تسجيل الحضور';
}

// =============================================
// Navigation & UI Helpers
// =============================================
function showSection(sectionId) {
  const sections = ['step-scanner', 'step-form', 'step-success', 'step-already'];
  sections.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackToScanner() {
  currentScanData = null;
  document.getElementById('form-status').innerHTML = '';
  document.getElementById('scan-status').innerHTML = '';
  showSection('step-scanner');
}

function showStatus(elementId, type, message) {
  const el = document.getElementById(elementId);
  el.innerHTML = `
    <div class="alert alert-${type}">
      <span class="alert-icon">${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
      <span>${message}</span>
    </div>
  `;
}

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

// =============================================
// Date/Time Formatting (Arabic)
// =============================================
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

function formatTime(isoStr) {
  try {
    const date = new Date(isoStr);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

// =============================================
// Input Formatting
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const nidInput = document.getElementById('input-national-id');
  if (nidInput) {
    nidInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').substring(0, 14);
    });

    nidInput.addEventListener('focus', function () {
      this.classList.remove('error');
    });
  }

  const nameInput = document.getElementById('input-name');
  if (nameInput) {
    nameInput.addEventListener('focus', function () {
      this.classList.remove('error');
    });
  }
});
