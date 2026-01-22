<script setup>
import ImageCommentSection from '@/components/image/ImageCommentSection.vue';
import ImageSortPanel from '@/components/image/ImageSortPanel.vue';
import ImageTagSection from '@/components/image/ImageTagSection.vue';
import ImageZoomViewer from '@/components/image/ImageZoomViewer.vue';
import PdfViewer from '@/components/image/PdfViewer.vue';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    selectedGroup: {
        type: Object,
        default: null
    },
    selectedImageDetail: {
        type: Object,
        default: null
    },
    loadingDetail: {
        type: Boolean,
        default: false
    },
    isJobClosed: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['refresh-detail', 'refresh-group']);

const currentImageIndex = ref(0);
const showCommentDialog = ref(false);
const showTagDialog = ref(false);
const imageSortMode = ref(false);

// Computed properties for carousel
const currentImageRef = computed(() => {
    if (!props.selectedGroup?.imagereferences?.length) return null;
    return props.selectedGroup.imagereferences[currentImageIndex.value];
});

const totalImages = computed(() => {
    return props.selectedGroup?.imagereferences?.length || 0;
});

const canGoPrev = computed(() => currentImageIndex.value > 0);
const canGoNext = computed(() => currentImageIndex.value < totalImages.value - 1);

// Reset image index when group changes
watch(
    () => props.selectedGroup,
    () => {
        currentImageIndex.value = 0;
    }
);

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

const handleCommentAdded = () => {
    emit('refresh-detail');
};

const openCommentDialog = () => {
    if (props.isJobClosed) return;
    showCommentDialog.value = true;
};

const handleTagsUpdated = () => {
    emit('refresh-group');
};

const openTagDialog = () => {
    if (props.isJobClosed) return;
    showTagDialog.value = true;
};

const toggleImageSortMode = () => {
    if (props.isJobClosed) return;
    imageSortMode.value = !imageSortMode.value;
};

const handleImageSortComplete = () => {
    imageSortMode.value = false;
    emit('refresh-group');
};

