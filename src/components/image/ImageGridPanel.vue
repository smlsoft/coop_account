<script setup>
import { ref, watch } from 'vue';

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
    }
});

const emit = defineEmits(['select-group', 'toggle-group-selection', 'load-more', 'reorder']);

const selectedIndex = ref(0);
const scrollContainer = ref(null);
const gridContainer = ref(null);

// Drag & Drop state
const draggedIndex = ref(null);
const dragOverIndex = ref(null);

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

    // คำนวณจำนวนคอลัมน์จริงๆ จาก grid
    let columns = 4; // default
    if (gridContainer.value) {
        const gridElement = gridContainer.value;
        const computedStyle = window.getComputedStyle(gridElement);
        const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');
        // นับจำนวนคอลัมน์จากค่า grid-template-columns
        columns = gridTemplateColumns.split(' ').length;
    }

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
                <div ref="gridContainer" class="grid grid-cols-1 @sm:grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4 gap-4 pt-4">
                    <div
                        v-for="(group, index) in imageGroups"
                        :key="group.guidfixed"
                        :draggable="sortMode"
                        class="relative aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden transition-all"
                        :class="{
                            'ring-2 ring-primary': !sortMode && isGroupSelected(group),
                            'ring-4': multiSelectMode && isGroupSelected(group),
                            'cursor-pointer hover:shadow-lg hover:scale-105': !sortMode,
                            'cursor-move': sortMode,
                            'ring-2 ring-blue-500': sortMode && dragOverIndex === index,
                            'opacity-50': sortMode && draggedIndex === index
                        }"
                        @click="selectGroup(group, index)"
                        @dragstart="handleDragStart($event, index)"
                        @dragover="handleDragOver($event, index)"
                        @dragleave="handleDragLeave"
                        @drop="handleDrop($event, index)"
                        @dragend="handleDragEnd"
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
                        </div>

                        <!-- Image count badge (only show if more than 1 and not in sort mode) -->
                        <div v-if="!sortMode && group.imagereferences && group.imagereferences.length > 1" class="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded">{{ group.imagereferences.length }} รูป</div>
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
