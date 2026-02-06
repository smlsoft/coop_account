<script setup>
import { FilterMatchMode } from '@primevue/core/api';
import { onMounted, ref, watch } from 'vue';

// modeMenu
// 1 = เมนู upload image
// 2 = เมนู ตรวจสอบรูป
// 3 = บันทึกรายวันจากรูป
const props = defineProps({
    modeMenu: {
        type: Number,
        default: 1
    },
    dataList: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    firstPage: {
        type: Number,
        default: 0
    },
    totalItemsCount: {
        type: Number,
        default: 0
    },
    filters: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['onRowSelect', 'showDialogCreateJob', 'showDialogConfigJob', 'search', 'onPage']);

// Reactive state
const dt = ref();
const first = ref(props.firstPage || 0);
const rowsPerPage = ref(10);
const tableFilters = ref({
    global: { value: props.filters || '', matchMode: FilterMatchMode.CONTAINS }
});
let searchTimeout = null;

// Constants for status mapping
const STATUS_CONFIG = {
    0: { text: 'รอแก้ไข', severity: 'secondary' },
    1: { text: 'รอตรวจสอบ', severity: 'warn' },
    2: { text: 'กำลังตรวจสอบ', severity: 'info' },
    3: { text: 'รอบันทึกบัญชี', severity: 'info' },
    4: { text: 'เสร็จสิ้น', severity: 'success' },
    5: { text: 'ยกเลิก', severity: 'danger' },
    99: { text: 'รอบันทึกบัญชี', severity: 'info' }
};

const LOCAL_STORAGE_KEYS = {
    1: 'images_job_upload_perPage',
    2: 'images_job_review_perPage',
    3: 'images_job_daily_perPage'
};

// Watchers
watch(
    () => props.firstPage,
    (newValue) => {
        first.value = newValue;
    }
);

watch(
    () => props.filters,
    (newValue) => {
        tableFilters.value.global.value = newValue || '';
    }
);

// Computed-like functions for document status
const getDocumentStatusTotal = (statusArray, targetStatus) => {
    if (!statusArray || !Array.isArray(statusArray)) return 0;
    const found = statusArray.find((item) => item.status === targetStatus);
    return found?.total || 0;
};

const getPassedDocumentsTotal = (statusArray) => {
    if (!statusArray || !Array.isArray(statusArray)) return 0;
    return statusArray.filter((item) => item.status === 1 || item.status === 3).reduce((sum, item) => sum + item.total, 0);
};

const getStatusText = (status) => {
    return STATUS_CONFIG[status]?.text || '-';
};

const getStatusSeverity = (data) => {
    const { status, parentguidfixed } = data;

    if (status === 0) {
        return parentguidfixed === '' ? 'secondary' : 'contrast';
    }

    return STATUS_CONFIG[status]?.severity || 'secondary';
};

const getStatusLabel = (data) => {
    const { status, parentguidfixed } = data;

    if (status === 0) {
        return parentguidfixed === '' ? 'รออัพโหลด' : 'รอแก้ไข';
    }

    return STATUS_CONFIG[status]?.text || '-';
};

const formatDate = (dateString) => {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Event handlers
const onRowSelect = (event) => {
    emit('onRowSelect', event.data);
};

const showDialogCreateJob = () => {
    emit('showDialogCreateJob');
};

const showDialogConfigJob = (data) => {
    emit('showDialogConfigJob', data);
};

const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        emit('search', tableFilters.value.global.value);
    }, 500);
};

const onPage = (event) => {
    rowsPerPage.value = event.rows;
    first.value = event.first;
    const activePage = Math.floor(event.first / event.rows) + 1;

    const storageKey = LOCAL_STORAGE_KEYS[props.modeMenu];
    if (storageKey) {
        localStorage.setItem(storageKey, event.rows.toString());
    }

    emit('onPage', activePage, event.rows);
};

