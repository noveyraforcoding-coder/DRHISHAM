const { getSupabase, cors, success, error } = require('./_lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    const db = getSupabase();
    const { lecture_id } = req.query;

    if (!lecture_id) {
      return error(res, 'معرف المحاضرة مطلوب');
    }

    // جلب بيانات المحاضرة
    const { data: lecture } = await db
      .from('lectures')
      .select('id, title, lecture_date')
      .eq('id', lecture_id)
      .single();

    // جلب سجلات الحضور مع بيانات الطلاب
    const { data: records, error: recErr } = await db
      .from('attendance')
      .select('id, scanned_at, device_fingerprint, students(id, full_name, national_id)')
      .eq('lecture_id', lecture_id)
      .order('scanned_at', { ascending: true });

    if (recErr) {
      return error(res, 'خطأ في جلب بيانات الحضور', 500);
    }

    const exportData = (records || []).map((r, idx) => ({
      row_number: idx + 1,
      full_name: r.students?.full_name || '',
      national_id: r.students?.national_id || '',
      scanned_at: r.scanned_at
    }));

    return success(res, {
      lecture: lecture || {},
      records: exportData,
      total: exportData.length
    });

  } catch (err) {
    console.error('Export error:', err);
    return error(res, 'حدث خطأ في الخادم', 500);
  }
};
