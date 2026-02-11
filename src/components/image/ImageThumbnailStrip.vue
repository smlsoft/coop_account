<script setup>
import { getDocumentImageGroup, getDocumentImageGroups } from '@/services/api/image';
import { deselectDocref, getDocrefSelected, selectDocref } from '@/services/api/journal';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
    taskId: {
        type: String,
        required: true
    },
    currentDocumentRef: {
        type: String,
        required: true
    },
    hasUnsavedChanges: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['change-document', 'confirm-change']);

// Expose methods for parent component
defineExpose({
    refresh: async () => {
        console.log('🔄 Refresh called from parent component');

        // Reload current document to get updated data (e.g., after save)
        if (props.currentDocumentRef) {
            try {
                console.log('📦 Reloading current document after refresh:', props.currentDocumentRef);
                const response = await getDocumentImageGroup(props.currentDocumentRef);
                if (response.data.success && response.data.data) {
                    currentDocumentGroup.value = response.data.data;
                    console.log('✅ Current document reloaded with updated data');
                }
            } catch (error) {
                console.error('❌ Error reloading current document:', error);
            }
        }

        await loadImageGroups(1);
    },

    // Check if there is a next document
    hasNextDocument: () => {
        return hasNextImage.value;
    },

    // Go to next document (for auto-next after save)
    goToNextDocument: async () => {
        console.log('⏭️ Auto navigate to next document');

        if (!hasNextImage.value) {
            console.log('⚠️ No next document available');
            return false;
        }

        const nextIndex = currentIndex.value + 1;
        if (nextIndex < imageGroups.value.length) {
            const nextGroup = imageGroups.value[nextIndex];
            console.log('➡️ Moving to next document:', nextGroup.guidfixed);
            await performDocumentChange(nextGroup.guidfixed);
            return true;
        } else if (hasNextPage.value) {
            // Load next page and navigate to first item
            console.log('📄 Loading next page...');
            await loadMore();
            await nextTick();

            if (imageGroups.value.length > nextIndex) {
                const nextGroup = imageGroups.value[nextIndex];
                console.log('➡️ Moving to next document from new page:', nextGroup.guidfixed);
                await performDocumentChange(nextGroup.guidfixed);
                return true;
            }
        }

        return false;
    }
});

const toast = useToast();

// State
const imageGroups = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0); // Total count from pagination
const limit = 20;
const scrollContainer = ref(null);
const showUnsavedWarning = ref(false);
const pendingDocumentRef = ref(null);

// Keep current document group to preserve it after saving
const currentDocumentGroup = ref(null);

// WebSocket/API state for selected documents
const selectedDocRefs = ref([]);
let pollingInterval = null;

// Debounce and retry state
let lastFetchTime = 0;
const FETCH_DEBOUNCE = 1000; // 1 second
let retryCount = 0;
const MAX_RETRIES = 3;
let isFetchingSelected = false;

// Loading state for document change
const changingDocument = ref(false);

// Computed
const currentIndex = computed(() => {
    return imageGroups.value.findIndex((group) => group.guidfixed === props.currentDocumentRef);
});

const totalImages = computed(() => imageGroups.value.length);

// Display current position (1-based)
const currentPosition = computed(() => {
    return currentIndex.value >= 0 ? currentIndex.value + 1 : 0;
});

const hasNextPage = computed(() => currentPage.value < totalPages.value);

const hasPrevImage = computed(() => currentIndex.value > 0);

const hasNextImage = computed(() => currentIndex.value < totalImages.value - 1 || hasNextPage.value);

// Check if document ref is being used by someone
const isDocRefSelected = (docRef) => {
    return selectedDocRefs.value.some((item) => item.docref === docRef);
};

// Check if document has journal references (saved)
const hasJournalReferences = (group) => {
    return group.references && group.references.length > 0;
};

// Check if image is PDF
const isPdfImage = (imageUri) => {
    return imageUri && imageUri.toLowerCase().endsWith('.pdf');
};

