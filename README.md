# OnaTili AI PRO — milliy sertifikatga tayyorgarlik

**Ona tili va adabiyot** fanidan shaxsiy tayyorgarlik sayti. 31 ta original dars, 114 ta test savoli (shundan 30 tasi matn asosida), 10 ta moslashtirish, 16 ta ochiq tahlil topshirig‘i va 12 ta esse mavzusi mavjud.

## Windows'da ochish

1. `OnaTili_AI_PRO.zip` faylini papkaga **Extract All** orqali ajrating.
2. Kompyuterda **Python 3.10 yoki yuqori** o‘rnatilgan bo‘lsin (Python.org). Python o‘rnatayotganda **Add Python to PATH** ni tanlang.
3. Papkadagi `START.bat` faylini ikki marta bosing.
4. Sayt odatda yangi brauzer oynasida yoki tabida ochiladi. Aks holda `http://127.0.0.1:5000` manzilini Chrome yoki Edge'da oching.
5. Sayt ishlashi uchun qora server oynasini yopmang. To‘xtatish: `Ctrl+C`.

**Mac/Linux**: terminalda `python3 launcher.py`, yoki `./start.sh`.

**Qo‘shimcha kutubxona kerak emas.** HTML, CSS, JS frontend, Python `http.server` backend va `sqlite3` bazasi Python bilan birga keladi. Parollar `PBKDF2-HMAC-SHA256` orqali tuz bilan xeshlanadi. Sayt tashqi internetga ochilmaydi (`127.0.0.1`).

## Funksiyalar

- **Bosh sahifa** — darslar, tayyorgarlik foizi, kunlar hisoblagichi.
- **Darslar** — 31 modul, misol, odatiy xato, mini mashq, darsni tugallangan deb belgilash.
- **Mavzuli mock** — 5–40 savol oralig‘i (bank imkoniga qarab), kategoriya bo‘yicha, taymer va izohli tahlil.
- **To‘liq mock** — 45 ta topshiriq, 180 daqiqa; 32 tanlovli (15 matn asosida), 3 moslashtirish, 9 ta ikki bandli tahlil, 1 esse. Natija sahifasi va javoblar tafsiloti.
- **Esse laboratoriyasi** — 12 mezon ko‘rinishi va **faqat taxminiy** pedagogik algoritm. 100 so‘zdan kam esse uchun maxsus qoida ko‘rsatiladi. AI API mavjud bo‘lsa, alohida mazmuniy maslahat beradi.
- **Ustoz** — API kalitsiz dars va mini test bo‘yicha lokal yordamchi; kalit bilan masofaviy AI chat. Brauzer qo‘llasa ovozni tanish va ovoz chiqarib o‘qish.
- **Reja** — imtihon sanasini sozlash, kunlik checklist, haftalik ritm.
- **Kabinet** — ro‘yxatdan o‘tish / kirish, SQLite tarix va natijalar. Kirishsiz vaqtinchalik mock va esse ishlaydi, uzoq muddatli progress uchun akkaunt kerak.

## AI integratsiya (ixtiyoriy)

1. `.env.example` nusxasini `.env` deb o‘zgartiring.
2. `OPENAI_API_KEY=...` ni o‘zingizning kalitingiz bilan to‘ldiring.
3. Serverni qayta ishga tushiring. Kalit faqat **backendda** qoladi, brauzerga yuborilmaydi.
4. Bunday AI xizmatiga internet, alohida hisob va ba’zan to‘lov kerak bo‘lishi mumkin. AI ishonchliligini tekshiring.

**Muhim chegaralar:**
- Bu O‘zbekiston Bilim va malakalarni baholash agentligining rasmiy sayti emas. Savollar ishlab chiqilgan **o‘quv namunalari**, rasmiy testlarning nusxasi emas.
- Rasmiy baholash Rasch modeli va ekspert tahliliga asoslanadi. Saytdagi foiz, esse bo‘yicha 24 lik raqam va boshqa natijalar rasmiy ball emas.
- 31 dars boshlang‘ich va o‘rta darajaga mos. Hamma adabiyot asarlarini chuqur qamrab olgan to‘liq milliy dastur deb qabul qilinmasin.
- Ovoz kiritish `SpeechRecognition` brauzerga va tilni qo‘llab-quvvatlashga bog‘liq. O‘zbekcha ovoz sifati tizimga qarab farq qiladi.
- Mahalliy server kompyuteringizda ishlaydi. Boshqalarga internet orqali foydalanish imkonini berish uchun hosting, HTTPS, qo‘shimcha xavfsizlik va monitoring kerak.

## Ma’lumotlar

`study.db` fayli birinchi ishga tushganda yaratiladi. Akkauntlar, darslar progressi, esse va sinov natijalari shu bazada saqlanadi. Zaxiralash uchun serverni to‘xtatib `study.db` faylini nusxalang. Maxfiy parolingizni hech kimga bermang.

## Rasmiy manba

Ona tili va adabiyot fanidan yozma ish baholash mezoni: https://uzbmb.uz/post/view/ona-tili-va-adabiyot-fanidan-yozma-ishni-baholash-mezoni

O‘zbekiston Bilim va malakalarni baholash agentligi: https://uzbmb.uz/
