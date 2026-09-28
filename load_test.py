import asyncio
import aiohttp
import time
import random
import uuid

# ==========================================
# سكربت بايثون لاختبار ضغط تسجيل الحضور (Load Test)
# ==========================================

# 1. إعدادات الاختبار
URL = "https://drhisham.vercel.app/api/scan-attendance" # يمكنك تغييره لرابط Vercel لاحقاً
CONCURRENT_USERS = 500 # عدد الطلاب اللي بيسجلوا في نفس اللحظة

# 2. بيانات المحاضرة (انسخها من الـ URL الخاص بالـ QR)
# افتح لوحة التحكم، اعمل محاضرة، وانسخ البيانات دي من رابط الـ QR اللي بيطلع
LECTURE_ID = "8feb79cf-787c-4b49-8e12-911291d0bfa0" 
LECTURE_DATE = "2026-09-28"
SIGNATURE = "f1bb2737185878ec"

async def submit_attendance(session, student_id):
    # إنشاء بيانات طالب عشوائية
    random_nid = f"299{random.randint(1000000000, 9999999999)}"
    name = f"طالب تجربة {student_id}"
    
    payload = {
        "lecture_id": LECTURE_ID,
        "lecture_date": LECTURE_DATE,
        "signature": SIGNATURE,
        "national_id": random_nid,
        "full_name": name,
        "device_fingerprint": str(uuid.uuid4())
    }
    
    start_time = time.time()
    try:
        async with session.post(URL, json=payload) as response:
            status = response.status
            text = await response.text()
            latency = time.time() - start_time
            return {"status": status, "latency": latency, "text": text}
    except Exception as e:
        return {"status": "ERROR", "latency": time.time() - start_time, "text": str(e)}

async def main():
    print(f"Starting load test for {CONCURRENT_USERS} students concurrently...")
    print(f"Target: {URL}")
    
    start_time = time.time()
    
    # فتح اتصال واحد قوي
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(CONCURRENT_USERS):
            tasks.append(submit_attendance(session, i+1))
        
        # تنفيذ كل الطلبات بالتوازي (في نفس اللحظة)
        results = await asyncio.gather(*tasks)
    
    total_time = time.time() - start_time
    
    # تحليل النتائج
    success_count = sum(1 for r in results if r["status"] == 200)
    failed_count = CONCURRENT_USERS - success_count
    avg_latency = sum(r["latency"] for r in results) / CONCURRENT_USERS
    max_latency = max(r["latency"] for r in results)
    
    print("\n" + "="*40)
    print("📊 نتائج الاختبار:")
    print("="*40)
    print(f"إجمالي الطلبات: {CONCURRENT_USERS}")
    print(f"✅ الطلبات الناجحة (200 OK): {success_count}")
    print(f"❌ الطلبات الفاشلة: {failed_count}")
    
    if failed_count > 0:
        sample_error = next((r for r in results if r["status"] != 200), None)
        if sample_error:
            print(f"⚠️ سبب الفشل (عينة): {sample_error['status']} - {sample_error['text'][:150]}")
            
    print(f"⏱️ الوقت الإجمالي للاختبار: {total_time:.2f} ثانية")
    print(f"⚡ متوسط سرعة الرد: {avg_latency*1000:.2f} مللي ثانية")
    print(f"🐢 أقصى تأخير (أسوأ حالة): {max_latency*1000:.2f} مللي ثانية")
    print("="*40)

if __name__ == "__main__":
    if LECTURE_ID == "YOUR_LECTURE_ID":
        print("⚠️ تنبيه: برجاء تعديل LECTURE_ID و LECTURE_DATE و SIGNATURE في ملف load_test.py قبل التشغيل.")
    else:
        asyncio.run(main())
