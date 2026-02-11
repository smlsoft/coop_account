<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
    imageGroups: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    loadingMore: {
        type: Boolean,
        default: false
    },
    selectedGroup: {
        type: Object,
        default: null
    },
    selectedGroups: {
        type: Array,
        default: () => []
    },
    multiSelectMode: {
        type: Boolean,
        default: false
    },
    sortMode: {
        type: Boolean,
        default: false
    },
    currentPage: {
        type: Number,
        default: 1
    },
    totalPages: {
        type: Number,
        default: 1
    },
    showStatus: {
        type: Boolean,
        default: false
    },
    isJobClosed: {
        type: Boolean,
        default: false
    },
    selectedByUsers: {
        type: Array,
        default: () => []
    },
    disableMerge: {
        type: Boolean,
        default: false
    },
    gridSize: {
        type: String,
        default: 'medium' // small, medium, large, xlarge
    }
});

// Status configuration for review mode
const STATUS_CONFIG = {
    0: { text: 'รอตรวจสอบ', severity: 'secondary', icon: 'pi pi-clock' },
    1: { text: 'ผ่าน', severity: 'success', icon: 'pi pi-check' },
    2: { text: 'ไม่ผ่าน', severity: 'danger', icon: 'pi pi-times' },
    3: { text: 'ไม่บันทึกรายวัน', severity: 'warn', icon: 'pi pi-minus' }
};

const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG[0];
};

const emit = defineEmits(['select-group', 'toggle-group-selection', 'load-more', 'reorder', 'merge-groups', 'add-to-group']);

const selectedIndex = ref(0);
const scrollContainer = ref(null);
const gridContainer = ref(null);

// Drag & Drop state for sort mode
const draggedIndex = ref(null);
const dragOverIndex = ref(null);

// Drag & Drop state for merge mode (non-sort mode)
const mergeDraggedGroup = ref(null);
const mergeDragOverGroup = ref(null);
const isDraggingForMerge = ref(false);

watch(
    () => props.selectedGroup,
    (newGroup) => {
        if (newGroup) {
            const index = props.imageGroups.findIndex((g) => g.guidfixed === newGroup.guidfixed);
            if (index !== -1) {
                selectedIndex.value = index;
            }
        }
    }
);

const handleScroll = (event) => {
    // ปิดการ infinite scroll ในโหมด sort
    if (props.sortMode) return;

    const container = event.target;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;

    // โหลดเพิ่มเมื่อ scroll ถึงใกล้ด้านล่าง (200px)
    if (scrollHeight - scrollTop - clientHeight < 200) {
        emit('load-more');
    }
};

const selectGroup = (group, index) => {
    // ปิดการ select ในโหมด sort
    if (props.sortMode) return;

    if (props.multiSelectMode) {
        emit('toggle-group-selection', group);
    } else {
        selectedIndex.value = index;
        emit('select-group', group, index);
    }
};

const isGroupSelected = (group) => {
    if (props.multiSelectMode) {
        return props.selectedGroups.some((g) => g.guidfixed === group.guidfixed);
    }
    return props.selectedGroup?.guidfixed === group.guidfixed;
};

