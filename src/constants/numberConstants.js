/**
 * Global constants for number formatting
 *
 * จำนวนทศนิยมที่ใช้ในระบบบัญชี
 * สามารถเปลี่ยนค่าที่นี่ที่เดียว แล้วจะมีผลกับทั้งระบบ
 */

// จำนวนทศนิยมสำหรับการคำนวณและแสดงผล
export const DECIMAL_PLACES = 2;

// จำนวนทศนิยมสำหรับแสดงผล (สามารถแยกจาก DECIMAL_PLACES ได้ถ้าต้องการ)
export const DISPLAY_DECIMAL_PLACES = 2;

// ค่าความคลาดเคลื่อนที่ยอมรับได้ในการเปรียบเทียบตัวเลข (สำหรับการตรวจสอบความสมดุล)
// ใช้ 10^(-DECIMAL_PLACES) / 2 = 0.01 / 2 = 0.005
export const EPSILON = 0.01;