// Lifecycle hooks
onMounted(() => {
    const storageKey = LOCAL_STORAGE_KEYS[props.modeMenu];
    if (storageKey) {
        const savedPerPage = localStorage.getItem(storageKey);
        if (savedPerPage) {
            rowsPerPage.value = parseInt(savedPerPage, 10);
        }
    }

    first.value = props.firstPage || 0;
    tableFilters.value.global.value = props.filters || '';
});
</script>

<template>
    <div>
        <Toolbar class="mb-6">
            <template #start>
                <Button v-if="props.modeMenu === 1" label="สร้างงาน" icon="pi pi-plus" @click="showDialogCreateJob" />
            </template>

            <template #end>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="tableFilters['global'].value" placeholder="ค้นหา..." @input="onSearchInput" />
                </IconField>
            </template>
        </Toolbar>

        <DataTable
            ref="dt"
            :value="props.dataList"
            dataKey="guidfixed"
            :paginator="true"
            :rows="rowsPerPage"
            :first="first"
            :totalRecords="props.totalItemsCount"
            :loading="loading"
            :lazy="true"
            :filters="tableFilters"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[10, 20, 50, 100]"
            currentPageReportTemplate="แสดง {first} ถึง {last} จาก {totalRecords} รายการ"
            selectionMode="single"
            :metaKeySelection="false"
            @rowSelect="onRowSelect"
            @page="onPage"
        >
            <template #empty>
                <div class="flex flex-col items-center justify-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">ไม่พบข้อมูล</p>
                </div>
            </template>

            <template #loading>
                <div class="flex flex-col items-center justify-center py-12">
                    <!-- Spinner -->
                    <div class="spinner-container mb-4">
                        <div class="spinner">
                            <div class="spinner-ring"></div>
                            <div class="spinner-ring"></div>
                            <div class="spinner-ring"></div>
                            <i class="pi pi-sync spinner-icon"></i>
                        </div>
                    </div>
                    <!-- Message -->
                    <p class="text-surface-700 dark:text-surface-300 font-medium">กำลังโหลดข้อมูล...</p>
                    <!-- Dots -->
                    <div class="loading-dots mt-2">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </div>
                </div>
            </template>

            <!-- ลำดับ -->
            <Column header="#" style="width: 4rem">
                <template #body="slotProps">
                    {{ first + slotProps.index + 1 }}
                </template>
            </Column>

            <!-- วันที่ -->
            <Column field="ownerat" header="วันที่" style="min-width: 10rem">
                <template #body="{ data }">
                    {{ formatDate(data.ownerat) }}
                </template>
            </Column>

            <!-- เลขที่งาน -->
            <Column field="code" header="เลขที่งาน" style="min-width: 10rem"></Column>

            <!-- ชื่องาน -->
            <Column field="name" header="ชื่องาน" style="min-width: 12rem"></Column>

            <!-- จำนวน (modeMenu !== 3) -->
            <Column v-if="props.modeMenu !== 3" field="totaldocument" header="จำนวน" style="min-width: 6rem">
                <template #body="{ data }">
                    {{ data.totaldocument || 0 }}
                </template>
            </Column>

            <!-- modeMenu = 1: เอกสารมีปัญหา -->
            <Column v-if="props.modeMenu === 1" header="มีปัญหา" style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag v-if="getDocumentStatusTotal(data.totaldocumentstatus, 2) > 0" :value="getDocumentStatusTotal(data.totaldocumentstatus, 2).toString()" severity="danger" />
                    <span v-else>-</span>
                </template>
            </Column>

            <!-- modeMenu = 2: ผ่าน / ไม่ผ่าน / คงเหลือ -->
            <Column v-if="props.modeMenu === 2" header="ผ่าน" style="min-width: 5rem">
                <template #body="{ data }">
                    <Tag :value="getPassedDocumentsTotal(data.totaldocumentstatus).toString()" severity="success" />
                </template>
            </Column>

            <Column v-if="props.modeMenu === 2" header="ไม่ผ่าน" style="min-width: 5rem">
                <template #body="{ data }">
                    <Tag v-if="getDocumentStatusTotal(data.totaldocumentstatus, 2) > 0" :value="getDocumentStatusTotal(data.totaldocumentstatus, 2).toString()" severity="danger" />
                    <span v-else>-</span>
                </template>
            </Column>

            <Column v-if="props.modeMenu === 2" header="คงเหลือ" style="min-width: 5rem">
                <template #body="{ data }">
                    {{ getDocumentStatusTotal(data.totaldocumentstatus, 0) }}
                </template>
            </Column>

            <!-- modeMenu = 3: เอกสารที่ต้องบันทึก / บันทึกแล้ว / คงเหลือ -->
            <Column v-if="props.modeMenu === 3" header="ต้องบันทึก" style="min-width: 6rem">
                <template #body="{ data }">
                    {{ getDocumentStatusTotal(data.totaldocumentstatus, 1) }}
                </template>
            </Column>

            <Column v-if="props.modeMenu === 3" header="บันทึกแล้ว" style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag :value="(data.referencecount || 0).toString()" severity="success" />
                </template>
            </Column>

            <Column v-if="props.modeMenu === 3" header="คงเหลือ" style="min-width: 5rem">
                <template #body="{ data }">
                    {{ getDocumentStatusTotal(data.totaldocumentstatus, 1) - (data.referencecount || 0) }}
                </template>
            </Column>

            <!-- ผู้สร้าง -->
            <Column field="ownerby" header="ผู้สร้าง" style="min-width: 10rem"></Column>

            <!-- สถานะ -->
            <Column field="status" header="สถานะ" style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag :value="getStatusLabel(data)" :severity="getStatusSeverity(data)" />
                </template>
            </Column>

            <!-- หมายเหตุ -->
            <Column field="description" header="หมายเหตุ" style="min-width: 10rem">
                <template #body="{ data }">
                    {{ data.description || '-' }}
                </template>
            </Column>

            <!-- modeMenu = 2: งานแก้ไข -->
            <Column v-if="props.modeMenu === 2" header="งานแก้ไข" style="min-width: 10rem">
                <template #body="{ data }">
                    <Button v-if="data.taskchild?.code" size="small" severity="warn" outlined :label="`${getStatusText(data.taskchild.status)}: ${data.taskchild.code}`" />
                    <span v-else>-</span>
                </template>
            </Column>

            <!-- modeMenu = 1: การจัดการ -->
            <Column v-if="props.modeMenu === 1" :exportable="false" style="min-width: 6rem">
                <template #body="slotProps">
                    <Button v-if="slotProps.data.status === 0" icon="pi pi-cog" outlined rounded @click.stop="showDialogConfigJob(slotProps.data)" v-tooltip.top="'ตั้งค่า'" />
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style scoped>
/* Spinner Container */
.spinner-container {
    position: relative;
    width: 56px;
    height: 56px;
}

