<script setup>
import DialogForm from '@/components/DialogForm.vue';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref } from 'vue';

const toast = useToast();
const { showLoading, hideLoading } = useLoading();

// ข้อมูลกิจการ
const shopData = ref(null);
const originalData = ref(null);

// ข้อมูลฟอร์ม
const formData = ref({
    name: '',
    taxId: '',
    telephone: '',
    address: '',
    promptShopInfo: ''
});

// Loading states
const isLoading = ref(false);
const isSaving = ref(false);

// Dialog confirmation
const showConfirmDialog = ref(false);

// Invalid states
const isNameInvalid = ref(false);
const isTaxIdInvalid = ref(false);
const isAddressInvalid = ref(false);

/**
 * ดึงข้อมูลกิจการจาก API
 */
const fetchShopData = async () => {
    try {
        isLoading.value = true;
        showLoading('กำลังโหลดข้อมูล...');

        const shopId = localStorage.getItem('shopid');
        if (!shopId) {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่พบรหัสกิจการ',
                life: 3000
            });
            return;
        }

        const response = await api.getShop(shopId);

        if (response.success) {
            shopData.value = response.data;
            originalData.value = JSON.parse(JSON.stringify(response.data));

            // แปลงข้อมูลเพื่อแสดงในฟอร์ม
            const thName = response.data.names?.find((n) => n.code === 'th');
            const thAddress = response.data.address?.find((a) => a.code === 'th');

            formData.value = {
                name: thName?.name || '',
                taxId: response.data.settings?.taxid || '',
                telephone: response.data.telephone || '',
                address: thAddress?.name || '',
                promptShopInfo: response.data.promptshopinfo || ''
            };
        }
    } catch (error) {
        console.error('Error fetching shop data:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลได้',
            life: 3000
        });
    } finally {
        isLoading.value = false;
        hideLoading();
    }
};

/**
 * ตรวจสอบข้อมูลก่อนบันทึก
 */
const saveShopData = () => {
    // Reset invalid states
    isNameInvalid.value = false;
    isTaxIdInvalid.value = false;
    isAddressInvalid.value = false;

    // Validation
    let hasError = false;

    if (!formData.value.name || !formData.value.name.trim()) {
        isNameInvalid.value = true;
        hasError = true;
    }

    if (!formData.value.taxId || !formData.value.taxId.trim()) {
        isTaxIdInvalid.value = true;
        hasError = true;
    }

    if (hasError) {
        toast.add({
            severity: 'warn',
            summary: 'กรุณากรอกข้อมูล',
            detail: 'กรุณากรอกข้อมูลให้ครบถ้วน',
            life: 3000
        });
        return;
    }

    // แสดง dialog ยืนยัน
    showConfirmDialog.value = true;
};

/**
 * ยืนยันการบันทึกข้อมูล
 */
const confirmSave = async () => {
    showConfirmDialog.value = false;

    try {
        isSaving.value = true;
        showLoading('กำลังบันทึกข้อมูล...');

        const shopId = localStorage.getItem('shopid');
        if (!shopId) {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่พบรหัสกิจการ',
                life: 3000
            });
            return;
        }

        // สร้าง payload โดยรวมข้อมูลเดิมทั้งหมด และอัพเดตเฉพาะส่วนที่แก้ไข
        const payload = JSON.parse(JSON.stringify(shopData.value));

        // อัพเดต names
        const thNameIndex = payload.names?.findIndex((n) => n.code === 'th');
        if (thNameIndex !== undefined && thNameIndex !== -1) {
            payload.names[thNameIndex].name = formData.value.name;
        } else {
            if (!payload.names) payload.names = [];
            payload.names.push({
                code: 'th',
                name: formData.value.name,
                isauto: false,
                isdelete: false
            });
        }

        // อัพเดต address
        const thAddressIndex = payload.address?.findIndex((a) => a.code === 'th');
        if (thAddressIndex !== undefined && thAddressIndex !== -1) {
            payload.address[thAddressIndex].name = formData.value.address;
        } else {
            if (!payload.address) payload.address = [];
            payload.address.push({
                code: 'th',
                name: formData.value.address,
                isauto: false,
                isdelete: false
            });
        }

        // อัพเดต telephone
        payload.telephone = formData.value.telephone;

        // อัพเดต settings.taxid
        if (!payload.settings) payload.settings = {};
        payload.settings.taxid = formData.value.taxId;

        // อัพเดต promptshopinfo
        payload.promptshopinfo = formData.value.promptShopInfo;

        // ส่งข้อมูลไปยัง API
        const response = await api.updateShop(shopId, payload);

        if (response.success) {
            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: 'บันทึกข้อมูลเรียบร้อยแล้ว',
                life: 3000
            });

            // ดึงข้อมูลใหม่หลังจากบันทึกสำเร็จ
            await fetchShopData();
        } else if (response.success === false && response.message === 'permission denied') {
            // แสดง toast permission denied
            toast.add({
                severity: 'warn',
                summary: 'ไม่มีสิทธิ์',
                detail: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลนี้',
                life: 5000
            });
        }
    } catch (error) {
        console.error('Error saving shop data:', error);

        // ตรวจสอบ response ว่าเป็น permission denied หรือไม่
        if (error.response?.data?.message === 'permission denied') {
            toast.add({
                severity: 'warn',
                summary: 'ไม่มีสิทธิ์',
                detail: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลนี้',
                life: 5000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้',
                life: 3000
            });
        }
    } finally {
        isSaving.value = false;
        hideLoading();
    }
};

