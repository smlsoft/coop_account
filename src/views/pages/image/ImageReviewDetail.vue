<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import DialogApprove from '@/components/DialogApprove.vue';
import DialogForm from '@/components/DialogForm.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageGridPanel from '@/components/image/ImageGridPanel.vue';
import MergeDocumentDialog from '@/components/image/MergeDocumentDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import {
    bulkCreateDocumentImages,
    getDocumentImageDetail,
    getDocumentImageGroup,
    getDocumentImageGroups,
    recountTaskDocuments,
    ungroupDocumentImageGroup,
    updateAllDocumentImageGroupsStatus,
    updateDocumentImageGroupImages,
    updateDocumentImageGroupsOrder,
    updateDocumentImageGroupStatus
} from '@/services/api/image';
import { getJournalById } from '@/services/api/journal';
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
const mergeDialogVisible = ref(false);
const multiSelectMode = ref(false);
const statusSelectMode = ref(false);
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
const searchQuery = ref('');
const searchTimeout = ref(null);
const updatingStatus = ref(false);
const updatingAllStatus = ref(false);
const closingJob = ref(false);
const dialogJobClose = ref(false);
const showUngroupDialog = ref(false);
const randomNumber = ref(0);
const journalDetailDialog = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);
const gridSize = ref('medium'); // เล็ก, กลาง, ใหญ่, ใหญ่มาก

// Copy document dialog
const showCopyDialog = ref(false);
const copyCount = ref(1);
const copyingDocument = ref(false);

// Menu refs
const documentMenu = ref(null);
const statusMenu = ref(null);

// Menu items
const documentMenuItems = computed(() => [
    {
        label: 'เลือกหลายรายการ',
        icon: 'pi pi-check-square',
        command: () => toggleMultiSelectMode(),
        disabled: isJobClosed.value
    },
    {
        label: 'เรียงลำดับเอกสาร',
        icon: 'pi pi-sort-alt',
        command: () => toggleSortMode(),
        disabled: isJobClosed.value || multiSelectMode.value
    },
    {
        separator: true
    },
    {
        label: 'แยกเอกสาร',
        icon: 'pi pi-clone',
        command: () => handleUngroup(),
        disabled: isJobClosed.value || !selectedGroup.value || (selectedGroup.value?.imagereferences?.length || 0) <= 1 || (isApprovalDisabled.value && selectedGroup.value?.references && selectedGroup.value.references.length > 0)
    }
]);

const statusMenuItems = computed(() => [
    {
        label: 'เลือกเอกสารเพื่ออัปเดตสถานะ',
        icon: 'pi pi-check-square',
        command: () => toggleStatusSelectMode(),
        disabled: isJobClosed.value
    },
    {
        separator: true
    },
    {
        label: 'ผ่านทั้งหมด',
        icon: 'pi pi-check-circle',
        command: () => handleApproveAll(),
        disabled: isJobClosed.value || updatingAllStatus.value
    },
    {
        label: 'ยกเลิกผ่านทั้งหมด',
        icon: 'pi pi-refresh',
        command: () => handleResetAllStatus(),
        disabled: isJobClosed.value || updatingAllStatus.value
    }
]);

// Toggle menu functions
const toggleDocumentMenu = (event) => {
    documentMenu.value.toggle(event);
};

const toggleStatusMenu = (event) => {
    statusMenu.value.toggle(event);
};

// Grid size cycle: small -> medium -> large -> xlarge -> small
const cycleGridSize = () => {
    const sizes = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(gridSize.value);
    const nextIndex = (currentIndex + 1) % sizes.length;
    gridSize.value = sizes[nextIndex];
};

// Get grid size icon
const gridSizeIcon = computed(() => {
    const icons = {
        small: 'pi pi-th-large',
        medium: 'pi pi-table',
        large: 'pi pi-clone',
        xlarge: 'pi pi-stop'
    };
    return icons[gridSize.value] || 'pi pi-table';
});

// Computed property to check if all documents are reviewed (no pending status=0)
const hasPendingDocuments = computed(() => {
    if (!taskData.value?.totaldocumentstatus) return true;
    const pendingStatus = taskData.value.totaldocumentstatus.find((s) => s.status === 0);
    return pendingStatus && pendingStatus.total > 0;
});

// Computed property to check if job is closed (status = 3 or 4)
const isJobClosed = computed(() => {
    return taskData.value?.status === 3 || taskData.value?.status === 4;
});

// Computed property to check if approval is disabled (status = 6)
const isApprovalDisabled = computed(() => {
    return taskData.value?.status === 6;
});

// Computed property to check if job can be closed
const canCloseJob = computed(() => {
    // Cannot close if task status is already 3 (closed)
    if (taskData.value?.status === 3) return false;
    // Cannot close if there are pending documents
    return !hasPendingDocuments.value;
});

// Computed properties สำหรับจำนวนเอกสารตามสถานะ
const getStatusCount = (status) => {
    if (!taskData.value?.totaldocumentstatus) return 0;
    const statusData = taskData.value.totaldocumentstatus.find((s) => s.status === status);
    return statusData?.total || 0;
};

