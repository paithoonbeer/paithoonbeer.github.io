/** SetSod Data — version line separate from the live SetSod app (APPV).
 * Bump DATAV here (and meta bp-data in data.html) when shipping Data-only changes.
 * Do NOT bump public/app.js APPV / sw cache / APK for Data-only work.
 */
export const DATAV='1.0.0';
export const DATACHG={
  '1.0.0':'สตูดิโอแต่งเพลงแยกเวอร์ชันจากแอปเล่นสด — ตัดต่อ · MIDI · อัดเสียง · EQ/Reverb · บันทึกโปรเจกต์ · มิกซ์ดาวน์'
};
export function dataWhatsNew(v=DATAV){return DATACHG[v]||''}
