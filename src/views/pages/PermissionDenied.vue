<script setup></script>

<template>
    <div class="card min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div class="flex flex-col items-center justify-center w-full max-w-3xl mx-auto py-8">
            <img src="/demo/images/dedeaccountlogo.svg" alt="BC Account Logo" class="mb-6 w-32 h-32 opacity-50" />

            <span class="text-red-500 font-bold text-2xl mb-2">403</span>
            <h1 class="text-surface-900 dark:text-surface-0 font-bold text-2xl mb-3">Permission Denied</h1>
            <div class="text-surface-600 dark:text-surface-200 mb-6 text-center">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>

            <div class="w-full max-w-xl">
                <router-link to="/" class="w-full flex items-center py-4 border-surface-300 dark:border-surface-500 border-b hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                    <span class="flex justify-center items-center border-2 border-red-500 text-red-500 rounded-border" style="height: 2.5rem; width: 2.5rem">
                        <i class="pi pi-fw pi-home text-lg"></i>
                    </span>
                    <span class="ml-4 flex flex-col">
                        <span class="text-surface-900 dark:text-surface-0 font-medium mb-0 block">กลับไปหน้าหลัก</span>
                        <span class="text-surface-600 dark:text-surface-200 text-sm">กลับไปยังหน้าแรกของระบบ</span>
                    </span>
                </router-link>

                <router-link to="/" class="w-full flex items-center py-4 border-surface-300 dark:border-surface-500 border-b hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                    <span class="flex justify-center items-center border-2 border-red-500 text-red-500 rounded-border" style="height: 2.5rem; width: 2.5rem">
                        <i class="pi pi-fw pi-question-circle text-lg"></i>
                    </span>
                    <span class="ml-4 flex flex-col">
                        <span class="text-surface-900 dark:text-surface-0 font-medium mb-0">ติดต่อผู้ดูแลระบบ</span>
                        <span class="text-surface-600 dark:text-surface-200 text-sm">หากคุณคิดว่านี่คือข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ</span>
                    </span>
                </router-link>

                <router-link to="/" class="w-full flex items-center py-4 mb-6 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                    <span class="flex justify-center items-center border-2 border-red-500 text-red-500 rounded-border" style="height: 2.5rem; width: 2.5rem">
                        <i class="pi pi-fw pi-shield text-lg"></i>
                    </span>
                    <span class="ml-4 flex flex-col">
                        <span class="text-surface-900 dark:text-surface-0 font-medium mb-0">ตรวจสอบสิทธิ์</span>
                        <span class="text-surface-600 dark:text-surface-200 text-sm">ตรวจสอบสิทธิ์การเข้าถึงของคุณ</span>
                    </span>
                </router-link>

                <div class="flex justify-center">
                    <Button as="router-link" label="กลับไปหน้าแรก" icon="pi pi-home" to="/" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card {
    background: var(--surface-card);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
