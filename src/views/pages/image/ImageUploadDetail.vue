<script setup>
import DialogApprove from '@/components/DialogApprove.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageGridPanel from '@/components/image/ImageGridPanel.vue';
import ImageUploadDialog from '@/components/image/ImageUploadDialog.vue';
import MergeDocumentDialog from '@/components/image/MergeDocumentDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import { deleteDocumentImageGroups, getDocumentImageDetail, getDocumentImageGroups, recountTaskDocuments, ungroupDocumentImageGroup, updateDocumentImageGroupsOrder } from '@/services/api/image';
import { getTask, updateTaskStatus } from '@/services/api/task';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { username } = useAuth();
const { showLoading, hideLoading } = useLoading();

const taskId = ref('');
const taskData = ref(null);
const uploadDialogVisible = ref(false);
const mergeDialogVisible = ref(false);
const multiSelectMode = ref(false);
const selectedGroupsForMerge = ref([]);
const ungrouping = ref(false);
const deleting = ref(false);
const sortMode = ref(false);
const sortableGroups = ref([]);
const savingOrder = ref(false);
const dialogJobClose = ref(false);
const randomNumber = ref(0);
const closingJob = ref(false);
const imageGroups = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const selectedGroup = ref(null);
const selectedImageDetail = ref(null);
const loadingDetail = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);
const searchQuery = ref('');
const searchTimeout = ref(null);

// Computed: Check if job is closed (status !== 0)
const isJobClosed = computed(() => {
    return taskData.value?.status !== 0;
});

// Watch searchQuery with debounce (1 seconds)
watch(searchQuery, (newValue, oldValue) => {
    // Clear existing timeout
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
    }

    // Set new timeout for 3 seconds
    searchTimeout.value = setTimeout(() => {
        fetchImageGroups(true);
    }, 1000);
});

const fetchTaskDetail = async () => {
    try {
        const response = await getTask(taskId.value);
        if (response.data.success) {
            taskData.value = response.data.data;
        }
    } catch (error) {
        console.error('Error fetching task detail:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'ไม่สามารถโหลดข้อมูล Task ได้',
            life: 3000
        });
    }
};

const fetchImageGroups = async (reset = true) => {
    try {
        if (reset) {
            loading.value = true;
            currentPage.value = 1;
            imageGroups.value = [];
        } else {
            loadingMore.value = true;
        }

        const params = {
            taskguid: taskId.value,
            page: currentPage.value,
            limit: 100
        };

        // Add search query if exists
        if (searchQuery.value && searchQuery.value.trim()) {
            params.q = searchQuery.value.trim();
        }

        const response = await getDocumentImageGroups(params);

        if (response.data.success) {
            if (reset) {
                imageGroups.value = response.data.data;
            } else {
                imageGroups.value = [...imageGroups.value, ...response.data.data];
            }
            totalPages.value = response.data.pagination?.totalPage || 1;
        }
    } catch (error) {
        console.error('Error fetching image groups:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        loading.value = false;
        loadingMore.value = false;
    }
};

const loadMore = async () => {
    if (loadingMore.value || loading.value || currentPage.value >= totalPages.value) return;
    currentPage.value++;
    await fetchImageGroups(false);
};

const handleSelectGroup = async (group) => {
    selectedGroup.value = group;

    // ดึงข้อมูล detail ของ image แรก
    if (group.imagereferences && group.imagereferences.length > 0) {
        const firstImageGuid = group.imagereferences[0].documentimageguid;
        if (firstImageGuid) {
            try {
                loadingDetail.value = true;
                const response = await getDocumentImageDetail(firstImageGuid);
                if (response.data.success) {
                    selectedImageDetail.value = response.data.data;
                }
            } catch (error) {
                console.error('Error fetching image detail:', error);
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'ไม่สามารถโหลดรายละเอียดรูปภาพได้',
                    life: 3000
                });
                selectedImageDetail.value = null;
            } finally {
                loadingDetail.value = false;
            }
        }
    }
};

const handleRefreshDetail = async () => {
    if (!selectedGroup.value?.imagereferences?.[0]?.documentimageguid) return;

    try {
        const response = await getDocumentImageDetail(selectedGroup.value.imagereferences[0].documentimageguid);
        if (response.data.success) {
            selectedImageDetail.value = response.data.data;
        }
    } catch (error) {
        console.error('Error refreshing image detail:', error);
    }
};

