// ตั้งค่าระบบ — แก้ไฟล์นี้ไฟล์เดียวหลังติดตั้ง (ดู docs/คู่มือติดตั้ง.md)
window.APP_CONFIG = {
  // URL ของ Apps Script Web App (ลงท้าย /exec) — ปล่อยว่างไว้ = ใช้ข้อมูลจำลองใน mock/
  API_URL: 'https://script.google.com/macros/s/AKfycbzXZXXO1KV2JszHE1hAzH0u-4ghaBiSMLIKu4BE5XzsoDQb7DqKVPD5cz5YBM_S0qk/exec',
  MOCK_URL: '',

  // LIFF ID จาก LINE Developers (เช่น 2001234567-AbCdEfGh) — ปล่อยว่างได้ เว็บยังใช้งานได้ปกตินอก LINE
  LIFF_ID: '',

  // ลิงก์เพิ่มเพื่อน LINE OA ของจังหวัด เช่น https://line.me/R/ti/p/@xxxxxxx (ใช้ในปกหลัง E-book และหน้าวิธีช่วยเหลือ)
  LINE_OA_URL: '',

  // URL หน้าเว็บจริงหลังเผยแพร่ (ใช้ทำ QR Code) — ปล่อยว่าง = ใช้ที่อยู่ปัจจุบันของหน้าเว็บ
  SITE_URL: 'https://nuttasittong.github.io/catalog-songkhla/',

  PROVINCE: 'สงขลา',
  ORG: 'สำนักงานพัฒนาชุมชนจังหวัดสงขลา',
  ORG_PHONE: '074-000-000',
};
