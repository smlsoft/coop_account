<script setup>
import ImageZoomViewer from '@/components/image/ImageZoomViewer.vue';
import PdfViewer from '@/components/image/PdfViewer.vue';
import { getDocumentImageGroup } from '@/services/api/image';
import { getJournalBooks } from '@/services/api/journal';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    journal: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible']);

const documentImages = ref([]);
const loadingImages = ref(false);
const selectedImage = ref(null);
const imagePreviewVisible = ref(false);
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

// Watch for dialog visibility and journal changes to fetch images
watch(
    () => [props.visible, props.journal?.documentref],
    async ([visible, documentRef]) => {
        if (visible && documentRef) {
            await fetchDocumentImages(documentRef);
        } else {
            documentImages.value = [];
        }
        // Reset index when dialog opens
        if (visible) {
            currentImageIndex.value = 0;
        }
    },
    { immediate: true }
);

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
    return props.journal?.journaldetail?.reduce((sum, item) => sum + (item.debitamount || 0), 0) || 0;
});

const getTotalCredit = computed(() => {
    return props.journal?.journaldetail?.reduce((sum, item) => sum + (item.creditamount || 0), 0) || 0;
});

const isBalanced = computed(() => {
    return Math.abs(getTotalDebit.value - getTotalCredit.value) < 0.01;
});

const hasVatData = computed(() => {
    return props.journal?.vats && props.journal.vats.length > 0;
});

const hasTaxData = computed(() => {
    return props.journal?.taxes && props.journal.taxes.length > 0;
});

const hasCreditor = computed(() => {
    return props.journal?.creditor?.guidfixed;
});

const hasDebtor = computed(() => {
    return props.journal?.debtor?.guidfixed;
});

const getCreditorName = computed(() => {
    const names = props.journal?.creditor?.names;
    if (names && names.length > 0) {
        const thName = names.find((n) => n.code === 'th');
        return thName?.name || names[0]?.name || '-';
    }
    return '-';
});

const getDebtorName = computed(() => {
    const names = props.journal?.debtor?.names;
    if (names && names.length > 0) {
        const thName = names.find((n) => n.code === 'th');
        return thName?.name || names[0]?.name || '-';
    }
    return '-';
});

const getCreditorAddress = computed(() => {
    const address = props.journal?.creditor?.addressforbilling?.address;
    if (address && address.length > 0) {
        return address.join(' ');
    }
    return '-';
});

const getDebtorAddress = computed(() => {
    const address = props.journal?.debtor?.addressforbilling?.address;
    if (address && address.length > 0) {
        return address.join(' ');
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

// VAT type: 0=ภาษีซื้อ, 1=ภาษีขาย
const getVatTypeName = (vattype) => {
    if (vattype === 0) return 'ภาษีซื้อ';
    if (vattype === 1) return 'ภาษีขาย';
    return '-';
};

// VAT mode: 0=ปกติ, 1=ขอคืนไม่ได้, 2=ไม่ถึงกำหนดชำระ
const getVatModeName = (vatmode) => {
    if (vatmode === 0) return 'ปกติ';
    if (vatmode === 1) return 'ขอคืนไม่ได้';
    if (vatmode === 2) return 'ไม่ถึงกำหนดชำระ';
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
    return props.journal?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.vatbase) || 0), 0) || 0;
});

const getTotalVatAmount = computed(() => {
    return props.journal?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.vatamount) || 0), 0) || 0;
});

const getTotalExceptVat = computed(() => {
    return props.journal?.vats?.reduce((sum, vat) => sum + (parseFloat(vat.exceptvat) || 0), 0) || 0;
});

// Total WHT calculations
const getTotalWhtBase = computed(() => {
    return (
        props.journal?.taxes?.reduce((sum, tax) => {
            const detailSum = tax.details?.reduce((s, d) => s + (parseFloat(d.taxbase) || 0), 0) || 0;
            return sum + detailSum;
        }, 0) || 0
    );
});

