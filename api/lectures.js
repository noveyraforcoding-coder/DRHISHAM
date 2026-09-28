const { getSupabase, cors, success, error, generateQrToken } = require('./_lib/db');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  const db = getSupabase();

  // =============================================
  // GET - جلب جميع المحاضرات
  // =============================================
  if (req.method === 'GET') {
    try {
      const { data: lectures, error: lecErr } = await db
        .from('lectures')
        .select('*')
        .order('lecture_date', { ascending: false });

      if (lecErr) {
        return error(res, 'خطأ في جلب المحاضرات', 500);
      }

      // إضافة عدد الحضور لكل محاضرة
      const enriched = [];
      for (const lec of (lectures || [])) {
        const { count } = await db
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('lecture_id', lec.id);

        enriched.push({
          ...lec,
          attendance_count: count || 0
        });
      }

      return success(res, { lectures: enriched });
    } catch (err) {
      console.error('Get lectures error:', err);
      return error(res, 'حدث خطأ في الخادم', 500);
    }
  }

  // =============================================
  // POST - إنشاء محاضرة جديدة
  // =============================================
  if (req.method === 'POST') {
    try {
      const { title, lecture_date, time_window_start, time_window_end } = req.body;

      if (!lecture_date) {
        return error(res, 'تاريخ المحاضرة مطلوب');
      }

      const lectureTitle = title || 'مقرر الحرارة';
      const lectureId = uuidv4();
      const qrToken = generateQrToken(lectureId, lecture_date);

      const { data: lecture, error: insertErr } = await db
        .from('lectures')
        .insert({
          id: lectureId,
          title: lectureTitle,
          lecture_date,
          time_window_start: time_window_start || null,
          time_window_end: time_window_end || null,
          qr_token: qrToken,
          is_active: true
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Create lecture error:', insertErr);
        return error(res, 'خطأ في إنشاء المحاضرة', 500);
      }

      // بيانات QR Code ككائن لتكوين الرابط في الواجهة الأمامية
      const qrData = {
        id: lectureId,
        date: lecture_date,
        sig: qrToken,
        title: lectureTitle
      };

      return success(res, {
        message: 'تم إنشاء المحاضرة بنجاح',
        lecture,
        qr_data: qrData
      }, 201);

    } catch (err) {
      console.error('Create lecture error:', err);
      return error(res, 'حدث خطأ في الخادم', 500);
    }
  }

  return error(res, 'Method not allowed', 405);
};