const totalDocuments = computed(() => taskData.value?.totaldocument || 0);
const pendingCount = computed(() => getStatusCount(0));
const approvedCount = computed(() => getStatusCount(1));
const rejectedCount = computed(() => getStatusCount(2));
const notRecordedCount = computed(() => getStatusCount(3));

// Watch searchQuery with debounce (1 second)
watch(searchQuery, (newValue, oldValue) => {
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
    }

    searchTimeout.value = setTimeout(() => {
        fetchImageGroups(true);
    }, 1000);
});

// Watch mergeDialogVisible - เคลียร์ selectedGroupsForMerge เมื่อปิด dialog (ถ้าไม่ได้อยู่ใน multiSelectMode)
watch(mergeDialogVisible, (newValue) => {
    if (!newValue && !multiSelectMode.value) {
        // เมื่อปิด dialog และไม่ได้อยู่ใน multiSelectMode ให้เคลียร์ค่า
        selectedGroupsForMerge.value = [];
    }
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
        await fetchImageGroups(true);
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

const toggleMultiSelectMode = () => {
    if (isJobClosed.value) return;
    multiSelectMode.value = !multiSelectMode.value;
    if (!multiSelectMode.value) {
        selectedGroupsForMerge.value = [];
    }
};

const toggleGroupSelection = (group) => {
    if (isJobClosed.value) return;

    // ป้องกันการเลือกเอกสารที่บันทึกบัญชีแล้ว
    if (group.references && group.references.length > 0) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถรวมเอกสารได้',
            detail: 'เอกสารนี้ถูกบันทึกบัญชีแล้ว ไม่สามารถรวมกับเอกสารอื่นได้',
            life: 3000
        });
        return;
    }

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

    // ตรวจสอบว่ามีเอกสารที่บันทึกบัญชีแล้วหรือไม่
    const hasRecordedDocs = selectedGroupsForMerge.value.some((g) => g.references && g.references.length > 0);
    if (hasRecordedDocs) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถรวมเอกสารได้',
            detail: 'มีเอกสารที่ถูกบันทึกบัญชีแล้ว ไม่สามารถรวมกับเอกสารอื่นได้',
            life: 3000
        });
        return;
    }

    mergeDialogVisible.value = true;
};

const handleMergeComplete = async (newGroupGuid) => {
    try {
        // เก็บ guid ของ target group (ตำแหน่งแรกใน selectedGroupsForMerge คือ target ที่ drop ลงไป)
        const targetGuid = selectedGroupsForMerge.value[0]?.guidfixed;
        // หาตำแหน่งของ target ก่อน merge
        const targetIndex = imageGroups.value.findIndex((g) => g.guidfixed === targetGuid);

        // เก็บ guid ทั้งหมดที่จะถูกลบ (ทั้ง source และ target)
        const mergedGuids = selectedGroupsForMerge.value.map((g) => g.guidfixed);

        // คำนวณตำแหน่งที่ถูกต้องหลัง merge
        let adjustedIndex = targetIndex;
        if (targetIndex !== -1) {
            for (let i = 0; i < targetIndex; i++) {
                if (mergedGuids.includes(imageGroups.value[i].guidfixed)) {
                    adjustedIndex--;
                }
            }
        }

        // Reset states
        multiSelectMode.value = false;
        selectedGroupsForMerge.value = [];

        // ดึงข้อมูล group ใหม่โดยตรง (เพราะอาจไม่อยู่ใน pagination 100 รายการแรก)
        showLoading('กำลังดึงข้อมูลเอกสารใหม่...');
        let newGroup = null;
        if (newGroupGuid) {
            try {
                const response = await getDocumentImageGroup(newGroupGuid);
                if (response.data.success) {
                    newGroup = response.data.data;
                }
            } catch (err) {
                // Silent fail - will refresh data anyway
            }
        }

        // Refresh data
        showLoading('กำลังโหลดรายการเอกสาร...');
        await fetchImageGroups(true);

        // ถ้ามี group ใหม่และมี adjustedIndex ที่ถูกต้อง
        if (newGroup && adjustedIndex !== -1 && adjustedIndex >= 0) {
            // ลบ groups เก่าที่ถูก merge ออก (ถ้ายังอยู่)
            imageGroups.value = imageGroups.value.filter((g) => !mergedGuids.includes(g.guidfixed));

            // ลบ group ใหม่ออกก่อน (ถ้ามีอยู่แล้ว) เพื่อป้องกันซ้ำ
            imageGroups.value = imageGroups.value.filter((g) => g.guidfixed !== newGroupGuid);

            // แทรก group ใหม่ในตำแหน่งที่ถูกต้อง
            const insertIndex = Math.min(adjustedIndex, imageGroups.value.length);
            imageGroups.value.splice(insertIndex, 0, newGroup);

            // บันทึกลำดับใหม่
            showLoading('กำลังจัดเรียงลำดับ...');
            const orderData = imageGroups.value.map((group, index) => ({
                guidfixed: group.guidfixed,
                xorder: index
            }));

            await updateDocumentImageGroupsOrder(taskId.value, orderData);

            // Refresh อีกครั้งเพื่อยืนยัน
            await fetchImageGroups(true);

            // Auto-select the merged group
            const mergedGroup = imageGroups.value.find((g) => g.guidfixed === newGroupGuid);
            if (mergedGroup) {
                selectedGroup.value = mergedGroup;
                await handleSelectGroup(mergedGroup);
            }
        }

        hideLoading();
    } catch (error) {
        hideLoading();
        await fetchImageGroups(true);
    }
};

