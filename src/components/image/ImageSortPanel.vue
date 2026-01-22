<script setup>
import { useLoading } from '@/composables/useLoading';
import { getDocumentImageGroup, updateDocumentImageGroupImages } from '@/services/api/image';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const props = defineProps({
    imageReferences: {
        type: Array,
        default: () => []
    },
    groupGuidfixed: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['save-complete', 'cancel']);

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

const sortableImages = ref([]);
const saving = ref(false);
const draggedImageIndex = ref(null);
const dragOverImageIndex = ref(null);

onMounted(() => {
    sortableImages.value = [...props.imageReferences];
});

const handleDragStart = (event, index) => {
    draggedImageIndex.value = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
    event.target.style.opacity = '0.5';
};

const handleDragOver = (event, index) => {
    if (draggedImageIndex.value === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverImageIndex.value = index;
};

const handleDragLeave = () => {
    dragOverImageIndex.value = null;
};

const handleDrop = (event, dropIndex) => {
    if (draggedImageIndex.value === null) return;
    event.preventDefault();

    const fromIndex = draggedImageIndex.value;
    const toIndex = dropIndex;

    if (fromIndex !== toIndex) {
        const newOrder = [...sortableImages.value];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);
        sortableImages.value = newOrder;
    }

    draggedImageIndex.value = null;
    dragOverImageIndex.value = null;
};

const handleDragEnd = (event) => {
    event.target.style.opacity = '1';
    draggedImageIndex.value = null;
    dragOverImageIndex.value = null;
};

const saveOrder = async () => {
    if (sortableImages.value.length === 0) return;

    saving.value = true;

    try {
        // Prepare images array with updated xorder
        const imagesData = sortableImages.value.map((img, index) => ({
            xorder: index,
            documentimageguid: img.documentimageguid,
            imageuri: img.imageuri,
            billcount: img.billcount || 1,
            cloneimagefrom: img.cloneimagefrom || '',
            name: img.name || '',
            uploadedby: img.uploadedby || '',
            uploadedat: img.uploadedat || '',
            metafileat: img.metafileat || '',
            ...(img.comments && img.comments.length > 0 ? { comments: img.comments } : {})
        }));

        showLoading('กำลังบันทึกการเรียงรูปภาพ...');
        await updateDocumentImageGroupImages(props.groupGuidfixed, imagesData);

        // Refresh the group data
        showLoading('กำลังโหลดข้อมูลเอกสาร...');
        await getDocumentImageGroup(props.groupGuidfixed);

        hideLoading();
        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'บันทึกการเรียงรูปภาพแล้ว',
            life: 3000
        });

        emit('save-complete');
    } catch (error) {
        console.error('Save image order error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถบันทึกการเรียงรูปภาพได้',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const cancel = () => {
    emit('cancel');
};

const isPDF = (uri) => {
    if (!uri) return false;
    return uri.toLowerCase().endsWith('.pdf');
};
</script>

<template>
    <div class="h-full flex flex-col">
        <!-- Header with actions -->
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center gap-2">
                <i class="pi pi-sort-alt text-xl text-primary"></i>
                <div class="text-lg font-semibold text-surface-900 dark:text-surface-100">เรียงลำดับรูปภาพ</div>
            </div>
            <div class="flex gap-2">
                <Button label="บันทึก" icon="pi pi-check" severity="success" size="small" @click="saveOrder" :loading="saving" />
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" size="small" @click="cancel" outlined />
            </div>
        </div>

        <!-- Sortable Grid -->
        <div class="flex-1 overflow-auto">
            <div class="grid grid-cols-2 gap-4 pb-4">
                <div
                    v-for="(img, index) in sortableImages"
                    :key="img.documentimageguid"
                    :draggable="true"
                    class="relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden transition-all cursor-move"
                    :class="{
                        'ring-2 ring-blue-500': dragOverImageIndex === index,
                        'opacity-50': draggedImageIndex === index
                    }"
                    @dragstart="handleDragStart($event, index)"
                    @dragover="handleDragOver($event, index)"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop($event, index)"
                    @dragend="handleDragEnd"
                >
                    <!-- Order number badge -->
                    <div class="absolute top-2 left-2 z-20 bg-primary text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                        {{ index + 1 }}
                    </div>

                    <!-- Drag handle icon -->
                    <div class="absolute top-2 right-2 z-20 bg-surface-900/70 dark:bg-surface-100/70 text-white dark:text-surface-900 w-8 h-8 rounded-full flex items-center justify-center">
                        <i class="pi pi-bars text-sm"></i>
                    </div>

                    <!-- Image/PDF thumbnail -->
                    <div v-if="isPDF(img.imageuri)" class="w-full h-full flex items-center justify-center">
                        <img src="/demo/images/pdf-icon.svg" alt="PDF" class="w-3/5 h-3/5 object-contain" />
                    </div>
                    <img v-else :src="img.imageuri" :alt="img.name" class="w-full h-full object-cover" />

                    <!-- Image name overlay -->
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-900/70 dark:from-surface-800/80 to-transparent p-2">
                        <div class="text-surface-0 text-xs truncate font-medium">{{ img.name || 'ไม่มีชื่อ' }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Helper text -->
        <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
            <p class="text-xs text-surface-600 dark:text-surface-400 text-center">
                <i class="pi pi-info-circle mr-1"></i>
                ลากรูปภาพเพื่อเรียงลำดับใหม่ แล้วกดปุ่ม "บันทึก" เมื่อเสร็จสิ้น
            </p>
        </div>
    </div>
</template>
