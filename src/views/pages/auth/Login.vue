<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { useAuth } from '@/composables/useAuth';
import { useLoading } from '@/composables/useLoading';
import { signInWithGoogle } from '@/services/firebase';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const { login, loginGoogle } = useAuth();
const { showLoading, hideLoading, isLoading } = useLoading();

const username = ref('');
const password = ref('');
const checked = ref(false);

const handleGoogleSignIn = async () => {
    showLoading('กำลังเข้าสู่ระบบด้วย Google...');

    // Step 1: Sign in with Google via Firebase
    const googleResult = await signInWithGoogle();

    if (!googleResult.success) {
        hideLoading();
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: googleResult.error,
            life: 3000
        });
        return;
    }

    // Step 2: Send token to backend
    const result = await loginGoogle(googleResult.token, googleResult.displayName, googleResult.email);

    hideLoading();

    if (result.success) {
        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'เข้าสู่ระบบด้วย Google สำเร็จ',
            life: 2000
        });

        router.push({ name: 'selectshop' });
    } else {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: result.error,
            life: 3000
        });
    }
};

const handleLogin = async () => {
    if (!username.value || !password.value) {
        toast.add({
            severity: 'warn',
            summary: 'คำเตือน',
            detail: 'กรุณากรอก Username และ Password',
            life: 3000
        });
        return;
    }

    showLoading('กำลังเข้าสู่ระบบ...');

    const result = await login(username.value, password.value);

    hideLoading();

    if (result.success) {
        toast.add({
            severity: 'success',
            summary: 'สำเร็จ',
            detail: 'เข้าสู่ระบบสำเร็จ',
            life: 2000
        });

        router.push({ name: 'selectshop' });
    } else {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: result.error,
            life: 3000
        });
    }
};
</script>

<template>
    <FloatingConfigurator />
    <Toast />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <img src="/demo/images/dedeaccountlogo.svg" alt="BC Logo" class="mb-8 w-48 h-48 shrink-0 mx-auto object-contain" />
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Welcome to BC ACCOUNT!</div>
                        <span class="text-muted-color font-medium">Sign in to continue</span>
                    </div>

                    <div>
                        <Button label="Sign in with Google" icon="pi pi-google" severity="secondary" class="w-full mb-2" :disabled="isLoading" @click="handleGoogleSignIn"></Button>
                        <Divider align="center" class="my-6">
                            <span class="text-muted-color"><b>OR</b></span>
                        </Divider>
                        <label for="username" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username</label>
                        <InputText id="username" type="text" placeholder="Username" class="w-full md:w-[30rem] mb-8" v-model="username" :disabled="isLoading" @keyup.enter="handleLogin" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false" :disabled="isLoading" @keyup.enter="handleLogin"></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2" :disabled="isLoading"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                        </div>
                        <Button label="Sign In" class="w-full" @click="handleLogin" :loading="isLoading" :disabled="isLoading"></Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
