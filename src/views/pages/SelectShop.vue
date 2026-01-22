<script setup>
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import api from '@/services/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const { selectShop: selectShopAuth, currentShop, displayName, username, logout } = useAuth();
const { showLoading, hideLoading } = useLoading();

// ชื่อที่จะแสดง (ใช้ displayName สำหรับ Google login, username สำหรับ login ปกติ)
const getUserDisplayName = () => {
    return displayName.value || username.value || '';
};

const shops = ref([]);
const allShops = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const showFavoritesOnly = ref(false);
const layout = ref('grid');
const layoutOptions = ref(['list', 'grid']);
const pagination = ref({
    total: 0,
    page: 1,
    perPage: 100,
    totalPage: 1
});

const fetchShops = async (page = 1) => {
    loading.value = true;
    showLoading('กำลังโหลดข้อมูลร้านค้า...');
    try {
        const response = await api.listShop({ page, perPage: 100, limit: 100 });
        if (response.data.success) {
            // ถ้ามีข้อมูลเดิมแล้วเป็นการโหลดเพิ่ม ให้ concat
            if (page > 1) {
                allShops.value = [...allShops.value, ...response.data.data];
            } else {
                allShops.value = response.data.data;
            }

            // กรองตาม search query
            filterShops();

            if (response.data.pagination) {
                pagination.value = response.data.pagination;
            }
        }
    } catch (error) {
        console.error('Error fetching shops:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลร้านค้าได้',
            life: 3000
        });
    } finally {
        loading.value = false;
        hideLoading();
    }
};

const filterShops = () => {
    let filtered = allShops.value;

    // กรองตาม favorite
    if (showFavoritesOnly.value) {
        filtered = filtered.filter((shop) => shop.isfavorite === true);
    }

    // กรองตาม search query
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim();
        filtered = filtered.filter((shop) => {
            // ค้นหาจาก field name
            const nameMatch = shop.name?.toLowerCase().includes(query);

            // ค้นหาจาก names.code = "th"
            const thName = shop.names?.find((n) => n.code === 'th');
            const thNameMatch = thName?.name?.toLowerCase().includes(query);

            return nameMatch || thNameMatch;
        });
    }

    shops.value = filtered;
};

const toggleFavorite = async (shop, event) => {
    event.stopPropagation(); // ป้องกันไม่ให้เลือกร้าน

    const newFavoriteStatus = !shop.isfavorite;

    try {
        const response = await api.favoriteShop(shop.shopid, newFavoriteStatus);

        if (response.data.success) {
            // อัพเดท state
            shop.isfavorite = newFavoriteStatus;

            // อัพเดทใน allShops ด้วย
            const shopIndex = allShops.value.findIndex((s) => s.shopid === shop.shopid);
            if (shopIndex !== -1) {
                allShops.value[shopIndex].isfavorite = newFavoriteStatus;
            }

            // กรองใหม่
            filterShops();

            toast.add({
                severity: 'success',
                summary: 'สำเร็จ',
                detail: newFavoriteStatus ? 'เพิ่มร้านค้าในรายการโปรด' : 'ลบร้านค้าออกจากรายการโปรด',
                life: 2000
            });
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอัพเดทรายการโปรดได้',
            life: 3000
        });
    }
};

onMounted(async () => {
    await fetchShops();
});

const loadMore = async () => {
    if (pagination.value.next && !loading.value) {
        await fetchShops(pagination.value.next);
    }
};

const handleSelectShop = async (shop) => {
    const shopData = {
        shopid: shop.shopid,
        name: getShopName(shop)
    };

    showLoading('กำลังเลือกร้านค้า...');

    const result = await selectShopAuth(shopData);

    hideLoading();

    if (result.success) {
        router.push({ name: 'dashboard' });
    } else {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: result.error,
            life: 3000
        });
    }
};

const isCurrentShop = (shop) => {
    return shop.shopid === currentShop.value.id;
};

const goBack = () => {
    router.back();
};

const getShopName = (shop) => {
    // ตรวจสอบ name ก่อน ถ้าไม่มีค่อยดึงจาก names.code = "th"
    if (shop.name) return shop.name;

    const thName = shop.names?.find((n) => n.code === 'th');
    if (thName && thName.name) return thName.name;

    const enName = shop.names?.find((n) => n.code === 'en');
    if (enName && enName.name) return enName.name;

    return 'Unnamed Shop';
};
</script>

