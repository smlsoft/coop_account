<script setup>
import ImageZoomViewer from '@/components/image/ImageZoomViewer.vue';
import PdfViewer from '@/components/image/PdfViewer.vue';
import { getDocumentImageGroup } from '@/services/api/image';
import { getJournalBooks, getJournalByDocno } from '@/services/api/journal';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    docno: {
        type: String,
        default: ''
    }
});

const router = useRouter();

const journal = ref(null);
const loading = ref(false);
const documentImages = ref([]);
const loadingImages = ref(false);
const currentImageIndex = ref(0);

// Masterdata
const journalBooks = ref([]);

// Fetch masterdata on component mount
const fetchMasterdata = async () => {
    try {
        const response = await getJournalBooks();
        if (response.data?.success) {
            journalBooks.value = response.data.data || [];
        }
    } catch (error) {
        console.error('Failed to fetch journal books:', error);
    }
};

fetchMasterdata();

const fetchJournalData = async (docno) => {
    loading.value = true;
    try {
        const response = await getJournalByDocno(docno);
        if (response.data?.success && response.data?.data) {
            journal.value = response.data.data;
            // Fetch images if documentref exists
            if (journal.value.documentref) {
                await fetchDocumentImages(journal.value.documentref);
            }
        }
    } catch (error) {
        console.error('Failed to fetch journal data:', error);
        journal.value = null;
    } finally {
        loading.value = false;
    }
};

const fetchDocumentImages = async (documentRef) => {
    loadingImages.value = true;
    try {
        const response = await getDocumentImageGroup(documentRef);
        if (response.data?.success && response.data?.data?.imagereferences) {
            documentImages.value = response.data.data.imagereferences;
        }
    } catch (error) {
        console.error('Failed to fetch document images:', error);
        documentImages.value = [];
    } finally {
        loadingImages.value = false;
    }
};

// Watch docno changes to fetch journal data
watch(
    () => props.docno,
    async (newDocno) => {
        if (newDocno) {
            await fetchJournalData(newDocno);
        } else {
            journal.value = null;
            documentImages.value = [];
        }
        currentImageIndex.value = 0;
    },
    { immediate: true }
);