const handleKeyboardNavigation = (event) => {
    if (props.imageGroups.length === 0) return;

    const maxIndex = props.imageGroups.length - 1;
    let newIndex = selectedIndex.value;

    // คำนวณจำนวนคอลัมน์จาก gridSize (ใช้ค่าเฉลี่ยของ breakpoints)
    const columnsBySize = {
        small: 6,
        medium: 4,
        large: 3,
        xlarge: 2
    };
    const columns = columnsBySize[props.gridSize] || 4;

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            newIndex = Math.max(0, selectedIndex.value - columns);
            break;
        case 'ArrowDown':
            event.preventDefault();
            newIndex = Math.min(maxIndex, selectedIndex.value + columns);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            newIndex = Math.max(0, selectedIndex.value - 1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            newIndex = Math.min(maxIndex, selectedIndex.value + 1);
            break;
        default:
            return;
    }

    if (newIndex !== selectedIndex.value && props.imageGroups[newIndex]) {
        selectGroup(props.imageGroups[newIndex], newIndex);

        // Scroll to selected item if needed
        const selectedElement = gridContainer.value?.children[newIndex];
        if (selectedElement) {
            selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};

const isPDF = (uri) => {
    if (!uri) return false;
    return uri.toLowerCase().endsWith('.pdf');
};

const getImageSrc = (group) => {
    if (!group.imagereferences || group.imagereferences.length === 0) return null;
    const uri = group.imagereferences[0].imageuri;
    if (isPDF(uri)) {
        return '/demo/images/pdf-icon.svg';
    }
    return uri;
};

// Drag & Drop handlers
const handleDragStart = (event, index) => {
    if (!props.sortMode) return;
    draggedIndex.value = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
    event.target.style.opacity = '0.5';
};

const handleDragOver = (event, index) => {
    if (!props.sortMode || draggedIndex.value === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverIndex.value = index;
};

const handleDragLeave = () => {
    dragOverIndex.value = null;
};

const handleDrop = (event, dropIndex) => {
    if (!props.sortMode || draggedIndex.value === null) return;
    event.preventDefault();

    const fromIndex = draggedIndex.value;
    const toIndex = dropIndex;

    if (fromIndex !== toIndex) {
        // สร้าง array ใหม่ที่เรียงลำดับใหม่
        const newOrder = [...props.imageGroups];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);

        // ส่ง event ไปยัง parent
        emit('reorder', newOrder);
    }

    draggedIndex.value = null;
    dragOverIndex.value = null;
};

const handleDragEnd = (event) => {
    event.target.style.opacity = '1';
    draggedIndex.value = null;
    dragOverIndex.value = null;
};

// ========== Drag & Drop handlers for Merge Mode ==========
const handleMergeDragStart = (event, group, index) => {
    // ไม่ทำงานในโหมด sort, multiSelectMode, เมื่องานถูกปิด หรือ disableMerge
    if (props.sortMode || props.multiSelectMode || props.isJobClosed || props.disableMerge) return;

    mergeDraggedGroup.value = group;
    isDraggingForMerge.value = true;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({ guidfixed: group.guidfixed, index }));
    event.target.style.opacity = '0.5';
};

const handleMergeDragOver = (event, group, index) => {
    // ไม่ทำงานในโหมด sort, multiSelectMode, เมื่องานถูกปิด หรือ disableMerge
    if (props.sortMode || props.multiSelectMode || props.isJobClosed || props.disableMerge) return;
    if (!isDraggingForMerge.value || !mergeDraggedGroup.value) return;

    // ไม่ให้ drop ลงบนตัวเอง
    if (mergeDraggedGroup.value.guidfixed === group.guidfixed) return;

    // ชุด กับ ชุด รวมกันไม่ได้
    const sourceHasMultipleImages = mergeDraggedGroup.value.imagereferences && mergeDraggedGroup.value.imagereferences.length > 1;
    const targetHasMultipleImages = group.imagereferences && group.imagereferences.length > 1;
    if (sourceHasMultipleImages && targetHasMultipleImages) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    mergeDragOverGroup.value = group;
};

const handleMergeDragLeave = (event) => {
    // ตรวจสอบว่าออกจาก element จริงๆ ไม่ใช่แค่ไปยัง child
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
        return;
    }
    mergeDragOverGroup.value = null;
};

const handleMergeDrop = (event, targetGroup, targetIndex) => {
    // ไม่ทำงานในโหมด sort, multiSelectMode, เมื่องานถูกปิด หรือ disableMerge
    if (props.sortMode || props.multiSelectMode || props.isJobClosed || props.disableMerge) return;
    if (!isDraggingForMerge.value || !mergeDraggedGroup.value) return;

    event.preventDefault();

    const sourceGroup = mergeDraggedGroup.value;

    // ไม่ให้ drop ลงบนตัวเอง
    if (sourceGroup.guidfixed === targetGroup.guidfixed) {
        resetMergeDragState();
        return;
    }

    // ตรวจสอบว่า source และ target มีหลายรูปหรือไม่
    const sourceHasMultipleImages = sourceGroup.imagereferences && sourceGroup.imagereferences.length > 1;
    const targetHasMultipleImages = targetGroup.imagereferences && targetGroup.imagereferences.length > 1;

    // ชุด กับ ชุด รวมกันไม่ได้
    if (sourceHasMultipleImages && targetHasMultipleImages) {
        resetMergeDragState();
        return;
    }

    if (targetHasMultipleImages) {
        // Use Case 2: เพิ่มเอกสารเข้าในชุดที่มีอยู่แล้ว (source ต้องมี 1 รูป)
        emit('add-to-group', {
            sourceGroup,
            targetGroup
        });
    } else {
        // Use Case 1: รวมเอกสาร (สร้าง group ใหม่)
        emit('merge-groups', {
            sourceGroup,
            targetGroup
        });
    }

    resetMergeDragState();
};

