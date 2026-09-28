const { getSupabase, cors, success, error } = require('./_lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    const { lecture_id, is_active } = req.body;

    if (!lecture_id) {
      return error(res, 'معرف المحاضرة مطلوب');
    }

    const db = getSupabase();

    const { data, error: updateErr } = await db
      .from('lectures')
      .update({ is_active: is_active !== undefined ? is_active : false })
      .eq('id', lecture_id)
      .select()
      .single();

    if (updateErr) {
      return error(res, 'خطأ في تحديث حالة المحاضرة', 500);
    }

    return success(res, {
      message: is_active ? 'تم تفعيل المحاضرة' : 'تم إغلاق المحاضرة',
      lecture: data
    });

  } catch (err) {
    console.error('Toggle lecture error:', err);
    return error(res, 'حدث خطأ في الخادم', 500);
  }
};
