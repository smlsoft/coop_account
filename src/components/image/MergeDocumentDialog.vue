<script setup>
import { getDocumentImageDetail, mergeDocumentImageGroups, recountTaskDocuments } from '@/services/api/image';
import { useToast } from 'primevue/usetoast';
import { computed, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    selectedGroups: {
        type: Array,
        default: () => []
    },
    taskGuid: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'merge-complete']);

const toast = useToast();
const title = ref('');
const localTags = ref([]);
const newTag = ref('');
const loading = ref(false);
const loadingDetails = ref(false);
const allImageReferences = ref([]);

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

const totalImages = computed(() => {
    return props.selectedGroups.reduce((sum, group) => {
        return sum + (group.imagereferences?.length || 0);
    }, 0);
});

const mergedTags = computed(() => {
    const tagsSet = new Set();
    props.selectedGroups.forEach((group) => {
        if (group.tags && Array.isArray(group.tags)) {
            group.tags.forEach((tag) => tagsSet.add(tag));
        }
    });
    return Array.from(tagsSet);
});

const resetForm = () => {
    title.value = '';
    localTags.value = [...mergedTags.value];
    newTag.value = '';
    allImageReferences.value = [];
};

const loadAllImageReferences = async () => {
    loadingDetails.value = true;
    allImageReferences.value = [];

    try {
        // Collect all imagereferences from selected groups with their comments
        for (const group of props.selectedGroups) {
            if (group.imagereferences && group.imagereferences.length > 0) {
                for (const imgRef of group.imagereferences) {
                    try {
                        // Fetch detail to get comments
                        const response = await getDocumentImageDetail(imgRef.documentimageguid);
                        if (response.data.success) {
                            const detail = response.data.data;
                            allImageReferences.value.push({
                                ...imgRef,
                                comments: detail.comments || null
                            });
                        } else {
                            // If failed to get detail, add without comments
                            allImageReferences.value.push({
                                ...imgRef,
                                comments: null
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching image detail:', error);
                        allImageReferences.value.push({
                            ...imgRef,
                            comments: null
                        });
                    }
                }
            }
        }

        // Sort by xorder and re-index
        allImageReferences.value.sort((a, b) => a.xorder - b.xorder);
        allImageReferences.value = allImageReferences.value.map((ref, index) => ({
            ...ref,
            xorder: index
        }));
    } catch (error) {
        console.error('Error loading image references:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลรูปภาพได้',
            life: 3000
        });
    } finally {
        loadingDetails.value = false;
    }
};

const addTag = () => {
    const tag = newTag.value.trim();
    if (tag && !localTags.value.includes(tag)) {
        localTags.value.push(tag);
        newTag.value = '';
    }
};

const removeTag = (index) => {
    localTags.value.splice(index, 1);
};

const handleMerge = async () => {
    if (!title.value.trim()) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณาใส่ชื่อเอกสาร',
            life: 3000
        });
        return;
    }

    if (allImageReferences.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'ไม่มีรูปภาพให้รวม',
            life: 3000
        });
        return;
    }

    loading.value = true;

    try {
        // 1. Create merged document image group
        const payload = {
            imagereferences: allImageReferences.value,
            title: title.value.trim(),
            taskguid: props.taskGuid,
            tags: localTags.value,
            uploadedat: new Date().toISOString(),
            billcount: 1
        };

        const response = await mergeDocumentImageGroups(payload);

        if (response.data.success) {
            // 2. Recount task documents
            await recountTaskDocuments(props.taskGuid);

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `รวมเอกสาร ${props.selectedGroups.length} รายการเป็น "${title.value}" แล้ว`,
                life: 3000
            });

            emit('merge-complete', response.data.id);
            dialogVisible.value = false;
        } else {
            throw new Error('Merge failed');
        }
    } catch (error) {
        console.error('Merge error:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถรวมเอกสารได้',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const isPDF = (uri) => {
    if (!uri) return false;
    return uri.toLowerCase().endsWith('.pdf');
};

// Handle Enter key
const handleKeyPress = (event) => {
    if (event.key === 'Enter' && props.visible && !loading.value && !loadingDetails.value && title.value.trim()) {
        event.preventDefault();
        handleMerge();
    }
};

watch(
    () => props.visible,
    async (newVal, oldVal) => {
        // ป้องกัน infinite loop: ตรวจสอบว่าค่าเปลี่ยนจริงและไม่ซ้ำซ้อน
        if (newVal === oldVal) return;

        if (newVal) {
            // ป้องกันการเรียกซ้ำถ้ากำลัง loading อยู่
            if (loadingDetails.value) return;

            resetForm();
            await loadAllImageReferences();
            window.addEventListener('keypress', handleKeyPress);
        } else {
            window.removeEventListener('keypress', handleKeyPress);
        }
    }
);

onUnmounted(() => {
    window.removeEventListener('keypress', handleKeyPress);
});
</script>

<template>
    <Dialog v-model:visible="dialogVisible" modal header="รวมเอกสาร" :style="{ width: '90vw', maxWidth: '800px' }" :closable="!loading">
        <div class="space-y-5">
            <!-- Summary -->
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <i class="pi pi-info-circle text-blue-600 dark:text-blue-400"></i>
                    <span class="font-semibold text-blue-900 dark:text-blue-100">ข้อมูลการรวม</span>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-surface-600 dark:text-surface-400">จำนวนเอกสารที่เลือก:</span>
                        <span class="ml-2 font-semibold text-surface-900 dark:text-surface-0">{{ selectedGroups.length }} รายการ</span>
                    </div>
                    <div>
                        <span class="text-surface-600 dark:text-surface-400">รวมจำนวนรูปภาพ:</span>
                        <span class="ml-2 font-semibold text-surface-900 dark:text-surface-0">{{ totalImages }} รูป</span>
                    </div>
                </div>
            </div>

            <!-- Title Input -->
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-surface-900 dark:text-surface-0"> ชื่อเอกสารใหม่ <span class="text-red-500">*</span> </label>
                <InputText v-model="title" placeholder="ระบุชื่อเอกสารที่รวมแล้ว" class="w-full" :disabled="loading" autofocus />
            </div>

            <!-- Tags Management -->
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-surface-900 dark:text-surface-0">Tags</label>
                <div class="flex flex-wrap gap-2 mb-2">
                    <Tag v-for="(tag, index) in localTags" :key="index" :value="tag" severity="secondary" class="cursor-pointer hover:opacity-80" @click="removeTag(index)">
                        <template #default>
                            <span>{{ tag }}</span>
                            <i class="pi pi-times ml-2 text-xs"></i>
                        </template>
                    </Tag>
                    <span v-if="localTags.length === 0" class="text-sm text-surface-500 dark:text-surface-400">ไม่มี tags</span>
                </div>
                <div class="flex gap-2">
                    <InputText v-model="newTag" placeholder="เพิ่ม tag ใหม่" class="flex-1" :disabled="loading" @keyup.enter="addTag" />
                    <Button label="เพิ่ม" icon="pi pi-plus" @click="addTag" :disabled="!newTag.trim() || loading" size="small" />
                </div>
            </div>

            <!-- Selected Groups Preview -->
            <div class="space-y-2">
                <label class="block text-sm font-semibold text-surface-900 dark:text-surface-0">เอกสารที่เลือก</label>
                <div v-if="loadingDetails" class="text-center py-8">
                    <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                    <p class="text-sm text-surface-500 dark:text-surface-400 mt-2">กำลังโหลดข้อมูลรูปภาพ...</p>
                </div>
                <div v-else class="max-h-64 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg">
                    <div class="divide-y divide-surface-200 dark:divide-surface-700">
                        <div v-for="(group, index) in selectedGroups" :key="group.guidfixed" class="p-3 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                            <div class="flex items-start gap-3">
                                <div class="flex-none w-12 h-12 bg-surface-200 dark:bg-surface-700 rounded flex items-center justify-center overflow-hidden">
                                    <img v-if="group.imagereferences?.[0]?.imageuri && !isPDF(group.imagereferences[0].imageuri)" :src="group.imagereferences[0].imageuri" class="w-full h-full object-cover" />
                                    <img v-else-if="isPDF(group.imagereferences?.[0]?.imageuri)" src="/demo/images/pdf-icon.svg" alt="PDF" class="w-3/5 h-3/5 object-contain" />
                                    <i v-else class="pi pi-image text-2xl text-surface-400 dark:text-surface-500"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-sm text-surface-900 dark:text-surface-0 truncate">{{ index + 1 }}. {{ group.title || 'ไม่มีชื่อ' }}</div>
                                    <div class="text-xs text-surface-600 dark:text-surface-400 mt-1">{{ group.imagereferences?.length || 0 }} รูป</div>
                                    <div v-if="group.tags && group.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                                        <Tag v-for="tag in group.tags" :key="tag" :value="tag" severity="secondary" class="text-[10px] py-0 px-1" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Total Images Preview -->
            <div v-if="!loadingDetails && allImageReferences.length > 0" class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <div class="text-sm font-semibold text-surface-900 dark:text-surface-0 mb-2">รูปภาพทั้งหมดที่จะรวม ({{ allImageReferences.length }} รูป)</div>
                <div class="flex flex-wrap gap-2">
                    <div v-for="(imgRef, index) in allImageReferences.slice(0, 10)" :key="imgRef.documentimageguid" class="w-12 h-12 bg-surface-200 dark:bg-surface-700 rounded overflow-hidden flex items-center justify-center">
                        <img v-if="!isPDF(imgRef.imageuri)" :src="imgRef.imageuri" class="w-full h-full object-cover" />
                        <img v-else src="/demo/images/pdf-icon.svg" alt="PDF" class="w-3/5 h-3/5 object-contain" />
                    </div>
                    <div v-if="allImageReferences.length > 10" class="w-12 h-12 bg-surface-300 dark:bg-surface-600 rounded flex items-center justify-center text-xs font-semibold text-surface-700 dark:text-surface-200">
                        +{{ allImageReferences.length - 10 }}
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="ยกเลิก" severity="secondary" @click="dialogVisible = false" :disabled="loading" />
                <Button label="รวมเอกสาร (Enter)" icon="pi pi-save" @click="handleMerge" :loading="loading" :disabled="!title.trim() || loadingDetails" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.space-y-2 > * + * {
    margin-top: 0.5rem;
}

.space-y-5 > * + * {
    margin-top: 1.25rem;
}
</style>
