/* =====================================================================
   إعدادات الموقع — العراقي ستور (كتالوج الجملة)
   ده الملف الوحيد اللي بتعدّل فيه. باقي الملفات ما تتلمسش.
===================================================================== */
window.SITE = {
  // "wholesale" = جملة (بالكرتونة) | "retail" = قطاعي (بالقطعة)
  mode: "wholesale",
  storeName: "العراقي ستور",

  // رقم واتساب المتجر (صيغة دولية بدون + أو صفر)
  whatsappNumber: "201105236152",

  // رابط الشيت المنشور CSV (نفس رابط الموقع القديم)
  googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy6tmzPEdxq6EcBxWh-bM_zR94kaYlZhHOxXa6LceOjFxZjxm0Qtr3Dy8GnYB99g/pub?gid=1444421128&single=true&output=csv",

  // رابط Apps Script لاستقبال الملاحظات (شوف README-AR.txt). لو فاضي الملاحظات بتتبعت على واتساب.
  feedbackEndpoint: "",

  // تصغير الصور تلقائيًا (WebP بمقاس مناسب) لسرعة الظهور — اتركها true
  imageProxy: true,

  // عدد أعمدة الكروت على الموبايل: 1 (كارت كبير زي المرجع) أو 2 (كروت أصغر)
  mobileColumns: 1,

  // رسالة الترحيب: false = مرة في اليوم لكل عميل | true = في كل زيارة
  welcomeEveryVisit: false,
  // لو عايز صورة بانر جاهزة مكان التصميم الافتراضي حط رابطها هنا (اختياري)
  welcomeBannerImage: "",

  currency: "جنيه",
  maxQuantity: 9999
};
