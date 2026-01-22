<script setup>
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageGridPanel from '@/components/image/ImageGridPanel.vue';
import ImageUploadDialog from '@/components/image/ImageUploadDialog.vue';
import MergeDocumentDialog from '@/components/image/MergeDocumentDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import { getDocumentImageDetail, getDocumentImageGroups, recountTaskDocuments, ungroupDocumentImageGroup, updateDocumentImageGroupsOrder } from '@/services/api/image';
import { getTask } from '@/services/api/task';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
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
const sortMode = ref(false);
const sortableGroups = ref([]);
const savingOrder = ref(false);
const imageGroups = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const selectedGroup = ref(null);
const selectedImageDetail = ref(null);
const loadingDetail = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);

const fetchTaskDetail = async () => {
    try {
        showLoading('กำลังโหลดข้อมูลงาน...');
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
    } finally {
        hideLoading();
    }
};

const fetchImageGroups = async (reset = true) => {
    try {
        if (reset) {
            loading.value = true;
            currentPage.value = 1;
            imageGroups.value = [];
            showLoading('กำลังโหลดรายการเอกสาร...');
        } else {
            loadingMore.value = true;
        }

        const response = await getDocumentImageGroups({
            taskguid: taskId.value,
            page: currentPage.value,
            limit: 100
        });

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
        if (reset) {
            hideLoading();
        }
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
    multiSelectMode.value = !multiSelectMode.value;
    if (!multiSelectMode.value) {
        selectedGroupsForMerge.value = [];
    }
};

const toggleGroupSelection = (group) => {
    const index = selectedGroupsForMerge.value.findIndex((g) => g.guidfixed === group.guidfixed);
    if (index !== -1) {
        selectedGroupsForMerge.value.splice(index, 1);
    } else {
        selectedGroupsForMerge.value.push(group);
    }
};

const openMergeDialog = () => {
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
    showLoading('กำลังโหลดรายการเอกสาร...');
    await fetchImageGroups(true);
    hideLoading();
};

const handleUngroup = async () => {
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
                </template>

                <template #center>
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText placeholder="Search" />
                    </IconField>
                </template>

                <template #end>
                    <Button v-if="sortMode" label="บันทึกการเรียง" icon="pi pi-check" severity="success" class="mr-2" @click="saveSortOrder" :loading="savingOrder" />
                    <Button v-if="sortMode" label="ยกเลิก" icon="pi pi-times" severity="secondary" class="mr-2" @click="cancelSortMode" outlined />
                    <Button
                        v-if="!sortMode && selectedGroup && selectedGroup.imagereferences && selectedGroup.imagereferences.length > 1"
                        label="แยกเอกสาร"
                        icon="pi pi-minus-circle"
                        severity="warning"
                        class="mr-2"
                        @click="handleUngroup"
                        :loading="ungrouping"
                        outlined
                    />
                    <Button v-if="!sortMode && multiSelectMode && selectedGroupsForMerge.length >= 2" :label="`รวมเอกสาร (${selectedGroupsForMerge.length})`" icon="pi pi-plus-circle" severity="success" class="mr-2" @click="openMergeDialog" />
                    <Button
                        v-if="!sortMode"
                        :label="multiSelectMode ? 'เลือกหลายรายการ' : 'เลือกเอกสาร'"
                        :icon="multiSelectMode ? 'pi pi-times' : 'pi pi-check-square'"
                        :severity="multiSelectMode ? 'secondary' : 'contrast'"
                        class="mr-2"
                        @click="toggleMultiSelectMode"
                        outlined
                    />
                    <Button v-if="!sortMode" :label="sortMode ? 'เรียงลำดับ' : 'เรียงลำดับ'" icon="pi pi-sort-alt" severity="info" class="mr-2" @click="toggleSortMode" outlined />
                    <Button v-if="!sortMode" label="Upload" icon="pi pi-cloud-upload" class="mr-2" @click="uploadDialogVisible = true" />
                    <Button icon="pi pi-refresh" severity="secondary" text @click="fetchImageGroups" :loading="loading" :disabled="sortMode" />
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
                    <ImageDetailPanel :selected-group="selectedGroup" :selected-image-detail="selectedImageDetail" :loading-detail="loadingDetail" @refresh-detail="handleRefreshDetail" @refresh-group="handleRefreshGroup" />
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Upload Dialog -->
        <ImageUploadDialog v-model:visible="uploadDialogVisible" :task-guid="taskId" :user-email="username" @upload-complete="handleUploadComplete" />

        <!-- Merge Dialog -->
        <MergeDocumentDialog v-model:visible="mergeDialogVisible" :selected-groups="selectedGroupsForMerge" :task-guid="taskId" :user-email="username" @merge-complete="handleMergeComplete" />

        <!-- Loading Dialog -->
        <LoadingDialog />
    </div>
</template>
