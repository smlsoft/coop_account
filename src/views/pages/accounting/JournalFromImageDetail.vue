<script setup>
import JournalDetailDialog from '@/components/accounting/JournalDetailDialog.vue';
import DialogApprove from '@/components/DialogApprove.vue';
import ImageDetailPanel from '@/components/image/ImageDetailPanel.vue';
import ImageGridPanel from '@/components/image/ImageGridPanel.vue';
import MergeDocumentDialog from '@/components/image/MergeDocumentDialog.vue';
import LoadingDialog from '@/components/LoadingDialog.vue';
import { useLoading } from '@/composables/useLoading';
import { getDocumentImageDetail, getDocumentImageGroups, recountTaskDocuments, ungroupDocumentImageGroup, updateDocumentImageGroupsOrder } from '@/services/api/image';
import { deselectDocref, getDocrefSelected, getJournalById, selectDocref } from '@/services/api/journal';
import { getTask, updateTaskStatus } from '@/services/api/task';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// Get current user email from localStorage
const getCurrentUserEmail = () => {
    return localStorage.getItem('username') || '';
};
const currentUserEmail = ref(getCurrentUserEmail());

const taskId = ref('');
const taskData = ref(null);
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
const searchQuery = ref('');
const searchTimeout = ref(null);
const updatingStatus = ref(false);
const updatingAllStatus = ref(false);
const closingJob = ref(false);
const dialogJobClose = ref(false);
const randomNumber = ref(0);
const selectedByUsers = ref([]);
const wsDocref = ref(null);
const pollingInterval = ref(null);
const journalDetailDialog = ref(false);
const selectedJournal = ref(null);
const loadingJournal = ref(false);

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
        disabled: isJobClosed.value || !selectedGroup.value || (selectedGroup.value?.imagereferences?.length || 0) <= 1
    }
]);

// Toggle menu function
const toggleDocumentMenu = (event) => {
    documentMenu.value.toggle(event);
};

// Computed property to check if job is closed (status = 4)
const isJobClosed = computed(() => {
    return taskData.value?.status === 4;
});

// Computed property to check if job can be closed
const canCloseJob = computed(() => {
    // ตรวจสอบว่า เอกสารทั้งหมดได้รับการบันทึกรายวันครบหรือไม่
    // ต้องบันทึก (status=1) ทั้งหมด และมี referencecount เท่ากับจำนวนเอกสาร
    const needToRecord = getStatusCount(1); // เอกสารที่ต้องบันทึก
    const recorded = taskData.value?.referencecount || 0; // บันทึกแล้ว
    return needToRecord > 0 && needToRecord === recorded;
});

// Computed properties สำหรับจำนวนเอกสารตามสถานะ
const getStatusCount = (status) => {
    if (!taskData.value?.totaldocumentstatus) return 0;
    const statusData = taskData.value.totaldocumentstatus.find((s) => s.status === status);
    return statusData?.total || 0;
};

const totalDocuments = computed(() => taskData.value?.totaldocument || 0);
const needToRecordCount = computed(() => getStatusCount(1)); // status = 1 (ผ่าน) = ต้องบันทึก
const recordedCount = computed(() => taskData.value?.referencecount || 0);
const remainingCount = computed(() => needToRecordCount.value - recordedCount.value);

// Watch searchQuery with debounce
watch(searchQuery, () => {
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
    }

    searchTimeout.value = setTimeout(() => {
        fetchImageGroups(true);
    }, 1000);
});