<template>
    <Toast />
    <div class="min-h-screen bg-surface-50 dark:bg-surface-950">
        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <!-- Compact Header Bar -->
            <div class="mb-6 flex items-center justify-between gap-4">
                <!-- Left: Back Button -->
                <div>
                    <Button v-if="currentShop.id" @click="goBack" icon="pi pi-arrow-left" text rounded severity="secondary" v-tooltip.bottom="'กลับ'" />
                </div>

                <!-- Right: Welcome + Logout Button -->
                <div class="flex items-center gap-2 text-sm">
                    <span v-if="getUserDisplayName()" class="text-surface-600 dark:text-surface-400">ยินดีต้อนรับ:</span>
                    <span v-if="getUserDisplayName()" class="font-semibold text-surface-900 dark:text-surface-0">{{ getUserDisplayName() }}</span>
                    <Button @click="logout" icon="pi pi-sign-out" text rounded severity="secondary" v-tooltip.bottom="'ออกจากระบบ'" />
                </div>
            </div>

            <!-- Search and Filter Bar -->
            <div class="bg-surface-0 dark:bg-surface-900 rounded-xl p-4 shadow-sm border border-surface-200 dark:border-surface-700 mb-6">
                <div class="flex flex-col lg:flex-row gap-4">
                    <!-- Search Input -->
                    <div class="flex-1">
                        <IconField iconPosition="left" class="w-full">
                            <InputIcon class="pi pi-search" />
                            <InputText v-model="searchQuery" @input="filterShops" placeholder="ค้นหาชื่อกิจการ..." class="w-full" />
                        </IconField>
                    </div>

                    <!-- Filters -->
                    <div class="flex flex-wrap items-center gap-3">
                        <!-- Favorites Toggle -->
                        <div
                            class="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all"
                            :class="showFavoritesOnly ? 'bg-yellow-50 dark:bg-yellow-500/10 border-2 border-yellow-400' : 'bg-surface-100 dark:bg-surface-800 border-2 border-transparent hover:border-surface-300 dark:hover:border-surface-600'"
                            @click="
                                showFavoritesOnly = !showFavoritesOnly;
                                filterShops();
                            "
                        >
                            <i :class="['pi', showFavoritesOnly ? 'pi-star-fill text-yellow-500' : 'pi-star text-surface-400']"></i>
                            <span class="text-sm font-medium" :class="showFavoritesOnly ? 'text-yellow-700 dark:text-yellow-400' : 'text-surface-600 dark:text-surface-400'">รายการโปรด</span>
                        </div>

                        <!-- Layout Toggle -->
                        <div class="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-1">
                            <button
                                v-for="option in layoutOptions"
                                :key="option"
                                @click="layout = option"
                                class="p-2 rounded-md transition-all"
                                :class="layout === option ? 'bg-surface-0 dark:bg-surface-700 shadow-sm text-primary' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'"
                            >
                                <i :class="option === 'list' ? 'pi pi-list' : 'pi pi-th-large'" class="text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Active Filters Info -->
                <div v-if="searchQuery || showFavoritesOnly" class="flex items-center gap-2 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <i class="pi pi-filter text-primary"></i>
                    <span class="text-sm text-surface-600 dark:text-surface-400">
                        พบ <strong class="text-surface-900 dark:text-surface-0">{{ shops.length }}</strong> กิจการ จากทั้งหมด {{ allShops.length }} กิจการ
                    </span>
                    <Button
                        v-if="searchQuery || showFavoritesOnly"
                        label="ล้างตัวกรอง"
                        icon="pi pi-times"
                        text
                        size="small"
                        class="ml-auto"
                        @click="
                            searchQuery = '';
                            showFavoritesOnly = false;
                            filterShops();
                        "
                    />
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="relative">
                    <div class="w-16 h-16 border-4 border-surface-200 dark:border-surface-700 rounded-full"></div>
                    <div class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p class="mt-6 text-lg font-medium text-surface-700 dark:text-surface-300">กำลังโหลดข้อมูล...</p>
                <p class="mt-1 text-sm text-surface-500 dark:text-surface-400">กรุณารอสักครู่</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="shops.length === 0" class="flex flex-col items-center justify-center py-20 bg-surface-0 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700">
                <div class="w-24 h-24 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-6">
                    <i class="pi pi-building text-4xl text-surface-400"></i>
                </div>
                <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-2">ไม่พบกิจการ</h3>
                <p class="text-surface-500 dark:text-surface-400 text-center max-w-md">
                    <template v-if="searchQuery || showFavoritesOnly"> ไม่พบกิจการที่ตรงกับเงื่อนไขการค้นหา ลองปรับตัวกรองหรือคำค้นหาใหม่ </template>
                    <template v-else> ยังไม่มีกิจการในระบบ </template>
                </p>
                <Button
                    v-if="searchQuery || showFavoritesOnly"
                    label="ล้างตัวกรอง"
                    icon="pi pi-refresh"
                    outlined
                    class="mt-6"
                    @click="
                        searchQuery = '';
                        showFavoritesOnly = false;
                        filterShops();
                    "
                />
            </div>

            <!-- List View -->
            <div v-else-if="layout === 'list'" class="bg-surface-0 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                <div v-for="(shop, index) in shops" :key="shop.shopid" class="group" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
                    <div
                        class="flex items-center gap-4 p-4 transition-colors"
                        :class="[isCurrentShop(shop) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer']"
                        @click="!isCurrentShop(shop) && handleSelectShop(shop)"
                    >
                        <!-- Shop Icon -->
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" :class="isCurrentShop(shop) ? 'bg-primary/20' : 'bg-primary/10'">
                            <i class="pi pi-building text-xl text-primary"></i>
                        </div>

                        <!-- Shop Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 truncate">
                                    {{ getShopName(shop) }}
                                </h3>
                                <i v-if="shop.isfavorite" class="pi pi-star-fill text-yellow-500 flex-shrink-0"></i>
                                <Tag v-if="isCurrentShop(shop)" value="กำลังใช้งาน" severity="success" icon="pi pi-check-circle" class="text-xs" />
                            </div>
                            <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                                {{ isCurrentShop(shop) ? 'ร้านที่กำลังเปิดใช้งาน' : 'คลิกเพื่อเข้าใช้งาน' }}
                            </p>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2">
                            <Button
                                @click.stop="toggleFavorite(shop, $event)"
                                :icon="shop.isfavorite ? 'pi pi-star-fill' : 'pi pi-star'"
                                :class="shop.isfavorite ? 'text-yellow-500' : 'text-surface-400'"
                                text
                                rounded
                                v-tooltip.top="shop.isfavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'"
                            />
                            <Button
                                :label="isCurrentShop(shop) ? 'กำลังใช้งาน' : 'เลือก'"
                                :icon="isCurrentShop(shop) ? 'pi pi-check' : 'pi pi-arrow-right'"
                                :iconPos="isCurrentShop(shop) ? 'left' : 'right'"
                                :disabled="isCurrentShop(shop)"
                                :severity="isCurrentShop(shop) ? 'success' : 'primary'"
                                :class="isCurrentShop(shop) ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'"
                                @click.stop="handleSelectShop(shop)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Grid View -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div
                    v-for="shop in shops"
                    :key="shop.shopid"
                    class="group bg-surface-0 dark:bg-surface-900 rounded-xl border p-5 transition-all duration-300"
                    :class="[isCurrentShop(shop) ? 'border-primary bg-primary-50 dark:bg-primary-900/20 shadow-md' : 'border-surface-200 dark:border-surface-700 hover:shadow-lg hover:border-primary dark:hover:border-primary cursor-pointer']"
                    @click="!isCurrentShop(shop) && handleSelectShop(shop)"
                >
                    <!-- Card Header -->
                    <div class="flex items-start justify-between mb-4">
                        <div class="w-14 h-14 rounded-xl flex items-center justify-center" :class="isCurrentShop(shop) ? 'bg-primary/20' : 'bg-primary/10'">
                            <i class="pi pi-building text-2xl text-primary"></i>
                        </div>
                        <button @click.stop="toggleFavorite(shop, $event)" class="p-2 -mr-2 -mt-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors" :title="shop.isfavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'">
                            <i :class="['pi text-xl', shop.isfavorite ? 'pi-star-fill text-yellow-500' : 'pi-star text-surface-300 dark:text-surface-600 group-hover:text-surface-400']"></i>
                        </button>
                    </div>

                    <!-- Card Body -->
                    <div class="mb-3">
                        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-2 line-clamp-2">
                            {{ getShopName(shop) }}
                        </h3>
                        <Tag v-if="isCurrentShop(shop)" value="กำลังใช้งาน" severity="success" icon="pi pi-check-circle" class="text-xs" />
                        <p v-else class="text-sm text-surface-500 dark:text-surface-400">คลิกเพื่อเข้าใช้งาน</p>
                    </div>

                    <!-- Card Footer -->
                    <Button
                        :label="isCurrentShop(shop) ? 'กำลังใช้งาน' : 'เลือกกิจการนี้'"
                        :icon="isCurrentShop(shop) ? 'pi pi-check' : 'pi pi-arrow-right'"
                        :iconPos="isCurrentShop(shop) ? 'left' : 'right'"
                        :disabled="isCurrentShop(shop)"
                        :severity="isCurrentShop(shop) ? 'success' : 'primary'"
                        :outlined="!isCurrentShop(shop)"
                        class="w-full"
                        @click.stop="handleSelectShop(shop)"
                    />
                </div>
            </div>

            <!-- Load More Button -->
            <div v-if="!loading && pagination.next" class="flex flex-col items-center mt-8">
                <Button label="โหลดเพิ่มเติม" icon="pi pi-angle-down" @click="loadMore" outlined size="large" class="px-8" />
                <p class="text-surface-500 dark:text-surface-400 text-sm mt-3">แสดง {{ shops.length }} จาก {{ pagination.total }} กิจการ</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.grid > div:hover {
    transform: translateY(-2px);
}

.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 1s linear infinite;
}
</style>
