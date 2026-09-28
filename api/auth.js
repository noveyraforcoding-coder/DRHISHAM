const { cors, success, error } = require('./_lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405);
  }

  try {
    const { password } = req.body;
    
    if (!password) {
      return error(res, 'كلمة المرور مطلوبة');
    }

    // كلمة المرور الافتراضية أو من متغيرات البيئة
    const adminPassword = process.env.ADMIN_PASSWORD || 'drhisham2024';

    if (password === adminPassword) {
      return success(res, { 
        message: 'تم تسجيل الدخول بنجاح',
        token: Buffer.from(`admin:${Date.now()}`).toString('base64')
      });
    } else {
      return error(res, 'كلمة المرور غير صحيحة', 401);
    }

  } catch (err) {
    console.error('Auth error:', err);
    return error(res, 'حدث خطأ في الخادم', 500);
  }
};
