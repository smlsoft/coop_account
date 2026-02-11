<script setup>
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    ocrData: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'test-again', 'apply-data']);

const toast = useToast();

// Expanded reasoning state per entry
const expandedReason = ref({});

const toggleReason = (idx) => {
    expandedReason.value[idx] = !expandedReason.value[idx];
};

// Parse OCR data
const parsedOcrData = computed(() => {
    if (!props.ocrData) return null;
    try {
        if (typeof props.ocrData === 'string') {
            return JSON.parse(props.ocrData);
        }
        return props.ocrData;
    } catch (error) {
        console.error('Failed to parse OCR data:', error);
        return null;
    }
});

const accountingEntry = computed(() => parsedOcrData.value?.accounting_entry || null);
const validation = computed(() => parsedOcrData.value?.validation || null);
const metadata = computed(() => parsedOcrData.value?.metadata || null);
const receipt = computed(() => parsedOcrData.value?.receipt || null);
const templateInfo = computed(() => parsedOcrData.value?.template_info || null);

// Confidence score
const confidenceScore = computed(() => validation.value?.confidence?.score || 0);
const confidenceLevel = computed(() => {
    if (confidenceScore.value >= 80) return { label: 'สูง', severity: 'success', icon: 'pi-check-circle', color: 'text-green-600' };
    if (confidenceScore.value >= 60) return { label: 'ปานกลาง', severity: 'warn', icon: 'pi-exclamation-triangle', color: 'text-orange-600' };
    return { label: 'ต่ำ', severity: 'danger', icon: 'pi-times-circle', color: 'text-red-600' };
});

// Issues
const issues = computed(() => validation.value?.review_requirements?.issues || []);
const hasIssues = computed(() => issues.value.length > 0);

// Format helpers
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
};

// Copy JSON
const formattedJson = computed(() => {
    if (!parsedOcrData.value) return '';
    return JSON.stringify(parsedOcrData.value, null, 2);
});

const copyJson = async () => {
    try {
        await navigator.clipboard.writeText(formattedJson.value);
        toast.add({ severity: 'success', summary: 'คัดลอกสำเร็จ', life: 2000 });
    } catch {
        toast.add({ severity: 'error', summary: 'ไม่สามารถคัดลอกได้', life: 3000 });
    }
};

// สร้างข้อมูลตัวอย่างสำหรับ JournalDetailPanel
const sampleJournalData = computed(() => {
    if (!accountingEntry.value) return null;

    return {
        docno: accountingEntry.value.reference_number || 'ตัวอย่าง',
        docdate: accountingEntry.value.document_date || new Date().toISOString().split('T')[0],
        journaldetail: (accountingEntry.value.entries || []).map((item) => ({
            accountcode: item.account_code || '',
            accountname: item.account_name || '',
            debitamount: item.debit || 0,
            creditamount: item.credit || 0
        }))
    };
});

// คำนวณยอดรวมเดบิตและเครดิต
const totalDebit = computed(() => {
    if (!sampleJournalData.value?.journaldetail) return 0;
    return sampleJournalData.value.journaldetail.reduce((sum, item) => sum + (item.debitamount || 0), 0);
});

const totalCredit = computed(() => {
    if (!sampleJournalData.value?.journaldetail) return 0;
    return sampleJournalData.value.journaldetail.reduce((sum, item) => sum + (item.creditamount || 0), 0);
});

const isBalanced = computed(() => {
    return Math.abs(totalDebit.value - totalCredit.value) < 0.01;
});

// Actions
const handleClose = () => emit('update:visible', false);
const handleTestAgain = () => emit('test-again');
const handleApplyData = () => {
    emit('apply-data');
    handleClose();
};
</script>