const handleUngroup = () => {
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

    showUngroupDialog.value = true;
};

const confirmUngroup = async () => {
    showUngroupDialog.value = false;
    if (!selectedGroup.value?.guidfixed) return;

    ungrouping.value = true;

    try {
        showLoading('กำลังแยกเอกสาร...');
        const response = await ungroupDocumentImageGroup(selectedGroup.value.guidfixed);

        if (response.data.success) {
            const newGuids = response.data.data || [];

            showLoading('กำลังนับจำนวนเอกสารใหม่...');
            await recountTaskDocuments(taskId.value);

            showLoading('กำลังอัปเดตข้อมูลงาน...');
            await fetchTaskDetail();

            showLoading('กำลังโหลดรายการเอกสาร...');
            await fetchImageGroups(true);

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
        sortableGroups.value = [...imageGroups.value];
        multiSelectMode.value = false;
        selectedGroupsForMerge.value = [];
    } else {
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

// Update document image group status
const handleUpdateStatus = async (guidfixed, status) => {
    if (isJobClosed.value) return;
    if (updatingStatus.value) return;

    updatingStatus.value = true;

    try {
        const response = await updateDocumentImageGroupStatus(guidfixed, status);

        if (response.data.success) {
            // Recount task documents
            await recountTaskDocuments(taskId.value);

            // Refresh task detail
            await fetchTaskDetail();

            // Refresh image groups and reselect current group
            const currentGuid = selectedGroup.value?.guidfixed;
            await fetchImageGroups(true);

            // Reselect the group
            if (currentGuid) {
                const updatedGroup = imageGroups.value.find((g) => g.guidfixed === currentGuid);
                if (updatedGroup) {
                    selectedGroup.value = updatedGroup;
                }
            }

            const statusText = {
                0: 'รอตรวจสอบ',
                1: 'ผ่าน',
                2: 'ไม่ผ่าน',
                3: 'ไม่บันทึกรายวัน'
            };

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `อัปเดตสถานะเป็น "${statusText[status]}" แล้ว`,
                life: 3000
            });
        }
    } catch (error) {
        console.error('Update status error:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะได้',
            life: 3000
        });
    } finally {
        updatingStatus.value = false;
    }
};

const handleSearch = () => {
    fetchImageGroups(true);
};

// Toggle status select mode
const toggleStatusSelectMode = () => {
    statusSelectMode.value = !statusSelectMode.value;
    if (!statusSelectMode.value) {
        selectedGroupsForMerge.value = [];
    }
    // ปิดโหมดอื่นๆ
    if (statusSelectMode.value) {
        multiSelectMode.value = false;
        sortMode.value = false;
    }
};

// Bulk update status for selected groups
const handleBulkUpdateStatus = async (status) => {
    if (isJobClosed.value) return;
    if (updatingStatus.value) return;
    if (selectedGroupsForMerge.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณาเลือกเอกสารอย่างน้อย 1 รายการ',
            life: 3000
        });
        return;
    }

    updatingStatus.value = true;

    try {
        showLoading(`กำลังอัปเดตสถานะ ${selectedGroupsForMerge.value.length} รายการ...`);

        // Update status for each selected group
        const updatePromises = selectedGroupsForMerge.value.map((group) => updateDocumentImageGroupStatus(group.guidfixed, status));

        await Promise.all(updatePromises);

        // Recount task documents
        showLoading('กำลังนับจำนวนเอกสารใหม่...');
        await recountTaskDocuments(taskId.value);

        // Refresh task detail
        showLoading('กำลังอัปเดตข้อมูลงาน...');
        await fetchTaskDetail();

        // Refresh image groups
        showLoading('กำลังโหลดรายการเอกสาร...');
        await fetchImageGroups(true);

        hideLoading();

        const statusText = {
            0: 'รอตรวจสอบ',
            1: 'ผ่าน',
            2: 'ไม่ผ่าน',
            3: 'ไม่บันทึกรายวัน'
        };

        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: `อัปเดตสถานะเป็น "${statusText[status]}" แล้ว ${selectedGroupsForMerge.value.length} รายการ`,
            life: 3000
        });

        // Exit status select mode
        toggleStatusSelectMode();
    } catch (error) {
        hideLoading();
        console.error('Bulk update status error:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะได้',
            life: 3000
        });
    } finally {
        updatingStatus.value = false;
    }
};