/**
 * Keyboard handler สำหรับ Ctrl + S
 */
const handleKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveShopData();
    }
};

// โหลดข้อมูลเมื่อเริ่มต้น
onMounted(() => {
    fetchShopData();
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col gap-4">
            <!-- Header -->
            <div class="flex justify-between items-center pb-4 border-b border-surface">
                <div>
                    <div class="text-2xl font-bold text-surface-900 dark:text-surface-0">ตั้งค่ากิจการ</div>
                    <p class="text-surface-600 dark:text-surface-400 mt-1">จัดการข้อมูลกิจการของคุณ</p>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <ProgressSpinner />
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="saveShopData" class="flex flex-col gap-6">
                <!-- Row 1: 2 columns on large screens -->
                <div class="flex flex-col md:flex-row gap-6">
                    <!-- ชื่อกิจการ -->
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="shopName" class="font-semibold text-surface-900 dark:text-surface-0">
                            ชื่อกิจการ
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="shopName" v-model="formData.name" placeholder="กรอกชื่อกิจการ" :invalid="isNameInvalid" />
                        <small v-if="isNameInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกชื่อกิจการ
                        </small>
                    </div>

                    <!-- เลขประจำตัวผู้เสียภาษี -->
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="taxId" class="font-semibold text-surface-900 dark:text-surface-0">
                            เลขประจำตัวผู้เสียภาษี
                            <span class="text-red-500">*</span>
                        </label>
                        <InputText id="taxId" v-model="formData.taxId" placeholder="กรอกเลขประจำตัวผู้เสียภาษี 13 หัก" maxlength="13" :invalid="isTaxIdInvalid" />
                        <small v-if="isTaxIdInvalid" class="text-red-500 dark:text-red-400 flex items-center gap-1">
                            <i class="pi pi-exclamation-circle"></i>
                            กรุณากรอกเลขประจำตัวผู้เสียภาษี
                        </small>
                    </div>
                </div>

                <!-- Row 2: 2 columns on large screens -->
                <div class="flex flex-col md:flex-row gap-6">
                    <!-- เบอร์โทรศัพท์ -->
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="telephone" class="font-semibold text-surface-900 dark:text-surface-0"> เบอร์โทรศัพท์ </label>
                        <InputText id="telephone" v-model="formData.telephone" placeholder="กรอกเบอร์โทรศัพท์" />
                    </div>

                    <!-- ที่อยู่ -->
                    <div class="flex flex-col gap-2 md:w-1/2">
                        <label for="address" class="font-semibold text-surface-900 dark:text-surface-0"> ที่อยู่ </label>
                        <InputText id="address" v-model="formData.address" placeholder="กรอกที่อยู่กิจการ" />
                    </div>
                </div>

                <!-- Row 3: Full width -->
                <!-- <div class="flex flex-col gap-2">
                    <label for="promptShopInfo" class="font-semibold text-surface-900 dark:text-surface-0"> ข้อมูลสหกรณ์เพิ่มเติม (Prompt Shop Info) </label>
                    <Textarea id="promptShopInfo" v-model="formData.promptShopInfo" rows="5" placeholder="กรอกข้อมูลเพิ่มเติมเกี่ยวกับกิจการ เช่น ประเภทธุรกิจ สินค้า/บริการ ฯลฯ" />
                    <small class="text-surface-500 dark:text-surface-400"> ข้อมูลนี้จะช่วยในการประมวลผลและวิเคราะห์ข้อมูลทางบัญชีของคุณได้ดีขึ้น </small>
                </div> -->

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 pt-4 border-t border-surface">
                    <Button type="submit" label="บันทึก (Ctrl + S)" icon="pi pi-save" :loading="isSaving" :disabled="!formData.name || !formData.taxId" />
                </div>
            </form>
        </div>
    </div>

    <!-- Confirm Save Dialog -->
    <DialogForm :confirmDialog="showConfirmDialog" :textContent="'คุณต้องการบันทึกข้อมูลกิจการหรือไม่?'" confirmLabel="บันทึก (Enter)" cancelLabel="ยกเลิก" @close="showConfirmDialog = false" @confirm="confirmSave" />
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
