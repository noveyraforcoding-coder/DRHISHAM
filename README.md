# نظام حضور وغياب الطلاب - د. هشام هاشم
## كلية العلوم - جامعة طنطا - قسم الفيزياء - مقرر الحرارة

### المتطلبات
- حساب [Vercel](https://vercel.com) (مجاني)
- حساب [Supabase](https://supabase.com) (مجاني)

### خطوات التشغيل

#### 1. إعداد قاعدة البيانات
1. أنشئ مشروع جديد في Supabase
2. افتح SQL Editor
3. انسخ والصق محتوى `database/schema.sql` وشغّله

#### 2. إعداد متغيرات البيئة
أنشئ ملف `.env.local` بالقيم التالية:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
QR_SECRET=your-random-secret-key-here
```

#### 3. التشغيل المحلي
```bash
npm install
npm run dev
```

#### 4. النشر على Vercel
```bash
npx vercel --prod
```
أضف متغيرات البيئة في إعدادات المشروع على Vercel.

### الروابط
- **واجهة الطالب (الماسح):** `/index.html`
- **لوحة تحكم الدكتور:** `/admin.html`
- **كلمة المرور الافتراضية:** `drhisham2024`
