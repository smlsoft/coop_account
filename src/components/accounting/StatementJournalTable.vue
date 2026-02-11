<script setup>
import ColumnGroup from 'primevue/columngroup';
import Row from 'primevue/row';
import Tag from 'primevue/tag';
import { ref } from 'vue';

const props = defineProps({
    journals: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const expandedRows = ref([]);

// Format currency
const formatCurrency = (value) => {
    if (!value) return '0.00';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

// Format วันที่เป็น dd/mm/yyyy (พ.ศ.)
const formatThaiDate = (dateValue) => {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear() + 543;

    return `${day}/${month}/${year}`;
};

// คำนวณยอดรวม
const getTotalDebit = (details) => {
    return details.reduce((sum, item) => sum + (item.debitamount || 0), 0);
};

const getTotalCredit = (details) => {
    return details.reduce((sum, item) => sum + (item.creditamount || 0), 0);
};

const getTotalAmount = () => {
    return props.journals.reduce((sum, journal) => sum + (journal.amount || 0), 0);
};

// Row class สำหรับ highlight ตาม validation status
const rowClass = (data) => {
    if (!data.periodValidation) {
        return ''; // ยังไม่มีการตรวจสอบ
    }

    // สีเขียว = valid, สีแดง = invalid
    return data.periodValidation.isValid ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
};
</script>

<template>
    <div class="journal-table-wrapper">
        <DataTable :value="journals" :loading="loading" v-model:expandedRows="expandedRows" dataKey="docno" :rowClass="rowClass" scrollable scrollHeight="flex" class="text-sm" responsiveLayout="scroll" :rowHover="true">
            <template #empty>
                <div class="text-center py-4 text-surface-500">
                    <i class="pi pi-inbox text-4xl mb-3"></i>
                    <p>ยังไม่มีรายการบัญชี</p>
                </div>
            </template>

            <template #loading> กำลังโหลดข้อมูล... </template>

            <Column :expander="true" style="width: 50px" />

            <Column field="docno" header="เลขที่เอกสาร" style="width: 200px">
                <template #body="{ data }">
                    <div :class="data.periodValidation?.isValid === false ? 'text-red-600 dark:text-red-400 font-medium' : data.periodValidation?.isValid ? 'text-green-700 dark:text-green-300' : ''">{{ data.docno }}</div>
                </template>
            </Column>

            <Column field="docdate" header="วันที่" style="width: 120px" class="text-center">
                <template #body="{ data }">
                    <div :class="data.periodValidation?.isValid === false ? 'text-red-600 dark:text-red-400 font-medium' : data.periodValidation?.isValid ? 'text-green-700 dark:text-green-300' : ''">{{ formatThaiDate(data.docdate) }}</div>
                </template>
            </Column>

            <Column field="accountperiod" header="งวด/ปี" style="width: 150px" class="text-center">
                <template #body="{ data }">
                    <Tag v-if="data.periodValidation?.isValid === false" severity="danger" :value="data.periodValidation?.message || 'ไม่ผ่าน'" class="text-xs" />
                    <Tag v-else-if="data.periodValidation?.isValid === true" severity="success" :value="`งวด ${data.accountperiod}`" class="text-xs" />
                    <span v-else class="text-surface-500">-</span>
                </template>
            </Column>

            <Column field="accountdescription" header="รายละเอียด" style="min-width: 250px">
                <template #body="{ data }">
                    <div :class="data.periodValidation?.isValid === false ? 'text-red-600 dark:text-red-400' : data.periodValidation?.isValid ? 'text-green-700 dark:text-green-300' : ''">{{ data.accountdescription }}</div>
                </template>
            </Column>

            <Column field="amount" header="มูลค่า" style="width: 150px" class="text-right" bodyStyle="text-align: right">
                <template #body="{ data }">
                    <span :class="data.periodValidation?.isValid === false ? 'text-red-600 dark:text-red-400 font-bold' : data.periodValidation?.isValid ? 'text-green-700 dark:text-green-400 font-medium' : 'font-medium'">
                        {{ formatCurrency(data.amount) }}
                    </span>
                </template>
            </Column>

            <ColumnGroup type="footer">
                <Row>
                    <Column :colspan="5" footerStyle="text-align: right">
                        <template #footer>
                            <span class="font-semibold text-sm">รวมทั้งหมด</span>
                        </template>
                    </Column>
                    <Column footerStyle="text-align: right">
                        <template #footer>
                            <span class="font-bold text-sm">{{ formatCurrency(getTotalAmount()) }}</span>
                        </template>
                    </Column>
                </Row>
            </ColumnGroup>

            <template #expansion="{ data }">
                <div class="p-4">
                    <h5 class="text-sm font-semibold mb-3 text-surface-700 dark:text-surface-300">รายละเอียดรายการ: {{ data.docno }}</h5>

                    <DataTable :value="data.journaldetail" class="text-sm">
                        <Column field="accountcode" header="รหัสบัญชี" style="width: 120px" />

                        <Column field="accountname" header="ชื่อบัญชี" style="min-width: 250px">
                            <template #footer>
                                <div class="font-semibold text-right">รวม</div>
                            </template>
                        </Column>

                        <Column field="debitamount" header="เดบิต" style="width: 150px" bodyClass="text-right">
                            <template #body="{ data }">
                                <span class="font-medium">{{ formatCurrency(data.debitamount) }}</span>
                            </template>
                            <template #footer>
                                <div class="font-semibold">{{ formatCurrency(getTotalDebit(data.journaldetail)) }}</div>
                            </template>
                        </Column>

                        <Column field="creditamount" header="เครดิต" style="width: 150px" bodyClass="text-right">
                            <template #body="{ data }">
                                <span class="font-medium">{{ formatCurrency(data.creditamount) }}</span>
                            </template>
                            <template #footer>
                                <div class="font-semibold">{{ formatCurrency(getTotalCredit(data.journaldetail)) }}</div>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </DataTable>
    </div>
</template>

<style scoped>
.journal-table-wrapper {
    height: 100%;
}

:deep(.p-datatable-thead) {
    position: sticky;
    top: 0;
    z-index: 1;
}

:deep(.p-datatable-tfoot) {
    position: sticky;
    bottom: 0;
    z-index: 1;
}

:deep(.p-datatable-tfoot > tr > td) {
    padding: 0.35rem 0.5rem;
}

:deep(.p-datatable-tbody > tr > td) {
    padding: 0.25rem 0.5rem;
}

:deep(.p-datatable-thead > tr > th) {
    padding: 0.35rem 0.5rem;
}

:deep(.p-row-toggler) {
    width: 1.5rem;
    height: 1.5rem;
}

/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
