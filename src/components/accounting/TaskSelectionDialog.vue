<script setup>
import { getTasks } from '@/services/api/task';
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'taskSelected']);

const tasks = ref([]);
const loading = ref(false);
const selectedTask = ref(null);
const searchQuery = ref('');
const currentPage = ref(1);
const totalRecords = ref(0);
const rowsPerPage = ref(10);

// Status config
const STATUS_CONFIG = {
    3: { text: 'รอบันทึกบัญชี', severity: 'info' },
    4: { text: 'เสร็จสิ้น', severity: 'success' },
    6: { text: 'ไม่ผ่านการอนุมัติ', severity: 'warn' }
};

const getStatusText = (status) => STATUS_CONFIG[status]?.text || '-';
const getStatusSeverity = (status) => STATUS_CONFIG[status]?.severity || 'secondary';

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

// Fetch tasks with status 3 and 4
const fetchTasks = async () => {
    loading.value = true;
    try {
        const response = await getTasks({
            page: currentPage.value,
            limit: rowsPerPage.value,
            status: '3,4,6', // Only status 3 (รอบันทึกบัญชี), 4 (เสร็จสิ้น), and 6 (ไม่ผ่านการอนุมัติ)
            q: searchQuery.value || undefined,
            sort: 'ownerat:-1'
        });

        if (response.data.success) {
            tasks.value = response.data.data || [];
            totalRecords.value = response.data.pagination?.total || 0;
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
        tasks.value = [];
        totalRecords.value = 0;
    } finally {
        loading.value = false;
    }
};

// Handle page change
const onPage = (event) => {
    currentPage.value = event.page + 1;
    rowsPerPage.value = event.rows;
    fetchTasks();
};

// Handle search
let searchTimeout = null;
const onSearch = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage.value = 1;
        fetchTasks();
    }, 500);
};

// Handle row selection
const onRowSelect = () => {
    if (selectedTask.value) {
        emit('taskSelected', selectedTask.value);
        emit('update:visible', false);
        selectedTask.value = null;
    }
};

// Handle cancel
const handleCancel = () => {
    emit('update:visible', false);
    selectedTask.value = null;
};

// Watch visibility to fetch tasks when dialog opens
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            selectedTask.value = null;
            fetchTasks();
        }
    }
);

onMounted(() => {
    if (props.visible) {
        fetchTasks();
    }
});
</script>

<template>
    <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal :dismissableMask="true" header="เลือก Task" :style="{ width: '90vw', maxWidth: '1200px' }" :breakpoints="{ '960px': '95vw' }">
        <template #header>
            <div class="flex items-center gap-3">
                <i class="pi pi-folder-open text-2xl text-primary-500"></i>
                <div>
                    <div class="text-xl font-bold">เลือก Task</div>
                    <div class="text-sm text-surface-500 dark:text-surface-400">เลือก Task ที่มีสถานะรอบันทึกบัญชีหรือเสร็จสิ้น</div>
                </div>
            </div>
        </template>

        <!-- Search -->
        <div class="mb-4">
            <IconField>
                <InputIcon>
                    <i class="pi pi-search" />
                </InputIcon>
                <InputText v-model="searchQuery" placeholder="ค้นหา Task..." class="w-full" @input="onSearch" />
            </IconField>
        </div>

        <!-- DataTable -->
        <DataTable
            v-model:selection="selectedTask"
            :value="tasks"
            :loading="loading"
            selectionMode="single"
            dataKey="guidfixed"
            :paginator="true"
            :rows="rowsPerPage"
            :totalRecords="totalRecords"
            :lazy="true"
            @page="onPage"
            @row-select="onRowSelect"
            :rowHover="true"
            showGridlines
            scrollable
            scrollHeight="400px"
            class="text-sm"
        >
            <template #empty>
                <div class="text-center py-8 text-surface-500">
                    <i class="pi pi-inbox text-4xl mb-2 block"></i>
                    <p>ไม่พบ Task ที่มีสถานะรอบันทึกบัญชีหรือเสร็จสิ้น</p>
                </div>
            </template>

            <template #loading>
                <div class="text-center py-8">กำลังโหลดข้อมูล...</div>
            </template>

            <!-- Task Code -->
            <Column field="code" header="รหัส Task" style="min-width: 150px">
                <template #body="{ data }">
                    <span class="font-semibold text-primary-600 dark:text-primary-400">{{ data.code }}</span>
                </template>
            </Column>

            <!-- Task Name -->
            <Column field="name" header="ชื่อ Task" style="min-width: 200px">
                <template #body="{ data }">
                    <div v-tooltip.top="data.name" class="truncate font-medium">
                        {{ data.name || '-' }}
                    </div>
                    <div v-if="data.description" class="text-xs text-surface-500 dark:text-surface-400 truncate mt-1">
                        {{ data.description }}
                    </div>
                </template>
            </Column>

            <!-- Status -->
            <Column field="status" header="สถานะ" style="min-width: 150px; text-align: center">
                <template #body="{ data }">
                    <Tag :value="getStatusText(data.status)" :severity="getStatusSeverity(data.status)" />
                </template>
            </Column>

            <!-- Owner -->
            <Column field="ownerby" header="เจ้าของ" style="min-width: 180px; text-align: center">
                <template #body="{ data }">
                    <div class="text-sm">
                        <div class="truncate" v-tooltip.top="data.ownerby">{{ data.ownerby || '-' }}</div>
                        <div class="text-xs text-surface-500 dark:text-surface-400">{{ formatDate(data.ownerat) }}</div>
                    </div>
                </template>
            </Column>
        </DataTable>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="ยกเลิก" severity="secondary" @click="handleCancel" />
            </div>
        </template>
    </Dialog>
</template>
<style scoped>
/* Header text center alignment - flex container needs justify-content */
:deep(.p-datatable-column-header-content) {
    justify-content: center !important;
}
</style>
