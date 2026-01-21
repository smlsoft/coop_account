<script setup>
import api from '@/services/api';
import { onMounted, ref } from 'vue';

const loading = ref(true);
const stats = ref({
    chartOfAccount: 0,
    journals: 0,
    documentImages: 0,
    duplicateDocs: 0
});

const fetchStats = async () => {
    loading.value = true;
    try {
        const [chartOfAccountRes, journalsRes, documentImagesRes, duplicateDocsRes] = await Promise.all([
            api.getChartOfAccount({ page: 1, perPage: 1 }),
            api.getJournals({ page: 1, perPage: 1, limit: 9999 }),
            api.getDocumentImages({ page: 1, perPage: 1, limit: 9999 }),
            api.getDuplicateDocNos()
        ]);

        stats.value = {
            chartOfAccount: chartOfAccountRes.data.pagination?.total || 0,
            journals: journalsRes.data.pagination?.total || 0,
            documentImages: documentImagesRes.data.pagination?.total || 0,
            duplicateDocs: duplicateDocsRes.data.data?.length || 0
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchStats();
});
</script>

<template>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="card mb-0">
            <div v-if="loading" class="space-y-4">
                <div class="flex justify-between">
                    <div class="flex-1">
                        <Skeleton width="60%" height="1rem" class="mb-4"></Skeleton>
                        <Skeleton width="40%" height="1.5rem"></Skeleton>
                    </div>
                    <Skeleton shape="circle" size="2.5rem"></Skeleton>
                </div>
                <Skeleton width="80%" height="0.875rem"></Skeleton>
            </div>
            <div v-else>
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">ผังบัญชี</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ stats.chartOfAccount.toLocaleString() }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-list text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">รายการทั้งหมด</span>
            </div>
        </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="card mb-0">
            <div v-if="loading" class="space-y-4">
                <div class="flex justify-between">
                    <div class="flex-1">
                        <Skeleton width="60%" height="1rem" class="mb-4"></Skeleton>
                        <Skeleton width="40%" height="1.5rem"></Skeleton>
                    </div>
                    <Skeleton shape="circle" size="2.5rem"></Skeleton>
                </div>
                <Skeleton width="80%" height="0.875rem"></Skeleton>
            </div>
            <div v-else>
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">รายการบันทึกบัญชี</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ stats.journals.toLocaleString() }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-book text-orange-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">รายการทั้งหมด</span>
            </div>
        </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="card mb-0">
            <div v-if="loading" class="space-y-4">
                <div class="flex justify-between">
                    <div class="flex-1">
                        <Skeleton width="60%" height="1rem" class="mb-4"></Skeleton>
                        <Skeleton width="40%" height="1.5rem"></Skeleton>
                    </div>
                    <Skeleton shape="circle" size="2.5rem"></Skeleton>
                </div>
                <Skeleton width="80%" height="0.875rem"></Skeleton>
            </div>
            <div v-else>
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">รูปภาพ</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ stats.documentImages.toLocaleString() }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-image text-cyan-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">รูปภาพทั้งหมด</span>
            </div>
        </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
        <div class="card mb-0">
            <div v-if="loading" class="space-y-4">
                <div class="flex justify-between">
                    <div class="flex-1">
                        <Skeleton width="60%" height="1rem" class="mb-4"></Skeleton>
                        <Skeleton width="40%" height="1.5rem"></Skeleton>
                    </div>
                    <Skeleton shape="circle" size="2.5rem"></Skeleton>
                </div>
                <Skeleton width="80%" height="0.875rem"></Skeleton>
            </div>
            <div v-else>
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">เลขที่เอกสารซ้ำ</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ stats.duplicateDocs }}
                            <span v-if="stats.duplicateDocs > 0" class="text-red-500">รายการ</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-center rounded-border" :class="stats.duplicateDocs > 0 ? 'bg-red-100 dark:bg-red-400/10' : 'bg-green-100 dark:bg-green-400/10'" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi text-xl!" :class="stats.duplicateDocs > 0 ? 'pi-exclamation-triangle text-red-500' : 'pi-check-circle text-green-500'"></i>
                    </div>
                </div>
                <span v-if="stats.duplicateDocs > 0" class="text-red-500 font-medium">ต้องตรวจสอบ</span>
                <span v-else class="text-green-500 font-medium">ไม่มีเอกสารซ้ำ</span>
            </div>
        </div>
    </div>
</template>
