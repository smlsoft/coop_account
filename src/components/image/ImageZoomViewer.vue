<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
    src: {
        type: String,
        required: true
    },
    alt: {
        type: String,
        default: ''
    }
});

const containerRef = ref(null);
const scale = ref(1);
const position = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_SENSITIVITY = 0.001;

const imageStyle = computed(() => ({
    transform: `translate(${position.value.x}px, ${position.value.y}px) scale(${scale.value})`,
    cursor: isDragging.value ? 'grabbing' : scale.value > 1 ? 'grab' : 'default',
    transition: isDragging.value ? 'none' : 'transform 0.1s ease-out'
}));

const zoomPercentage = computed(() => Math.round(scale.value * 100));

const handleWheel = (e) => {
    e.preventDefault();

    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + delta * scale.value));

    if (newScale !== scale.value) {
        // Zoom toward mouse position
        const rect = containerRef.value.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const scaleRatio = newScale / scale.value;

        position.value = {
            x: mouseX - (mouseX - position.value.x) * scaleRatio,
            y: mouseY - (mouseY - position.value.y) * scaleRatio
        };

        scale.value = newScale;
    }
};

const handleMouseDown = (e) => {
    if (scale.value <= 1) return;

    isDragging.value = true;
    dragStart.value = {
        x: e.clientX - position.value.x,
        y: e.clientY - position.value.y
    };
};

const handleMouseMove = (e) => {
    if (!isDragging.value) return;

    position.value = {
        x: e.clientX - dragStart.value.x,
        y: e.clientY - dragStart.value.y
    };
};

const handleMouseUp = () => {
    isDragging.value = false;
};

const resetZoom = () => {
    scale.value = 1;
    position.value = { x: 0, y: 0 };
};

const zoomIn = () => {
    scale.value = Math.min(MAX_SCALE, scale.value * 1.25);
};

const zoomOut = () => {
    scale.value = Math.max(MIN_SCALE, scale.value / 1.25);
    if (scale.value <= 1) {
        position.value = { x: 0, y: 0 };
    }
};

onMounted(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
});

onUnmounted(() => {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
});
</script>

<template>
    <div class="image-zoom-viewer">
        <!-- Toolbar -->
        <div class="zoom-toolbar bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            <Button icon="pi pi-minus" severity="secondary" text size="small" @click="zoomOut" :disabled="scale <= MIN_SCALE" />
            <span class="zoom-percentage text-surface-700 dark:text-surface-300">{{ zoomPercentage }}%</span>
            <Button icon="pi pi-plus" severity="secondary" text size="small" @click="zoomIn" :disabled="scale >= MAX_SCALE" />
            <Button icon="pi pi-refresh" severity="secondary" text size="small" @click="resetZoom" :disabled="scale === 1" title="Reset zoom" />
        </div>

        <!-- Image Container -->
        <div ref="containerRef" class="image-container bg-surface-50 dark:bg-surface-900" @wheel="handleWheel" @mousedown="handleMouseDown">
            <img :src="src" :alt="alt" :style="imageStyle" class="zoomable-image" draggable="false" />
        </div>
    </div>
</template>

<style scoped>
.image-zoom-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}

.zoom-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
}

.zoom-percentage {
    min-width: 50px;
    text-align: center;
    font-size: 0.875rem;
}

.image-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.zoomable-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}
</style>
