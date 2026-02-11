<script setup>
import TaskDataTable from '@/components/TaskDataTable.vue';
import { getTasks } from '@/services/api/task';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const dataList = ref([]);
const loading = ref(false);
const totalItemsCount = ref(0);
const firstPage = ref(0);
const filters = ref('');

// Fetch tasks with status 3,4 (รอบันทึกบัญชี, ลงบัญชีเสร็จแล้ว)
const loadTasks = async (page = 1, limit = 10, searchQuery = '') => {
    loading.value = true;
    try {
        const params = {
            page,
            limit,
            status: '3,4,6',
            sort: 'ownerat:-1',
            jobfilter: 1,
            ...(searchQuery && { q: searchQuery })
        };

        const response = await getTasks(params);

        if (response.data.success) {
            dataList.value = response.data.data || [];
            totalItemsCount.value = response.data.pagination?.total || 0;
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Handle row selection - navigate to detail page
const handleRowSelect = (data) => {
    router.push({
        name: 'journal-from-image-detail',
        params: { id: data.guidfixed }
    });
};

// Handle search
const handleSearch = (searchQuery) => {
    filters.value = searchQuery;
    firstPage.value = 0;
    loadTasks(1, 10, searchQuery);
};

// Handle pagination
const handlePage = (page, limit) => {
    firstPage.value = (page - 1) * limit;
    loadTasks(page, limit, filters.value);
};

// Load initial data
onMounted(() => {
    loadTasks();
});
</script>

<template>
    <div class="card">
        <div class="text-2xl font-bold mb-5 text-surface-900 dark:text-surface-0">บันทึกรายการบัญชีจากรูปภาพ</div>

        <TaskDataTable :modeMenu="3" :dataList="dataList" :loading="loading" :firstPage="firstPage" :totalItemsCount="totalItemsCount" :filters="filters" @onRowSelect="handleRowSelect" @search="handleSearch" @onPage="handlePage" />
    </div>
</template>