.spinner {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spinner-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid transparent;
}

.spinner-ring:nth-child(1) {
    border-top-color: var(--p-primary-color);
    animation: spin 1s linear infinite;
}

.spinner-ring:nth-child(2) {
    width: 80%;
    height: 80%;
    border-right-color: var(--p-primary-400);
    animation: spin 1.5s linear infinite reverse;
}

.spinner-ring:nth-child(3) {
    width: 60%;
    height: 60%;
    border-bottom-color: var(--p-primary-300);
    animation: spin 2s linear infinite;
}

.spinner-icon {
    font-size: 1rem;
    color: var(--p-primary-color);
    animation: pulse 1.5s ease-in-out infinite;
}

/* Loading Dots */
.loading-dots {
    display: flex;
    gap: 6px;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--p-primary-color);
    animation: bounce 1.4s ease-in-out infinite;
}

.dot:nth-child(1) {
    animation-delay: 0s;
}

.dot:nth-child(2) {
    animation-delay: 0.2s;
}

.dot:nth-child(3) {
    animation-delay: 0.4s;
}

/* Animations */
@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(0.9);
    }
}

@keyframes bounce {
    0%,
    80%,
    100% {
        transform: translateY(0);
        opacity: 0.5;
    }
    40% {
        transform: translateY(-8px);
        opacity: 1;
    }
}
</style>
