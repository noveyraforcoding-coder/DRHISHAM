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

    // =============================================
    // إجمالي الطلاب المسجلين
    // =============================================
    const { count: totalStudents } = await db
      .from('students')
      .select('*', { count: 'exact', head: true });

    // =============================================
    // إجمالي المحاضرات
    // =============================================
    const { count: totalLectures } = await db
      .from('lectures')
      .select('*', { count: 'exact', head: true });

    // =============================================
    // إجمالي سجلات الحضور
    // =============================================
    const { count: totalAttendance } = await db
      .from('attendance')
      .select('*', { count: 'exact', head: true });

    // =============================================
    // الأكثر حضوراً - Top 10
    // =============================================
    const { data: allAttendance } = await db
      .from('attendance')
      .select('student_id, students(full_name, national_id)');

    // تجميع بيانات الحضور
    const attendanceMap = {};
    if (allAttendance) {
      allAttendance.forEach(a => {
        if (!attendanceMap[a.student_id]) {
          attendanceMap[a.student_id] = {
            student_id: a.student_id,
            full_name: a.students?.full_name || 'غير معروف',
            national_id: a.students?.national_id || '',
            count: 0
          };
        }
        attendanceMap[a.student_id].count++;
      });
    }

    const studentStats = Object.values(attendanceMap);
    
    // الأكثر حضوراً
    const topAttending = [...studentStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // الأكثر غياباً (الأقل حضوراً من المسجلين)
    // جلب جميع الطلاب
    const { data: allStudents } = await db
      .from('students')
      .select('id, full_name, national_id');

    const mostAbsentList = [];
    if (allStudents && totalLectures > 0) {
      allStudents.forEach(s => {
        const attended = attendanceMap[s.id]?.count || 0;
        const missed = totalLectures - attended;
        mostAbsentList.push({
          student_id: s.id,
          full_name: s.full_name,
          national_id: s.national_id,
          attended,
          missed,
          attendance_rate: ((attended / totalLectures) * 100).toFixed(1)
        });
      });
    }

    const mostAbsent = mostAbsentList
      .sort((a, b) => b.missed - a.missed)
      .slice(0, 10);

    // =============================================
    // نسبة الحضور لكل محاضرة
    // =============================================
    const { data: lectures } = await db
      .from('lectures')
      .select('id, title, lecture_date')
      .order('lecture_date', { ascending: false });

    const lectureStats = [];
    if (lectures) {
      for (const lec of lectures) {
        const { count: lecAttCount } = await db
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('lecture_id', lec.id);

        lectureStats.push({
          id: lec.id,
          title: lec.title,
          lecture_date: lec.lecture_date,
          attendance_count: lecAttCount || 0,
          attendance_rate: totalStudents > 0 
            ? (((lecAttCount || 0) / totalStudents) * 100).toFixed(1) 
            : '0.0'
        });
      }
    }

    return success(res, {
      overview: {
        total_students: totalStudents || 0,
        total_lectures: totalLectures || 0,
        total_attendance_records: totalAttendance || 0,
        overall_rate: (totalStudents && totalLectures) 
          ? (((totalAttendance || 0) / (totalStudents * totalLectures)) * 100).toFixed(1)
          : '0.0'
      },
      top_attending: topAttending,
      most_absent: mostAbsent,
      lecture_stats: lectureStats
    });

  } catch (err) {
    console.error('Stats error:', err);
    return error(res, 'حدث خطأ في الخادم', 500);
  }
};