const handleRefreshGroup = async () => {
    if (!selectedGroup.value?.guidfixed) return;

    try {
        const selectedGuid = selectedGroup.value.guidfixed;

        // Reset and reload all groups
        await fetchImageGroups(true);

        // Find and reselect the updated group
        const updatedGroup = imageGroups.value.find((g) => g.guidfixed === selectedGuid);
        if (updatedGroup) {
            selectedGroup.value = updatedGroup;
        }
    } catch (error) {
        console.error('Error refreshing group:', error);
    }
};

onMounted(async () => {
    taskId.value = route.params.id;
    await fetchTaskDetail();
    await fetchImageGroups();
});

const handleUploadComplete = async () => {
    // Refresh data after upload
    await fetchImageGroups(true);
};

const toggleMultiSelectMode = () => {
    if (isJobClosed.value) return;
    multiSelectMode.value = !multiSelectMode.value;
    if (!multiSelectMode.value) {
        selectedGroupsForMerge.value = [];
    }
};

const toggleGroupSelection = (group) => {
    if (isJobClosed.value) return;
    const index = selectedGroupsForMerge.value.findIndex((g) => g.guidfixed === group.guidfixed);
    if (index !== -1) {
        selectedGroupsForMerge.value.splice(index, 1);
    } else {
        selectedGroupsForMerge.value.push(group);
    }
};

const openMergeDialog = () => {
    if (isJobClosed.value) return;
    if (selectedGroupsForMerge.value.length < 2) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณาเลือกอย่างน้อย 2 รายการ',
            life: 3000
        });
        return;
    }
    mergeDialogVisible.value = true;
};

const handleMergeComplete = async () => {
    // Reset states
    multiSelectMode.value = false;
    selectedGroupsForMerge.value = [];

    // Refresh data
    await fetchImageGroups(true);
};

const handleUngroup = async () => {
    if (isJobClosed.value) return;
    if (!selectedGroup.value?.guidfixed) return;

    const imageCount = selectedGroup.value.imagereferences?.length || 0;
    if (imageCount <= 1) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'ไม่สามารถแยกเอกสารที่มีรูปภาพเพียง 1 รูปได้',
            life: 3000
        });
        return;
    }

    ungrouping.value = true;

    try {
        // 1. Ungroup the document
        showLoading('กำลังแยกเอกสาร...');
        const response = await ungroupDocumentImageGroup(selectedGroup.value.guidfixed);

        if (response.data.success) {
            const newGuids = response.data.data || [];

            // 2. Recount task documents
            showLoading('กำลังนับจำนวนเอกสารใหม่...');
            await recountTaskDocuments(taskId.value);

            // 3. Refresh task data
            showLoading('กำลังอัปเดตข้อมูลงาน...');
            await fetchTaskDetail();

            // 4. Refresh image groups
            showLoading('กำลังโหลดรายการเอกสาร...');
            await fetchImageGroups(true);

            // 5. Re-sort (xsort) - prepare order data
            if (imageGroups.value.length > 0) {
                showLoading('กำลังจัดเรียงลำดับ...');
                const orderData = imageGroups.value.map((group, index) => ({
                    guidfixed: group.guidfixed,
                    xorder: index
                }));
                await updateDocumentImageGroupsOrder(taskId.value, orderData);
            }

            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `แยกเอกสารเป็น ${newGuids.length} รายการแล้ว`,
                life: 3000
            });

            // Clear selection
            selectedGroup.value = null;
            selectedImageDetail.value = null;
        } else {
            throw new Error('Ungroup failed');
        }
    } catch (error) {
        console.error('Ungroup error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถแยกเอกสารได้',
            life: 3000
        });
    } finally {
        ungrouping.value = false;
    }
};

const toggleSortMode = () => {
    if (isJobClosed.value) return;
    sortMode.value = !sortMode.value;
    if (sortMode.value) {
        // Enter sort mode: copy current groups
        sortableGroups.value = [...imageGroups.value];
        // Disable other modes
        multiSelectMode.value = false;
        selectedGroupsForMerge.value = [];
    } else {
        // Exit sort mode: reset
        sortableGroups.value = [];
    }
};

const handleReorder = (newOrder) => {
    sortableGroups.value = newOrder;
};

