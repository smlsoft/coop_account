<script setup>
import { updateDocumentImageGroupTags } from '@/services/api/image';
import { useToast } from 'primevue/usetoast';
import { ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    tags: {
        type: Array,
        default: () => []
    },
    documentImageGroupGuid: {
        type: String,
        default: ''
    },
    imageName: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'tags-updated']);

const toast = useToast();
const localTags = ref([]);
const newTag = ref('');
const submitting = ref(false);

// Sync localTags with props.tags
watch(
    () => props.tags,
    (newTags) => {
        localTags.value = [...(newTags || [])];
    },
    { immediate: true }
);

watch(
    () => props.visible,
    (visible) => {
        if (visible) {
            localTags.value = [...(props.tags || [])];
            newTag.value = '';
        }
    }
);

const addTag = () => {
    const trimmedTag = newTag.value.trim();
    if (!trimmedTag) return;

    if (localTags.value.includes(trimmedTag)) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'Tag นี้มีอยู่แล้ว',
            life: 3000
        });
        return;
    }

    localTags.value.push(trimmedTag);
    newTag.value = '';
};

const removeTag = (index) => {
    localTags.value.splice(index, 1);
};

const handleSave = async () => {
    if (!props.documentImageGroupGuid) return;

    try {
        submitting.value = true;
        const response = await updateDocumentImageGroupTags(props.documentImageGroupGuid, localTags.value);

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'อัพเดท Tags แล้ว',
                life: 3000
            });
            emit('tags-updated');
            closeDialog();
        }
    } catch (error) {
        console.error('Error updating tags:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'ไม่สามารถอัพเดท Tags ได้',
            life: 3000
        });
    } finally {
        submitting.value = false;
    }
};

const closeDialog = () => {
    emit('update:visible', false);
};

const handleKeydown = (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTag();
    }
};
</script>

<template>
    <Dialog :visible="visible" modal :header="`จัดการ Tags - ${imageName}`" :style="{ width: '40rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" @update:visible="closeDialog">
        <div class="tag-section space-y-4">
            <!-- Current Tags -->
            <div>
                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300 block mb-2">Tags ปัจจุบัน</label>
                <div v-if="localTags.length > 0" class="flex flex-wrap gap-2">
                    <Tag v-for="(tag, index) in localTags" :key="index" :value="tag" severity="info">
                        <template #default>
                            <span>{{ tag }}</span>
                            <i class="pi pi-times ml-2 cursor-pointer" @click="removeTag(index)"></i>
                        </template>
                    </Tag>
                </div>
                <div v-else class="text-center py-4 text-surface-500 dark:text-surface-400 text-sm">
                    <i class="pi pi-tags text-2xl mb-2"></i>
                    <p>ยังไม่มี Tags</p>
                </div>
            </div>

            <!-- Add Tag Form -->
            <div class="space-y-2">
                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300 block">เพิ่ม Tag ใหม่</label>
                <div class="flex gap-2">
                    <InputText v-model="newTag" placeholder="พิมพ์ tag และกด Enter หรือคลิกเพิ่ม" class="flex-1" @keydown="handleKeydown" :disabled="submitting" />
                    <Button icon="pi pi-plus" label="เพิ่ม" size="small" @click="addTag" :disabled="!newTag.trim() || submitting" />
                </div>
                <small class="text-surface-500 dark:text-surface-400">กด Enter เพื่อเพิ่ม tag อย่างรวดเร็ว</small>
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" severity="secondary" @click="closeDialog" :disabled="submitting" />
            <Button label="บันทึก" icon="pi pi-save" @click="handleSave" :disabled="submitting" :loading="submitting" />
        </template>
    </Dialog>
</template>

<style scoped>
.pi-times {
    font-size: 0.75rem;
}

.pi-times:hover {
    color: var(--p-red-500);
}
</style>