// ผ่านทั้งหมด - เปลี่ยนสถานะเอกสารทั้งหมดเป็น status: 1
const handleApproveAll = async () => {
    if (isJobClosed.value) return;
    if (updatingAllStatus.value) return;

    updatingAllStatus.value = true;

    try {
        showLoading('กำลังอนุมัติเอกสารทั้งหมด...');
        const response = await updateAllDocumentImageGroupsStatus(taskId.value, 1);

        if (response.data.success) {
            // Recount task documents
            showLoading('กำลังนับจำนวนเอกสารใหม่...');
            await recountTaskDocuments(taskId.value);

            // Refresh task detail
            showLoading('กำลังอัปเดตข้อมูลงาน...');
            await fetchTaskDetail();

            // Refresh image groups
            showLoading('กำลังโหลดรายการเอกสาร...');
            await fetchImageGroups(true);

            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'อนุมัติเอกสารทั้งหมดแล้ว',
                life: 3000
            });

            // Clear selection
            selectedGroup.value = null;
            selectedImageDetail.value = null;
        } else {
            throw new Error('Approve all failed');
        }
    } catch (error) {
        console.error('Approve all error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถอนุมัติเอกสารทั้งหมดได้',
            life: 3000
        });
    } finally {
        updatingAllStatus.value = false;
    }
};

