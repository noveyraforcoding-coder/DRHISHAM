const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// =============================================
// Real Supabase Connection
// =============================================

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // MUST be the service_role key for admin access

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase Environment Variables (SUPABASE_URL or SUPABASE_SERVICE_KEY).');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return supabaseInstance;
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
