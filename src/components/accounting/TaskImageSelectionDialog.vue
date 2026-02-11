<script setup>
import { getDocumentImageGroups } from '@/services/api/image';
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    task: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'imagesSelected', 'backToTaskSelection']);

const loading = ref(false);
const documentGroups = ref([]); // เปลี่ยนจาก documentImages เป็น documentGroups
const selectedGroup = ref(null); // เลือก group แทน image

const isPDF = (uri) => {
    if (!uri) return false;
    return uri.toLowerCase().endsWith('.pdf');
};

// Get image source for display (first image or PDF icon)
const getImageSrc = (group) => {
    if (!group.imagereferences || group.imagereferences.length === 0) return null;
    const uri = group.imagereferences[0].imageuri;
    return uri;
};

// Fetch document image groups from task
const fetchImages = async () => {
    if (!props.task?.guidfixed) {
        return;
    }

    loading.value = true;
    try {
        const response = await getDocumentImageGroups({
            taskguid: props.task.guidfixed,
            status: '1,3,4',
            limit: 100,
            page: 1
        });

        if (response.data.success && response.data.data) {
            // ใช้ document groups โดยตรง ไม่ flatten
            documentGroups.value = response.data.data;
        } else {
            documentGroups.value = [];
        }
    } catch (error) {
        console.error('Error fetching document images:', error);
        documentGroups.value = [];
    } finally {
        loading.value = false;
    }
};

// Handle confirm selection
const handleConfirm = () => {
    if (!selectedGroup.value) {
        return;
    }
    // ส่ง group guidfixed และ imagereferences ทั้งหมดของ group ที่เลือก
    const result = {
        groupGuidfixed: selectedGroup.value.guidfixed,
        images: selectedGroup.value.imagereferences || []
    };
    emit('imagesSelected', result);
    emit('update:visible', false);
    selectedGroup.value = null;
};

// Handle cancel
const handleCancel = () => {
    emit('update:visible', false);
    selectedGroup.value = null;
};

// Handle back to task selection
const handleBack = () => {
    emit('update:visible', false);
    emit('backToTaskSelection');
};

// Toggle group selection (เลือกได้ 1 ชุดเท่านั้น)
const toggleGroupSelection = (group) => {
    if (selectedGroup.value?.guidfixed === group.guidfixed) {
        selectedGroup.value = null; // ยกเลิกการเลือก
    } else {
        selectedGroup.value = group; // เลือกชุดใหม่
    }
};

// Check if group is selected
const isGroupSelected = (group) => {
    return selectedGroup.value?.guidfixed === group.guidfixed;
};

// Watch visibility to fetch images when dialog opens
watch(
    () => props.visible,
    (newVal) => {
        if (newVal && props.task) {
            selectedGroup.value = null;
            fetchImages();
        }
    }
);

onMounted(() => {
    if (props.visible && props.task) {
        fetchImages();
    }
});
</script>

<template>
    <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal :dismissableMask="true" :style="{ width: '90vw', maxWidth: '1400px' }" :breakpoints="{ '960px': '95vw' }">
        <template #header>
            <div class="flex items-center gap-3 w-full justify-between">
                <div class="flex items-center gap-3">
                    <i class="pi pi-images text-2xl text-primary-500"></i>
                    <div>
                        <div class="text-xl font-bold">เลือกชุดเอกสารจาก Task (เลือกได้ 1 ชุด)</div>
                        <div class="text-sm text-surface-500 dark:text-surface-400">Task: {{ task?.code }} - {{ task?.name }}</div>
                    </div>
                </div>
                <Badge v-if="selectedGroup" :value="`เลือกชุดเอกสาร: ${selectedGroup.title || 'ไม่มีชื่อ'}`" severity="success" class="text-base px-3 py-1" />
            </div>
        </template>

        <div class="image-selection-content">
            <!-- Loading -->
            <div v-if="loading" class="flex justify-center items-center py-20">
                <ProgressSpinner style="width: 50px; height: 50px" />
            </div>

            <!-- Empty State -->
            <div v-else-if="documentGroups.length === 0" class="flex flex-col items-center justify-center py-20 text-surface-500">
                <i class="pi pi-image text-6xl mb-4"></i>
                <p class="text-lg">ไม่พบชุดเอกสารใน Task นี้</p>
            </div>

            <!-- Document Groups Grid -->
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div
                    v-for="group in documentGroups"
                    :key="group.guidfixed"
                    class="relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden cursor-pointer transition-all"
                    :class="{
                        'ring-2 ring-primary scale-105': isGroupSelected(group),
                        'hover:shadow-lg hover:scale-105': !isGroupSelected(group)
                    }"
                    @click="toggleGroupSelection(group)"
                >
                    <!-- Checkbox (selected indicator) -->
                    <div class="absolute top-2 left-2 z-10">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center transition-all" :class="isGroupSelected(group) ? 'bg-primary' : 'bg-surface-900/50 dark:bg-surface-100/50'">
                            <i v-if="isGroupSelected(group)" class="pi pi-check text-white text-xs"></i>
                        </div>
                    </div>

                    <!-- Image count badge (แสดงจำนวนรูปในชุด) -->
                    <div v-if="group.imagereferences && group.imagereferences.length > 1" class="absolute top-2 right-2 z-10 bg-primary text-white text-xs font-bold px-2 py-1 rounded">{{ group.imagereferences.length }} เอกสาร</div>

                    <!-- Image Preview (แสดงรูปแรกของชุด) -->
                    <div v-if="getImageSrc(group)" class="w-full h-full flex items-center justify-center">
                        <template v-if="isPDF(group.imagereferences?.[0]?.imageuri)">
                            <i class="pi pi-file-pdf text-6xl text-red-500"></i>
                        </template>
                        <template v-else>
                            <img :src="getImageSrc(group)" :alt="group.title" class="w-full h-full object-cover" />
                        </template>
                    </div>
                    <div v-else class="w-full h-full flex items-center justify-center">
                        <i class="pi pi-image text-6xl text-surface-400 dark:text-surface-500"></i>
                    </div>

                    <!-- Overlay with info -->
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-900/70 dark:from-surface-800/80 to-transparent p-2">
                        <div class="text-surface-0 text-xs truncate font-medium">{{ group.title || 'ไม่มีชื่อ' }}</div>
                        <div v-if="group.uploadedby" class="text-surface-200 text-xs truncate mt-1"><i class="pi pi-user text-xs mr-1"></i>{{ group.uploadedby }}</div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="กลับ" icon="pi pi-arrow-left" severity="secondary" @click="handleBack" outlined />
            <Button label="ยกเลิก" severity="secondary" @click="handleCancel" />
            <Button label="ยืนยัน" @click="handleConfirm" :disabled="!selectedGroup" />
        </template>
    </Dialog>
</template>

<style scoped>
.image-selection-content {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