// ยกเลิกผ่านทั้งหมด - เปลี่ยนสถานะเอกสารทั้งหมดเป็น status: 0 (ยกเว้นเอกสารที่บันทึกบัญชีแล้ว)
const handleResetAllStatus = async () => {
    if (isJobClosed.value) return;
    if (updatingAllStatus.value) return;

    // กรองเอกสารที่ไม่ได้บันทึกบัญชี (ไม่มี references)
    const groupsToReset = imageGroups.value.filter((g) => !(g.references && g.references.length > 0));
    const recordedGroups = imageGroups.value.filter((g) => g.references && g.references.length > 0);

    if (groupsToReset.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถดำเนินการได้',
            detail: 'ไม่มีเอกสารที่สามารถยกเลิกผ่านได้ (เอกสารทั้งหมดถูกบันทึกบัญชีแล้ว)',
            life: 3000
        });
        return;
    }

    updatingAllStatus.value = true;

    try {
        showLoading('กำลังยกเลิกการอนุมัติ...');

        let successCount = 0;
        let failCount = 0;

        // อัปเดตทีละรายการสำหรับเอกสารที่ไม่ได้บันทึกบัญชี
        for (const group of groupsToReset) {
            try {
                const response = await updateDocumentImageGroupStatus(group.guidfixed, 0);
                if (response.data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Error resetting status for ${group.guidfixed}:`, error);
                failCount++;
            }
        }

        // Recount task documents
        showLoading('กำลังนับจำนวนเอกสารใหม่...');
        await recountTaskDocuments(taskId.value);

        // Refresh task detail
        showLoading('กำลังอัปเดตข้อมูลงาน...');
        await fetchTaskDetail();

        // Refresh image groups
        showLoading('กำลังโหลดรายการเอกสาร...');
        await fetchImageGroups(true);

        hideLoading();

        // แสดงผลลัพธ์
        if (successCount > 0) {
            let message = `ยกเลิกการอนุมัติแล้ว ${successCount} รายการ`;
            if (recordedGroups.length > 0) {
                message += ` (ข้าม ${recordedGroups.length} รายการที่บันทึกบัญชีแล้ว)`;
            }

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: message,
                life: 4000
            });
        }

        if (failCount > 0) {
            toast.add({
                severity: 'warn',
                summary: 'คำเตือน',
                detail: `ไม่สามารถยกเลิกได้ ${failCount} รายการ`,
                life: 3000
            });
        }

        // Clear selection
        selectedGroup.value = null;
        selectedImageDetail.value = null;
    } catch (error) {
        console.error('Reset all status error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถยกเลิกการอนุมัติทั้งหมดได้',
            life: 3000
        });
    } finally {
        updatingAllStatus.value = false;
    }
};

const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

const openCloseJobDialog = () => {
    // Check if there are pending documents
    if (hasPendingDocuments.value) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถปิดงานได้',
            detail: 'ยังมีเอกสารที่รอตรวจสอบอยู่ กรุณาตรวจสอบเอกสารให้ครบทุกรายการ',
            life: 5000
        });
        return;
    }
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

// Close job function
const confirmCloseJob = async () => {
    closingJob.value = true;

    try {
        showLoading('กำลังปิดงาน...');
        const response = await updateTaskStatus(taskId.value, { status: 3 });

        if (response.data.success) {
            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ปิดงานเรียบร้อยแล้ว',
                life: 3000
            });

            dialogJobClose.value = false;

            // Navigate back to review list
            setTimeout(() => {
                router.push({ name: 'image-review' });
            }, 500);
        } else {
            throw new Error('Close job failed');
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

const goBack = () => {
    router.push({ name: 'image-review' });
};

// View Journal Detail
const handleViewJournalDetail = async (reference) => {
    if (!reference?.guidfixed) return;

    try {
        loadingJournal.value = true;
        const response = await getJournalById(reference.guidfixed);

        if (response.data.success) {
            selectedJournal.value = response.data.data;
            journalDetailDialog.value = true;
        } else {
            toast.add({
                severity: 'error',
                summary: 'ข้อผิดพลาด',
                detail: 'ไม่สามารถโหลดข้อมูลรายการบัญชีได้',
                life: 3000
            });
        }
    } catch (error) {
        console.error('Error fetching journal detail:', error);
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลรายการบัญชีได้',
            life: 3000
        });
    } finally {
        loadingJournal.value = false;
    }
};

// Handle copy document
const handleCopyDocument = () => {
    if (isJobClosed.value) return;
    if (!selectedGroup.value?.guidfixed) return;

    copyCount.value = 1;
    showCopyDialog.value = true;
};

const confirmCopyDocument = async () => {
    if (!selectedGroup.value?.guidfixed || copyCount.value < 1) return;

    copyingDocument.value = true;

    try {
        showLoading('กำลัง Copy เอกสาร...');

        // สร้าง payload สำหรับ bulk create
        const bulkPayload = [];
        const now = new Date();

        // วนลูปสร้างข้อมูลตามจำนวนที่ระบุ
        for (let i = 1; i <= copyCount.value; i++) {
            // วนลูปแต่ละรูปใน group
            if (selectedGroup.value.imagereferences && selectedGroup.value.imagereferences.length > 0) {
                for (const imgRef of selectedGroup.value.imagereferences) {
                    // แยกนามสกุลไฟล์ออกจากชื่อ
                    const originalName = imgRef.name || 'document';
                    const lastDotIndex = originalName.lastIndexOf('.');
                    const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
                    const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
                    const newName = `${nameWithoutExt} copy-${i}${extension}`;

                    bulkPayload.push({
                        name: newName,
                        metafileat: imgRef.metafileat || now.toISOString(),
                        imageuri: imgRef.imageuri,
                        uploadedby: username.value || 'unknown',
                        uploadedat: now.toISOString(),
                        billcount: 1,
                        tags: [`copy-${i}`],
                        taskguid: taskId.value
                    });
                }
            }
        }

        // ส่ง bulk create
        const response = await bulkCreateDocumentImages(bulkPayload);

        if (response.data.success) {
            // Recount task documents
            showLoading('กำลังนับจำนวนเอกสารใหม่...');
            await recountTaskDocuments(taskId.value);

            // Refresh task detail
            showLoading('กำลังอัปเดตข้อมูลงาน...');
            await fetchTaskDetail();

            // Refresh image groups
            showLoading('กำลังโหลดรายการเอกสาร...');
            await fetchImageGroups(true);

            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: `Copy เอกสาร ${copyCount.value} ชุดเรียบร้อยแล้ว`,
                life: 3000
            });

            showCopyDialog.value = false;
            copyCount.value = 1;
        } else {
            throw new Error('Copy document failed');
        }
    } catch (error) {
        console.error('Copy document error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: error.response?.data?.message || 'ไม่สามารถ Copy เอกสารได้',
            life: 3000
        });
    } finally {
        copyingDocument.value = false;
    }
};

const handleCancelCopy = () => {
    showCopyDialog.value = false;
    copyCount.value = 1;
};

// ========== Drag & Drop Merge Handlers ==========

// Use Case 1: รวมเอกสาร (สร้าง group ใหม่) - เปิด MergeDocumentDialog
const handleDragMergeGroups = ({ sourceGroup, targetGroup }) => {
    if (isJobClosed.value) return;

    // ป้องกันการ drag เอกสารที่บันทึกบัญชีแล้ว
    if ((sourceGroup.references && sourceGroup.references.length > 0) || (targetGroup.references && targetGroup.references.length > 0)) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถรวมเอกสารได้',
            detail: 'เอกสารที่ถูกบันทึกบัญชีแล้วไม่สามารถรวมกับเอกสารอื่นได้',
            life: 3000
        });
        return;
    }

    // เพิ่ม groups เข้า selectedGroupsForMerge แล้วเปิด dialog
    // ให้ targetGroup อยู่ก่อน (ตำแหน่งแรก) เพราะจะใช้ตำแหน่งนี้ในการวาง
    selectedGroupsForMerge.value = [targetGroup, sourceGroup];
    mergeDialogVisible.value = true;
};

// Use Case 2: เพิ่มเอกสารเข้าในชุดที่มีอยู่แล้ว - ใช้ข้อมูลของชุดหลักเลย ไม่ต้องเปิด dialog
const handleDragAddToGroup = async ({ sourceGroup, targetGroup }) => {
    if (isJobClosed.value) return;

    // ป้องกันการ drag เอกสารที่บันทึกบัญชีแล้ว
    if ((sourceGroup.references && sourceGroup.references.length > 0) || (targetGroup.references && targetGroup.references.length > 0)) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถเพิ่มเอกสารได้',
            detail: 'เอกสารที่ถูกบันทึกบัญชีแล้วไม่สามารถรวมกับเอกสารอื่นได้',
            life: 3000
        });
        return;
    }

    try {
        // บันทึกตำแหน่งของ target group และ source group ก่อนเริ่ม
        const targetIndex = imageGroups.value.findIndex((g) => g.guidfixed === targetGroup.guidfixed);
        const sourceIndex = imageGroups.value.findIndex((g) => g.guidfixed === sourceGroup.guidfixed);

        // คำนวณตำแหน่งที่ถูกต้องหลัง merge
        // ถ้า source อยู่ก่อน target, ตำแหน่ง target จะเลื่อนลง 1 หลังจาก source ถูกลบ
        let adjustedTargetIndex = targetIndex;
        if (sourceIndex !== -1 && sourceIndex < targetIndex) {
            adjustedTargetIndex = targetIndex - 1;
        }

        showLoading('กำลังเพิ่มเอกสารเข้าชุด...');

        // รวม imagereferences - เพิ่ม source เข้าไปใน target
        const allImageReferences = [];
        let xorder = 0;

        // เพิ่มรูปจาก sourceGroup ก่อน (รูปที่ลากมา) - ให้อยู่ด้านหน้าเพื่อให้เห็นการเปลี่ยนแปลง
        if (sourceGroup.imagereferences && sourceGroup.imagereferences.length > 0) {
            for (const imgRef of sourceGroup.imagereferences) {
                allImageReferences.push({
                    ...imgRef,
                    xorder: xorder++
                });
            }
        }

        // เพิ่มรูปจาก targetGroup ตาม (ชุดหลัก)
        if (targetGroup.imagereferences && targetGroup.imagereferences.length > 0) {
            for (const imgRef of targetGroup.imagereferences) {
                allImageReferences.push({
                    ...imgRef,
                    xorder: xorder++
                });
            }
        }

        // 1. อัปเดต imagereferences ของ target group
        const response = await updateDocumentImageGroupImages(targetGroup.guidfixed, allImageReferences);

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

            // 5. Re-position the updated target group to its adjusted position if it moved
            if (adjustedTargetIndex !== -1 && adjustedTargetIndex >= 0) {
                const currentIndex = imageGroups.value.findIndex((g) => g.guidfixed === targetGroup.guidfixed);

                if (currentIndex !== -1 && currentIndex !== adjustedTargetIndex) {
                    // Move target group back to adjusted position
                    const movedGroup = imageGroups.value.splice(currentIndex, 1)[0];
                    // ป้องกัน index เกินขอบเขต
                    const insertIndex = Math.min(adjustedTargetIndex, imageGroups.value.length);
                    imageGroups.value.splice(insertIndex, 0, movedGroup);
                }

                // Re-sort with new order
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
                detail: `เพิ่มเอกสารเข้าชุด "${targetGroup.title || 'ไม่มีชื่อ'}" แล้ว`,
                life: 3000
            });

            // Auto-select the updated target group at its position
            const updatedGroup = imageGroups.value.find((g) => g.guidfixed === targetGroup.guidfixed);
            if (updatedGroup) {
                selectedGroup.value = updatedGroup;
                await handleSelectGroup(updatedGroup);
            }
        } else {
            throw new Error('Add to group failed');
        }
    } catch (error) {
        console.error('Drag add to group error:', error);
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถเพิ่มเอกสารเข้าชุดได้',
            life: 3000
        });
    }
};
</script>

<template>
    <div class="main-container" style="height: calc(100vh - 120px); display: flex; flex-direction: column; overflow: hidden">
        <Toast />

        <div class="toolbar-section flex-none mb-4">
            <Toolbar>
                <template #start>
                    <Button icon="pi pi-arrow-left" class="mr-2" text @click="goBack" />
                    <div class="font-semibold text-ml">ตรวจสอบงาน - {{ taskData?.name || taskId }}</div>
                    <Tag v-if="isJobClosed" value="งานถูกปิดแล้ว" severity="danger" class="ml-3" />
                </template>

                <template #center>
                    <div class="flex items-center gap-4">
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="searchQuery" placeholder="ค้นหาเอกสาร..." @keyup.enter="handleSearch" />
                        </IconField>
                        <!-- สรุปสถานะเอกสาร -->
                        <div class="flex items-center gap-3 text-sm bg-surface-100 dark:bg-surface-800 px-3 py-1.5 rounded-lg">
                            <span class="flex items-center gap-1" title="ทั้งหมด">
                                <i class="pi pi-file text-surface-500"></i>
                                <span class="font-semibold">{{ totalDocuments }}</span>
                            </span>
                            <span class="text-surface-300">|</span>
                            <span class="flex items-center gap-1" title="รอตรวจสอบ">
                                <i class="pi pi-clock text-gray-500"></i>
                                <span class="font-semibold text-gray-600 dark:text-gray-400">{{ pendingCount }}</span>
                            </span>
                            <span class="flex items-center gap-1" title="ผ่าน">
                                <i class="pi pi-check-circle text-green-500"></i>
                                <span class="font-semibold text-green-600">{{ approvedCount }}</span>
                            </span>
                            <span class="flex items-center gap-1" title="ไม่ผ่าน">
                                <i class="pi pi-times-circle text-red-500"></i>
                                <span class="font-semibold text-red-600">{{ rejectedCount }}</span>
                            </span>
                            <span class="flex items-center gap-1" title="ไม่บันทึกรายวัน">
                                <i class="pi pi-minus-circle text-orange-500"></i>
                                <span class="font-semibold text-orange-600">{{ notRecordedCount }}</span>
                            </span>
                        </div>
                    </div>
                </template>

                <template #end>
                    <!-- Sort Mode Actions -->
                    <template v-if="sortMode">
                        <Button label="บันทึกการเรียง" icon="pi pi-save" class="mr-2" @click="saveSortOrder" :loading="savingOrder" />
                        <Button label="ยกเลิก" icon="pi pi-times" @click="cancelSortMode" outlined />
                    </template>
                    <!-- Status Select Mode Actions -->
                    <template v-else-if="statusSelectMode">
                        <div class="flex items-center gap-2">
                            <Tag :value="`เลือกแล้ว ${selectedGroupsForMerge.length} รายการ`" severity="success" />
                            <Button label="ผ่าน" icon="pi pi-check-circle" severity="success" @click="handleBulkUpdateStatus(1)" :disabled="selectedGroupsForMerge.length === 0" />
                            <Button label="ไม่ผ่าน" icon="pi pi-times-circle" severity="danger" @click="handleBulkUpdateStatus(2)" :disabled="selectedGroupsForMerge.length === 0" />
                            <Button label="ไม่บันทึกรายวัน" icon="pi pi-minus-circle" severity="warning" @click="handleBulkUpdateStatus(3)" :disabled="selectedGroupsForMerge.length === 0" />
                            <Button label="รอตรวจสอบ" icon="pi pi-clock" severity="secondary" @click="handleBulkUpdateStatus(0)" :disabled="selectedGroupsForMerge.length === 0" />
                            <Button label="ยกเลิก" icon="pi pi-times" @click="toggleStatusSelectMode" outlined />
                        </div>
                    </template>
                    <!-- Normal Mode Actions -->
                    <template v-else>
                        <Button v-if="!isJobClosed && !isApprovalDisabled" label="ปิดงาน" icon="pi pi-lock" @click="openCloseJobDialog" :disabled="!canCloseJob" :title="hasPendingDocuments ? 'ยังมีเอกสารที่รอตรวจสอบอยู่' : 'ปิดงาน'" />
                    </template>
                </template>
            </Toolbar>
        </div>

        <div class="splitter-section flex-1 overflow-hidden">
            <Splitter style="height: 100%">
                <SplitterPanel :size="50" :minSize="30" :maxSize="50">
                    <div class="h-full flex flex-col">
                        <!-- Toolbar ย่อย -->
                        <div class="flex-none flex items-center justify-between gap-2 px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                            <div class="flex items-center gap-2">
                                <!-- Dropdown จัดการเอกสาร -->
                                <Menu ref="documentMenu" :model="documentMenuItems" :popup="true" />
                                <Button v-if="taskData && !sortMode && !isJobClosed" type="button" label="จัดการเอกสาร" icon="pi pi-file-edit" @click="toggleDocumentMenu" size="small" />

                                <!-- Dropdown จัดการสถานะ -->
                                <Menu ref="statusMenu" :model="statusMenuItems" :popup="true" />
                                <Button v-if="taskData && !sortMode && !multiSelectMode && !statusSelectMode && !isJobClosed" type="button" label="จัดการสถานะ" icon="pi pi-check-square" @click="toggleStatusMenu" size="small" />

                                <!-- ปุ่ม Refresh -->
                                <Button v-if="!sortMode" icon="pi pi-refresh" size="small" @click="fetchImageGroups" :loading="loading" title="รีเฟรช" text />

                                <!-- Context Actions สำหรับ Multi-select Mode -->
                                <template v-if="multiSelectMode && !sortMode">
                                    <Tag :value="`เลือกแล้ว ${selectedGroupsForMerge.length} รายการ`" severity="info" />
                                    <Button v-if="selectedGroupsForMerge.length >= 2" label="รวมเอกสาร" icon="pi pi-plus-circle" size="small" @click="openMergeDialog" />
                                    <Button label="ยกเลิก" icon="pi pi-times" size="small" @click="toggleMultiSelectMode" outlined />
                                </template>

                                <!-- Context Actions สำหรับ Status Select Mode -->
                                <template v-if="statusSelectMode && !sortMode">
                                    <Tag value="โหมดอัปเดตสถานะ" severity="success" />
                                </template>

                                <!-- Context Actions สำหรับ Sort Mode -->
                                <template v-if="sortMode">
                                    <Tag value="โหมดเรียงลำดับ" severity="info" />
                                </template>
                            </div>

                            <div class="flex items-center gap-2">
                                <!-- ปุ่มเปลี่ยนขนาดการแสดงผล -->
                                <Button :icon="gridSizeIcon" @click="cycleGridSize" size="small" outlined />
                                <!-- แสดงจำนวนเอกสาร -->
                                <div class="text-sm text-surface-600 dark:text-surface-400">{{ imageGroups.length }} รายการ</div>
                            </div>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <ImageGridPanel
                                :image-groups="sortMode ? sortableGroups : imageGroups"
                                :loading="loading"
                                :loading-more="loadingMore"
                                :selected-group="selectedGroup"
                                :selected-groups="selectedGroupsForMerge"
                                :multi-select-mode="multiSelectMode || statusSelectMode"
                                :sort-mode="sortMode"
                                :current-page="currentPage"
                                :total-pages="totalPages"
                                :grid-size="gridSize"
                                :show-status="true"
                                :is-job-closed="isJobClosed"
                                @select-group="handleSelectGroup"
                                @toggle-group-selection="toggleGroupSelection"
                                @reorder="handleReorder"
                                @load-more="loadMore"
                                @merge-groups="handleDragMergeGroups"
                                @add-to-group="handleDragAddToGroup"
                            />
                        </div>
                    </div>
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="30">
                    <ImageDetailPanel
                        :selected-group="selectedGroup"
                        :selected-image-detail="selectedImageDetail"
                        :loading-detail="loadingDetail"
                        :is-job-closed="isJobClosed"
                        :is-review-mode="true"
                        :updating-status="updatingStatus"
                        :task-status="taskData?.status"
                        :show-copy-button="true"
                        @refresh-detail="handleRefreshDetail"
                        @refresh-group="handleRefreshGroup"
                        @update-status="handleUpdateStatus"
                        @view-journal-detail="handleViewJournalDetail"
                        @copy-document="handleCopyDocument"
                    />
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Merge Dialog -->
        <MergeDocumentDialog v-model:visible="mergeDialogVisible" :selected-groups="selectedGroupsForMerge" :task-guid="taskId" :user-email="username" @merge-complete="handleMergeComplete" />

        <!-- Ungroup Dialog -->
        <DialogForm :confirmDialog="showUngroupDialog" textContent="คุณต้องการแยกเอกสารนี้หรือไม่?" confirmLabel="แยก (Enter)" cancelLabel="ยกเลิก" severity="warning" @close="showUngroupDialog = false" @confirm="confirmUngroup" />

        <!-- Journal Detail Dialog -->
        <JournalDetailDialog v-model:visible="journalDetailDialog" :journal="selectedJournal" :loading="loadingJournal" />

        <!-- Close Job Dialog -->
        <DialogApprove mode="close" title="ยืนยันการปิดงาน" :randomNumber="randomNumber" :confirmDialog="dialogJobClose" @close="dialogJobClose = false" @confirmJob="confirmCloseJob" @confirmJobFalse="confirmJobFalse" />

        <!-- Copy Document Dialog -->
        <Dialog v-model:visible="showCopyDialog" modal :closable="true" :style="{ width: '500px' }" @keydown.enter="confirmCopyDocument">
            <template #header>
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <i class="pi pi-copy text-2xl text-primary-600 dark:text-primary-400"></i>
                    </div>
                    <div>
                        <div class="text-xl font-semibold text-surface-900 dark:text-surface-0">Copy เอกสาร</div>
                        <div class="text-sm text-surface-500 dark:text-surface-400">สร้างสำเนาเอกสารใหม่</div>
                    </div>
                </div>
            </template>

            <div class="flex flex-col gap-5 py-5">
                <!-- เอกสารต้นฉบับ -->
                <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
                    <div class="flex items-start gap-3">
                        <i class="pi pi-file text-2xl text-surface-500 mt-1"></i>
                        <div class="flex-1">
                            <div class="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">เอกสารต้นฉบับ</div>
                            <div class="text-surface-900 dark:text-surface-100 font-medium">{{ selectedGroup?.title || 'ไม่มีชื่อ' }}</div>
                            <div class="flex items-center gap-2 mt-2">
                                <Tag :value="`${selectedGroup?.imagereferences?.length || 0} รูป`" severity="info" size="small" />
                                <Tag v-if="selectedGroup?.status === 0" value="รอตรวจสอบ" severity="secondary" size="small" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- จำนวนที่ต้องการ Copy -->
                <div>
                    <label class="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                        <i class="pi pi-hashtag mr-1"></i>
                        จำนวนชุดที่ต้องการ Copy
                    </label>
                    <InputNumber v-model="copyCount" :min="1" :max="100" showButtons buttonLayout="horizontal" :step="1" fluid inputClass="text-center text-lg font-semibold" @keydown.enter="confirmCopyDocument">
                        <template #incrementbuttonicon>
                            <span class="pi pi-plus" />
                        </template>
                        <template #decrementbuttonicon>
                            <span class="pi pi-minus" />
                        </template>
                    </InputNumber>
                </div>

                <!-- สรุปผลลัพธ์ -->
                <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                    <div class="flex items-start gap-3">
                        <i class="pi pi-info-circle text-primary-600 dark:text-primary-400 text-xl mt-0.5"></i>
                        <div class="flex-1">
                            <div class="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-2">ผลลัพธ์ที่จะได้</div>
                            <div class="text-sm text-primary-800 dark:text-primary-200">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="pi pi-arrow-right text-xs"></i>
                                    <span
                                        >สร้างเอกสารใหม่ <strong>{{ copyCount }} ชุด</strong></span
                                    >
                                </div>
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="pi pi-arrow-right text-xs"></i>
                                    <span
                                        >แต่ละชุดมี <strong>{{ selectedGroup?.imagereferences?.length || 0 }} รูป</strong></span
                                    >
                                </div>
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-arrow-right text-xs"></i>
                                    <span>ชื่อไฟล์จะเพิ่ม <strong>"copy-1", "copy-2", ...</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="ยกเลิก (Esc)" icon="pi pi-times" @click="handleCancelCopy" severity="secondary" outlined />
                    <Button label="ยืนยัน Copy (Enter)" icon="pi pi-save" @click="confirmCopyDocument" :loading="copyingDocument" :disabled="copyCount < 1" />
                </div>
            </template>
        </Dialog>

        <!-- Loading Dialog -->
        <LoadingDialog />
    </div>
</template>