const handleImageSortCancel = () => {
    imageSortMode.value = false;
};
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <div v-if="!selectedGroup" class="h-full flex flex-col items-center justify-center p-4">
            <i class="pi pi-image text-6xl text-surface-400 dark:text-surface-500 mb-4"></i>
            <p class="text-surface-500 dark:text-surface-400 text-lg">เลือกรูปภาพเพื่อดูรายละเอียด</p>
        </div>
        <div v-else-if="loadingDetail" class="h-full flex items-center justify-center p-4">
            <ProgressSpinner />
        </div>
        <div v-else class="h-full flex flex-col overflow-auto p-4">
            <!-- Sort Images Mode -->
            <ImageSortPanel v-if="imageSortMode && !isJobClosed" :image-references="selectedGroup.imagereferences || []" :group-guidfixed="selectedGroup.guidfixed" @save-complete="handleImageSortComplete" @cancel="handleImageSortCancel" />

            <!-- Normal Mode -->
            <template v-else>
                <div class="mb-4">
                    <h3 class="mb-2 text-surface-900 dark:text-surface-100">{{ selectedGroup.title || 'ไม่มีชื่อ' }}</h3>
                    <div class="flex gap-2 mb-4 items-center">
                        <Tag :value="`${selectedGroup.imagereferences?.length || 0} รูป`" severity="info" />
                        <Tag :value="`${selectedGroup.billcount || 0} บิล`" severity="success" />
                        <Button v-if="selectedImageDetail" icon="pi pi-comment" :label="`${selectedImageDetail.comments?.length || 0}`" severity="secondary" text size="small" @click="openCommentDialog" :disabled="isJobClosed" />
                        <div class="ml-auto">
                            <Button v-if="totalImages > 1" label="เรียงรูปภาพ" icon="pi pi-sort-alt" severity="info" size="small" @click="toggleImageSortMode" :disabled="isJobClosed" outlined />
                        </div>
                    </div>
                </div>

                <!-- รูปภาพเต็ม with Carousel -->
                <div class="mb-4 rounded-lg overflow-hidden relative bg-surface-100 dark:bg-surface-800" style="min-height: 400px; height: 60vh">
                    <!-- Image/PDF Viewer -->
                    <ImageZoomViewer v-if="currentImageRef && !isPDF(currentImageRef.imageuri)" :key="`img-${currentImageIndex}`" :src="currentImageRef.imageuri" :alt="selectedGroup.title" />
                    <PdfViewer v-else-if="currentImageRef && isPDF(currentImageRef.imageuri)" :key="`pdf-${currentImageIndex}`" :src="currentImageRef.imageuri" />

                    <!-- Navigation Arrows (show only if more than 1 image) -->
                    <template v-if="totalImages > 1">
                        <Button icon="pi pi-chevron-left" class="carousel-nav carousel-nav-left" severity="secondary" rounded :disabled="!canGoPrev" @click="prevImage" />
                        <Button icon="pi pi-chevron-right" class="carousel-nav carousel-nav-right" severity="secondary" rounded :disabled="!canGoNext" @click="nextImage" />

                        <!-- Image Counter -->
                        <div class="carousel-counter">{{ currentImageIndex + 1 }} / {{ totalImages }}</div>
                    </template>
                </div>

                <!-- รายละเอียด -->
                <div class="bg-surface-50 dark:bg-surface-800 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
                    <!-- เอกสารอ้างอิง (full width) -->
                    <div v-if="selectedImageDetail?.references && selectedImageDetail.references.length > 0" class="mb-3">
                        <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">เอกสารอ้างอิง</label>
                        <div class="space-y-2 mt-1">
                            <div v-for="(ref, index) in selectedImageDetail.references" :key="index" class="flex gap-2 items-center text-sm text-surface-700 dark:text-surface-200">
                                <Tag :value="ref.module" severity="info" />
                                <span>{{ ref.docno }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 2 Column Grid -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Left Column -->
                        <div class="space-y-3">
                            <div>
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">อัพโหลดโดย</label>
                                <p class="text-sm mt-1 text-surface-700 dark:text-surface-200">{{ selectedGroup.uploadedby }}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">วันที่อัพโหลด</label>
                                <p class="text-sm mt-1 text-surface-700 dark:text-surface-200">
                                    {{ new Date(selectedGroup.uploadedat).toLocaleString('th-TH') }}
                                </p>
                            </div>
                        </div>

                        <!-- Right Column -->
                        <div class="space-y-3">
                            <div>
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">คำอธิบาย</label>
                                <p class="text-sm mt-1 text-surface-700 dark:text-surface-200">{{ selectedGroup.description || '-' }}</p>
                            </div>
                            <div v-if="selectedGroup.tags && selectedGroup.tags.length > 0">
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">Tags</label>
                                <div class="flex flex-wrap gap-2 mt-1 items-center">
                                    <Tag v-for="tag in selectedGroup.tags" :key="tag" :value="tag" />
                                    <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openTagDialog" title="จัดการ Tags" :disabled="isJobClosed" />
                                </div>
                            </div>
                            <div v-else>
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">Tags</label>
                                <div class="mt-1">
                                    <Button icon="pi pi-plus" label="เพิ่ม Tags" size="small" severity="secondary" text @click="openTagDialog" :disabled="isJobClosed" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- Comment Dialog -->
        <ImageCommentSection
            v-model:visible="showCommentDialog"
            :comments="selectedImageDetail?.comments || []"
            :document-image-guid="selectedImageDetail?.guidfixed || ''"
            :image-name="selectedGroup?.title || 'ไม่มีชื่อ'"
            @comment-added="handleCommentAdded"
        />

        <!-- Tag Dialog -->
        <ImageTagSection v-model:visible="showTagDialog" :tags="selectedGroup?.tags || []" :document-image-group-guid="selectedGroup?.guidfixed || ''" :image-name="selectedGroup?.title || 'ไม่มีชื่อ'" @tags-updated="handleTagsUpdated" />
    </div>
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
