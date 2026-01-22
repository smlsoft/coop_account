<script setup>
import { addDocumentImageComment } from '@/services/api/image';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    comments: {
        type: Array,
        default: () => []
    },
    documentImageGuid: {
        type: String,
        default: ''
    },
    imageName: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'comment-added']);

const toast = useToast();
const newComment = ref('');
const submitting = ref(false);

const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getInitials = (email) => {
    if (!email) return '?';
    return email.substring(0, 2).toUpperCase();
};

const handleSubmit = async () => {
    if (!newComment.value.trim() || !props.documentImageGuid) return;

    try {
        submitting.value = true;
        const response = await addDocumentImageComment(props.documentImageGuid, newComment.value.trim());

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'เพิ่มความคิดเห็นแล้ว',
                life: 3000
            });
            newComment.value = '';
            emit('comment-added');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'ไม่สามารถเพิ่มความคิดเห็นได้',
            life: 3000
        });
    } finally {
        submitting.value = false;
    }
};

const closeDialog = () => {
    emit('update:visible', false);
};
</script>

<template>
    <Dialog :visible="visible" modal :header="`ความคิดเห็น - ${imageName}`" :style="{ width: '50rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" @update:visible="closeDialog">
        <div class="comment-section space-y-4">
            <!-- Comment List -->
            <div v-if="comments.length > 0" class="comment-list space-y-3 max-h-96 overflow-y-auto pr-2">
                <div v-for="(comment, index) in comments" :key="index" class="comment-item bg-surface-50 dark:bg-surface-800 p-3 rounded-lg border border-surface-200 dark:border-surface-700">
                    <div class="flex gap-3">
                        <!-- Avatar -->
                        <div class="flex-shrink-0">
                            <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                                {{ getInitials(comment.commentedby) }}
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ comment.commentedby }}</span>
                                <span class="text-xs text-surface-500 dark:text-surface-400">{{ formatDateTime(comment.commentedat) }}</span>
                            </div>
                            <p class="text-sm text-surface-700 dark:text-surface-200 whitespace-pre-wrap break-words">{{ comment.comment }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400 text-sm">
                <i class="pi pi-comment text-3xl mb-2"></i>
                <p>ยังไม่มีความคิดเห็น</p>
            </div>

            <!-- Add Comment Form -->
            <div class="comment-form space-y-2">
                <label class="text-sm font-semibold text-surface-700 dark:text-surface-300">เพิ่มความคิดเห็น</label>
                <Textarea v-model="newComment" rows="3" placeholder="พิมพ์ความคิดเห็นของคุณ..." class="w-full" :disabled="submitting" />
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" severity="secondary" @click="closeDialog" :disabled="submitting" />
            <Button label="ส่งความคิดเห็น" icon="pi pi-send" @click="handleSubmit" :disabled="!newComment.trim() || submitting" :loading="submitting" />
        </template>
    </Dialog>
</template>

<style scoped>
.comment-list {
    scrollbar-width: thin;
    scrollbar-color: var(--p-surface-400) transparent;
}

.comment-list::-webkit-scrollbar {
    width: 6px;
}

.comment-list::-webkit-scrollbar-track {
    background: transparent;
}

.comment-list::-webkit-scrollbar-thumb {
    background-color: var(--p-surface-400);
    border-radius: 3px;
}

.comment-list::-webkit-scrollbar-thumb:hover {
    background-color: var(--p-surface-500);
}
</style>