const handleMergeDragEnd = (event) => {
    event.target.style.opacity = '1';
    resetMergeDragState();
};

const resetMergeDragState = () => {
    mergeDraggedGroup.value = null;
    mergeDragOverGroup.value = null;
    isDraggingForMerge.value = false;
};

// Combined drag handlers - เลือกใช้ตาม mode
const onDragStart = (event, group, index) => {
    if (props.sortMode) {
        handleDragStart(event, index);
    } else if (!props.multiSelectMode) {
        handleMergeDragStart(event, group, index);
    }
};

const onDragOver = (event, group, index) => {
    if (props.sortMode) {
        handleDragOver(event, index);
    } else if (!props.multiSelectMode) {
        handleMergeDragOver(event, group, index);
    }
};

const onDragLeave = (event) => {
    if (props.sortMode) {
        handleDragLeave();
    } else {
        handleMergeDragLeave(event);
    }
};

const onDrop = (event, group, index) => {
    if (props.sortMode) {
        handleDrop(event, index);
    } else if (!props.multiSelectMode) {
        handleMergeDrop(event, group, index);
    }
};

const onDragEnd = (event) => {
    if (props.sortMode) {
        handleDragEnd(event);
    } else {
        handleMergeDragEnd(event);
    }
};

// ตรวจสอบว่ากำลัง drag over group นี้อยู่หรือไม่
const isMergeDragOver = (group) => {
    return isDraggingForMerge.value && mergeDragOverGroup.value?.guidfixed === group.guidfixed;
};

// ตรวจสอบว่า group นี้กำลังถูก drag อยู่หรือไม่
const isMergeDragging = (group) => {
    return isDraggingForMerge.value && mergeDraggedGroup.value?.guidfixed === group.guidfixed;
};

// Get username who is selecting this group
const getSelectedByUser = (group) => {
    if (!props.selectedByUsers || props.selectedByUsers.length === 0) return null;
    const found = props.selectedByUsers.find((item) => item.docref === group.guidfixed);
    return found ? found.username : null;
};

// Format username for display (show only first part of email)
const formatUsername = (username) => {
    if (!username) return '';
    if (username.includes('@')) {
        return username.split('@')[0];
    }
    return username;
};

// Check if group has references (recorded in journal)
const hasReferences = (group) => {
    return group.references && group.references.length > 0;
};

// Grid size configuration
const gridColumns = computed(() => {
    const configs = {
        small: 'grid-cols-1 @sm:grid-cols-3 @md:grid-cols-4 @lg:grid-cols-6',
        medium: 'grid-cols-1 @sm:grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4',
        large: 'grid-cols-1 @sm:grid-cols-2 @md:grid-cols-3',
        xlarge: 'grid-cols-1 @sm:grid-cols-2'
    };
    return configs[props.gridSize] || configs.medium;
});

