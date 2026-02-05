<script setup>
import ImageZoomViewer from '@/components/image/ImageZoomViewer.vue';
import PdfViewer from '@/components/image/PdfViewer.vue';
import { getDocumentImageGroup } from '@/services/api/image';
import { getJournalBooks, getJournalByDocno } from '@/services/api/journal';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    docno: {
        type: String,
        default: ''
    }
});

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

// VAT type: 0=ปกติ, 1=ขอคืนไม่ได้, 2=ไม่ถึงกำหนดชำระ
const getVatTypeName = (vattype) => {
    if (vattype === 0) return 'ปกติ';
    if (vattype === 1) return 'ขอคืนไม่ได้';
    if (vattype === 2) return 'ไม่ถึงกำหนดชำระ';
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
                <!-- Summary Cards -->
                <div class="mb-3">
                    <div class="grid grid-cols-4 gap-2">
                        <div class="bg-primary-50 dark:bg-primary-900/30 p-4 rounded-xl border border-primary-200 dark:border-primary-700">
                            <div class="text-sm text-primary-600 dark:text-primary-400">ยอดรวม</div>
                            <div class="text-2xl font-bold text-primary-700 dark:text-primary-300">{{ formatCurrency(journal.amount) }}</div>
                            <div class="text-xs text-primary-600/70 dark:text-primary-400/70 mt-1">{{ journal.docformat || '-' }}</div>
                        </div>

                        <div class="bg-surface-100 dark:bg-surface-700 p-3 rounded-lg">
                            <div class="text-xs text-surface-500 dark:text-surface-400">Debit / Credit</div>
                            <div class="flex items-center gap-1 mt-1">
                                <span class="text-sm font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(getTotalDebit) }}</span>
                                <span class="text-surface-400">/</span>
                                <span class="text-sm font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(getTotalCredit) }}</span>
                            </div>
                        </div>

                        <div class="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                            <div class="text-xs text-green-600 dark:text-green-400">ภาษีมูลค่าเพิ่ม</div>
                            <div class="text-lg font-bold text-green-700 dark:text-green-300">{{ formatCurrency(getTotalVatAmount) }}</div>
                        </div>

                        <div class="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg">
                            <div class="text-xs text-orange-600 dark:text-orange-400">ภาษีหัก ณ ที่จ่าย</div>
                            <div class="text-lg font-bold text-orange-700 dark:text-orange-300">{{ formatCurrency(getTotalWhtAmount) }}</div>
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
                                        <div class="col-span-4">
                                            <label class="block text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">วันที่เอกสาร</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm font-semibold">
                                                {{ formatDate(journal.docdate) }}
                                            </div>
                                        </div>

                                        <div class="col-span-4">
                                            <label class="block text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">เลขที่เอกสาร</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm font-bold text-primary-600 dark:text-primary-400">
                                                {{ journal.docno }}
                                            </div>
                                        </div>

                                        <div class="col-span-4">
                                            <label class="block text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">สมุดรายวัน</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm">
                                                <span class="text-primary-600 dark:text-primary-400">{{ journal.bookcode }}</span>
                                                <span class="text-surface-400 mx-1">~</span>
                                                <span>{{ getBookName(journal.bookcode) }}</span>
                                            </div>
                                        </div>

                                        <!-- Row 2 -->
                                        <div class="col-span-4">
                                            <label class="block font-medium mb-2 text-sm text-surface-600 dark:text-surface-400">ประเภท</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded">
                                                <Tag :value="journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้'" :severity="journal.debtaccounttype === 1 ? 'warn' : 'info'" />
                                            </div>
                                        </div>

                                        <div class="col-span-8">
                                            <label class="block text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">
                                                {{ journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้' }}
                                            </label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm">
                                                <template v-if="hasCreditor || hasDebtor">
                                                    <span class="text-primary-600 dark:text-primary-400">{{ hasCreditor ? journal.creditor.code : journal.debtor.code }}</span>
                                                    <span class="text-surface-400 mx-1">~</span>
                                                    <span>{{ hasCreditor ? getCreditorName : getDebtorName }}</span>
                                                </template>
                                                <span v-else class="text-surface-400">-</span>
                                            </div>
                                        </div>

                                        <!-- Row 3 -->
                                        <div class="col-span-12">
                                            <label class="block text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">คำอธิบาย</label>
                                            <div class="p-2.5 bg-surface-100 dark:bg-surface-700 rounded text-sm min-h-[50px]">
                                                {{ journal.accountdescription || '-' }}
                                            </div>
                                        </div>

                                        <!-- Row 4: รายละเอียดบัญชี -->
                                        <div class="col-span-12 mt-2">
                                            <label class="block text-base font-medium mb-2 text-surface-900 dark:text-surface-0">รายละเอียดบัญชี</label>

                                            <DataTable :value="journal.journaldetail" showGridlines class="text-sm">
                                                <Column header="#" style="width: 40px" bodyStyle="text-align: center">
                                                    <template #body="{ index }">
                                                        {{ index + 1 }}
                                                    </template>
                                                </Column>
                                                <Column field="accountcode" header="รหัสบัญชี" style="width: 100px">
                                                    <template #body="{ data }">
                                                        <span class="font-bold text-primary-600 dark:text-primary-400">{{ data.accountcode }}</span>
                                                    </template>
                                                </Column>
                                                <Column field="accountname" header="ชื่อบัญชี" style="min-width: 150px">
                                                    <template #body="{ data }">
                                                        <span class="text-surface-600 dark:text-surface-400">{{ data.accountname || '-' }}</span>
                                                    </template>
                                                </Column>
                                                <Column header="เดบิต" style="width: 100px">
                                                    <template #body="{ data }">
                                                        <div class="text-right">
                                                            <span v-if="data.debitamount > 0" class="font-semibold text-primary-600 dark:text-primary-400">
                                                                {{ formatCurrency(data.debitamount) }}
                                                            </span>
                                                            <span v-else class="text-surface-300">-</span>
                                                        </div>
                                                    </template>
                                                </Column>
                                                <Column header="เครดิต" style="width: 100px">
                                                    <template #body="{ data }">
                                                        <div class="text-right">
                                                            <span v-if="data.creditamount > 0" class="font-semibold text-blue-600 dark:text-blue-400">
                                                                {{ formatCurrency(data.creditamount) }}
                                                            </span>
                                                            <span v-else class="text-surface-300">-</span>
                                                        </div>
                                                    </template>
                                                </Column>

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
                                    <!-- Summary -->
                                    <div v-if="hasVatData" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700 mb-3">
                                        <div class="grid grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="font-bold">{{ journal.vats.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="font-bold">{{ formatCurrency(getTotalVatBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมยอดภาษี</div>
                                                <div class="font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalVatAmount) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมยกเว้นภาษี</div>
                                                <div class="font-bold">{{ formatCurrency(getTotalExceptVat) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- VAT Entries -->
                                    <div v-if="hasVatData" class="space-y-3">
                                        <div v-for="(vat, index) in journal.vats" :key="index" class="border border-surface-200 dark:border-surface-700 rounded-lg p-3">
                                            <div class="flex justify-between items-center mb-2">
                                                <span class="text-sm font-medium">รายการที่ {{ index + 1 }}</span>
                                                <div class="text-right">
                                                    <div class="font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(vat.vatamount) }}</div>
                                                    <div class="text-xs text-surface-500">ฐานภาษี {{ formatCurrency(vat.vatbase) }} × {{ vat.vatrate }}%</div>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                <div>
                                                    <label class="text-surface-500">วันที่ใบกำกับ</label>
                                                    <div class="font-semibold">{{ formatDate(vat.vatdate) }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">เลขที่ใบกำกับ</label>
                                                    <div class="font-semibold">{{ vat.vatdocno || '-' }}</div>
                                                </div>
                                                <div class="col-span-2">
                                                    <label class="text-surface-500">ชื่อ</label>
                                                    <div class="font-semibold">{{ vat.custname || '-' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">เลขประจำตัวผู้เสียภาษี</label>
                                                    <div>{{ vat.custtaxid || '-' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">ภาษี</label>
                                                    <div><Tag :value="getVatTypeName(vat.vattype)" :severity="vat.vattype === 0 ? 'info' : 'success'" /></div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">ประเภทภาษี</label>
                                                    <div><Tag :value="getVatModeName(vat.vatmode)" :severity="vat.vatmode === 0 ? 'secondary' : 'warn'" /></div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">ยื่นเพิ่ม</label>
                                                    <div>
                                                        <i :class="vat.vatsubmit ? 'pi pi-check-circle text-green-500' : 'pi pi-circle text-surface-400'"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-else class="flex flex-col items-center justify-center py-8 text-surface-400">
                                        <i class="pi pi-file-edit text-4xl mb-2"></i>
                                        <span>ไม่มีรายการภาษี</span>
                                    </div>
                                </div>
                            </TabPanel>

                            <!-- Tab 2: ภาษีถูกหัก ณ ที่จ่าย -->
                            <TabPanel value="2" class="flex-1 overflow-hidden">
                                <div class="p-3 overflow-auto h-full">
                                    <!-- Summary -->
                                    <div v-if="hasTaxData" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700 mb-3">
                                        <div class="grid grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="font-bold">{{ journal.taxes.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="font-bold">{{ formatCurrency(getTotalWhtBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-surface-600 dark:text-surface-400">รวมภาษีหัก ณ ที่จ่าย</div>
                                                <div class="font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalWhtAmount) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Tax Entries -->
                                    <div v-if="hasTaxData" class="space-y-3">
                                        <div v-for="(tax, taxIndex) in journal.taxes" :key="taxIndex" class="border border-surface-200 dark:border-surface-700 rounded-lg p-3">
                                            <div class="flex justify-between items-center mb-2">
                                                <span class="text-sm font-medium">รายการที่ {{ taxIndex + 1 }}</span>
                                                <div class="text-right">
                                                    <div class="font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(getTaxTotal(tax).amount) }}</div>
                                                    <div class="text-xs text-surface-500">ฐานภาษี {{ formatCurrency(getTaxTotal(tax).base) }}</div>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                <div>
                                                    <label class="text-surface-500">ภาษี</label>
                                                    <div><Tag :value="getTaxTypeName(tax.taxtype)" severity="warn" /></div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">ประเภท</label>
                                                    <div><Tag :value="getCustomerTypeName(tax.custtype)" severity="secondary" /></div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">วันที่หัก ณ ที่จ่าย</label>
                                                    <div class="font-semibold">{{ formatDate(tax.taxdate) }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-surface-500">เลขที่เอกสาร</label>
                                                    <div class="font-semibold">{{ tax.taxdocno || '-' }}</div>
                                                </div>
                                                <div class="col-span-2">
                                                    <label class="text-surface-500">ชื่อ</label>
                                                    <div class="font-semibold">{{ tax.custname || '-' }}</div>
                                                </div>
                                                <div class="col-span-2">
                                                    <label class="text-surface-500">เลขประจำตัวผู้เสียภาษี</label>
                                                    <div>{{ tax.custtaxid || '-' }}</div>
                                                </div>
                                            </div>

                                            <!-- Details Table -->
                                            <div v-if="tax.details && tax.details.length > 0" class="mt-2">
                                                <DataTable :value="tax.details" class="text-xs" size="small">
                                                    <Column field="description" header="รายละเอียด" />
                                                    <Column field="taxbase" header="ฐานภาษี" style="width: 100px">
                                                        <template #body="{ data }">
                                                            <div class="text-right">{{ formatCurrency(data.taxbase) }}</div>
                                                        </template>
                                                    </Column>
                                                    <Column field="taxrate" header="อัตรา" style="width: 70px">
                                                        <template #body="{ data }">
                                                            <div class="text-center">{{ data.taxrate }}%</div>
                                                        </template>
                                                    </Column>
                                                    <Column field="taxamount" header="ภาษี" style="width: 100px">
                                                        <template #body="{ data }">
                                                            <div class="text-right font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(data.taxamount) }}</div>
                                                        </template>
                                                    </Column>
                                                </DataTable>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-else class="flex flex-col items-center justify-center py-8 text-surface-400">
                                        <i class="pi pi-percentage text-4xl mb-2"></i>
                                        <span>ไม่มีรายการภาษีหัก ณ ที่จ่าย</span>
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
