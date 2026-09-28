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
    const { lecture_id } = req.body;

    if (!lecture_id) {
      return error(res, 'معرف المحاضرة مطلوب');
    }

    const db = getSupabase();

    // التحقق من وجود المحاضرة
    const { data: lecture, error: lecErr } = await db
      .from('lectures')
      .select('id, title, lecture_date')
      .eq('id', lecture_id)
      .single();

    if (lecErr || !lecture) {
      return error(res, 'المحاضرة غير موجودة', 404);
    }

    // جلب جميع الطلاب المسجلين في النظام
    const { data: allStudents, error: studErr } = await db
      .from('students')
      .select('id, national_id, full_name')
      .order('full_name');

    if (studErr) {
      return error(res, 'خطأ في جلب بيانات الطلاب', 500);
    }

    // جلب الطلاب الذين حضروا هذه المحاضرة
    const { data: presentStudents, error: attErr } = await db
      .from('attendance')
      .select('student_id')
      .eq('lecture_id', lecture_id);

    if (attErr) {
      return error(res, 'خطأ في جلب بيانات الحضور', 500);
    }

    const presentIds = new Set(presentStudents.map(a => a.student_id));

    // تحديد الغائبين
    const absentStudents = allStudents.filter(s => !presentIds.has(s.id));
    const presentList = allStudents.filter(s => presentIds.has(s.id));

    return success(res, {
      lecture: {
        id: lecture.id,
        title: lecture.title,
        lecture_date: lecture.lecture_date
      },
      total_students: allStudents.length,
      present_count: presentList.length,
      absent_count: absentStudents.length,
      attendance_rate: allStudents.length > 0 
        ? ((presentList.length / allStudents.length) * 100).toFixed(1) 
        : '0.0',
      present_students: presentList.map(s => ({
        id: s.id,
        national_id: s.national_id,
        full_name: s.full_name
      })),
      absent_students: absentStudents.map(s => ({
        id: s.id,
        national_id: s.national_id,
        full_name: s.full_name
      }))
    });

  } catch (err) {
    console.error('Audit absence error:', err);
    return error(res, 'حدث خطأ في الخادم', 500);
  }
};
