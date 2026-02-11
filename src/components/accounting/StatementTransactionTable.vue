<script setup>
import ColumnGroup from 'primevue/columngroup';
import Row from 'primevue/row';
import { computed } from 'vue';

const props = defineProps({
    transactions: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});

// คำนวณสรุปยอด
const summary = computed(() => {
    let totalDeposit = 0;
    let totalWithdraw = 0;
    let countDeposit = 0;
    let countWithdraw = 0;
    let lastBalance = null;

    props.transactions.forEach((tx) => {
        if (tx.deposit) {
            const depositValue = parseFloat(String(tx.deposit).replace(/,/g, ''));
            if (!isNaN(depositValue) && depositValue > 0) {
                totalDeposit += depositValue;
                countDeposit++;
            }
        }

        if (tx.withdraw) {
            const withdrawValue = parseFloat(String(tx.withdraw).replace(/,/g, ''));
            if (!isNaN(withdrawValue) && withdrawValue > 0) {
                totalWithdraw += withdrawValue;
                countWithdraw++;
            }
        }

        if (tx.balance) {
            const balanceValue = parseFloat(String(tx.balance).replace(/,/g, ''));
            if (!isNaN(balanceValue)) {
                lastBalance = balanceValue;
            }
        }
    });

    return {
        totalDeposit,
        totalWithdraw,
        countDeposit,
        countWithdraw,
        lastBalance
    };
});

// Format number เป็นทศนิยม 2 ตำแหน่ง
const formatCurrency = (value) => {
    if (!value || value === '') return '';

    const numStr = String(value).replace(/,/g, '');
    const num = parseFloat(numStr);

    if (isNaN(num)) return value;

    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

// Format วันที่เป็น dd/mm/yyyy (พ.ศ.)
const formatThaiDate = (dateValue) => {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear() + 543; // แปลงเป็น พ.ศ.

    return `${day}/${month}/${year}`;
};
</script>

<template>
    <div class="statement-table-wrapper">
        <DataTable :value="transactions" :loading="loading" scrollable scrollHeight="flex" class="text-sm" responsiveLayout="scroll" :rowHover="true">
            <template #empty>
                <div class="text-center py-4 text-surface-500">
                    <i class="pi pi-inbox text-4xl mb-3"></i>
                    <p>ไม่มีข้อมูล Statement</p>
                </div>
            </template>

            <template #loading> กำลังโหลดข้อมูล... </template>

            <Column field="index" header="ลำดับ" style="width: 80px" class="text-center" frozen>
                <template #body="{ index }">
                    {{ index + 1 }}
                </template>
            </Column>

            <Column field="date" header="วันที่" style="width: 120px" class="text-center">
                <template #body="{ data }">
                    {{ formatThaiDate(data.date) }}
                </template>
            </Column>

            <Column field="description" header="รายการ" style="min-width: 250px">
                <template #body="{ data }">
                    <div>{{ data.description }}</div>
                    <div v-if="data.detail" class="text-xs text-surface-500 mt-1">{{ data.detail }}</div>
                </template>
            </Column>

            <Column field="deposit" header="เงินเข้า" style="width: 130px" bodyClass="text-right" bodyStyle="text-align: right">
                <template #body="{ data }">
                    <span v-if="data.deposit" class="text-green-600 font-medium">{{ formatCurrency(data.deposit) }}</span>
                </template>
            </Column>

            <Column field="withdraw" header="เงินออก" style="width: 130px" bodyClass="text-right" bodyStyle="text-align: right">
                <template #body="{ data }">
                    <span v-if="data.withdraw" class="text-red-600 font-medium">{{ formatCurrency(data.withdraw) }}</span>
                </template>
            </Column>

            <Column field="balance" header="คงเหลือ" style="width: 130px" bodyClass="text-right" bodyStyle="text-align: right">
                <template #body="{ data }">
                    {{ formatCurrency(data.balance) }}
                </template>
            </Column>

            <ColumnGroup type="footer">
                <Row>
                    <Column :colspan="3" class="text-sm" footerStyle="text-align: left">
                        <template #footer>
                            <span class="font-semibold">ทั้งหมด {{ transactions.length }} รายการ</span>
                            <span class="text-surface-500 ml-2">(เข้า {{ summary.countDeposit }} / ออก {{ summary.countWithdraw }})</span>
                        </template>
                    </Column>
                    <Column footerStyle="text-align: right">
                        <template #footer>
                            <span class="text-green-600 font-semibold text-sm">{{ formatCurrency(summary.totalDeposit) }}</span>
                        </template>
                    </Column>
                    <Column footerStyle="text-align: right">
                        <template #footer>
                            <span class="text-red-600 font-semibold text-sm">{{ formatCurrency(summary.totalWithdraw) }}</span>
                        </template>
                    </Column>
                    <Column footerStyle="text-align: right">
                        <template #footer>
                            <span class="font-bold text-sm">{{ formatCurrency(summary.lastBalance) }}</span>
                        </template>
                    </Column>
                </Row>
            </ColumnGroup>
        </DataTable>
    </div>
</template>

<style scoped>
.statement-table-wrapper {
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

/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
