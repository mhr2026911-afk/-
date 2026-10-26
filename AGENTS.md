# AGENTS.md — مرسال

ملاحظات تشغيل غير بديهية لهذا المستودع. اقرأها قبل تشغيل البيئة أو تعديلها.

## البنية

- `frontend/` — React 18 + Vite + Tailwind، واجهة عربية RTL بمقاس الجوال (الحد الأقصى 480px).
- `backend/` — FastAPI + SQLAlchemy + PostgreSQL، مع WebSocket للتحديثات الفورية وإشارات المكالمات.
- `docker-compose.base44.yml` — بيئة التطوير: `db` + `api` (uvicorn --reload) + `web` (Vite dev server).
- تشغيل واحد فقط: `docker compose -f docker-compose.base44.yml up -d --build`.

## أمور غير بديهية

1. **الاتصال بين الواجهة والـ API يتم عبر نفس الأصل**. Vite يمرّر `/api` و`/ws` إلى `http://api:8000`
   (انظر `frontend/vite.config.js`). لا تضف عنوان API مطلقًا في الكود؛ استخدم `/api/...` فقط.
2. **لا بيانات تجريبية ولا حسابات وهمية** — القرار مقصود: قاعدة البيانات تبدأ فارغة ولا يوجد seed.
   أي مستخدم يظهر في الواجهة يجب أن يكون قد سجّل رقم هاتفه فعليًا. لا تضف seed أو demo users.
3. **تحقق الهاتف**: `POST /api/auth/request-code`. في وضع المعاينة فقط (`BASE44_PREVIEW_MODE=1`)
   وبدون بوابة SMS يعيد الخادم `dev_code` ليظهر على الشاشة. خارج وضع المعاينة لا يُعاد الرمز أبدًا،
   وتلزم بيانات Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) عبر
   `/run/base44/app.env`.
4. **الوسائط** تُخزَّن في volume باسم `media-data` على `/data/media` وتُقدَّم عبر
   `/api/media/{id}?token=...` مع تحقق من صلاحية الوصول (لا روابط عامة دائمة).
5. **المكالمات** WebRTC حقيقية: الإشارات تمر عبر `/ws`، وSTUN عام. تحتاج جهازين/مستخدمين مسجلين
   لتجربة مكالمة فعلية؛ لا يمكن التحقق منها من متصفح واحد.
6. **الجداول** تُنشأ تلقائيًا عبر `Base.metadata.create_all` عند بدء التشغيل؛ لا يوجد Alembic.
7. **قفل التطبيق** رمز 4 أرقام يُخزَّن كـ SHA-256 في `localStorage` على الجهاز (عميل فقط).

## التحقق السريع

```bash
curl -s localhost:3000/api/health
docker compose -f docker-compose.base44.yml ps
docker compose -f docker-compose.base44.yml logs --tail 60 api web
```

- لا توجد مجموعة اختبارات في المستودع. للتحقق من الـ API شغّل سكربتًا مؤقتًا (في `/tmp`، لا في المستودع)
  يستخدم `fastapi.testclient` داخل حاوية `api` مع قاعدة بيانات منفصلة: أنشئ `mersal_test` عبر psql، ثم
  `exec -e DATABASE_URL=…mersal_test -e MEDIA_DIR=/tmp/media-test -e PYTHONPATH=/srv api python /tmp/test.py`،
  واحذف قاعدة الاختبار بعدها. لا تختبر في قاعدة التطبيق حتى لا تبقى حسابات تجريبية.
- بناء الواجهة للتحقق من الأخطاء: `docker compose -f docker-compose.base44.yml exec -T web npx vite build`.

## متغيرات البيئة

- محلية (في compose): `DATABASE_URL`, `MEDIA_DIR`, `BASE44_PREVIEW_MODE`.
- أسرار (من `/run/base44/app.env`): `SECRET_KEY` (مطلوب عند الإقلاع)، وبيانات Twilio اختيارية.