// Load image groups from API
const loadImageGroups = async (page = 1, append = false) => {
    loading.value = true;
    try {
        const response = await getDocumentImageGroups({
            taskguid: props.taskId,
            status: 1,
            reserve: 1,
            ref: 1,
            limit: limit,
            page: page,
            sort: 'xorder:1,guidfixed:1'
        });

        if (response.data.success) {
            const newGroups = response.data.data || [];
            console.log('🔍 API Response:', {
                totalGroups: newGroups.length,
                currentDocumentRef: props.currentDocumentRef,
                guidfixedList: newGroups.map((g) => g.guidfixed),
                hasCurrentInResponse: newGroups.some((g) => g.guidfixed === props.currentDocumentRef)
            });

            if (append) {
                imageGroups.value = [...imageGroups.value, ...newGroups];
                // append mode - use original totalCount
                if (response.data.pagination) {
                    totalPages.value = response.data.pagination.totalPage || 1;
                    totalCount.value = response.data.pagination.total || 0;
                    currentPage.value = page;
                }
            } else {
                // Store current document group before replacing
                if (props.currentDocumentRef) {
                    const currentGroup = imageGroups.value.find((g) => g.guidfixed === props.currentDocumentRef);
                    if (currentGroup) {
                        currentDocumentGroup.value = currentGroup;
                        console.log('📦 Stored current document group:', currentGroup.guidfixed);
                    } else {
                        console.log('⚠️ Current document not in existing imageGroups');
                    }
                }

                imageGroups.value = newGroups;
                console.log('📥 Loaded', newGroups.length, 'image groups from API');

                // If current document is not in the new list (because it was saved and filtered out)
                // Prepend it to the list
                if (props.currentDocumentRef && currentDocumentGroup.value) {
                    const exists = imageGroups.value.some((g) => g.guidfixed === props.currentDocumentRef);
                    console.log('🔎 Checking if current doc exists in list:', {
                        currentDocRef: props.currentDocumentRef,
                        exists: exists,
                        hasCurrentDocGroup: !!currentDocumentGroup.value
                    });
                    if (!exists) {
                        console.log('🔄 Current document not in list, prepending:', currentDocumentGroup.value.guidfixed);
                        imageGroups.value = [currentDocumentGroup.value, ...imageGroups.value];
                        console.log('✅ After prepend, total images:', imageGroups.value.length);

                        // Update totalCount to include prepended document
                        if (response.data.pagination) {
                            totalPages.value = response.data.pagination.totalPage || 1;
                            totalCount.value = (response.data.pagination.total || 0) + 1; // +1 for prepended document
                            currentPage.value = page;
                        }
                    } else {
                        console.log('✅ Current document exists in list:', props.currentDocumentRef);

                        // Use original totalCount
                        if (response.data.pagination) {
                            totalPages.value = response.data.pagination.totalPage || 1;
                            totalCount.value = response.data.pagination.total || 0;
                            currentPage.value = page;
                        }
                    }
                } else {
                    // No currentDocumentGroup to prepend, use original totalCount
                    if (response.data.pagination) {
                        totalPages.value = response.data.pagination.totalPage || 1;
                        totalCount.value = response.data.pagination.total || 0;
                        currentPage.value = page;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading image groups:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดรายการรูปภาพได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

// Load more images (infinite scroll)
const loadMore = async () => {
    if (loading.value || !hasNextPage.value) return;
    await loadImageGroups(currentPage.value + 1, true);
};

// Fetch selected docrefs from API with debounce and retry
const fetchSelectedDocRefs = async () => {
    // Debounce: prevent too frequent calls
    const now = Date.now();
    if (now - lastFetchTime < FETCH_DEBOUNCE) {
        return;
    }
    lastFetchTime = now;

    // Prevent concurrent calls
    if (isFetchingSelected) {
        return;
    }
    isFetchingSelected = true;

    try {
        const response = await getDocrefSelected();
        if (response.data.success && response.data.data) {
            selectedDocRefs.value = response.data.data;
            console.log('📋 Selected docrefs:', selectedDocRefs.value);
            retryCount = 0; // Reset retry count on success
        }
    } catch (error) {
        console.error('Error fetching selected docrefs:', error);

        // Retry logic with exponential backoff
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const retryDelay = 2000 * retryCount; // 2s, 4s, 6s
            console.log(`🔄 Retrying fetch selected docrefs in ${retryDelay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(() => {
                isFetchingSelected = false;
                fetchSelectedDocRefs();
            }, retryDelay);
        } else {
            // Max retries reached - silent fail
            retryCount = 0;
        }
    } finally {
        if (retryCount === 0) {
            isFetchingSelected = false;
        }
    }
};

// Start polling for selected docrefs every 10 seconds
const startPolling = () => {
    // Fetch immediately
    fetchSelectedDocRefs();

    // Then poll every 10 seconds
    pollingInterval = setInterval(() => {
        fetchSelectedDocRefs();
    }, 10000);
};

// Stop polling
const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
};

// Handle scroll event for infinite scroll
const handleScroll = () => {
    if (!scrollContainer.value || loading.value) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;

    // Load more when scrolled 80%
    if (scrollPercentage > 0.8 && hasNextPage.value) {
        loadMore();
    }
};

// Change document with WebSocket select/deselect
const changeDocument = async (newDocumentRef) => {
    if (newDocumentRef === props.currentDocumentRef) return;

    // Check unsaved changes
    if (props.hasUnsavedChanges) {
        pendingDocumentRef.value = newDocumentRef;
        showUnsavedWarning.value = true;
        return;
    }

    await performDocumentChange(newDocumentRef);
};

// Perform actual document change
const performDocumentChange = async (newDocumentRef) => {
    // Prevent double-click or concurrent changes
    if (changingDocument.value) {
        console.log('⚠️ Document change already in progress');
        return;
    }

    changingDocument.value = true;
    console.log('🟣 ImageThumbnailStrip performDocumentChange called:', newDocumentRef);

    try {
        // Deselect old document
        if (props.currentDocumentRef) {
            console.log('🔴 Deselecting old document:', props.currentDocumentRef);
            await deselectDocref(props.currentDocumentRef);
        }

        // Select new document
        console.log('🟢 Selecting new document:', newDocumentRef);
        await selectDocref(newDocumentRef);
        console.log('✅ ImageThumbnailStrip selectDocref success');

        // Fetch selected docrefs immediately to update status
        await fetchSelectedDocRefs();

        // Emit change event
        emit('change-document', newDocumentRef);
    } catch (error) {
        console.error('❌ ImageThumbnailStrip error changing document:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถเปลี่ยนรูปภาพได้',
            life: 3000
        });
    } finally {
        changingDocument.value = false;
    }
};

// Confirm unsaved changes warning
const confirmUnsavedChange = async () => {
    showUnsavedWarning.value = false;
    if (pendingDocumentRef.value) {
        await performDocumentChange(pendingDocumentRef.value);
        pendingDocumentRef.value = null;
    }
};

// Cancel unsaved changes warning
const cancelUnsavedChange = () => {
    showUnsavedWarning.value = false;
    pendingDocumentRef.value = null;
};

// Navigate to previous image
const navigatePrev = () => {
    if (!hasPrevImage.value) return;
    const prevGroup = imageGroups.value[currentIndex.value - 1];
    if (prevGroup) {
        changeDocument(prevGroup.guidfixed);
    }
};

// Navigate to next image
const navigateNext = async () => {
    if (!hasNextImage.value) return;

    const nextIndex = currentIndex.value + 1;
    if (nextIndex < imageGroups.value.length) {
        const nextGroup = imageGroups.value[nextIndex];
        changeDocument(nextGroup.guidfixed);
    } else if (hasNextPage.value) {
        // Load next page and navigate to first item
        await loadMore();
        await nextTick();
        if (imageGroups.value[nextIndex]) {
            changeDocument(imageGroups.value[nextIndex].guidfixed);
        }
    }
};

// Keyboard navigation
const handleKeyboard = (event) => {
    // Arrow Left - Previous image
    if (event.key === 'ArrowLeft' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Check if user is not typing in input/textarea
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        event.preventDefault();
        navigatePrev();
    }
    // Arrow Right - Next image
    else if (event.key === 'ArrowRight' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        event.preventDefault();
        navigateNext();
    }
};

// Scroll to current thumbnail
const scrollToCurrent = () => {
    if (!scrollContainer.value || currentIndex.value === -1) return;

    const thumbnails = scrollContainer.value.querySelectorAll('.thumbnail-item');
    const currentThumbnail = thumbnails[currentIndex.value];

    if (currentThumbnail) {
        currentThumbnail.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }
};

// Watch for current document changes to scroll
watch(
    () => props.currentDocumentRef,
    async (newDocRef, oldDocRef) => {
        console.log('👁️ Watch triggered - currentDocumentRef changed from', oldDocRef, 'to', newDocRef);

        await nextTick();

        // Update current document group
        const currentGroup = imageGroups.value.find((g) => g.guidfixed === newDocRef);
        if (currentGroup) {
            currentDocumentGroup.value = currentGroup;
            console.log('📦 Updated currentDocumentGroup from watch:', currentGroup.guidfixed);
        }

        // Check if current document is in loaded groups
        const index = imageGroups.value.findIndex((group) => group.guidfixed === newDocRef);
        console.log('🔍 Current document index in list:', index);

        // Only reload if document not found AND we have loaded some groups
        if (index === -1 && newDocRef && imageGroups.value.length > 0) {
            console.log('⚠️ Document not found in list, reloading from page 1');
            // Document not found in current loaded groups
            // Need to load from beginning to find it
            await loadImageGroups(1);
            await nextTick();
        }

        scrollToCurrent();
    },
    { immediate: false } // Don't trigger on mount
);

onMounted(async () => {
    console.log('🎬 ImageThumbnailStrip mounted, currentDocumentRef:', props.currentDocumentRef);

    // Load current document first (may be filtered out from list)
    if (props.currentDocumentRef) {
        try {
            const response = await getDocumentImageGroup(props.currentDocumentRef);
            if (response.data.success && response.data.data) {
                currentDocumentGroup.value = response.data.data;
                console.log('📦 Loaded current document from API:', currentDocumentGroup.value.guidfixed);
            }
        } catch (error) {
            console.error('❌ Error loading current document:', error);
        }
    }

    await loadImageGroups(1);
    await nextTick();

    scrollToCurrent();

    // Start polling for selected docrefs
    startPolling();

    // Add keyboard listener
    window.addEventListener('keydown', handleKeyboard);

    // Add scroll listener
    if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', handleScroll);
    }
});

onBeforeUnmount(() => {
    // Stop polling
    stopPolling();

    window.removeEventListener('keydown', handleKeyboard);
    if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', handleScroll);
    }
});
</script>

<template>
    <div class="thumbnail-strip-container bg-surface-0 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700">
        <!-- Navigation Info -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center gap-3">
                <span class="text-sm text-surface-600 dark:text-surface-400">
                    <i class="pi pi-images mr-2"></i>
                    รูปที่ <strong class="text-surface-900 dark:text-surface-0">{{ currentPosition }}</strong> / <span>{{ totalCount }}</span>
                </span>
            </div>
            <div class="flex items-center gap-2">
                <Button icon="pi pi-chevron-left" text size="small" @click="navigatePrev" :disabled="!hasPrevImage" v-tooltip.top="'รูปก่อนหน้า (←)'" />
                <Button icon="pi pi-chevron-right" text size="small" @click="navigateNext" :disabled="!hasNextImage" v-tooltip.top="'รูปถัดไป (→)'" />
            </div>
        </div>

        <!-- Thumbnails Strip -->
        <div ref="scrollContainer" class="thumbnails-scroll overflow-x-auto overflow-y-hidden p-3" style="height: 140px">
            <div class="flex gap-3" style="min-width: min-content">
                <!-- Thumbnail Item -->
                <div
                    v-for="(group, index) in imageGroups"
                    :key="group.guidfixed"
                    class="thumbnail-item flex-shrink-0 cursor-pointer transition-all duration-200"
                    :class="{
                        'ring-4 ring-primary-500 scale-105': group.guidfixed === currentDocumentRef,
                        'ring-2 ring-green-500': hasJournalReferences(group) && group.guidfixed !== currentDocumentRef,
                        'ring-2 ring-blue-400': isDocRefSelected(group.guidfixed) && group.guidfixed !== currentDocumentRef && !hasJournalReferences(group),
                        'hover:ring-2 hover:ring-surface-300 dark:hover:ring-surface-600': group.guidfixed !== currentDocumentRef && !hasJournalReferences(group) && !isDocRefSelected(group.guidfixed)
                    }"
                    @click="changeDocument(group.guidfixed)"
                >
                    <div class="relative bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden" style="width: 100px; height: 100px">
                        <!-- PDF Icon -->
                        <div v-if="group.imagereferences && group.imagereferences.length > 0 && isPdfImage(group.imagereferences[0].imageuri)" class="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                            <img src="/demo/images/pdf-icon.svg" alt="PDF" class="w-16 h-16 object-contain" />
                        </div>

                        <!-- Image -->
                        <img v-else-if="group.imagereferences && group.imagereferences.length > 0" :src="group.imagereferences[0].imageuri" :alt="group.title" class="w-full h-full object-cover" loading="lazy" />

                        <!-- Placeholder -->
                        <div v-else class="w-full h-full flex items-center justify-center text-surface-400 dark:text-surface-500">
                            <i class="pi pi-image text-3xl"></i>
                        </div>

                        <!-- Multiple images indicator -->
                        <div v-if="group.imagereferences && group.imagereferences.length > 1" class="absolute top-1 right-1 bg-surface-900/80 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
                            <i class="pi pi-images mr-1 text-[10px]"></i>{{ group.imagereferences.length }}
                        </div>

                        <!-- Status indicators -->
                        <div class="absolute top-1 left-1 flex gap-1">
                            <!-- Saved indicator (green) -->
                            <div v-if="hasJournalReferences(group)" v-tooltip.top="'บันทึก journal แล้ว'" class="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <i class="pi pi-check text-[10px]"></i>
                            </div>

                            <!-- In-use indicator (blue) -->
                            <div v-if="isDocRefSelected(group.guidfixed)" v-tooltip.top="'มีผู้ใช้งานอยู่'" class="bg-blue-400 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <i class="pi pi-user text-[10px]"></i>
                            </div>
                        </div>

                        <!-- Current indicator -->
                        <div v-if="group.guidfixed === currentDocumentRef" class="absolute inset-0 bg-primary-500/10 flex items-center justify-center">
                            <i class="pi pi-check-circle text-primary-500 text-2xl"></i>
                        </div>
                    </div>

                    <!-- Title -->
                    <div class="text-xs text-center mt-1 text-surface-600 dark:text-surface-400 truncate" style="max-width: 100px" :title="group.title || `รูปที่ ${index + 1}`">
                        {{ group.title || `รูปที่ ${index + 1}` }}
                    </div>
                </div>

                <!-- Loading indicator -->
                <div v-if="loading" class="flex-shrink-0 flex items-center justify-center" style="width: 100px">
                    <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                </div>
            </div>
        </div>

        <!-- Unsaved Changes Warning Dialog -->
        <Dialog v-model:visible="showUnsavedWarning" :style="{ width: '450px' }" header="มีการแก้ไขที่ยังไม่ได้บันทึก" :modal="true">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <div>
                    <p class="text-lg mb-2">คุณมีการแก้ไขข้อมูลที่ยังไม่ได้บันทึก</p>
                    <p class="text-surface-600 dark:text-surface-400">หากเปลี่ยนรูปภาพ ข้อมูลที่แก้ไขจะหายไป คุณต้องการดำเนินการต่อหรือไม่?</p>
                </div>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" class="p-button-text" @click="cancelUnsavedChange" autofocus />
                <Button label="เปลี่ยนรูปแบบไม่บันทึก" icon="pi pi-exclamation-triangle" severity="warning" @click="confirmUnsavedChange" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.thumbnail-strip-container {
    width: 100%;
}

.thumbnails-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--p-surface-300) var(--p-surface-100);
}

.thumbnails-scroll::-webkit-scrollbar {
    height: 8px;
}

.thumbnails-scroll::-webkit-scrollbar-track {
    background: var(--p-surface-100);
    border-radius: 4px;
}

.thumbnails-scroll::-webkit-scrollbar-thumb {
    background: var(--p-surface-300);
    border-radius: 4px;
}

.thumbnails-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--p-surface-400);
}

.dark .thumbnails-scroll::-webkit-scrollbar-track {
    background: var(--p-surface-800);
}

.dark .thumbnails-scroll::-webkit-scrollbar-thumb {
    background: var(--p-surface-600);
}

.dark .thumbnails-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--p-surface-500);
}

.thumbnail-item {
    transform-origin: center;
}
</style>