const formatDate = (dateString) => {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const getTotalDebit = computed(() => {
    return journal.value?.journaldetail?.reduce((sum, item) => sum + (item.debitamount || 0), 0) || 0;
});

const getTotalCredit = computed(() => {
    return journal.value?.journaldetail?.reduce((sum, item) => sum + (item.creditamount || 0), 0) || 0;
});

const isBalanced = computed(() => {
    return Math.abs(getTotalDebit.value - getTotalCredit.value) < 0.01;
});

const hasVatData = computed(() => {
    return journal.value?.vats && journal.value.vats.length > 0;
});

const hasTaxData = computed(() => {
    return journal.value?.taxes && journal.value.taxes.length > 0;
});

const hasCreditor = computed(() => {
    return journal.value?.creditor?.guidfixed;
});

const hasDebtor = computed(() => {
    return journal.value?.debtor?.guidfixed;
});

const getCreditorName = computed(() => {
    const names = journal.value?.creditor?.names;
    if (names && names.length > 0) {
        const thName = names.find((n) => n.code === 'th');
        return thName?.name || names[0]?.name || '-';
    }
    return '-';
});

const getDebtorName = computed(() => {
    const names = journal.value?.debtor?.names;
    if (names && names.length > 0) {
        const thName = names.find((n) => n.code === 'th');
        return thName?.name || names[0]?.name || '-';
    }
    return '-';
});

// Get book name from masterdata
const getBookName = (bookcode) => {
    if (!bookcode) return '-';
    const book = journalBooks.value.find((b) => b.code === bookcode);
    return book?.name1 || bookcode;
};

// Journal type: 0=ทั่วไป, 1=ปิดบัญชี
const getJournalTypeName = (journaltype) => {
    if (journaltype === 0) return 'ทั่วไป';
    if (journaltype === 1) return 'ปิดบัญชี';
    return '-';
};

// VAT type: แสดงตามประเภทภาษี (vatmode)
// vatmode = 0 (ภาษีซื้อ): 0=ปกติ, 1=ขอคืนไม่ได้, 2=ไม่ถึงกำหนดชำระ
// vatmode = 1 (ภาษีขาย): 0=ปกติ, 1=ไม่ถึงกำหนดชำระ
const getVatTypeName = (vattype, vatmode) => {
    if (vatmode === 0) {
        // ภาษีซื้อ
        if (vattype === 0) return 'ปกติ';
        if (vattype === 1) return 'ขอคืนไม่ได้';
        if (vattype === 2) return 'ไม่ถึงกำหนดชำระ';
    } else if (vatmode === 1) {
        // ภาษีขาย
        if (vattype === 0) return 'ปกติ';
        if (vattype === 1) return 'ไม่ถึงกำหนดชำระ';
    }
    return '-';
};

// VAT mode: 0=ภาษีซื้อ, 1=ภาษีขาย
const getVatModeName = (vatmode) => {
    if (vatmode === 0) return 'ภาษีซื้อ';
    if (vatmode === 1) return 'ภาษีขาย';
    return '-';
};

// Tax type: 0=ภาษีถูกหัก, 1=ภาษีหัก
const getTaxTypeName = (taxtype) => {
    if (taxtype === 0) return 'ถูกหัก ณ ที่จ่าย';
    if (taxtype === 1) return 'หัก ณ ที่จ่าย';
    return '-';
};

// Customer type: 0=บุคคลธรรมดา, 1=นิติบุคคล
const getCustomerTypeName = (custtype) => {
    if (custtype === 0) return 'บุคคลธรรมดา';
    if (custtype === 1) return 'นิติบุคคล';
    return '-';
};

// Organization: 0=สำนักงานใหญ่, 1=สาขา
const getOrganizationName = (org) => {
    if (org === 0) return 'สำนักงานใหญ่';
    if (org === 1) return 'สาขา';
    return '-';
};

// Total VAT calculations
const getTotalVatBase = computed(() => {
    return journal.value?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.vatbase) || 0), 0) || 0;
});

const getTotalVatAmount = computed(() => {
    return journal.value?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.vatamount) || 0), 0) || 0;
});

const getTotalExceptVat = computed(() => {
    return journal.value?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.exceptvat) || 0), 0) || 0;
});

// Total WHT calculations
const getTotalWhtBase = computed(() => {
    return (
        journal.value?.taxes?.reduce((sum, tax) => {
            const detailSum = tax.details?.reduce((s, d) => s + (parseFloat(d.taxbase) || 0), 0) || 0;
            return sum + detailSum;
        }, 0) || 0
    );
});

const getTotalWhtAmount = computed(() => {
    return (
        journal.value?.taxes?.reduce((sum, tax) => {
            const detailSum = tax.details?.reduce((s, d) => s + (parseFloat(d.taxamount) || 0), 0) || 0;
            return sum + detailSum;
        }, 0) || 0
    );
});

// Get tax entry total
const getTaxTotal = (tax) => {
    if (!tax.details || tax.details.length === 0) return { base: 0, amount: 0 };
    return {
        base: tax.details.reduce((sum, d) => sum + (parseFloat(d.taxbase) || 0), 0),
        amount: tax.details.reduce((sum, d) => sum + (parseFloat(d.taxamount) || 0), 0)
    };
};

// Carousel functions
const currentImageRef = computed(() => {
    if (!documentImages.value?.length) return null;
    return documentImages.value[currentImageIndex.value];
});

const totalImages = computed(() => {
    return documentImages.value?.length || 0;
});

const canGoPrev = computed(() => currentImageIndex.value > 0);
const canGoNext = computed(() => currentImageIndex.value < totalImages.value - 1);

const prevImage = () => {
    if (canGoPrev.value) {
        currentImageIndex.value--;
    }
};

const nextImage = () => {
    if (canGoNext.value) {
        currentImageIndex.value++;
    }
};

const isPDF = (uri) => {
    if (!uri) return false;
    return uri.toLowerCase().endsWith('.pdf');
};