// Grid gap configuration
const gridGap = computed(() => {
    const configs = {
        small: 'gap-3',
        medium: 'gap-4',
        large: 'gap-6',
        xlarge: 'gap-8'
    };
    return configs[props.gridSize] || configs.medium;
});
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
        <div ref="scrollContainer" class="flex-1 overflow-auto px-6 pb-6 pb-2 @container" @scroll="handleScroll" @keydown="handleKeyboardNavigation" tabindex="0">
            <div v-if="loading" class="flex items-center justify-center h-full">
                <ProgressSpinner />
            </div>
            <div v-else-if="imageGroups.length === 0" class="flex flex-col items-center justify-center h-full">
                <i class="pi pi-images text-6xl text-surface-400 dark:text-surface-500 mb-4"></i>
                <p class="text-surface-500 dark:text-surface-400">ไม่มีรูปภาพในงานนี้</p>
            </div>
            <div v-else>
                <div ref="gridContainer" class="grid pt-4" :class="[gridColumns, gridGap]">
                    <div
                        v-for="(group, index) in imageGroups"
                        :key="group.guidfixed"
                        :draggable="sortMode || (!multiSelectMode && !sortMode && !isJobClosed && !disableMerge)"
                        class="relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden transition-all"
                        :class="{
                            'ring-2 ring-primary': !sortMode && isGroupSelected(group) && !hasReferences(group),
                            'ring-4': multiSelectMode && isGroupSelected(group),
                            'cursor-pointer hover:shadow-lg hover:scale-105': !sortMode && !isDraggingForMerge,
                            'cursor-move': sortMode,
                            'cursor-grab': !sortMode && !multiSelectMode && !isDraggingForMerge && !isJobClosed && !disableMerge,
                            'cursor-grabbing': !sortMode && !multiSelectMode && isDraggingForMerge && !isJobClosed && !disableMerge,
                            'ring-2 ring-blue-500': sortMode && dragOverIndex === index,
                            'opacity-50': sortMode && draggedIndex === index,
                            'ring-2 ring-green-500 scale-105': isMergeDragOver(group) || hasReferences(group),
                            'opacity-50 scale-95': isMergeDragging(group)
                        }"
                        @click="selectGroup(group, index)"
                        @dragstart="onDragStart($event, group, index)"
                        @dragover="onDragOver($event, group, index)"
                        @dragleave="onDragLeave($event)"
                        @drop="onDrop($event, group, index)"
                        @dragend="onDragEnd"
                    >
                        <!-- Order number badge for sort mode -->
                        <div v-if="sortMode" class="absolute top-2 left-2 z-20 bg-primary text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                            {{ index + 1 }}
                        </div>

                        <!-- Drag handle icon for sort mode -->
                        <div v-if="sortMode" class="absolute top-2 right-2 z-20 bg-surface-900/70 dark:bg-surface-100/70 text-white dark:text-surface-900 w-8 h-8 rounded-full flex items-center justify-center">
                            <i class="pi pi-bars text-sm"></i>
                        </div>

                        <!-- Multi-select checkbox -->
                        <div v-if="multiSelectMode && !sortMode" class="absolute top-2 left-2 z-10">
                            <div class="w-6 h-6 rounded-full flex items-center justify-center transition-all" :class="isGroupSelected(group) ? 'bg-primary' : 'bg-surface-900/50 dark:bg-surface-100/50'">
                                <i v-if="isGroupSelected(group)" class="pi pi-check text-white text-xs"></i>
                            </div>
                        </div>
                        <div v-if="getImageSrc(group)" class="w-full h-full flex items-center justify-center">
                            <img :src="getImageSrc(group)" :alt="group.title" :class="isPDF(group.imagereferences?.[0]?.imageuri) ? 'w-3/5 h-3/5 object-contain' : 'w-full h-full object-cover'" />
                        </div>
                        <div v-else class="w-full h-full flex items-center justify-center">
                            <i class="pi pi-image text-6xl text-surface-400 dark:text-surface-500"></i>
                        </div>

                        <!-- Overlay with info -->
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-900/70 dark:from-surface-800/80 to-transparent p-2">
                            <div class="text-surface-0 text-xs truncate font-medium">{{ group.title || 'ไม่มีชื่อ' }}</div>
                            <!-- Status badge for review mode -->
                            <Tag v-if="showStatus" :value="getStatusConfig(group.status).text" :severity="getStatusConfig(group.status).severity" class="mt-1" style="font-size: 0.65rem; padding: 0.15rem 0.4rem" />
                        </div>

                        <!-- Image count badge (only show if more than 1 and not in sort mode) -->
                        <div v-if="!sortMode && group.imagereferences && group.imagereferences.length > 1" class="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded">{{ group.imagereferences.length }} เอกสาร</div>

                        <!-- User selecting badge -->
                        <div v-if="getSelectedByUser(group)" class="absolute top-2 left-2 z-20 bg-orange-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                            <i class="pi pi-user text-xs"></i>
                            <span>{{ formatUsername(getSelectedByUser(group)) }}</span>
                        </div>

                        <!-- Merge drop zone indicator -->
                        <div v-if="isMergeDragOver(group)" class="absolute inset-0 bg-green-500/30 flex items-center justify-center z-30 pointer-events-none">
                            <div class="bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
                                <i class="pi pi-plus-circle"></i>
                                <span v-if="group.imagereferences && group.imagereferences.length > 1">เพิ่มเข้าชุดนี้</span>
                                <span v-else>รวมเอกสาร</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Loading More Indicator -->
                <div v-if="loadingMore" class="flex flex-col items-center justify-center py-6 gap-2">
                    <ProgressSpinner style="width: 40px; height: 40px" />
                    <span class="text-sm text-surface-600 dark:text-surface-400">กำลังโหลดข้อมูลเพิ่ม...</span>
                </div>

                <!-- End of Results -->
                <div v-else-if="currentPage >= totalPages && imageGroups.length > 0" class="text-center py-4 text-surface-500 dark:text-surface-400 text-sm">แสดงครบทั้งหมด {{ imageGroups.length }} รายการแล้ว</div>
            </div>
        </div>
    </div>
</template>
