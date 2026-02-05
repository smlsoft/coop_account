export const MONTH_OPTIONS = [
    { label: 'มกราคม', value: 1 },
    { label: 'กุมภาพันธ์', value: 2 },
    { label: 'มีนาคม', value: 3 },
    { label: 'เมษายน', value: 4 },
    { label: 'พฤษภาคม', value: 5 },
    { label: 'มิถุนายน', value: 6 },
    { label: 'กรกฎาคม', value: 7 },
    { label: 'สิงหาคม', value: 8 },
    { label: 'กันยายน', value: 9 },
    { label: 'ตุลาคม', value: 10 },
    { label: 'พฤศจิกายน', value: 11 },
    { label: 'ธันวาคม', value: 12 }
];

export const ITEMS_PER_PAGE_OPTIONS = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '30', value: 30 },
    { label: '50', value: 50 },
    { label: 'ทั้งหมด', value: 9999 }
];

export const TAX_MODE = {
    PURCHASE: 0, // ภาษีซื้อ
    SALE: 1 // ภาษีขาย
};

export const WITHHOLDING_TAX_TYPE = {
    WHT: 1 // ภาษีหัก ณ ที่จ่าย
};

export const CUSTOMER_TYPE = {
    INDIVIDUAL: 0, // บุคคลธรรมดา (ภ.ง.ด.3)
    JURISTIC: 1 // นิติบุคคล (ภ.ง.ด.53)
};