// Navigate to edit page
const navigateToEdit = () => {
    if (journal.value?.guidfixed) {
        router.push(`/accounting/entry/${journal.value.guidfixed}`);
    }
};
</script>

<template>
    <div class="journal-detail-panel">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
            <span class="ml-3 text-surface-500">กำลังโหลดข้อมูล...</span>
        </div>

        <!-- Content -->
        <div v-else-if="journal" class="panel-container flex gap-4">
            <!-- Left Panel: Document Image (แสดงเฉพาะเมื่อกำลังโหลดหรือมีรูป) -->
            <div v-if="loadingImages || documentImages.length > 0" class="w-2/5 flex flex-col bg-surface-50 dark:bg-surface-900 rounded-lg overflow-hidden">
                <div class="flex-1 p-3 flex flex-col">
                    <div v-if="loadingImages" class="flex items-center justify-center flex-1">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                    </div>

                    <div v-else-if="documentImages.length > 0" class="flex-1">
                        <div class="h-full rounded-lg overflow-hidden relative bg-surface-100 dark:bg-surface-800">
                            <ImageZoomViewer v-if="currentImageRef && !isPDF(currentImageRef.imageuri)" :key="`img-${currentImageIndex}`" :src="currentImageRef.imageuri" :alt="currentImageRef.name || 'Document'" />
                            <PdfViewer v-else-if="currentImageRef && isPDF(currentImageRef.imageuri)" :key="`pdf-${currentImageIndex}`" :src="currentImageRef.imageuri" />

                            <template v-if="totalImages > 1">
                                <Button icon="pi pi-chevron-left" class="carousel-nav carousel-nav-left" severity="secondary" rounded size="small" :disabled="!canGoPrev" @click="prevImage" />
                                <Button icon="pi pi-chevron-right" class="carousel-nav carousel-nav-right" severity="secondary" rounded size="small" :disabled="!canGoNext" @click="nextImage" />
                                <div class="carousel-counter">{{ currentImageIndex + 1 }} / {{ totalImages }}</div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Details (ขยายเต็มความกว้างเมื่อไม่มีรูป) -->
            <div :class="[loadingImages || documentImages.length > 0 ? 'w-3/5' : 'w-full px-6', 'flex flex-col overflow-hidden']">
                <!-- Header with Edit Button -->
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <div class="text-xl font-bold text-surface-900 dark:text-surface-0">รายละเอียดการบันทึกบัญชี</div>
                        <p class="text-sm text-surface-500 dark:text-surface-400">{{ journal.docno }}</p>
                    </div>
                    <Button label="แก้ไข" icon="pi pi-pencil" severity="primary" @click="navigateToEdit" :disabled="!journal?.guidfixed" />
                </div>

                <!-- Summary Cards -->
                <div class="mb-3">
                    <div class="grid grid-cols-4 gap-2">
                        <div class="bg-primary-50 dark:bg-primary-900/30 p-4 rounded-xl border border-primary-200 dark:border-primary-700">
                            <div class="text-sm text-primary-600 dark:text-primary-400">ยอดรวม</div>
                            <div class="text-2xl font-bold text-primary-700 dark:text-primary-300">{{ formatCurrency(journal.amount) }}</div>
                            <div class="text-xs text-primary-600/70 dark:text-primary-400/70 mt-1">{{ journal.docformat || '-' }}</div>
                        </div>

                        <div class="bg-surface-100 dark:bg-surface-700 p-4 rounded-xl">
                            <div class="text-sm text-surface-500 dark:text-surface-400">Debit / Credit</div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(getTotalDebit) }}</span>
                                <span class="text-surface-400">/</span>
                                <span class="text-lg font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(getTotalCredit) }}</span>
                            </div>
                            <Tag :value="isBalanced ? 'สมดุล' : 'ไม่สมดุล'" :severity="isBalanced ? 'success' : 'danger'" class="mt-2" />
                        </div>

                        <div class="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
                            <div class="text-sm text-green-600 dark:text-green-400">ภาษีมูลค่าเพิ่ม</div>
                            <div class="text-2xl font-bold text-green-700 dark:text-green-300">{{ formatCurrency(getTotalVatAmount) }}</div>
                            <div class="text-xs text-green-600/70 mt-1">{{ journal.vats?.length || 0 }} รายการ</div>
                        </div>

                        <div class="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-xl">
                            <div class="text-sm text-orange-600 dark:text-orange-400">ภาษีหัก ณ ที่จ่าย</div>
                            <div class="text-2xl font-bold text-orange-700 dark:text-orange-300">{{ formatCurrency(getTotalWhtAmount) }}</div>
                            <div class="text-xs text-orange-600/70 mt-1">{{ journal.taxes?.length || 0 }} รายการ</div>
                        </div>
                    </div>
                </div>

                <!-- Tabs Content -->
                <div class="flex-1 overflow-hidden flex flex-col">
                    <Tabs value="0" class="flex-1 flex flex-col">
                        <TabList>
                            <Tab value="0">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-calendar text-sm"></i>
                                    <span>ข้อมูลรายวัน</span>
                                </div>
                            </Tab>
                            <Tab value="1" :disabled="!hasVatData">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-file-edit text-sm"></i>
                                    <span>ข้อมูลภาษี</span>
                                    <Badge v-if="hasVatData" :value="journal.vats?.length || 0" severity="success" />
                                </div>
                            </Tab>
                            <Tab value="2" :disabled="!hasTaxData">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-percentage text-sm"></i>
                                    <span>ภาษีถูกหัก ณ ที่จ่าย</span>
                                    <Badge v-if="hasTaxData" :value="journal.taxes?.length || 0" severity="warn" />
                                </div>
                            </Tab>
                        </TabList>
                        <TabPanels>
                            <!-- Tab 0: ข้อมูลรายวัน -->
                            <TabPanel value="0" class="flex-1 overflow-hidden">
                                <div class="p-3 overflow-auto h-full">
                                    <div class="grid grid-cols-12 gap-3">
                                        <!-- Row 1 -->
                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">วันที่เอกสาร</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                {{ formatDate(journal.docdate) }}
                                            </div>
                                        </div>

                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">เลขที่เอกสาร</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded font-bold text-sm text-primary-600 dark:text-primary-400">
                                                {{ journal.docno }}
                                            </div>
                                        </div>

                                        <div class="col-span-12 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">สมุดรายวัน</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                <span class="text-sm text-primary-600 dark:text-primary-400">{{ journal.bookcode }}</span>
                                                <span class="text-surface-500 dark:text-surface-400 mx-1">~</span>
                                                <span>{{ getBookName(journal.bookcode) }}</span>
                                            </div>
                                        </div>

                                        <!-- Row 2 -->
                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">ประเภท</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded">
                                                <Tag :value="journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้'" :severity="journal.debtaccounttype === 1 ? 'warn' : 'info'" />
                                            </div>
                                        </div>

                                        <div class="col-span-12 sm:col-span-6 md:col-span-8">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">
                                                {{ journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้' }}
                                            </label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                <template v-if="hasCreditor || hasDebtor">
                                                    <span class="text-sm text-primary-600 dark:text-primary-400">{{ hasCreditor ? journal.creditor.code : journal.debtor.code }}</span>
                                                    <span class="text-surface-500 dark:text-surface-400 mx-1">~</span>
                                                    <span>{{ hasCreditor ? getCreditorName : getDebtorName }}</span>
                                                </template>
                                                <span v-else class="text-surface-400">-</span>
                                            </div>
                                        </div>

                                        <!-- Row 3 -->
                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">วันที่เอกสารอ้างอิง</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                {{ formatDate(journal.exdocrefdate) }}
                                            </div>
                                        </div>

                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">เลขที่เอกสารอ้างอิง</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                {{ journal.exdocrefno || '-' }}
                                            </div>
                                        </div>

                                        <div class="col-span-12 sm:col-span-6 md:col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">ประเภทรายการ</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded">
                                                <Tag :value="getJournalTypeName(journal.journaltype)" :severity="journal.journaltype === 0 ? 'secondary' : 'warn'" />
                                            </div>
                                        </div>

                                        <!-- Row 4 -->
                                        <div class="col-span-12">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">คำอธิบาย</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded min-h-[50px] text-sm text-surface-900 dark:text-surface-0">
                                                {{ journal.accountdescription || '-' }}
                                            </div>
                                        </div>

                                        <!-- Row 5: รายละเอียดบัญชี -->
                                        <div class="col-span-12 mt-2">
                                            <div class="flex justify-between items-center mb-2">
                                                <label class="font-medium text-base text-surface-900 dark:text-surface-0">รายละเอียดบัญชี</label>
                                                <div v-if="journal.docformat" class="text-sm">
                                                    <span class="text-surface-500 dark:text-surface-400">รูปแบบ:</span>
                                                    <Tag :value="journal.docformat" severity="info" class="ml-2" />
                                                </div>
                                            </div>

                                            <DataTable :value="journal.journaldetail" showGridlines class="text-sm">
                                                <Column header="#" style="width: 50px" bodyStyle="text-align: center">
                                                    <template #body="{ index }">
                                                        {{ index + 1 }}
                                                    </template>
                                                </Column>
                                                <Column field="accountcode" header="รหัสบัญชี" style="width: 110px">
                                                    <template #body="{ data }">
                                                        <span class="font-bold text-primary-600 dark:text-primary-400">{{ data.accountcode }}</span>
                                                    </template>
                                                </Column>
                                                <Column field="accountname" header="ชื่อบัญชี" style="min-width: 180px">
                                                    <template #body="{ data }">
                                                        <span class="text-surface-600 dark:text-surface-400">{{ data.accountname || '-' }}</span>
                                                    </template>
                                                </Column>
                                                <Column header="เดบิต" style="width: 120px">
                                                    <template #body="{ data }">
                                                        <div class="text-right">
                                                            <span v-if="data.debitamount > 0" class="font-semibold text-primary-600 dark:text-primary-400">
                                                                {{ formatCurrency(data.debitamount) }}
                                                            </span>
                                                            <span v-else class="text-surface-300">-</span>
                                                        </div>
                                                    </template>
                                                </Column>
                                                <Column header="เครดิต" style="width: 120px">
                                                    <template #body="{ data }">
                                                        <div class="text-right">
                                                            <span v-if="data.creditamount > 0" class="font-semibold text-blue-600 dark:text-blue-400">
                                                                {{ formatCurrency(data.creditamount) }}
                                                            </span>
                                                            <span v-else class="text-surface-300">-</span>
                                                        </div>
                                                    </template>
                                                </Column>

                                                <template #empty>
                                                    <div class="text-center py-6 text-surface-500">
                                                        <i class="pi pi-inbox text-3xl mb-2 block"></i>
                                                        <p>ไม่มีรายการบัญชี</p>
                                                    </div>
                                                </template>

                                                <template #footer>
                                                    <div class="flex justify-end gap-4 py-1 text-xs font-semibold">
                                                        <div class="flex items-center gap-1">
                                                            <span class="text-surface-600 dark:text-surface-400">รวมเดบิต:</span>
                                                            <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalDebit) }}</span>
                                                        </div>
                                                        <div class="flex items-center gap-1">
                                                            <span class="text-surface-600 dark:text-surface-400">รวมเครดิต:</span>
                                                            <span class="text-blue-600 dark:text-blue-400">{{ formatCurrency(getTotalCredit) }}</span>
                                                        </div>
                                                        <div class="flex items-center gap-1">
                                                            <span class="text-surface-600 dark:text-surface-400">ผลต่าง:</span>
                                                            <span :class="isBalanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                                                                {{ formatCurrency(getTotalDebit - getTotalCredit) }}
                                                            </span>
                                                            <i v-if="isBalanced" class="pi pi-check-circle text-green-600 dark:text-green-400"></i>
                                                            <i v-else class="pi pi-exclamation-triangle text-red-600 dark:text-red-400"></i>
                                                        </div>
                                                    </div>
                                                </template>
                                            </DataTable>
                                        </div>
                                    </div>
                                </div>
                            </TabPanel>

                            <!-- Tab 1: ข้อมูลภาษี -->
                            <TabPanel value="1" class="flex-1 overflow-hidden">
                                <div class="p-3 overflow-auto h-full">
                                    <!-- Header -->
                                    <div class="flex justify-between items-center mb-3">
                                        <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">รายการภาษี</h3>
                                    </div>

                                    <!-- Summary -->
                                    <div v-if="hasVatData" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700 mb-3">
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ journal.vats.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalVatBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมยอดภาษี</div>
                                                <div class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalVatAmount) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมยกเว้นภาษี</div>
                                                <div class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalExceptVat) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-if="!hasVatData" class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
                                        <i class="pi pi-file-edit text-5xl text-surface-400 dark:text-surface-600 mb-3"></i>
                                        <h3 class="text-lg font-semibold mb-2 text-surface-700 dark:text-surface-300">ไม่มีรายการภาษี</h3>
                                        <p class="text-sm text-surface-500 dark:text-surface-400">ไม่มีข้อมูลภาษีมูลค่าเพิ่มสำหรับรายการนี้</p>
                                    </div>

                                    <!-- VAT Entries -->
                                    <div v-else class="space-y-3">
                                        <Card v-for="(vat, index) in journal.vats" :key="index" class="border border-surface-200 dark:border-surface-700">
                                            <template #title>
                                                <div class="flex justify-between items-center">
                                                    <span class="text-sm">รายการที่ {{ index + 1 }}</span>
                                                    <div class="text-right">
                                                        <div class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(vat.vatamount) }}</div>
                                                        <div class="text-xs text-surface-500 dark:text-surface-400">ฐานภาษี {{ formatCurrency(vat.vatbase) }} × {{ vat.vatrate }}%</div>
                                                    </div>
                                                </div>
                                            </template>
                                            <template #content>
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <!-- วันที่ใบกำกับ -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">วันที่ใบกำกับ</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ formatDate(vat.vatdate) }}
                                                        </div>
                                                    </div>

                                                    <!-- เลขที่ใบกำกับ -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">เลขที่ใบกำกับ</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.vatdocno || '-' }}
                                                        </div>
                                                    </div>

                                                    <!-- ชื่อ -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ชื่อ</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.custname || '-' }}
                                                        </div>
                                                    </div>

                                                    <!-- เลขประจำตัวผู้เสียภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">เลขประจำตัวผู้เสียภาษี/เลขที่บัตรประชาชน</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.custtaxid || '-' }}
                                                        </div>
                                                    </div>

                                                    <!-- สถานประกอบการ -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">สถานประกอบการ</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                            {{ getOrganizationName(vat.organization) }}
                                                        </div>
                                                    </div>

                                                    <!-- ลำดับที่สาขา -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ลำดับที่สาขา</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.branchcode || '00000' }}
                                                        </div>
                                                    </div>

                                                    <!-- ปีภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ปีภาษี (พ.ศ.)</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.vatyear || '-' }}
                                                        </div>
                                                    </div>

                                                    <!-- เดือนภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">เดือนภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.vatperiod || '-' }}
                                                        </div>
                                                    </div>

                                                    <!-- ฐานภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ฐานภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ formatCurrency(vat.vatbase) }}
                                                        </div>
                                                    </div>

                                                    <!-- อัตราภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">อัตราภาษี (%)</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">{{ vat.vatrate || 0 }} %</div>
                                                    </div>

                                                    <!-- ภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded">
                                                            <Tag :value="getVatTypeName(vat.vattype, vat.vatmode)" :severity="vat.vattype === 0 ? 'info' : 'success'" />
                                                        </div>
                                                    </div>

                                                    <!-- ประเภทภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ประเภทภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded">
                                                            <Tag :value="getVatModeName(vat.vatmode)" :severity="vat.vatmode === 0 ? 'secondary' : 'warn'" />
                                                        </div>
                                                    </div>

                                                    <!-- ยอดภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ยอดภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-bold text-sm text-primary-600 dark:text-primary-400">
                                                            {{ formatCurrency(vat.vatamount) }}
                                                        </div>
                                                    </div>

                                                    <!-- ยอดยกเว้นภาษี -->
                                                    <div class="flex flex-col gap-1">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ยอดยกเว้นภาษี</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                            {{ formatCurrency(vat.exceptvat) }}
                                                        </div>
                                                    </div>

                                                    <!-- หมายเหตุ (full width) -->
                                                    <div v-if="vat.remark" class="flex flex-col gap-1 md:col-span-2">
                                                        <label class="font-medium text-xs text-surface-600 dark:text-surface-400">หมายเหตุ</label>
                                                        <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                            {{ vat.remark }}
                                                        </div>
                                                    </div>

                                                    <!-- ยื่นเพิ่ม -->
                                                    <div class="flex items-center gap-2 md:col-span-2">
                                                        <i :class="vat.vatsubmit ? 'pi pi-check-circle text-green-500' : 'pi pi-circle text-surface-400'" class="text-base"></i>
                                                        <span class="font-medium text-xs text-surface-900 dark:text-surface-0">ยื่นเพิ่ม</span>
                                                    </div>
                                                </div>
                                            </template>
                                        </Card>
                                    </div>
                                </div>
                            </TabPanel>

                            <!-- Tab 2: ภาษีถูกหัก ณ ที่จ่าย -->
                            <TabPanel value="2" class="flex-1 overflow-hidden">
                                <div class="p-3 overflow-auto h-full">
                                    <!-- Header -->
                                    <div class="flex justify-between items-center mb-3">
                                        <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">ภาษีหัก ณ ที่จ่าย</h3>
                                    </div>

                                    <!-- Summary -->
                                    <div v-if="hasTaxData" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700 mb-3">
                                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ journal.taxes.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalWhtBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมภาษีหัก ณ ที่จ่าย</div>
                                                <div class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalWhtAmount) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-if="!hasTaxData" class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
                                        <i class="pi pi-percentage text-5xl text-surface-400 dark:text-surface-600 mb-3"></i>
                                        <h3 class="text-lg font-semibold mb-2 text-surface-700 dark:text-surface-300">ไม่มีรายการภาษีหัก ณ ที่จ่าย</h3>
                                        <p class="text-sm text-surface-500 dark:text-surface-400">ไม่มีข้อมูลภาษีหัก ณ ที่จ่ายสำหรับรายการนี้</p>
                                    </div>

                                    <!-- Tax Entries -->
                                    <div v-else class="space-y-3">
                                        <Card v-for="(tax, taxIndex) in journal.taxes" :key="taxIndex" class="border border-surface-200 dark:border-surface-700">
                                            <template #title>
                                                <div class="flex justify-between items-center">
                                                    <span class="text-sm">รายการที่ {{ taxIndex + 1 }}</span>
                                                    <div class="text-right">
                                                        <div class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTaxTotal(tax).amount) }}</div>
                                                        <div class="text-xs text-surface-500 dark:text-surface-400">ฐานภาษี {{ formatCurrency(getTaxTotal(tax).base) }}</div>
                                                    </div>
                                                </div>
                                            </template>
                                            <template #content>
                                                <div class="space-y-3">
                                                    <!-- Tax Info -->
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <!-- ภาษี -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ภาษี</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded">
                                                                <Tag :value="getTaxTypeName(tax.taxtype)" severity="warn" />
                                                            </div>
                                                        </div>

                                                        <!-- ประเภท -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ประเภท</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded">
                                                                <Tag :value="getCustomerTypeName(tax.custtype)" severity="secondary" />
                                                            </div>
                                                        </div>

                                                        <!-- วันที่หัก ณ ที่จ่าย -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">วันที่หัก ณ ที่จ่าย</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                                {{ formatDate(tax.taxdate) }}
                                                            </div>
                                                        </div>

                                                        <!-- เลขที่เอกสาร -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">เลขที่เอกสาร</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                                {{ tax.taxdocno || '-' }}
                                                            </div>
                                                        </div>

                                                        <!-- ชื่อ -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ชื่อ</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded font-semibold text-sm text-surface-900 dark:text-surface-0">
                                                                {{ tax.custname || '-' }}
                                                            </div>
                                                        </div>

                                                        <!-- เลขประจำตัวผู้เสียภาษี -->
                                                        <div class="flex flex-col gap-1">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">เลขประจำตัวผู้เสียภาษี/เลขที่บัตรประชาชน</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0">
                                                                {{ tax.custtaxid || '-' }}
                                                            </div>
                                                        </div>

                                                        <!-- ที่อยู่ -->
                                                        <div class="flex flex-col gap-1 md:col-span-2">
                                                            <label class="font-medium text-xs text-surface-600 dark:text-surface-400">ที่อยู่</label>
                                                            <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-sm text-surface-900 dark:text-surface-0 min-h-[36px]">
                                                                {{ tax.address || '-' }}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- Details Table -->
                                                    <div v-if="tax.details && tax.details.length > 0" class="mt-3">
                                                        <div class="flex justify-between items-center mb-2">
                                                            <h4 class="font-semibold text-sm text-surface-900 dark:text-surface-0">รายละเอียด</h4>
                                                        </div>

                                                        <DataTable :value="tax.details" class="text-xs">
                                                            <Column field="description" header="รายละเอียด">
                                                                <template #body="{ data }">
                                                                    <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-surface-900 dark:text-surface-0">
                                                                        {{ data.description || '-' }}
                                                                    </div>
                                                                </template>
                                                            </Column>
                                                            <Column field="taxbase" header="ฐานภาษี" style="width: 130px">
                                                                <template #body="{ data }">
                                                                    <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-right font-semibold text-surface-900 dark:text-surface-0">
                                                                        {{ formatCurrency(data.taxbase) }}
                                                                    </div>
                                                                </template>
                                                            </Column>
                                                            <Column field="taxrate" header="อัตรา (%)" style="width: 100px">
                                                                <template #body="{ data }">
                                                                    <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-center text-surface-900 dark:text-surface-0">{{ data.taxrate }} %</div>
                                                                </template>
                                                            </Column>
                                                            <Column field="taxamount" header="ภาษีหัก ณ ที่จ่าย" style="width: 130px">
                                                                <template #body="{ data }">
                                                                    <div class="p-2 bg-surface-100 dark:bg-surface-700 rounded text-right font-bold text-primary-600 dark:text-primary-400">
                                                                        {{ formatCurrency(data.taxamount) }}
                                                                    </div>
                                                                </template>
                                                            </Column>
                                                        </DataTable>

                                                        <!-- Detail Total -->
                                                        <div class="mt-2 p-2 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                                                            <div class="flex justify-end gap-6 text-xs">
                                                                <div class="flex items-center gap-1">
                                                                    <span class="font-medium">รวมฐานภาษี:</span>
                                                                    <span class="text-sm font-bold">{{ formatCurrency(getTaxTotal(tax).base) }}</span>
                                                                </div>
                                                                <div class="flex items-center gap-1">
                                                                    <span class="font-medium">รวมภาษีหัก ณ ที่จ่าย:</span>
                                                                    <span class="text-sm font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTaxTotal(tax).amount) }}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </template>
                                        </Card>
                                    </div>
                                </div>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-8 text-surface-400">
            <i class="pi pi-inbox text-5xl mb-3"></i>
            <span>ไม่พบข้อมูลรายการ</span>
        </div>
    </div>
</template>

<style scoped>
.journal-detail-panel {
    background: var(--surface-card);
    border-radius: 8px;
    padding: 1rem;
}

.panel-container {
    height: 950px;
}

.journal-detail-panel :deep(.p-tabs) {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.journal-detail-panel :deep(.p-tabpanels) {
    flex: 1;
    overflow: hidden;
}

.journal-detail-panel :deep(.p-tabpanel) {
    height: 100%;
}

.carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    opacity: 0.8;
}

.carousel-nav:hover {
    opacity: 1;
}

.carousel-nav-left {
    left: 0.5rem;
}

.carousel-nav-right {
    right: 0.5rem;
}

.carousel-counter {
    position: absolute;
    bottom: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--p-surface-900);
    color: var(--p-surface-0);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    opacity: 0.9;
    z-index: 20;
}
</style>
