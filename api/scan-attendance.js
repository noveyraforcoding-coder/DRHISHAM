const { getSupabase, cors, success, error, verifyQrSignature } = require('./_lib/db');

// =============================================
// 🚀 High-Performance Attendance Scan Endpoint
// مُحسّن لتحمل 500+ طلب متزامن
// =============================================
// استراتيجية التحسين:
// 1. التحقق من البيانات أولاً (بدون DB) = رد فوري للطلبات الخاطئة
// 2. عملية واحدة Upsert بدل Select ثم Insert = نصف عدد الـ queries
// 3. حماية Race Condition بالـ ON CONFLICT
// 4. الـ Client-side device lock يمنع 90% من التكرارات
// =============================================

module.exports = async function handler(req, res) {
  // Handle CORS preflight - رد فوري بدون DB
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    const { lecture_id, lecture_date, signature, national_id, full_name, device_fingerprint } = req.body;

    // =============================================
    // Phase 1: Client-Side Validation (ZERO DB CALLS)
    // هذه التحققات ترد فوراً بدون ما تلمس قاعدة البيانات
    // =============================================
    if (!lecture_id || !lecture_date || !signature || !national_id || !full_name) {
      return error(res, 'جميع البيانات مطلوبة');
    }

    // التحقق من التاريخ - بدون DB
    const today = new Date().toISOString().split('T')[0];
    if (lecture_date !== today) {
      return error(res, 'كود المحاضرة منتهي الصلاحية أو غير صالح - التاريخ لا يتطابق مع اليوم', 403);
    }

    // التحقق من التوقيع - بدون DB
    if (!verifyQrSignature(lecture_id, lecture_date, signature)) {
      return error(res, 'كود QR غير صالح - التوقيع الرقمي غير متطابق', 403);
    }

    // التحقق من الرقم القومي - بدون DB
    const cleanNationalId = national_id.trim().replace(/\s/g, '');
    if (!/^\d{14}$/.test(cleanNationalId)) {
      return error(res, 'الرقم القومي يجب أن يتكون من 14 رقم بالضبط');
    }

    const cleanName = full_name.trim();
    if (cleanName.length < 5) {
      return error(res, 'الاسم يجب أن يكون 5 حروف على الأقل');
    }

    // =============================================
    // Phase 2: Database Operations (Optimized - Minimal Queries)
    // =============================================
    const db = getSupabase();

    // =============================================
    // Query 1: التحقق من المحاضرة (فحص واحد سريع)
    // =============================================
    const { data: lecture, error: lectureErr } = await db
      .from('lectures')
      .select('id, is_active, title, lecture_date')
      .eq('id', lecture_id)
      .single();

    if (lectureErr || !lecture) {
      return error(res, 'المحاضرة غير موجودة', 404);
    }

    if (!lecture.is_active) {
      return error(res, 'تم إغلاق تسجيل الحضور لهذه المحاضرة');
    }

    // =============================================
    // Query 2: Upsert الطالب (عملية ذرية واحدة بدل 2)
    // INSERT ... ON CONFLICT = لا race condition
    // =============================================
    const { data: student, error: studentErr } = await db
      .from('students')
      .upsert(
        { national_id: cleanNationalId, full_name: cleanName },
        { onConflict: 'national_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (studentErr || !student) {
      console.error('Student upsert error:', studentErr);
      // Fallback: محاولة البحث في حالة الفشل
      const { data: fallbackStudent } = await db
        .from('students')
        .select('id')
        .eq('national_id', cleanNationalId)
        .single();

      if (!fallbackStudent) {
        return error(res, 'خطأ في تسجيل بيانات الطالب', 500);
      }
      var studentId = fallbackStudent.id;
    } else {
      var studentId = student.id;
    }

    // =============================================
    // Query 3: تسجيل الحضور (مع حماية التكرار)
    // UNIQUE(student_id, lecture_id) يمنع التكرار تلقائياً
    // =============================================
    const { data: attendanceRecord, error: attendErr } = await db
      .from('attendance')
      .insert({
        student_id: studentId,
        lecture_id: lecture_id,
        device_fingerprint: device_fingerprint || null,
        scanned_at: new Date().toISOString()
      })
      .select('id, scanned_at')
      .single();

    if (attendErr) {
      if (attendErr.code === '23505') {
        return error(res, 'تم تسجيل حضورك مسبقاً لهذه المحاضرة', 409);
      }
      console.error('Attendance insert error:', attendErr);
      return error(res, 'خطأ في تسجيل الحضور', 500);
    }

    // =============================================
    // ✅ نجاح - رد خفيف
    // =============================================
    return success(res, {
      message: 'تم تسجيل حضورك بنجاح ✅',
      data: {
        student_name: cleanName,
        lecture_title: lecture.title,
        lecture_date: lecture.lecture_date,
        scanned_at: attendanceRecord.scanned_at
      }
    });

  } catch (err) {
    console.error('Scan attendance error:', err);
    return error(res, 'حدث خطأ في الخادم - حاول مرة أخرى', 500);
  }
};
