/**
 * Number formatting utilities for accounting system
 *
 * Helper functions สำหรับการจัดการตัวเลขในระบบบัญชี
 * - การ round ทศนิยม
 * - การ format แสดงผลตัวเลข
 * - การ parse ค่าจาก input
 */

import { DECIMAL_PLACES, DISPLAY_DECIMAL_PLACES } from '@/constants/numberConstants';

/**
 * Round ตัวเลขให้มีทศนิยมตามที่กำหนด
 * @param {number|string} value - ค่าที่ต้องการ round
 * @param {number} decimals - จำนวนทศนิยม (default จาก DECIMAL_PLACES)
 * @returns {number} - ตัวเลขที่ round แล้ว
 */
export const roundDecimal = (value, decimals = DECIMAL_PLACES) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * แปลงค่าเป็นตัวเลขที่มีทศนิยมตามที่กำหนด (สำหรับส่ง API)
 * @param {number|string} value - ค่าที่ต้องการแปลง
 * @param {number} defaultValue - ค่า default ถ้าแปลงไม่ได้ (default = 0)
 * @returns {number} - ตัวเลขที่ round แล้ว
 */
export const toDecimalNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') return defaultValue;
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    return roundDecimal(num);
};

/**
 * Format ตัวเลขสำหรับแสดงผล (มี comma คั่นหลักพัน + ทศนิยม)
 * @param {number|string} value - ค่าที่ต้องการ format
 * @param {number} decimals - จำนวนทศนิยม (default จาก DISPLAY_DECIMAL_PLACES)
 * @returns {string} - ตัวเลข format แล้ว เช่น "1,234.56"
 */
export const formatNumber = (value, decimals = DISPLAY_DECIMAL_PLACES) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

/**
 * Format ตัวเลขสำหรับแสดงผลในช่อง input (มี comma คั่นหลักพัน + ทศนิยม แต่ถ้าเป็น 0 จะแสดงเป็นค่าว่าง)
 * @param {number|string} value - ค่าที่ต้องการ format
 * @param {number} decimals - จำนวนทศนิยม (default จาก DISPLAY_DECIMAL_PLACES)
 * @returns {string} - ตัวเลข format แล้ว หรือ '' ถ้าเป็น 0
 */
export const formatAmountDisplay = (value, decimals = DISPLAY_DECIMAL_PLACES) => {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

/**
 * Parse ค่าจาก input (ลบ comma ออก แล้วแปลงเป็นตัวเลข)
 * @param {string|number} value - ค่าจาก input
 * @param {number} defaultValue - ค่า default ถ้าแปลงไม่ได้ (default = 0)
 * @returns {number} - ตัวเลขที่แปลงแล้ว พร้อม round ทศนิยม
 */
export const parseAmountInput = (value, defaultValue = 0) => {
    if (!value || value === '') return defaultValue;
    // ลบ comma ออก
    const cleaned = String(value).replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return defaultValue;
    return roundDecimal(num);
};

/**
 * คำนวณภาษี VAT
 * @param {number|string} base - ฐานภาษี
 * @param {number|string} rate - อัตราภาษี (%)
 * @returns {number} - ยอดภาษีที่คำนวณได้
 */
export const calculateVat = (base, rate) => {
    const baseNum = toDecimalNumber(base, 0);
    const rateNum = toDecimalNumber(rate, 0);
    const vat = (baseNum * rateNum) / 100;
    return roundDecimal(vat);
};

/**
 * คำนวณภาษีหัก ณ ที่จ่าย
 * @param {number|string} base - ฐานภาษี
 * @param {number|string} rate - อัตราภาษี (%)
 * @returns {number} - ยอดภาษีที่คำนวณได้
 */
export const calculateWithholdingTax = (base, rate) => {
    const baseNum = toDecimalNumber(base, 0);
    const rateNum = toDecimalNumber(rate, 0);
    const tax = (baseNum * rateNum) / 100;
    return roundDecimal(tax);
};

/**
 * ตรวจสอบว่าตัวเลขสมดุลกันหรือไม่ (ใช้สำหรับตรวจสอบ debit = credit)
 * @param {number|string} value1 - ค่าที่ 1
 * @param {number|string} value2 - ค่าที่ 2
 * @param {number} epsilon - ค่าความคลาดเคลื่อนที่ยอมรับได้ (default = 0.01)
 * @returns {boolean} - true ถ้าสมดุล
 */
export const isBalanced = (value1, value2, epsilon = 0.01) => {
    const num1 = toDecimalNumber(value1, 0);
    const num2 = toDecimalNumber(value2, 0);
    return Math.abs(num1 - num2) <= epsilon;
};
