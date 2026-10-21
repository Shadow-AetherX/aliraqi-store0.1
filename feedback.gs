/**
 * استقبال ملاحظات وتعليقات العملاء من الموقع — العراقي ستور
 * بيحفظ كل ملاحظة كصف جديد في شيت اسمه "Feedback" جوه نفس ملف Google Sheet.
 * طريقة التركيب في ملف README-AR.txt
 */
const SHEET_NAME = 'Feedback';
const OWNER_EMAIL = '';   // اختياري: اكتب إيميلك هنا لو عايز إشعار على كل ملاحظة جديدة

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const msg = String(d.message || '').trim();
    if (msg.length < 3) return out_({ ok: false, error: 'empty' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['الوقت', 'الموقع', 'النوع', 'الرسالة', 'الاسم', 'الجوال', 'الصفحة', 'الجهاز', 'الحالة']);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, 9).setFontWeight('bold');
    }
    // منع حقن المعادلات في الشيت
    const clean = (v, n) => {
      v = String(v == null ? '' : v).slice(0, n || 200);
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    };
    sh.appendRow([
      new Date(), clean(d.site, 20), clean(d.type, 20), clean(msg, 800),
      clean(d.name, 60), clean(d.phone, 20), clean(d.page, 200), clean(d.agent, 140), 'جديد'
    ]);

    if (OWNER_EMAIL) {
      MailApp.sendEmail(OWNER_EMAIL, 'ملاحظة جديدة على موقع العراقي ستور (' + clean(d.type, 20) + ')',
        msg + '\n\nالاسم: ' + clean(d.name, 60) + '\nالجوال: ' + clean(d.phone, 20) + '\nالموقع: ' + clean(d.site, 20));
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() { return ContentService.createTextOutput('feedback endpoint is running'); }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