// Watch mergeDialogVisible
watch(mergeDialogVisible, (newValue) => {
    if (!newValue && !multiSelectMode.value) {
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
            limit: 100,
            // เฉพาะเอกสารที่ status = 1 (ผ่าน/ต้องบันทึก)
            status: '1'
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

// Fetch selected users from API (initial load)
const fetchSelectedUsers = async () => {
    try {
        const response = await getDocrefSelected();
        if (response.data.success) {
            selectedByUsers.value = response.data.data || [];
        }
    } catch (error) {
        console.error('Error fetching selected users:', error);
    }
};

// Send select docref when user clicks journal button
const sendSelectDocref = async (docref) => {
    try {
        const response = await selectDocref(docref);
        return response.data.success;
    } catch (error) {
        console.error('Error sending select docref:', error);
        return false;
    }
};

// Deselect current docref before selecting new one
const sendDeselectDocref = async (docref) => {
    try {
        await deselectDocref(docref);
    } catch (error) {
        console.error('Error sending deselect docref:', error);
    }
};

// Find if current user has selected any docref
const getCurrentUserSelectedDocref = () => {
    const found = selectedByUsers.value.find((item) => item.username === currentUserEmail.value);
    return found ? found.docref : null;
};

// WebSocket connection for real-time docref updates
const connectDocrefWebSocket = () => {
    const token = localStorage.getItem('_token');
    if (!token) return;

    wsDocref.value = new WebSocket(`wss://api.dev.dedepos.com/gl/journal/ws/docref?apikey=${token}`);

    wsDocref.value.onopen = () => {
        console.log('WebSocket docref connected');
    };

    wsDocref.value.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket docref message:', data);

            if (data.status === 'selected') {
                // Add user to selectedByUsers if not already exists
                const exists = selectedByUsers.value.find((item) => item.docref === data.docref);
                if (!exists) {
                    selectedByUsers.value.push({
                        docref: data.docref,
                        username: data.username
                    });
                }
            } else if (data.status === 'deselected') {
                // Remove user from selectedByUsers
                selectedByUsers.value = selectedByUsers.value.filter((item) => item.docref !== data.docref);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    wsDocref.value.onclose = (e) => {
        console.log('WebSocket docref closed:', e.reason);
        // Reconnect after 1 second if still on this page
        setTimeout(() => {
            const token = localStorage.getItem('_token');
            if (token && route.name === 'journal-from-image-detail') {
                connectDocrefWebSocket();
            }
        }, 1000);
    };

    wsDocref.value.onerror = (error) => {
        console.error('WebSocket docref error:', error);
    };
};

// Disconnect WebSocket
const disconnectDocrefWebSocket = () => {
    if (wsDocref.value) {
        wsDocref.value.close();
        wsDocref.value = null;
    }
};

// Computed: check if selected group is being viewed by another user
const isSelectedByOther = computed(() => {
    if (!selectedGroup.value?.guidfixed) return false;
    const found = selectedByUsers.value.find((item) => item.docref === selectedGroup.value.guidfixed);
    if (!found) return false;
    // Check if it's not the current user
    return found.username !== currentUserEmail.value;
});

// Computed: get username of who is selecting the current group
const selectedByUsername = computed(() => {
    if (!selectedGroup.value?.guidfixed) return '';
    const found = selectedByUsers.value.find((item) => item.docref === selectedGroup.value.guidfixed);
    if (!found || found.username === currentUserEmail.value) return '';
    return found.username;
});

// Start polling for selected users every 5 seconds
const startPolling = () => {
    pollingInterval.value = setInterval(async () => {
        await fetchSelectedUsers();
    }, 5000);
};

// Stop polling
const stopPolling = () => {
    if (pollingInterval.value) {
        clearInterval(pollingInterval.value);
        pollingInterval.value = null;
    }
};

onMounted(async () => {
    taskId.value = route.params.id;
    await fetchTaskDetail();
    await fetchImageGroups();
    // Fetch initial selected users then connect WebSocket for real-time updates
    await fetchSelectedUsers();
    connectDocrefWebSocket();
    // Start polling every 5 seconds
    startPolling();
});

onUnmounted(() => {
    disconnectDocrefWebSocket();
    stopPolling();
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

const handleMergeComplete = async (newGroupGuid) => {
    try {
        const firstSelectedGuid = selectedGroupsForMerge.value[0]?.guidfixed;
        const firstSelectedIndex = imageGroups.value.findIndex((g) => g.guidfixed === firstSelectedGuid);

        multiSelectMode.value = false;
        selectedGroupsForMerge.value = [];

        showLoading('กำลังโหลดรายการเอกสาร...');
        await fetchImageGroups(true);

        if (firstSelectedIndex !== -1 && newGroupGuid) {
            const newGroupIndex = imageGroups.value.findIndex((g) => g.guidfixed === newGroupGuid);

            if (newGroupIndex !== -1 && newGroupIndex !== firstSelectedIndex) {
                const newGroup = imageGroups.value.splice(newGroupIndex, 1)[0];
                imageGroups.value.splice(firstSelectedIndex, 0, newGroup);

                showLoading('กำลังจัดเรียงลำดับ...');
                const orderData = imageGroups.value.map((group, index) => ({
                    guidfixed: group.guidfixed,
                    xorder: index
                }));
                await updateDocumentImageGroupsOrder(taskId.value, orderData);

                await fetchImageGroups(true);

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
        await fetchImageGroups(true);
    }
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

const handleSearch = () => {
    fetchImageGroups(true);
};

const generateRandomNumber = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

const openCloseJobDialog = () => {
    // ตรวจสอบว่าบันทึกรายวันครบหรือไม่
    if (!canCloseJob.value) {
        toast.add({
            severity: 'warn',
            summary: 'ไม่สามารถปิดงานได้',
            detail: 'ยังมีเอกสารที่ต้องบันทึกรายวันอยู่ กรุณาบันทึกให้ครบทุกรายการ',
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

// Close job - change status to 4
const confirmCloseJob = async () => {
    closingJob.value = true;

    try {
        showLoading('กำลังปิดงาน...');
        const response = await updateTaskStatus(taskId.value, { status: 4 });

        if (response.data.success) {
            hideLoading();
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'ปิดงานเรียบร้อยแล้ว',
                life: 3000
            });

            dialogJobClose.value = false;

            setTimeout(() => {
                router.push({ name: 'journal-from-image' });
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
    router.push({ name: 'journal-from-image' });
};

// Navigate to journal form with documentref
const handleCreateJournal = async () => {
    if (!selectedGroup.value?.guidfixed) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณาเลือกเอกสารก่อน',
            life: 3000
        });
        return;
    }

    const currentSelectedDocref = getCurrentUserSelectedDocref();
    const targetDocref = selectedGroup.value.guidfixed;

    // Case 1: User already selected the same docref - just navigate
    if (currentSelectedDocref === targetDocref) {
        router.push({
            name: 'journal-from-image-form',
            params: { taskId: taskId.value },
            query: { documentref: targetDocref }
        });
        return;
    }

    // Case 2: User has selected another docref - deselect first
    if (currentSelectedDocref) {
        await sendDeselectDocref(currentSelectedDocref);
    }

    // Case 3: Select new docref
    const success = await sendSelectDocref(targetDocref);
    if (!success) {
        toast.add({
            severity: 'error',
            summary: 'ข้อผิดพลาด',
            detail: 'ไม่สามารถเลือกเอกสารได้ กรุณาลองใหม่',
            life: 3000
        });
        return;
    }

    // Navigate to journal from image form page
    router.push({
        name: 'journal-from-image-form',
        params: { taskId: taskId.value },
        query: { documentref: targetDocref }
    });
};

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
</script>

<template>
    <div class="main-container" style="height: calc(100vh - 120px); display: flex; flex-direction: column; overflow: hidden">
        <Toast />

        <div class="toolbar-section flex-none mb-4">
            <Toolbar>
                <template #start>
                    <Button icon="pi pi-arrow-left" class="mr-2" text @click="goBack" />
                    <div class="font-semibold text-ml">บันทึกรายการบัญชี - {{ taskData?.name || taskId }}</div>
                    <Tag v-if="isJobClosed" value="งานเสร็จแล้ว" severity="success" class="ml-3" />
                </template>

                <template #center>
                    <div class="flex items-center gap-4">
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="searchQuery" placeholder="ค้นหาเอกสาร..." @keyup.enter="handleSearch" />
                        </IconField>
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
                        <Button v-if="!isJobClosed" label="ปิดงาน" icon="pi pi-lock" @click="openCloseJobDialog" :disabled="!canCloseJob" :title="!canCloseJob ? 'ยังมีเอกสารที่ต้องบันทึกรายวันอยู่' : 'ปิดงาน'" />
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
                                <!-- ปุ่มเรียงลำดับเอกสาร -->
                                <Button v-if="!sortMode && !isJobClosed" label="เรียงลำดับเอกสาร" icon="pi pi-sort-alt" @click="toggleSortMode" size="small" />

                                <!-- ปุ่ม Refresh -->
                                <Button v-if="!sortMode" icon="pi pi-refresh" size="small" @click="fetchImageGroups" :loading="loading" title="รีเฟรช" text />

                                <!-- Context Actions สำหรับ Sort Mode -->
                                <template v-if="sortMode">
                                    <Tag value="โหมดเรียงลำดับ" severity="info" />
                                </template>
                            </div>

                            <!-- แสดงจำนวนเอกสาร -->
                            <div class="text-sm text-surface-600 dark:text-surface-400">{{ imageGroups.length }} รายการ</div>
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
                                :show-status="false"
                                :is-job-closed="isJobClosed"
                                :selected-by-users="selectedByUsers"
                                :disable-merge="true"
                                @select-group="handleSelectGroup"
                                @toggle-group-selection="toggleGroupSelection"
                                @reorder="handleReorder"
                                @load-more="loadMore"
                            />
                        </div>
                    </div>
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="30">
                    <div class="h-full flex flex-col">
                        <!-- Image Detail Panel -->
                        <div class="flex-1 overflow-hidden">
                            <ImageDetailPanel
                                :selected-group="selectedGroup"
                                :selected-image-detail="selectedImageDetail"
                                :loading-detail="loadingDetail"
                                :is-job-closed="isJobClosed"
                                :is-review-mode="false"
                                :updating-status="updatingStatus"
                                :is-read-only="true"
                                :show-journal-button="true"
                                :is-selected-by-other="isSelectedByOther"
                                :selected-by-username="selectedByUsername"
                                @refresh-detail="handleRefreshDetail"
                                @refresh-group="handleRefreshGroup"
                                @create-journal="handleCreateJournal"
                                @view-journal-detail="handleViewJournalDetail"
                            />
                        </div>
                    </div>
                </SplitterPanel>
            </Splitter>
        </div>

        <!-- Merge Dialog -->
        <MergeDocumentDialog v-model:visible="mergeDialogVisible" :selected-groups="selectedGroupsForMerge" :task-guid="taskId" :user-email="currentUserEmail" @merge-complete="handleMergeComplete" />

        <!-- Journal Detail Dialog -->
        <JournalDetailDialog v-model:visible="journalDetailDialog" :journal="selectedJournal" :loading="loadingJournal" />

        <!-- Close Job Dialog -->
        <DialogApprove mode="close" title="ยืนยันการปิดงาน" :randomNumber="randomNumber" :confirmDialog="dialogJobClose" @close="dialogJobClose = false" @confirmJob="confirmCloseJob" @confirmJobFalse="confirmJobFalse" />

        <!-- Loading Dialog -->
        <LoadingDialog />
    </div>
</template>