const getTotalWhtAmount = computed(() => {
    return (
        props.journal?.taxes?.reduce((sum, tax) => {
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
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        :modal="true"
        :dismissableMask="true"
        :style="{ width: '95vw', maxWidth: '1600px', height: '90vh' }"
        :contentStyle="{ padding: 0, overflow: 'hidden' }"
        :breakpoints="{ '960px': '95vw' }"
    >
        <template #header>
            <div class="flex items-center gap-3">
                <i class="pi pi-book text-2xl text-primary-500"></i>
                <div>
                    <div class="text-xl font-bold text-surface-900 dark:text-surface-0">รายละเอียดการบันทึกบัญชี</div>
                    <div class="text-sm text-surface-500 dark:text-surface-400">{{ journal?.docno }}</div>
                </div>
            </div>
        </template>

        <div v-if="journal" class="flex h-full" style="height: calc(90vh - 80px)">
            <!-- Left Panel: Document Image -->
            <div class="w-2/5 border-r border-surface-200 dark:border-surface-700 flex flex-col bg-surface-50 dark:bg-surface-900">
                <!-- Image Viewer -->
                <div class="flex-1 p-4 overflow-hidden">
                    <div v-if="loadingImages" class="flex items-center justify-center h-full">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                    </div>

                    <div v-else-if="documentImages.length > 0" class="h-full">
                        <!-- Carousel Viewer -->
                        <div class="h-full rounded-lg overflow-hidden relative bg-surface-100 dark:bg-surface-800">
                            <!-- Image/PDF Viewer -->
                            <ImageZoomViewer v-if="currentImageRef && !isPDF(currentImageRef.imageuri)" :key="`img-${currentImageIndex}`" :src="currentImageRef.imageuri" :alt="currentImageRef.name || 'Document'" />
                            <PdfViewer v-else-if="currentImageRef && isPDF(currentImageRef.imageuri)" :key="`pdf-${currentImageIndex}`" :src="currentImageRef.imageuri" />

                            <!-- Navigation Arrows (show only if more than 1 image) -->
                            <template v-if="totalImages > 1">
                                <Button icon="pi pi-chevron-left" class="carousel-nav carousel-nav-left" severity="secondary" rounded :disabled="!canGoPrev" @click="prevImage" />
                                <Button icon="pi pi-chevron-right" class="carousel-nav carousel-nav-right" severity="secondary" rounded :disabled="!canGoNext" @click="nextImage" />

                                <!-- Image Counter -->
                                <div class="carousel-counter">{{ currentImageIndex + 1 }} / {{ totalImages }}</div>
                            </template>
                        </div>
                    </div>

                    <div v-else class="flex flex-col items-center justify-center h-full text-surface-400">
                        <i class="pi pi-image text-6xl mb-4"></i>
                        <span class="text-lg">ไม่พบรูปภาพเอกสาร</span>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Details -->
            <div class="w-3/5 flex flex-col overflow-hidden">
                <!-- Summary Cards -->
                <div class="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800">
                    <div class="grid grid-cols-4 gap-3">
                        <!-- Total Amount -->
                        <div class="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-4 rounded-xl">
                            <div class="text-sm opacity-80">ยอดรวม</div>
                            <div class="text-2xl font-bold">{{ formatCurrency(journal.amount) }}</div>
                            <div class="text-xs opacity-70 mt-1">{{ journal.docformat || '-' }}</div>
                        </div>

                        <!-- Debit/Credit Balance -->
                        <div class="bg-surface-100 dark:bg-surface-700 p-4 rounded-xl">
                            <div class="text-sm text-surface-500 dark:text-surface-400">Debit / Credit</div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(getTotalDebit) }}</span>
                                <span class="text-surface-400">/</span>
                                <span class="text-lg font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(getTotalCredit) }}</span>
                            </div>
                            <Tag :value="isBalanced ? 'สมดุล' : 'ไม่สมดุล'" :severity="isBalanced ? 'success' : 'danger'" class="mt-2" />
                        </div>

                        <!-- VAT Summary -->
                        <div class="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
                            <div class="text-sm text-green-600 dark:text-green-400">ภาษีมูลค่าเพิ่ม</div>
                            <div class="text-2xl font-bold text-green-700 dark:text-green-300">{{ formatCurrency(getTotalVatAmount) }}</div>
                            <div class="text-xs text-green-600/70 mt-1">{{ journal.vats?.length || 0 }} รายการ</div>
                        </div>

                        <!-- WHT Summary -->
                        <div class="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-xl">
                            <div class="text-sm text-orange-600 dark:text-orange-400">ภาษีหัก ณ ที่จ่าย</div>
                            <div class="text-2xl font-bold text-orange-700 dark:text-orange-300">{{ formatCurrency(getTotalWhtAmount) }}</div>
                            <div class="text-xs text-orange-600/70 mt-1">{{ journal.taxes?.length || 0 }} รายการ</div>
                        </div>
                    </div>
                </div>

                <!-- Tabs Content -->
                <div class="flex-1 overflow-hidden">
                    <Tabs value="0">
                        <TabList>
                            <Tab value="0">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-calendar"></i>
                                    <span>ข้อมูลรายวัน</span>
                                </div>
                            </Tab>
                            <Tab value="1" :disabled="!hasVatData">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-file-edit"></i>
                                    <span>ข้อมูลภาษี</span>
                                    <Badge v-if="hasVatData" :value="journal.vats?.length || 0" severity="success" />
                                </div>
                            </Tab>
                            <Tab value="2" :disabled="!hasTaxData">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-percentage"></i>
                                    <span>ภาษีถูกหัก ณ ที่จ่าย</span>
                                    <Badge v-if="hasTaxData" :value="journal.taxes?.length || 0" severity="warn" />
                                </div>
                            </Tab>
                        </TabList>
                        <TabPanels>
                            <!-- Tab 0: ข้อมูลรายวัน (ตาม JournalDailyInfoTab) -->
                            <TabPanel value="0">
                                <div class="p-4 overflow-auto" style="max-height: calc(90vh - 320px)">
                                    <!-- ข้อมูลเอกสาร -->
                                    <div class="mb-6">
                                        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2 text-surface-900 dark:text-surface-0">
                                            <i class="pi pi-file text-primary-500"></i>
                                            ข้อมูลเอกสาร
                                        </h3>
                                        <div class="grid grid-cols-3 gap-4 mb-4">
                                            <!-- วันที่เอกสาร -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">วันที่เอกสาร</label>
                                                <div class="font-semibold text-surface-900 dark:text-surface-0">{{ formatDate(journal.docdate) }}</div>
                                            </div>
                                            <!-- เลขที่เอกสาร -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">เลขที่เอกสาร</label>
                                                <div class="font-bold text-lg text-primary-600 dark:text-primary-400">{{ journal.docno }}</div>
                                            </div>
                                            <!-- สมุดรายวัน -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">สมุดรายวัน</label>
                                                <div class="font-semibold text-surface-900 dark:text-surface-0">
                                                    <span class="font-mono text-sm text-primary-600 dark:text-primary-400">{{ journal.bookcode }}</span>
                                                    <span class="text-surface-500 dark:text-surface-400 mx-1">~</span>
                                                    <span>{{ getBookName(journal.bookcode) }}</span>
                                                </div>
                                            </div>
                                            <!-- ประเภท (ลูกหนี้/เจ้าหนี้) -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">ประเภท</label>
                                                <Tag :value="journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้'" :severity="journal.debtaccounttype === 1 ? 'warn' : 'info'" />
                                            </div>
                                            <!-- ลูกหนี้/เจ้าหนี้ -->
                                            <div class="col-span-2">
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">{{ journal.debtaccounttype === 1 ? 'เจ้าหนี้' : 'ลูกหนี้' }}</label>
                                                <div v-if="hasCreditor || hasDebtor" class="font-semibold text-surface-900 dark:text-surface-0">
                                                    <span class="font-mono text-sm text-primary-600 dark:text-primary-400">{{ hasCreditor ? journal.creditor.code : journal.debtor.code }}</span>
                                                    <span class="text-surface-500 dark:text-surface-400 mx-1">~</span>
                                                    <span>{{ hasCreditor ? getCreditorName : getDebtorName }}</span>
                                                </div>
                                                <div v-else class="text-surface-400">-</div>
                                            </div>
                                            <!-- วันที่เอกสารอ้างอิง -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">วันที่เอกสารอ้างอิง</label>
                                                <div class="text-surface-900 dark:text-surface-0">{{ formatDate(journal.exdocrefdate) }}</div>
                                            </div>
                                            <!-- เลขที่เอกสารอ้างอิง -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">เลขที่เอกสารอ้างอิง</label>
                                                <div class="font-semibold text-surface-900 dark:text-surface-0">{{ journal.exdocrefno || '-' }}</div>
                                            </div>
                                            <!-- ประเภทรายการ -->
                                            <div>
                                                <label class="text-xs text-surface-500 dark:text-surface-400 block">ประเภทรายการ</label>
                                                <Tag :value="getJournalTypeName(journal.journaltype)" :severity="journal.journaltype === 0 ? 'secondary' : 'warn'" />
                                            </div>
                                        </div>

                                        <!-- คำอธิบาย -->
                                        <div class="mb-4">
                                            <label class="text-xs text-surface-500 block mb-2">คำอธิบาย</label>
                                            <div class="bg-surface-100 dark:bg-surface-700 p-3 rounded-lg">{{ journal.accountdescription || '-' }}</div>
                                        </div>

                                        <!-- Creditor/Debtor Detail Cards -->
                                        <div v-if="hasCreditor || hasDebtor" class="grid grid-cols-1 gap-4 mb-4">
                                            <div v-if="hasCreditor" class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                                                <div class="flex items-center gap-2 mb-3">
                                                    <i class="pi pi-building text-orange-500"></i>
                                                    <Tag value="เจ้าหนี้" severity="warn" />
                                                    <span class="font-mono text-sm">{{ journal.creditor.code }}</span>
                                                </div>
                                                <div class="text-lg font-bold mb-2">{{ getCreditorName }}</div>
                                                <div class="text-sm space-y-1 text-surface-600 dark:text-surface-400">
                                                    <div><i class="pi pi-id-card mr-2"></i>{{ journal.creditor.taxid || '-' }}</div>
                                                    <div><i class="pi pi-map-marker mr-2"></i>{{ getCreditorAddress }}</div>
                                                </div>
                                            </div>

                                            <div v-if="hasDebtor" class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                                <div class="flex items-center gap-2 mb-3">
                                                    <i class="pi pi-user text-blue-500"></i>
                                                    <Tag value="ลูกหนี้" severity="info" />
                                                    <span class="font-mono text-sm">{{ journal.debtor.code }}</span>
                                                </div>
                                                <div class="text-lg font-bold mb-2">{{ getDebtorName }}</div>
                                                <div class="text-sm space-y-1 text-surface-600 dark:text-surface-400">
                                                    <div><i class="pi pi-id-card mr-2"></i>{{ journal.debtor.taxid || '-' }}</div>
                                                    <div><i class="pi pi-map-marker mr-2"></i>{{ getDebtorAddress }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    <!-- รายละเอียดบัญชี -->
                                    <div class="mt-6">
                                        <div class="flex justify-between items-center mb-4">
                                            <h3 class="text-lg font-semibold flex items-center gap-2 text-surface-900 dark:text-surface-0">
                                                <i class="pi pi-list text-primary-500"></i>
                                                รายละเอียดบัญชี
                                                <Badge :value="journal.journaldetail?.length || 0" severity="secondary" />
                                            </h3>
                                            <div v-if="journal.docformat" class="text-sm">
                                                <span class="text-surface-500 dark:text-surface-400">รูปแบบ:</span>
                                                <Tag :value="journal.docformat" severity="info" class="ml-2" />
                                            </div>
                                        </div>
                                        <DataTable :value="journal.journaldetail" size="small" showGridlines stripedRows class="text-sm">
                                            <Column header="#" style="width: 50px" bodyStyle="text-align: center">
                                                <template #body="{ index }">
                                                    {{ index + 1 }}
                                                </template>
                                            </Column>
                                            <Column field="accountcode" header="รหัสบัญชี" style="width: 120px">
                                                <template #body="{ data }">
                                                    <span class="font-mono font-bold text-primary-600 dark:text-primary-400">{{ data.accountcode }}</span>
                                                </template>
                                            </Column>
                                            <Column field="accountname" header="ชื่อบัญชี">
                                                <template #body="{ data }">
                                                    <span v-tooltip.top="data.accountname" class="block truncate max-w-xs">{{ data.accountname }}</span>
                                                </template>
                                            </Column>
                                            <Column field="debitamount" header="เดบิต" style="width: 130px">
                                                <template #body="{ data }">
                                                    <div class="text-right">
                                                        <span v-if="data.debitamount > 0" class="font-semibold text-primary-600 dark:text-primary-400">
                                                            {{ formatCurrency(data.debitamount) }}
                                                        </span>
                                                        <span v-else class="text-surface-300">-</span>
                                                    </div>
                                                </template>
                                            </Column>
                                            <Column field="creditamount" header="เครดิต" style="width: 130px">
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
                                                <div class="flex justify-end gap-6 py-2 font-bold text-base">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-surface-600 dark:text-surface-400">รวมเดบิต:</span>
                                                        <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(getTotalDebit) }}</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-surface-600 dark:text-surface-400">รวมเครดิต:</span>
                                                        <span class="text-blue-600 dark:text-blue-400">{{ formatCurrency(getTotalCredit) }}</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
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

                                    <!-- Meta Info -->
                                    <div class="mt-6 flex items-center gap-6 text-sm text-surface-500 dark:text-surface-400">
                                        <div>
                                            <i class="pi pi-tag mr-2"></i>งวดบัญชี: <span class="text-surface-700 dark:text-surface-300 font-semibold">{{ journal.accountperiod }}/{{ journal.accountyear }}</span>
                                        </div>
                                        <div v-if="journal.appname"><i class="pi pi-desktop mr-2"></i>แอป: <Tag :value="journal.appname" severity="contrast" /></div>
                                        <div>
                                            <i class="pi pi-user mr-2"></i>สร้างโดย: <span class="text-surface-700 dark:text-surface-300">{{ journal.createdby }}</span>
                                        </div>
                                        <div><i class="pi pi-calendar mr-2"></i>{{ formatDate(journal.createdat) }}</div>
                                    </div>
                                </div>
                            </TabPanel>

                            <!-- Tab 1: ข้อมูลภาษี (ตาม JournalTaxInfoTab) -->
                            <TabPanel value="1">
                                <div class="p-4 overflow-auto" style="max-height: calc(90vh - 320px)">
                                    <!-- Summary -->
                                    <div v-if="hasVatData" class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700 mb-4">
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ journal.vats.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalVatBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">รวมยอดภาษี</div>
                                                <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(getTotalVatAmount) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">รวมยกเว้นภาษี</div>
                                                <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalExceptVat) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- VAT Entries -->
                                    <div v-if="hasVatData" class="space-y-4">
                                        <div v-for="(vat, index) in journal.vats" :key="index" class="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                                            <div class="flex items-center justify-between mb-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">{{ index + 1 }}</div>
                                                    <div>
                                                        <div class="font-bold text-lg text-surface-900 dark:text-surface-0">{{ vat.vatdocno || '-' }}</div>
                                                        <div class="text-sm text-surface-500 dark:text-surface-400">{{ formatDate(vat.vatdate) }}</div>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(vat.vatamount) }}</div>
                                                    <div class="text-sm text-surface-500 dark:text-surface-400">ฐานภาษี {{ formatCurrency(vat.vatbase) }} x {{ vat.vatrate }}%</div>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                                                <div>
                                                    <span class="text-surface-500">ภาษี:</span>
                                                    <Tag :value="getVatTypeName(vat.vattype)" :severity="vat.vattype === 0 ? 'info' : 'success'" class="ml-2" />
                                                </div>
                                                <div>
                                                    <span class="text-surface-500">ประเภท:</span>
                                                    <Tag :value="getVatModeName(vat.vatmode)" :severity="vat.vatmode === 0 ? 'secondary' : 'warn'" class="ml-2" />
                                                </div>
                                                <div>
                                                    <span class="text-surface-500">งวด:</span>
                                                    <span class="ml-2 font-semibold">{{ vat.vatperiod }}/{{ vat.vatyear }}</span>
                                                </div>
                                                <div>
                                                    <span class="text-surface-500">สถานะ:</span>
                                                    <Tag :value="vat.vatsubmit ? 'ยื่นเพิ่ม' : 'ปกติ'" :severity="vat.vatsubmit ? 'success' : 'secondary'" class="ml-2" />
                                                </div>
                                            </div>

                                            <Divider class="my-3" />

                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">ชื่อ</label>
                                                    <div class="font-semibold text-surface-900 dark:text-surface-0">{{ vat.custname || '-' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">เลขประจำตัวผู้เสียภาษี</label>
                                                    <div class="font-mono text-surface-900 dark:text-surface-0">{{ vat.custtaxid || '-' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">สถานประกอบการ</label>
                                                    <div class="text-surface-900 dark:text-surface-0">{{ getOrganizationName(vat.organization) }} {{ vat.branchcode ? `(${vat.branchcode})` : '' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">ยอดยกเว้นภาษี</label>
                                                    <div class="font-semibold text-surface-900 dark:text-surface-0">{{ formatCurrency(vat.exceptvat) }}</div>
                                                </div>
                                                <div v-if="vat.remark" class="md:col-span-2">
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">หมายเหตุ</label>
                                                    <div class="bg-surface-100 dark:bg-surface-700 p-2 rounded text-surface-900 dark:text-surface-0">{{ vat.remark }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-else class="flex flex-col items-center justify-center py-12 text-surface-400">
                                        <i class="pi pi-file-edit text-5xl mb-3"></i>
                                        <span>ไม่มีข้อมูลภาษีมูลค่าเพิ่ม</span>
                                    </div>
                                </div>
                            </TabPanel>

                            <!-- Tab 2: ภาษีถูกหัก ณ ที่จ่าย (ตาม JournalWithholdingTaxTab) -->
                            <TabPanel value="2">
                                <div class="p-4 overflow-auto" style="max-height: calc(90vh - 320px)">
                                    <!-- Summary -->
                                    <div v-if="hasTaxData" class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700 mb-4">
                                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">จำนวนรายการ</div>
                                                <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ journal.taxes.length }}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">รวมฐานภาษี</div>
                                                <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(getTotalWhtBase) }}</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-surface-600 dark:text-surface-400">รวมภาษีหัก ณ ที่จ่าย</div>
                                                <div class="text-xl font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(getTotalWhtAmount) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Tax Entries -->
                                    <div v-if="hasTaxData" class="space-y-4">
                                        <div v-for="(tax, taxIndex) in journal.taxes" :key="taxIndex" class="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                                            <div class="flex items-center justify-between mb-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">{{ taxIndex + 1 }}</div>
                                                    <div>
                                                        <div class="font-bold text-lg text-surface-900 dark:text-surface-0">{{ tax.taxdocno || '-' }}</div>
                                                        <div class="text-sm text-surface-500 dark:text-surface-400">{{ formatDate(tax.taxdate) }}</div>
                                                    </div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <Tag :value="getTaxTypeName(tax.taxtype)" severity="warn" />
                                                    <Tag :value="getCustomerTypeName(tax.custtype)" severity="secondary" />
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">ชื่อ</label>
                                                    <div class="font-semibold text-lg text-surface-900 dark:text-surface-0">{{ tax.custname || '-' }}</div>
                                                </div>
                                                <div>
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">เลขประจำตัวผู้เสียภาษี</label>
                                                    <div class="font-mono text-surface-900 dark:text-surface-0">{{ tax.custtaxid || '-' }}</div>
                                                </div>
                                                <div class="md:col-span-2">
                                                    <label class="text-xs text-surface-500 dark:text-surface-400 block">ที่อยู่</label>
                                                    <div class="text-surface-900 dark:text-surface-0">{{ tax.address || '-' }}</div>
                                                </div>
                                            </div>

                                            <!-- Tax Details Table -->
                                            <div v-if="tax.details && tax.details.length > 0">
                                                <h4 class="font-semibold text-surface-900 dark:text-surface-0 mb-3">รายละเอียด</h4>
                                                <DataTable :value="tax.details" size="small" showGridlines class="text-sm">
                                                    <Column field="description" header="รายการ"></Column>
                                                    <Column field="taxbase" header="ฐานภาษี" style="width: 130px">
                                                        <template #body="{ data }">
                                                            <div class="text-right font-semibold">{{ formatCurrency(data.taxbase) }}</div>
                                                        </template>
                                                    </Column>
                                                    <Column field="taxrate" header="อัตรา (%)" style="width: 100px">
                                                        <template #body="{ data }">
                                                            <div class="text-center">{{ data.taxrate }}%</div>
                                                        </template>
                                                    </Column>
                                                    <Column field="taxamount" header="ภาษีหัก ณ ที่จ่าย" style="width: 150px">
                                                        <template #body="{ data }">
                                                            <div class="text-right font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(data.taxamount) }}</div>
                                                        </template>
                                                    </Column>
                                                </DataTable>

                                                <!-- Detail Total -->
                                                <div class="mt-3 p-3 bg-surface-100 dark:bg-surface-700 rounded-lg">
                                                    <div class="flex justify-end gap-8">
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-sm font-medium">รวมฐานภาษี:</span>
                                                            <span class="text-lg font-bold">{{ formatCurrency(getTaxTotal(tax).base) }}</span>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-sm font-medium">รวมภาษีหัก ณ ที่จ่าย:</span>
                                                            <span class="text-lg font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(getTaxTotal(tax).amount) }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-else class="flex flex-col items-center justify-center py-12 text-surface-400">
                                        <i class="pi pi-percentage text-5xl mb-3"></i>
                                        <span>ไม่มีข้อมูลภาษีหัก ณ ที่จ่าย</span>
                                    </div>
                                </div>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </div>
            </div>
        </div>

        <!-- Image Preview Dialog -->
        <Dialog v-model:visible="imagePreviewVisible" :modal="true" :dismissableMask="true" header="ดูรูปภาพเอกสาร" :style="{ width: '95vw', maxWidth: '1400px' }">
            <div class="flex justify-center bg-surface-900 p-4 rounded-lg">
                <img :src="selectedImage" alt="Document Preview" class="max-w-full max-h-[80vh] object-contain" />
            </div>
        </Dialog>
    </Dialog>
</template>

<style scoped>
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
    font-size: 0.875rem;
    opacity: 0.9;
    z-index: 20;
}
</style>
