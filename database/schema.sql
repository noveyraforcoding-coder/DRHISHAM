-- ============================================================
-- نظام حضور وغياب الطلاب - د. هشام هاشم
-- كلية العلوم - جامعة طنطا - قسم الفيزياء - مقرر الحرارة
-- ============================================================
-- قاعدة البيانات: Supabase (PostgreSQL) أو Neon Database
-- ============================================================

-- تفعيل إضافة UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- جدول الطلاب
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    national_id VARCHAR(14) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهرس على الرقم القومي للبحث السريع
CREATE INDEX IF NOT EXISTS idx_students_national_id ON students(national_id);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);

-- ============================================================
-- جدول المحاضرات
-- ============================================================
CREATE TABLE IF NOT EXISTS lectures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL DEFAULT 'مقرر الحرارة',
    lecture_date DATE NOT NULL,
    time_window_start TIME,
    time_window_end TIME,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    qr_salt VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس المحاضرات
CREATE INDEX IF NOT EXISTS idx_lectures_date ON lectures(lecture_date);
CREATE INDEX IF NOT EXISTS idx_lectures_qr_token ON lectures(qr_token);
CREATE INDEX IF NOT EXISTS idx_lectures_active ON lectures(is_active);

-- ============================================================
-- جدول الحضور
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(512),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- منع التكرار: طالب واحد لا يسجل حضور أكثر من مرة لنفس المحاضرة
    UNIQUE(student_id, lecture_id)
);

-- فهارس الحضور
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_lecture ON attendance(lecture_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned ON attendance(scanned_at);

-- ============================================================
-- جدول إعدادات النظام (كلمة مرور الأدمن)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- كلمة المرور الافتراضية للوحة التحكم: drhisham2024
-- يمكن تغييرها لاحقاً من لوحة التحكم
INSERT INTO app_settings (key, value) 
VALUES ('admin_password', 'drhisham2024')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- دوال مساعدة
-- ============================================================

-- دالة حساب عدد حضور طالب معين
CREATE OR REPLACE FUNCTION get_student_attendance_count(p_student_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM attendance WHERE student_id = p_student_id;
$$ LANGUAGE SQL STABLE;

-- دالة جرد الغياب: الطلاب المسجلين الذين لم يحضروا محاضرة معينة
CREATE OR REPLACE FUNCTION get_absent_students(p_lecture_id UUID)
RETURNS TABLE(student_id UUID, national_id VARCHAR, full_name VARCHAR) AS $$
    SELECT s.id, s.national_id, s.full_name
    FROM students s
    WHERE s.id NOT IN (
        SELECT a.student_id FROM attendance a WHERE a.lecture_id = p_lecture_id
    )
    ORDER BY s.full_name;
$$ LANGUAGE SQL STABLE;
