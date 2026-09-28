const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// =============================================
// Local JSON Database Mock for Testing
// هذا الكود يستخدم ملف JSON كقاعدة بيانات محلية
// للتجربة بدون الحاجة لربط Supabase الحقيقي
// =============================================

const DB_PATH = path.join(__dirname, 'local-data.json');

// تهيئة قاعدة البيانات المحلية إذا لم تكن موجودة
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({
    lectures: [],
    students: [],
    attendance: []
  }, null, 2));
}

function loadDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

class SupabaseMock {
  from(tableName) {
    return new QueryBuilder(tableName);
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.db = loadDb();
    this.data = this.db[table] || [];
    this.isSingle = false;
    this.isCount = false;
    this._selectQuery = '*';
  }

  select(query = '*', opts = {}) {
    this._selectQuery = query;
    if (opts.count === 'exact') {
      this.isCount = true;
    }
    return this;
  }

  eq(col, val) {
    this.data = this.data.filter(item => item[col] === val);
    return this;
  }

  order(col, opts = { ascending: true }) {
    this.data = this.data.sort((a, b) => {
      if (a[col] < b[col]) return opts.ascending ? -1 : 1;
      if (a[col] > b[col]) return opts.ascending ? 1 : -1;
      return 0;
    });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(record) {
    this.type = 'insert';
    this.record = record;
    return this;
  }

  update(record) {
    this.type = 'update';
    this.record = record;
    return this;
  }

  upsert(record, opts) {
    this.type = 'upsert';
    this.record = record;
    this.onConflict = opts.onConflict;
    return this;
  }

  // محاكاة التنفيذ Asynchronous
  async then(resolve) {
    try {
      // 1. INSERT
      if (this.type === 'insert') {
        const id = this.record.id || crypto.randomUUID();
        const newRecord = { ...this.record, id };
        
        // محاكاة قيد منع التكرار في جدول الحضور UNIQUE(student_id, lecture_id)
        if (this.table === 'attendance') {
           const exists = this.data.find(a => a.student_id === newRecord.student_id && a.lecture_id === newRecord.lecture_id);
           if (exists) {
             const err = new Error('Duplicate entry');
             err.code = '23505'; // نفس كود خطأ Postgres للتكرار
             return resolve({ data: null, error: err });
           }
        }
        
        this.db[this.table].push(newRecord);
        saveDb(this.db);
        return resolve({ data: this.isSingle ? newRecord : [newRecord], error: null });
      }

      // 2. UPDATE
      if (this.type === 'update') {
        let updated = null;
        this.db[this.table] = this.db[this.table].map(item => {
          // تحديث العنصر لو موجود في ناتج التصفية الحالي (eq)
          if (this.data.find(d => d.id === item.id)) {
            updated = { ...item, ...this.record };
            return updated;
          }
          return item;
        });
        saveDb(this.db);
        return resolve({ data: this.isSingle ? updated : [updated], error: null });
      }

      // 3. UPSERT
      if (this.type === 'upsert') {
        const conflictVal = this.record[this.onConflict];
        const existingIdx = this.db[this.table].findIndex(item => item[this.onConflict] === conflictVal);
        let resultRecord;
        
        if (existingIdx >= 0) {
           resultRecord = { ...this.db[this.table][existingIdx], ...this.record };
           this.db[this.table][existingIdx] = resultRecord;
        } else {
           resultRecord = { id: crypto.randomUUID(), ...this.record };
           this.db[this.table].push(resultRecord);
        }
        saveDb(this.db);
        return resolve({ data: this.isSingle ? resultRecord : [resultRecord], error: null });
      }

      // 4. SELECT COUNT
      if (this.isCount) {
        return resolve({ count: this.data.length, error: null, data: [] });
      }

      // 5. SELECT RELATION (JOIN) محاكاة
      // المستخدمة في الإحصائيات: select('student_id, students(full_name, national_id)')
      if (this._selectQuery.includes('students(') && this.table === 'attendance') {
         const students = this.db['students'] || [];
         this.data = this.data.map(att => {
           const student = students.find(s => s.id === att.student_id);
           return { ...att, students: student || null };
         });
      }

      // 6. SELECT SINGLE
      if (this.isSingle) {
        return resolve({ 
          data: this.data[0] || null, 
          error: this.data.length > 0 ? null : new Error('No rows found') 
        });
      }

      // 7. SELECT ALL
      return resolve({ data: this.data, error: null });

    } catch(err) {
      console.error('Mock DB Error:', err);
      return resolve({ data: null, error: err });
    }
  }
}

// دالة التصدير الرئيسية بدلاً من اتصال Supabase
function getSupabase() {
  return new SupabaseMock();
}

// =============================================
// CORS Helper
// =============================================
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

// =============================================
// JSON Response Helpers
// =============================================
function success(res, data, status = 200) {
  cors(res);
  return res.status(status).json({ success: true, ...data });
}

function error(res, message, status = 400) {
  cors(res);
  return res.status(status).json({ success: false, error: message });
}

// =============================================
// QR Token Verification
// =============================================
function generateQrToken(lectureId, lectureDate) {
  const secret = process.env.QR_SECRET || 'dr-hisham-tanta-physics-2024-secret';
  const payload = `${lectureId}:${lectureDate}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return hmac.substring(0, 16);
}

function verifyQrSignature(lectureId, lectureDate, signature) {
  const expected = generateQrToken(lectureId, lectureDate);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

module.exports = { getSupabase, cors, success, error, generateQrToken, verifyQrSignature };