const saveSortOrder = async () => {
    if (sortableGroups.value.length === 0) return;

    savingOrder.value = true;

    try {
        const orderData = sortableGroups.value.map((group, index) => ({
            guidfixed: group.guidfixed,
            xorder: index
        }));

        showLoading('กำลังบันทึกการเรียงลำดับ...');
        await updateDocumentImageGroupsOrder(taskId.value, orderData);

        showLoading('กำลังโหลดรายการเอกสาร...');
        // Exit sort mode and refresh
        sortMode.value = false;
        sortableGroups.value = [];
        await fetchImageGroups(true);

        hideLoading();
        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'บันทึกการเรียงลำดับแล้ว',
            life: 3000
        });
    } catch (error) {
        console.error('Save order error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถบันทึกการเรียงลำดับได้',
            life: 3000
        });
    } finally {
        savingOrder.value = false;
    }
};

const cancelSortMode = () => {
    sortMode.value = false;
    sortableGroups.value = [];
};

const handleDelete = async () => {
    if (isJobClosed.value) return;
    if (!selectedGroup.value?.guidfixed) return;

    deleting.value = true;

    try {
        // 1. Delete the document group
        showLoading('กำลังลบเอกสาร...');
        const response = await deleteDocumentImageGroups([selectedGroup.value.guidfixed]);

        if (response.data.success) {
            // 2. Recount task documents
            showLoading('กำลังนับจำนวนเอกสารใหม่...');
            await recountTaskDocuments(taskId.value);

            // 3. Refresh task data
            showLoading('กำลังอัปเดตข้อมูลงาน...');
            await fetchTaskDetail();

            // 4. Refresh image groups
            showLoading('กำลังโหลดรายการเอกสาร...');
            await fetchImageGroups(true);

            // 5. Re-sort (xsort) - prepare order data
            if (imageGroups.value.length > 0) {
                showLoading('กำลังจัดเรียงลำดับ...');
                const orderData = imageGroups.value.map((group, index) => ({
                    guidfixed: group.guidfixed,
                    xorder: index
                }));
                await updateDocumentImageGroupsOrder(taskId.value, orderData);
            }

            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ลบเอกสารเรียบร้อยแล้ว',
                life: 3000
            });

            // Clear selection
            selectedGroup.value = null;
            selectedImageDetail.value = null;
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถลบเอกสารได้',
            life: 3000
        });
    } finally {
        deleting.value = false;
    }
};

const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

const openCloseJobDialog = () => {
    randomNumber.value = generateRandomNumber();
    dialogJobClose.value = true;
};

const confirmJobFalse = () => {
    randomNumber.value = generateRandomNumber();
    toast.add({
        severity: 'error',
        summary: 'ตัวเลขไม่ถูกต้อง',
        detail: 'กรุณากรอกตัวเลขใหม่',
        life: 3000
    });
};

const confirmCloseJob = async () => {
    closingJob.value = true;

    try {
        showLoading('กำลังปิดงาน...');
        const response = await updateTaskStatus(taskId.value, { status: 1 });

        if (response.data.success) {
            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ปิดงานเรียบร้อยแล้ว',
                life: 3000
            });

            dialogJobClose.value = false;

            // กลับไปหน้า ImageUpload
            setTimeout(() => {
                router.push({ name: 'image-upload' });
            }, 500);
        }
    } catch (error) {
        console.error('Close job error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถปิดงานได้',
            life: 3000
        });
    } finally {
        closingJob.value = false;
    }
};

const handleSearch = () => {
    fetchImageGroups(true);
};

const clearSearch = () => {
    searchQuery.value = '';
    fetchImageGroups(true);
};

const goBack = () => {
    router.push({ name: 'image-upload' });
};
</script>

