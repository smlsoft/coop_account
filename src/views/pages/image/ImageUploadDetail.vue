<script setup>
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';

const route = useRoute();
const router = useRouter();
const taskId = ref('');

onMounted(() => {
    taskId.value = route.params.id;
});

const goBack = () => {
    router.push({ name: 'image-upload' });
};
</script>

<template>
    <div>
        <div class="card">
            <div class="flex items-center gap-4 mb-4">
                <Button icon="pi pi-arrow-left" class="p-button-text" @click="goBack" />
                <h2 class="m-0">รายละเอียดงานอัพโหลด</h2>
            </div>
            <div class="flex flex-col items-center justify-center py-8">
                <i class="pi pi-file-edit text-6xl text-surface-400 mb-4"></i>
                <p class="text-surface-500 text-lg">Task ID: {{ taskId }}</p>
                <p class="text-surface-400">หน้านี้อยู่ระหว่างการพัฒนา</p>
            </div>
        </div>
    </div>
</template>
