<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import DialogApprove from '@/components/DialogApprove.vue';
import DialogForm from '@/components/DialogForm.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageGridPanel from '@/components/image/ImageGridPanel.vue';
import ImageUploadDialog from '@/components/image/ImageUploadDialog.vue';
import MergeDocumentDialog from '@/components/image/MergeDocumentDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import { deleteDocumentImageGroups, getDocumentImageDetail, getDocumentImageGroups, recountTaskDocuments, ungroupDocumentImageGroup, updateDocumentImageGroupImages, updateDocumentImageGroupsOrder } from '@/services/api/image';
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
const showDeleteDialog = ref(false);
const showUngroupDialog = ref(false);
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
const journalDetailDialog = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);
const gridSize = ref('medium'); // เล็ก, กลาง, ใหญ่, ใหญ่มาก

// Menu refs
const documentMenu = ref(null);

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
    },
    {
        label: 'ลบเอกสาร',
        icon: 'pi pi-trash',
        command: () => handleDelete(),
        disabled: isJobClosed.value || !selectedGroup.value || selectedGroup.value?.status === 1
    }
]);

// Toggle menu functions
const toggleDocumentMenu = (event) => {
    documentMenu.value.toggle(event);
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

// Computed: Check if job is closed (status !== 0 and status !== 6)
const isJobClosed = computed(() => {
    return taskData.value?.status !== 0 && taskData.value?.status !== 6;
});

// Computed: Check if approval is disabled (status = 6)
const isApprovalDisabled = computed(() => {
    return taskData.value?.status === 6;
});

// Computed: Check if can close job
const canCloseJob = computed(() => {
    return imageGroups.value.length > 0 && !isJobClosed.value;
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

// Watch mergeDialogVisible
watch(mergeDialogVisible, (newValue) => {
    // Watch for merge dialog visibility changes
});

// Watch selectedGroupsForMerge
watch(
    selectedGroupsForMerge,
    (newValue) => {
        // Watch for selected groups changes
    },
    { deep: true }
);

// Watch multiSelectMode
watch(multiSelectMode, (newValue) => {
    // Watch for multi-select mode changes
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
                // showLoading('กำลังโหลดรายละเอียดเอกสาร...');
                const response = await getDocumentImageDetail(firstImageGuid);
                if (response.data.success) {
                    selectedImageDetail.value = response.data.data;
                }
                hideLoading();
            } catch (error) {
                console.error('Error fetching image detail:', error);
                hideLoading();
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
        showLoading('กำลังรีเฟรชข้อมูล...');
        const response = await getDocumentImageDetail(selectedGroup.value.imagereferences[0].documentimageguid);
        if (response.data.success) {
            selectedImageDetail.value = response.data.data;
        }
        hideLoading();
    } catch (error) {
        console.error('Error refreshing image detail:', error);
        hideLoading();
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
    if (isJobClosed.value) {
        return;
    }
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
        // Find the position of the first selected group before clearing
        const firstSelectedGuid = selectedGroupsForMerge.value[0]?.guidfixed;
        const firstSelectedIndex = imageGroups.value.findIndex((g) => g.guidfixed === firstSelectedGuid);

        // Reset states
        multiSelectMode.value = false;
        selectedGroupsForMerge.value = [];

        // Refresh data to get the new merged group
        showLoading('กำลังโหลดรายการเอกสาร...');
        await fetchImageGroups(true);

        // If we found the original position and have a new group
        if (firstSelectedIndex !== -1 && newGroupGuid) {
            // Find the new merged group (it's probably at the end)
            const newGroupIndex = imageGroups.value.findIndex((g) => g.guidfixed === newGroupGuid);

            if (newGroupIndex !== -1 && newGroupIndex !== firstSelectedIndex) {
                // Move the new group to the original position
                const newGroup = imageGroups.value.splice(newGroupIndex, 1)[0];
                imageGroups.value.splice(firstSelectedIndex, 0, newGroup);

                // Re-sort with new order
                showLoading('กำลังจัดเรียงลำดับ...');
                const orderData = imageGroups.value.map((group, index) => ({
                    guidfixed: group.guidfixed,
                    xorder: index
                }));
                await updateDocumentImageGroupsOrder(taskId.value, orderData);

                // Refresh again to confirm the order
                await fetchImageGroups(true);

                // Auto-select the merged group at its new position
                const mergedGroup = imageGroups.value.find((g) => g.guidfixed === newGroupGuid);
                if (mergedGroup) {
                    selectedGroup.value = mergedGroup;
                    await handleSelectGroup(mergedGroup);
                }
            }
        }

        hideLoading();
    } catch (error) {
        console.error('Error in handleMergeComplete:', error);
        hideLoading();
        // Still refresh the list even if reordering failed
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

const handleDelete = () => {
    if (isJobClosed.value) return;
    if (!selectedGroup.value?.guidfixed) return;

    // ตรวจสอบว่าเอกสารเป็นสถานะ "ผ่าน" (status = 1) หรือไม่
    if (selectedGroup.value.status === 1) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'ไม่สามารถลบเอกสารที่มีสถานะ "ผ่าน" ได้',
            life: 3000
        });
        return;
    }

    showDeleteDialog.value = true;
};

const confirmDelete = async () => {
    showDeleteDialog.value = false;
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

const goBack = () => {
    router.push({ name: 'image-upload' });
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
        // บันทึกตำแหน่งของ target group ก่อนเริ่ม
        const targetIndex = imageGroups.value.findIndex((g) => g.guidfixed === targetGroup.guidfixed);

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

            // 5. Re-position the updated target group to its original position if it moved
            if (targetIndex !== -1) {
                const currentIndex = imageGroups.value.findIndex((g) => g.guidfixed === targetGroup.guidfixed);

                if (currentIndex !== -1 && currentIndex !== targetIndex) {
                    // Move target group back to original position
                    const movedGroup = imageGroups.value.splice(currentIndex, 1)[0];
                    imageGroups.value.splice(targetIndex, 0, movedGroup);
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
                    <div class="font-semibold text-ml">งานอัพโหลด - {{ taskData?.name || taskId }}</div>
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
                        <!-- จำนวนเอกสารทั้งหมด -->
                        <div class="flex items-center gap-2 text-sm bg-surface-100 dark:bg-surface-800 px-3 py-1.5 rounded-lg">
                            <span class="flex items-center gap-1" title="ทั้งหมด">
                                <i class="pi pi-file text-surface-500"></i>
                                <span class="font-semibold">{{ imageGroups.length }}</span>
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
                    <!-- Normal Mode Actions -->
                    <template v-else>
                        <Button v-if="!isJobClosed" label="Upload" icon="pi pi-cloud-upload" class="mr-2" @click="uploadDialogVisible = true" />
                        <Button v-if="!isJobClosed && !isApprovalDisabled" label="ปิดงาน" icon="pi pi-lock" @click="openCloseJobDialog" :disabled="!canCloseJob" :title="imageGroups.length === 0 ? 'ไม่มีเอกสารในงาน' : 'ปิดงาน'" outlined />
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
                                <Button v-if="!sortMode && !isJobClosed" type="button" label="จัดการเอกสาร" icon="pi pi-file-edit" @click="toggleDocumentMenu" size="small" />

                                <!-- ปุ่ม Refresh -->
                                <Button v-if="!sortMode" icon="pi pi-refresh" size="small" @click="fetchImageGroups" :loading="loading" title="รีเฟรช" text />

                                <!-- Context Actions สำหรับ Multi-select Mode -->
                                <template v-if="multiSelectMode && !sortMode">
                                    <Tag :value="`เลือกแล้ว ${selectedGroupsForMerge.length} รายการ`" severity="info" />
                                    <Button v-if="selectedGroupsForMerge.length >= 2" label="รวมเอกสาร" icon="pi pi-plus-circle" severity="success" size="small" @click="openMergeDialog" />
                                    <Button label="ยกเลิก" icon="pi pi-times" size="small" @click="toggleMultiSelectMode" outlined />
                                </template>

                                <!-- Context Actions สำหรับ Sort Mode -->
                                <template v-if="sortMode">
                                    <Tag value="โหมดเรียงลำดับ" severity="info" />
                                </template>
                            </div>
                            <div class="flex items-center gap-2">
                                <!-- แสดงจำนวนเอกสาร -->
                                <Button :icon="gridSizeIcon" @click="cycleGridSize" size="small" outlined />
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
                                :multi-select-mode="multiSelectMode"
                                :sort-mode="sortMode"
                                :current-page="currentPage"
                                :total-pages="totalPages"
                                :grid-size="gridSize"
                                :is-job-closed="isJobClosed"
                                :show-status="true"
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
                        @refresh-detail="handleRefreshDetail"
                        @refresh-group="handleRefreshGroup"
                        @view-journal-detail="handleViewJournalDetail"
                    />
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Upload Dialog -->
        <ImageUploadDialog v-model:visible="uploadDialogVisible" :task-guid="taskId" :user-email="username" @upload-complete="handleUploadComplete" />

        <!-- Merge Dialog -->
        <MergeDocumentDialog v-model:visible="mergeDialogVisible" :selected-groups="selectedGroupsForMerge" :task-guid="taskId" :user-email="username" @merge-complete="handleMergeComplete" />

        <!-- Ungroup Dialog -->
        <DialogForm :confirmDialog="showUngroupDialog" textContent="คุณต้องการแยกเอกสารนี้หรือไม่?" confirmLabel="แยก (Enter)" cancelLabel="ยกเลิก" severity="warning" @close="showUngroupDialog = false" @confirm="confirmUngroup" />

        <!-- Delete Document Dialog -->
        <DialogForm :confirmDialog="showDeleteDialog" textContent="คุณต้องการลบเอกสารนี้หรือไม่?" confirmLabel="ลบ (Enter)" cancelLabel="ยกเลิก" severity="danger" @close="showDeleteDialog = false" @confirm="confirmDelete" />

        <!-- Journal Detail Dialog -->
        <JournalDetailDialog v-model:visible="journalDetailDialog" :journal="selectedJournal" :loading="loadingJournal" />

        <!-- Close Job Dialog -->
        <DialogApprove mode="close" title="ยืนยันการปิดงาน" :randomNumber="randomNumber" :confirmDialog="dialogJobClose" @close="dialogJobClose = false" @confirmJob="confirmCloseJob" @confirmJobFalse="confirmJobFalse" />

        <!-- Loading Dialog -->
        <LoadingDialog />
    </div>
</template>