<template>
    <Dialog :visible="visible" :style="{ width: '95vw', maxHeight: '95vh' }" :modal="true" @update:visible="handleClose">
        <template #header>
            <div class="flex items-center gap-3">
                <i class="pi pi-sparkles text-2xl text-primary-500"></i>
                <div>
                    <div class="text-lg font-bold">ผลการวิเคราะห์เอกสาร & ตัวอย่างการบันทึกบัญชี</div>
                    <div class="text-sm text-surface-500 dark:text-surface-400">ตรวจสอบและเปรียบเทียบข้อมูล</div>
                </div>
            </div>
        </template>

        <!-- Empty state -->
        <div v-if="!parsedOcrData" class="flex flex-col items-center justify-center py-16">
            <i class="pi pi-exclamation-triangle text-5xl text-orange-500 mb-4"></i>
            <p class="text-surface-600 dark:text-surface-400">ไม่มีข้อมูล OCR</p>
        </div>

        <!-- Split Screen Layout -->
        <div v-else class="grid grid-cols-2 gap-4" style="height: calc(95vh - 200px)">
            <!-- LEFT PANEL: ผลการวิเคราะห์ OCR -->
            <div class="flex flex-col gap-4 overflow-auto pr-2 border-r border-surface-200 dark:border-surface-700">
                <!-- Section 1: สรุปเอกสาร -->
                <div class="flex flex-col gap-4">
                    <!-- Confidence + Cost bar -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <i :class="['pi', confidenceLevel.icon, confidenceLevel.color]"></i>
                            <span class="font-semibold">ความมั่นใจ:</span>
                            <Tag :value="`${confidenceScore}% (${confidenceLevel.label})`" :severity="confidenceLevel.severity" />
                        </div>
                        <div v-if="metadata?.token_usage?.total" class="text-sm text-surface-500 dark:text-surface-400">ค่าใช้จ่าย: {{ metadata.token_usage.total.cost_thb }}</div>
                    </div>

                    <!-- Document Info Card -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-surface-500 dark:text-surface-400">เลขที่เอกสาร</span>
                            <span class="font-semibold">{{ receipt?.number || accountingEntry?.reference_number || '-' }}</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-surface-500 dark:text-surface-400">วันที่</span>
                            <span class="font-semibold">{{ formatDate(receipt?.date || accountingEntry?.document_date) }}</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-surface-500 dark:text-surface-400">ผู้ขาย</span>
                            <span class="font-semibold">{{ receipt?.vendor_name || '-' }}</span>
                            <span v-if="receipt?.vendor_tax_id" class="text-xs text-surface-500 dark:text-surface-400">{{ receipt.vendor_tax_id }}</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-surface-500 dark:text-surface-400">วิธีชำระ</span>
                            <span class="font-semibold">{{ receipt?.payment_method || '-' }}</span>
                        </div>
                    </div>

                    <!-- Amount Summary -->
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-surface-500 dark:text-surface-400">ยอดรวม:</span>
                            <span class="font-bold text-xl">{{ formatCurrency(receipt?.total || accountingEntry?.balance_check?.total_debit || 0) }} ฿</span>
                        </div>
                        <Divider layout="vertical" class="mx-0" />
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-surface-500 dark:text-surface-400">VAT:</span>
                            <span class="font-semibold">{{ formatCurrency(receipt?.vat || 0) }} ฿</span>
                        </div>
                        <Divider layout="vertical" class="mx-0" />
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-surface-500 dark:text-surface-400">สมุดรายวัน:</span>
                            <span class="font-semibold">{{ accountingEntry?.journal_book_name || '-' }} ({{ accountingEntry?.journal_book_code || '-' }})</span>
                        </div>
                        <div v-if="templateInfo" class="flex items-center gap-2 ml-auto">
                            <span class="text-sm text-surface-500 dark:text-surface-400">Template:</span>
                            <Tag :value="templateInfo.template_name" severity="info" />
                        </div>
                    </div>
                </div>

                <Divider />

                <!-- Section 2: Issues / Warning -->
                <div v-if="hasIssues" class="flex flex-col gap-2">
                    <Message v-for="(issue, idx) in issues" :key="idx" :severity="issue.status === 'very_poor' ? 'error' : 'warn'" :closable="false">
                        <div class="flex items-center justify-between w-full">
                            <div>
                                <span class="font-semibold">{{ issue.issue }}</span>
                                <span class="ml-2 text-sm">- {{ issue.action }}</span>
                            </div>
                        </div>
                    </Message>
                </div>

                <!-- Section 3: ตารางรายการบัญชี -->
                <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-lg">รายการบัญชี</span>
                            <Tag :value="`${accountingEntry?.entries?.length || 0} รายการ`" severity="secondary" />
                        </div>
                        <div class="flex items-center gap-2">
                            <i class="pi" :class="accountingEntry?.balance_check?.balanced ? 'pi-check-circle text-green-600' : 'pi-times-circle text-red-600'"></i>
                            <span :class="accountingEntry?.balance_check?.balanced ? 'text-green-600' : 'text-red-600'" class="font-semibold text-sm">
                                {{ accountingEntry?.balance_check?.balanced ? 'สมดุล' : 'ไม่สมดุล' }}
                            </span>
                        </div>
                    </div>

                    <!-- Table -->
                    <DataTable :value="accountingEntry?.entries || []" size="small" stripedRows showGridlines>
                        <Column header="#" style="width: 3rem; text-align: center">
                            <template #body="{ index }">{{ index + 1 }}</template>
                        </Column>
                        <Column field="account_code" header="รหัสบัญชี" style="width: 8rem">
                            <template #body="{ data }">
                                <span class="font-mono font-semibold">{{ data.account_code }}</span>
                            </template>
                        </Column>
                        <Column field="account_name" header="ชื่อบัญชี">
                            <template #body="{ data, index }">
                                <div>
                                    <div class="font-medium">{{ data.account_name }}</div>
                                    <div v-if="data.description" class="text-xs text-surface-500 dark:text-surface-400">{{ data.description }}</div>
                                </div>
                                <!-- Expand/Collapse reason -->
                                <div v-if="data.selection_reason || data.side_reason" class="mt-1">
                                    <button class="text-xs text-primary-500 hover:underline cursor-pointer" @click="toggleReason(index)">
                                        <i :class="expandedReason[index] ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="text-xs mr-1"></i>
                                        {{ expandedReason[index] ? 'ซ่อนเหตุผล AI' : 'ดูเหตุผล AI' }}
                                    </button>
                                    <div v-if="expandedReason[index]" class="mt-2 p-2 bg-surface-100 dark:bg-surface-700 rounded text-xs space-y-1">
                                        <div v-if="data.selection_reason"><strong>เหตุผลเลือกบัญชี:</strong> {{ data.selection_reason }}</div>
                                        <div v-if="data.side_reason"><strong>เหตุผล Dr/Cr:</strong> {{ data.side_reason }}</div>
                                    </div>
                                </div>
                            </template>
                        </Column>
                        <Column field="debit" header="เดบิต" style="width: 8rem; text-align: right">
                            <template #body="{ data }">
                                <span v-if="data.debit > 0" class="font-semibold text-blue-600 dark:text-blue-400">{{ formatCurrency(data.debit) }}</span>
                                <span v-else class="text-surface-400">-</span>
                            </template>
                        </Column>
                        <Column field="credit" header="เครดิต" style="width: 8rem; text-align: right">
                            <template #body="{ data }">
                                <span v-if="data.credit > 0" class="font-semibold text-orange-600 dark:text-orange-400">{{ formatCurrency(data.credit) }}</span>
                                <span v-else class="text-surface-400">-</span>
                            </template>
                        </Column>

                        <!-- Footer row -->
                        <ColumnGroup type="footer">
                            <Row>
                                <Column footer="รวม" :colspan="3" footerStyle="text-align:right; font-weight:bold" />
                                <Column :footer="formatCurrency(accountingEntry?.balance_check?.total_debit || 0)" footerStyle="text-align:right; font-weight:bold; color: var(--p-blue-600)" />
                                <Column :footer="formatCurrency(accountingEntry?.balance_check?.total_credit || 0)" footerStyle="text-align:right; font-weight:bold; color: var(--p-orange-600)" />
                            </Row>
                        </ColumnGroup>
                    </DataTable>
                </div>

                <!-- Section 4: AI Explanation (collapsible) -->
                <Accordion v-if="validation?.ai_explanation" :value="null">
                    <AccordionPanel value="0">
                        <AccordionHeader>
                            <div class="flex items-center gap-2">
                                <i class="pi pi-comment text-primary-500"></i>
                                <span>คำอธิบายจาก AI</span>
                            </div>
                        </AccordionHeader>
                        <AccordionContent>
                            <div class="flex flex-col gap-3 text-sm">
                                <p>{{ validation.ai_explanation.reasoning }}</p>

                                <div v-if="validation.ai_explanation.risk_assessment" class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                    <div class="font-semibold mb-1">ความเสี่ยง: {{ validation.ai_explanation.risk_assessment.overall_risk }}</div>
                                    <div class="text-surface-600 dark:text-surface-400">{{ validation.ai_explanation.risk_assessment.factors }}</div>
                                    <div v-if="validation.ai_explanation.risk_assessment.recommendations" class="mt-1 text-surface-600 dark:text-surface-400">แนะนำ: {{ validation.ai_explanation.risk_assessment.recommendations }}</div>
                                </div>

                                <!-- Confidence Breakdown -->
                                <div v-if="validation.confidence_breakdown" class="flex flex-col gap-2">
                                    <div class="font-semibold">รายละเอียดคะแนน</div>
                                    <div v-for="(factor, key) in validation.confidence_breakdown.factors" :key="key" class="flex items-center gap-3">
                                        <span class="w-48 text-surface-600 dark:text-surface-400 truncate">{{ validation.confidence_breakdown.explanations?.[key] || key }}</span>
                                        <ProgressBar :value="factor" :showValue="false" style="width: 120px; height: 0.4rem" />
                                        <span class="w-10 text-right font-semibold">{{ factor }}%</span>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionPanel>
                </Accordion>

                <!-- Section 5: Raw JSON (collapsible) -->
                <Accordion :value="null">
                    <AccordionPanel value="0">
                        <AccordionHeader>
                            <div class="flex items-center gap-2">
                                <i class="pi pi-code text-surface-500"></i>
                                <span>JSON ต้นฉบับ</span>
                            </div>
                        </AccordionHeader>
                        <AccordionContent>
                            <div class="flex justify-end mb-2">
                                <Button label="คัดลอก" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyJson" />
                            </div>
                            <pre class="p-3 bg-surface-900 text-green-400 rounded-lg overflow-auto text-xs" style="max-height: 400px"><code>{{ formattedJson }}</code></pre>
                        </AccordionContent>
                    </AccordionPanel>
                </Accordion>
            </div>

            <!-- RIGHT PANEL: ตัวอย่างการบันทึกบัญชี -->
            <div class="flex flex-col gap-4 overflow-auto pl-2">
                <div class="flex items-center gap-2 mb-2">
                    <i class="pi pi-file-edit text-primary-500 text-xl"></i>
                    <span class="font-semibold text-lg">ตัวอย่างการบันทึกบัญชี</span>
                </div>

                <div v-if="sampleJournalData" class="flex flex-col gap-4">
                    <!-- Header Info -->
                    <div class="grid grid-cols-2 gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                        <div>
                            <label class="text-sm text-surface-500 dark:text-surface-400">เลขที่เอกสาร</label>
                            <div class="font-semibold">{{ sampleJournalData.docno }}</div>
                        </div>
                        <div>
                            <label class="text-sm text-surface-500 dark:text-surface-400">วันที่เอกสาร</label>
                            <div class="font-semibold">{{ formatDate(sampleJournalData.docdate) }}</div>
                        </div>
                    </div>

                    <!-- Journal Detail Table -->
                    <div class="overflow-auto flex-1">
                        <DataTable :value="sampleJournalData.journaldetail" showGridlines stripedRows size="small">
                            <Column field="accountcode" header="รหัสบัญชี" style="min-width: 120px">
                                <template #body="{ data }">
                                    <span class="font-semibold text-primary">{{ data.accountcode }}</span>
                                </template>
                            </Column>
                            <Column field="accountname" header="ชื่อบัญชี" style="min-width: 250px">
                                <template #body="{ data }">
                                    <span>{{ data.accountname || '-' }}</span>
                                </template>
                            </Column>
                            <Column field="debitamount" header="เดบิต" style="min-width: 150px">
                                <template #body="{ data }">
                                    <div class="text-right font-semibold" :class="data.debitamount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-surface-400'">
                                        {{ data.debitamount > 0 ? formatCurrency(data.debitamount) : '-' }}
                                    </div>
                                </template>
                            </Column>
                            <Column field="creditamount" header="เครดิต" style="min-width: 150px">
                                <template #body="{ data }">
                                    <div class="text-right font-semibold" :class="data.creditamount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-surface-400'">
                                        {{ data.creditamount > 0 ? formatCurrency(data.creditamount) : '-' }}
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>

                    <!-- Summary Footer -->
                    <div class="flex justify-end gap-8 p-4 border-t-2 border-primary-500 bg-surface-50 dark:bg-surface-800 rounded-lg">
                        <div class="flex flex-col items-end">
                            <label class="text-sm text-surface-500 dark:text-surface-400">รวมเดบิต</label>
                            <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(totalDebit) }}</div>
                        </div>
                        <div class="flex flex-col items-end">
                            <label class="text-sm text-surface-500 dark:text-surface-400">รวมเครดิต</label>
                            <div class="text-xl font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(totalCredit) }}</div>
                        </div>
                        <div class="flex flex-col items-end">
                            <label class="text-sm text-surface-500 dark:text-surface-400">สถานะ</label>
                            <div class="flex items-center gap-2">
                                <i class="pi text-xl" :class="isBalanced ? 'pi-check-circle text-green-600' : 'pi-times-circle text-red-600'"></i>
                                <span class="text-lg" :class="isBalanced ? 'text-green-600 font-bold' : 'text-red-600 font-bold'">{{ isBalanced ? 'สมดุล' : 'ไม่สมดุล' }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="flex flex-col items-center justify-center py-16">
                    <i class="pi pi-inbox text-5xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">ไม่มีข้อมูลสำหรับสร้างตัวอย่าง</p>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center w-full">
                <Button label="ปิด" icon="pi pi-times" text severity="secondary" @click="handleClose" />
                <div class="flex gap-2">
                    <Button label="ทดสอบใหม่" icon="pi pi-refresh" severity="secondary" outlined @click="handleTestAgain" />
                    <Button label="นำข้อมูลไปใช้" icon="pi pi-check" severity="success" @click="handleApplyData" :disabled="!accountingEntry" />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
pre {
    font-family: 'Courier New', Courier, monospace;
    line-height: 1.4;
}
</style>
