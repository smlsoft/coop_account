<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'confirm']);

const selectedModel = ref('mistral'); // ค่าเริ่มต้น

const aiModels = [
    {
        value: 'mistral',
        label: 'Mistral AI',
        description: 'โมเดลที่แนะนำ เหมาะสำหรับเอกสารทั่วไป ประมวลผลเร็ว ประหยัด',
        details: [
            { icon: 'pi-bolt', text: 'ความเร็วสูง' },
            { icon: 'pi-wallet', text: 'ค่าใช้จ่ายต่ำ' },
            { icon: 'pi-file', text: 'เอกสารทั่วไป' }
        ],
        recommended: true
    },
    {
        value: 'gemini',
        label: 'Google Gemini',
        description: 'โมเดลที่แม่นยำสูงกว่า เหมาะสำหรับเอกสารที่มีรายละเอียดซับซ้อน',
        details: [
            { icon: 'pi-chart-line', text: 'ความแม่นยำสูง' },
            { icon: 'pi-search', text: 'วิเคราะห์ละเอียด' },
            { icon: 'pi-sitemap', text: 'เอกสารซับซ้อน' }
        ],
        recommended: false
    }
];

// Get selected model details
const selectedModelDetails = computed(() => {
    return aiModels.find((m) => m.value === selectedModel.value);
});

// Reset selected model เมื่อ dialog เปิด
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            selectedModel.value = 'mistral';
        }
    }
);

const closeDialog = () => {
    emit('update:visible', false);
};

const confirmSelection = () => {
    emit('confirm', selectedModel.value);
    closeDialog();
};
</script>

<template>
    <Dialog :visible="visible" modal :style="{ width: '600px' }" :breakpoints="{ '960px': '75vw', '640px': '95vw' }" @update:visible="closeDialog">
        <template #header>
            <div class="flex items-center gap-3">
                <i class="pi pi-sparkles text-2xl text-primary-500"></i>
                <div>
                    <div class="text-xl font-bold">เลือกโมเดล AI</div>
                    <div class="text-sm text-surface-500 dark:text-surface-400">เลือกโมเดล AI สำหรับวิเคราะห์เอกสาร</div>
                </div>
            </div>
        </template>

        <div class="flex flex-col gap-4">
            <!-- Model Selection -->
            <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-3">
                    <div
                        v-for="model in aiModels"
                        :key="model.value"
                        class="flex items-start gap-3 p-4 border border-surface-300 dark:border-surface-600 rounded-lg cursor-pointer transition-all hover:border-primary-400 dark:hover:border-primary-500 hover:bg-surface-50 dark:hover:bg-surface-800"
                        :class="{
                            'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20': selectedModel === model.value
                        }"
                        @click="selectedModel = model.value"
                    >
                        <RadioButton v-model="selectedModel" :inputId="model.value" name="aiModel" :value="model.value" />
                        <div class="flex-1">
                            <label :for="model.value" class="cursor-pointer">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-semibold text-lg text-surface-900 dark:text-surface-0">{{ model.label }}</span>
                                    <Tag v-if="model.recommended" value="แนะนำ" severity="success" class="text-xs" />
                                </div>
                                <p class="text-surface-600 dark:text-surface-400 m-0 text-sm mb-2">{{ model.description }}</p>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Model Details -->
            <div v-if="selectedModelDetails" class="p-4 bg-surface-50 dark:bg-surface-800 border-l-4 border-primary-500 rounded">
                <div class="font-medium text-surface-700 dark:text-surface-300 mb-3">คุณสมบัติ</div>
                <div class="flex flex-col gap-2">
                    <div v-for="(detail, idx) in selectedModelDetails.details" :key="idx" class="flex items-center gap-2">
                        <i :class="['pi', detail.icon, 'text-primary-500']"></i>
                        <span class="text-surface-700 dark:text-surface-300 text-sm">{{ detail.text }}</span>
                    </div>
                </div>
            </div>

            <!-- Info Message -->
            <Message severity="info" :closable="false">
                <div class="flex items-start gap-2">
                    <i class="pi pi-info-circle text-lg"></i>
                    <span class="text-sm">โมเดล AI ที่แตกต่างกันจะให้ผลลัพธ์และความเร็วที่แตกต่างกัน แนะนำให้เริ่มต้นด้วย Mistral AI ก่อน</span>
                </div>
            </Message>
        </div>

        <template #footer>
            <Button label="ยกเลิก" icon="pi pi-times" text severity="secondary" @click="closeDialog" />
            <Button label="วิเคราะห์เอกสาร" icon="pi pi-play" severity="primary" @click="confirmSelection" autofocus />
        </template>
    </Dialog>
</template>
