<script setup>
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const props = defineProps({
    src: {
        type: String,
        required: true
    },
    password: {
        type: String,
        default: ''
    }
});

const canvasRef = ref(null);
const containerRef = ref(null);
const loading = ref(true);
const error = ref(null);
const currentPage = ref(1);
const totalPages = ref(0);
const scale = ref(1);
const position = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

let pdfDoc = null;

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_SENSITIVITY = 0.001;

const zoomPercentage = computed(() => Math.round(scale.value * 100));

const canvasStyle = computed(() => ({
    transform: `translate(${position.value.x}px, ${position.value.y}px) scale(${scale.value})`,
    cursor: isDragging.value ? 'grabbing' : scale.value > 1 ? 'grab' : 'default',
    transition: isDragging.value ? 'none' : 'transform 0.1s ease-out'
}));

const loadPdf = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await fetch(props.src);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            password: props.password || undefined
        });
        pdfDoc = await loadingTask.promise;
        totalPages.value = pdfDoc.numPages;

        loading.value = false;
        await nextTick();
        await renderPage(currentPage.value);
    } catch (err) {
        console.error('Error loading PDF:', err);
        error.value = 'ไม่สามารถโหลด PDF ได้';
        loading.value = false;
    }
};

const renderPage = async (pageNum) => {
    if (!pdfDoc || !canvasRef.value) return;

    try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.value;
        const ctx = canvas.getContext('2d');

        const baseScale = 2;
        const viewport = page.getViewport({ scale: baseScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
    } catch (err) {
        console.error('Error rendering page:', err);
    }
};

const handleWheel = (e) => {
    e.preventDefault();

    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + delta * scale.value));

    if (newScale !== scale.value) {
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

const prevPage = async () => {
    if (currentPage.value > 1) {
        currentPage.value--;
        resetZoom();
        await renderPage(currentPage.value);
    }
};

const nextPage = async () => {
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
        resetZoom();
        await renderPage(currentPage.value);
    }
};

const openInNewTab = () => {
    window.open(props.src, '_blank');
};

watch(
    () => props.src,
    () => {
        currentPage.value = 1;
        resetZoom();
        loadPdf();
    }
);

onMounted(() => {
    loadPdf();
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
});

onUnmounted(() => {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
});
</script>

<template>
    <div class="pdf-viewer">
        <!-- Toolbar -->
        <div class="pdf-toolbar bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            <!-- Page navigation -->
            <div class="toolbar-section">
                <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="prevPage" :disabled="currentPage <= 1 || loading" />
                <span class="page-info text-surface-700 dark:text-surface-300">{{ currentPage }} / {{ totalPages || '-' }}</span>
                <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="nextPage" :disabled="currentPage >= totalPages || loading" />
            </div>

            <div class="toolbar-divider bg-surface-300 dark:bg-surface-600"></div>

            <!-- Zoom controls -->
            <div class="toolbar-section">
                <Button icon="pi pi-minus" severity="secondary" text size="small" @click="zoomOut" :disabled="scale <= MIN_SCALE" />
                <span class="zoom-percentage text-surface-700 dark:text-surface-300">{{ zoomPercentage }}%</span>
                <Button icon="pi pi-plus" severity="secondary" text size="small" @click="zoomIn" :disabled="scale >= MAX_SCALE" />
                <Button icon="pi pi-refresh" severity="secondary" text size="small" @click="resetZoom" :disabled="scale === 1" title="Reset zoom" />
            </div>

            <div class="toolbar-divider bg-surface-300 dark:bg-surface-600"></div>

            <Button icon="pi pi-download" severity="secondary" text size="small" @click="openInNewTab" title="ดาวน์โหลด" />
        </div>

        <!-- PDF Container -->
        <div ref="containerRef" class="pdf-container bg-surface-50 dark:bg-surface-900" @wheel="handleWheel" @mousedown="handleMouseDown">
            <div v-if="loading" class="overlay bg-surface-50 dark:bg-surface-900">
                <i class="pi pi-spin pi-spinner text-4xl text-surface-600 dark:text-surface-400"></i>
                <p class="mt-2 text-surface-600 dark:text-surface-400">กำลังโหลด PDF...</p>
            </div>

            <div v-else-if="error" class="overlay bg-surface-50 dark:bg-surface-900">
                <img src="/demo/images/pdf-icon.svg" alt="PDF" class="w-24 h-24 object-contain mb-4 opacity-50" />
                <p class="text-surface-700 dark:text-surface-300 mb-4">{{ error }}</p>
                <Button label="ดาวน์โหลด PDF" icon="pi pi-download" @click="openInNewTab" />
            </div>

            <canvas v-else ref="canvasRef" :style="canvasStyle" class="pdf-canvas" />
        </div>
    </div>
</template>

<style scoped>
.pdf-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}

.pdf-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    flex-wrap: wrap;
}

.toolbar-section {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.toolbar-divider {
    width: 1px;
    height: 1.5rem;
    margin: 0 0.5rem;
}

.page-info,
.zoom-percentage {
    min-width: 60px;
    text-align: center;
    font-size: 0.875rem;
}

.pdf-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.pdf-canvas {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
}

.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
}
</style>
