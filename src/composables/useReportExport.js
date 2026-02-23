import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SarabunBold, SarabunRegular } from '@/utils/sarabunFont';
import * as XLSX from 'xlsx';

/**
 * Composable สำหรับ export รายงานเป็น Excel และ PDF
 * ใช้ร่วมกันได้ระหว่างหลายหน้ารายงาน
 */
export function useReportExport() {
    /**
     * สร้าง jsPDF document พร้อม Sarabun font ไทย
     * @param {'landscape'|'portrait'} orientation
     */
    const createPdfDoc = (orientation = 'landscape') => {
        const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        doc.addFileToVFS('Sarabun-Regular.ttf', SarabunRegular);
        doc.addFileToVFS('Sarabun-Bold.ttf', SarabunBold);
        doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
        doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
        doc.setFont('Sarabun', 'normal');
        return doc;
    };

    /**
     * วาด title และ subtitle กลางหน้า
     * @param {jsPDF} doc
     * @param {string} title
     * @param {string} subtitle
     * @returns {number} Y position ถัดจาก subtitle
     */
    const drawPdfTitle = (doc, title, subtitle) => {
        const cx = doc.internal.pageSize.getWidth() / 2;
        doc.setFont('Sarabun', 'bold');
        doc.setFontSize(14);
        doc.text(title, cx, 14, { align: 'center' });
        doc.setFont('Sarabun', 'normal');
        doc.setFontSize(10);
        doc.text(subtitle, cx, 21, { align: 'center' });
        return 26;
    };

    /**
     * วาดเลขหน้า footer ทุกหน้า (ใช้ใน didDrawPage)
     * @param {jsPDF} doc
     * @param {object} data - autoTable didDrawPage data
     */
    const drawPageNumber = (doc, data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont('Sarabun', 'normal');
        doc.setFontSize(8);
        doc.text(`หน้า ${data.pageNumber} / ${pageCount}`, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
    };

    /**
     * Export ข้อมูลเป็น Excel
     * @param {object} options
     * @param {string[][]} options.headerRows - array ของ header rows (สำหรับ multi-level header)
     * @param {any[][]} options.dataRows - array ของข้อมูล
     * @param {object[]} options.merges - SheetJS merge config
     * @param {object[]} options.colWidths - SheetJS column width config
     * @param {string} options.sheetName
     * @param {string} options.filename
     */
    const exportToExcel = ({ headerRows, dataRows, merges = [], colWidths = [], sheetName = 'รายงาน', filename = 'รายงาน.xlsx' }) => {
        const wsData = [...headerRows, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        if (merges.length) ws['!merges'] = merges;
        if (colWidths.length) ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename);
    };

    /**
     * Export ข้อมูลเป็น PDF ด้วย autoTable
     * @param {object} options
     * @param {'landscape'|'portrait'} options.orientation
     * @param {string} options.title
     * @param {string} options.subtitle
     * @param {any[][]} options.head - autoTable head
     * @param {any[][]} options.body - autoTable body
     * @param {object} options.columnStyles - autoTable columnStyles
     * @param {number} options.marginH - horizontal margin (default 8)
     * @param {string} options.filename
     */
    const exportToPdf = ({ orientation = 'landscape', title, subtitle, head, body, columnStyles = {}, marginH = 8, filename = 'รายงาน.pdf' }) => {
        const doc = createPdfDoc(orientation);
        const startY = drawPdfTitle(doc, title, subtitle);
        const usableWidth = doc.internal.pageSize.getWidth() - marginH * 2;

        autoTable(doc, {
            head,
            body,
            startY,
            tableWidth: usableWidth,
            styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', font: 'Sarabun' },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center', fontStyle: 'bold' },
            columnStyles,
            didDrawPage: (data) => drawPageNumber(doc, data),
            margin: { top: 10, left: marginH, right: marginH }
        });

        doc.save(filename);
    };

    return { createPdfDoc, drawPdfTitle, drawPageNumber, exportToExcel, exportToPdf };
}
