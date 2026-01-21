<script setup>
import { useAuth } from '@/composables/useAuth';
import { useLayout } from '@/layout/composables/layout';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppConfigurator from './AppConfigurator.vue';

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();
const { currentShop, displayName, username, logout } = useAuth();
const router = useRouter();

const showLogoutDialog = ref(false);

// Get user display name
const getUserDisplayName = () => {
    return displayName.value || username.value || '';
};

const goToSelectShop = () => {
    router.push({ name: 'selectshop' });
};

const confirmLogout = () => {
    showLogoutDialog.value = true;
};

const handleLogout = () => {
    showLogoutDialog.value = false;
    logout();
};
</script>

<template>
    <Toast />
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <img src="/demo/images/dedeaccountlogo.svg" alt="DedeAccount Logo" class="w-12 h-12" />
                <span>{{ currentShop.name || 'DedeAccount' }}</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button v-if="currentShop.id" type="button" class="layout-topbar-action" @click="goToSelectShop" :title="'เปลี่ยนร้านค้า'">
                    <i class="pi pi-building"></i>
                    <span class="ml-2">{{ currentShop.name }}</span>
                </button>
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div class="relative">
                    <button
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
                        type="button"
                        class="layout-topbar-action layout-topbar-action-highlight"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action">
                        <i class="pi pi-calendar"></i>
                        <span>Calendar</span>
                    </button>
                    <button type="button" class="layout-topbar-action">
                        <i class="pi pi-inbox"></i>
                        <span>Messages</span>
                    </button>

                    <!-- Welcome Message -->
                    <div v-if="getUserDisplayName()" class="flex items-center gap-2 px-4 text-sm border-l border-r border-surface-200 dark:border-surface-700">
                        <span class="text-surface-500 dark:text-surface-400">ยินดีต้อนรับ:</span>
                        <span class="font-semibold text-surface-900 dark:text-surface-0">{{ getUserDisplayName() }}</span>
                    </div>

                    <button type="button" class="layout-topbar-action" @click="confirmLogout">
                        <i class="pi pi-sign-out"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Logout Confirmation Dialog -->
    <Dialog v-model:visible="showLogoutDialog" modal :draggable="false" :closable="true" class="logout-dialog" :style="{ width: '400px' }">
        <template #header>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <i class="pi pi-sign-out text-red-500 text-lg"></i>
                </div>
                <span class="text-xl font-semibold text-surface-900 dark:text-surface-0">ออกจากระบบ</span>
            </div>
        </template>

        <div class="py-2">
            <p class="text-surface-600 dark:text-surface-400">คุณต้องการออกจากระบบใช่หรือไม่?</p>
            <p class="text-sm text-surface-500 dark:text-surface-500 mt-2">คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งเพื่อใช้งาน</p>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="ยกเลิก" severity="secondary" outlined @click="showLogoutDialog = false" />
                <Button label="ออกจากระบบ" severity="danger" icon="pi pi-sign-out" @click="handleLogout" />
            </div>
        </template>
    </Dialog>
</template>
