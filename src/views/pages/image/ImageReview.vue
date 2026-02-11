<script setup>
import TaskDataTable from '@/components/TaskDataTable.vue';
import { getTasks } from '@/services/api/task';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

// Data list state
const tasks = ref([]);
const totalItemsCount = ref(0);
const loading = ref(false);

// Pagination state
const firstPage = ref(0);
const currentPage = ref(1);
const perPage = ref(10);
const filters = ref('');

// Fetch tasks with status 1,6 (exclude 0)
const fetchTasks = async () => {
    loading.value = true;
    try {
        const params = {
            page: currentPage.value,
            limit: perPage.value,
            status: '1,2,3,4,6',
            sort: 'ownerat:-1'
        };

        if (filters.value.trim()) {
            params.q = filters.value.trim();
        }

        const response = await getTasks(params);

        if (response.data.success) {
            tasks.value = response.data.data || [];
            totalItemsCount.value = response.data.pagination?.total || 0;
            firstPage.value = (currentPage.value - 1) * perPage.value;
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Row select handler - navigate to review detail
const handleRowSelect = (data) => {
    router.push({
        name: 'image-review-detail',
        params: { id: data.guidfixed }
    });
};

// Page change handler
const handlePage = (page, rows) => {
    currentPage.value = page;
    perPage.value = rows;
    firstPage.value = (page - 1) * rows;

    // บันทึกค่าเข้า localStorage
    localStorage.setItem('images_job_review_currentPage', page.toString());
    localStorage.setItem('images_job_review_perPage', rows.toString());

    fetchTasks();
};

// Search handler
const handleSearch = (searchText) => {
    filters.value = searchText;
    currentPage.value = 1;
    firstPage.value = 0;
    fetchTasks();
};

onMounted(() => {
    // ดึงค่า perPage และ currentPage จาก localStorage
    const savedPerPage = localStorage.getItem('images_job_review_perPage');
    const savedCurrentPage = localStorage.getItem('images_job_review_currentPage');

    if (savedPerPage) {
        perPage.value = parseInt(savedPerPage, 10);
    }

    if (savedCurrentPage) {
        currentPage.value = parseInt(savedCurrentPage, 10);
        firstPage.value = (currentPage.value - 1) * perPage.value;
    }

    fetchTasks();
});
</script>

<template>
    <div>
        <Toast />

        <!-- Main Content -->
        <div class="card">
            <h4 class="mb-4">ตรวจสอบรูปภาพเอกสาร</h4>
            <TaskDataTable :modeMenu="2" :dataList="tasks" :loading="loading" :firstPage="firstPage" :totalItemsCount="totalItemsCount" :filters="filters" @onRowSelect="handleRowSelect" @search="handleSearch" @onPage="handlePage" />
        </div>
    </div>
</template>