<template>
    <div class="main-container" style="height: calc(100vh - 120px); display: flex; flex-direction: column; overflow: hidden">
        <Toast />

        <div class="toolbar-section flex-none mb-4">
            <Toolbar>
                <template #start>
                    <Button icon="pi pi-arrow-left" class="mr-2" severity="secondary" text @click="goBack" />
                    <div class="font-semibold text-ml">งานอัพโหลด - {{ taskData?.name || taskId }} ({{ imageGroups.length }})</div>
                    <Tag v-if="isJobClosed" value="งานถูกปิดแล้ว" severity="danger" class="ml-3" />
                </template>

                <template #center>
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="searchQuery" placeholder="ค้นหาเอกสาร..." @keyup.enter="handleSearch" />
                    </IconField>
                    <Button icon="pi pi-refresh" severity="secondary" text @click="fetchImageGroups" :loading="loading" :disabled="sortMode" title="รีเฟรช" />
                </template>

                <template #end>
                    <Button v-if="sortMode" label="บันทึกการเรียง" icon="pi pi-check" severity="success" class="mr-2" @click="saveSortOrder" :loading="savingOrder" :disabled="isJobClosed" />
                    <Button v-if="sortMode" label="ยกเลิก" icon="pi pi-times" severity="secondary" class="mr-2" @click="cancelSortMode" outlined :disabled="isJobClosed" />
                    <Button v-if="!sortMode && !isJobClosed" label="ปิดงาน" icon="pi pi-lock" severity="success" class="mr-2" @click="openCloseJobDialog" outlined />
                    <Button v-if="!sortMode && selectedGroup" label="ลบเอกสาร" icon="pi pi-trash" severity="danger" class="mr-2" @click="handleDelete" :loading="deleting" :disabled="isJobClosed" outlined />
                    <Button
                        v-if="!sortMode && selectedGroup && selectedGroup.imagereferences && selectedGroup.imagereferences.length > 1"
                        label="แยกเอกสาร"
                        icon="pi pi-minus-circle"
                        severity="warning"
                        class="mr-2"
                        @click="handleUngroup"
                        :loading="ungrouping"
                        :disabled="isJobClosed"
                        outlined
                    />
                    <Button
                        v-if="!sortMode && multiSelectMode && selectedGroupsForMerge.length >= 2"
                        :label="`รวมเอกสาร (${selectedGroupsForMerge.length})`"
                        icon="pi pi-plus-circle"
                        severity="success"
                        class="mr-2"
                        @click="openMergeDialog"
                        :disabled="isJobClosed"
                    />
                    <Button
                        v-if="!sortMode"
                        :label="multiSelectMode ? 'เลือกหลายรายการ' : 'เลือกเอกสาร'"
                        :icon="multiSelectMode ? 'pi pi-times' : 'pi pi-check-square'"
                        :severity="multiSelectMode ? 'secondary' : 'contrast'"
                        class="mr-2"
                        @click="toggleMultiSelectMode"
                        :disabled="isJobClosed"
                        outlined
                    />
                    <Button v-if="!sortMode" :label="sortMode ? 'เรียงลำดับ' : 'เรียงลำดับ'" icon="pi pi-sort-alt" severity="info" class="mr-2" @click="toggleSortMode" :disabled="isJobClosed" outlined />
                    <Button v-if="!sortMode" label="Upload" icon="pi pi-cloud-upload" class="mr-2" @click="uploadDialogVisible = true" :disabled="isJobClosed" />
                </template>
            </Toolbar>
        </div>

        <div class="splitter-section flex-1 overflow-hidden">
            <Splitter style="height: 100%">
                <SplitterPanel :size="50" :minSize="30" :maxSize="50">
                    <ImageGridPanel
                        :image-groups="sortMode ? sortableGroups : imageGroups"
                        :loading="loading"
                        :loading-more="loadingMore"
                        :selected-group="selectedGroup"
                        :selected-groups="selectedGroupsForMerge"
                        :multi-select-mode="multiSelectMode"
                        :sort-mode="sortMode"
                        :current-page="currentPage"
                        :total-pages="totalPages"
                        @select-group="handleSelectGroup"
                        @toggle-group-selection="toggleGroupSelection"
                        @reorder="handleReorder"
                        @load-more="loadMore"
                    />
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="30">
                    <ImageDetailPanel
                        :selected-group="selectedGroup"
                        :selected-image-detail="selectedImageDetail"
                        :loading-detail="loadingDetail"
                        :is-job-closed="isJobClosed"
                        @refresh-detail="handleRefreshDetail"
                        @refresh-group="handleRefreshGroup"
                    />
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Upload Dialog -->
        <ImageUploadDialog v-model:visible="uploadDialogVisible" :task-guid="taskId" :user-email="username" @upload-complete="handleUploadComplete" />

        <!-- Merge Dialog -->
        <MergeDocumentDialog v-model:visible="mergeDialogVisible" :selected-groups="selectedGroupsForMerge" :task-guid="taskId" :user-email="username" @merge-complete="handleMergeComplete" />

        <!-- Close Job Dialog -->
        <DialogApprove mode="close" title="ยืนยันการปิดงาน" :ramdomNumber="randomNumber" :confirmDialog="dialogJobClose" @close="dialogJobClose = false" @confirmJob="confirmCloseJob" @confirmJobFalse="confirmJobFalse" />

        <!-- Loading Dialog -->
        <LoadingDialog />
    </div>
</template>
