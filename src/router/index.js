import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const appTitle = import.meta.env.VITE_APP_TITLE || 'DEDE ACCOUNT';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    meta: { title: 'Dashboard' },
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/uikit/formlayout',
                    name: 'formlayout',
                    meta: { title: 'Form Layout' },
                    component: () => import('@/views/uikit/FormLayout.vue')
                },
                {
                    path: '/uikit/input',
                    name: 'input',
                    meta: { title: 'Input' },
                    component: () => import('@/views/uikit/InputDoc.vue')
                },
                {
                    path: '/uikit/button',
                    name: 'button',
                    meta: { title: 'Button' },
                    component: () => import('@/views/uikit/ButtonDoc.vue')
                },
                {
                    path: '/uikit/table',
                    name: 'table',
                    meta: { title: 'Table' },
                    component: () => import('@/views/uikit/TableDoc.vue')
                },
                {
                    path: '/uikit/list',
                    name: 'list',
                    meta: { title: 'List' },
                    component: () => import('@/views/uikit/ListDoc.vue')
                },
                {
                    path: '/uikit/tree',
                    name: 'tree',
                    meta: { title: 'Tree' },
                    component: () => import('@/views/uikit/TreeDoc.vue')
                },
                {
                    path: '/uikit/panel',
                    name: 'panel',
                    meta: { title: 'Panel' },
                    component: () => import('@/views/uikit/PanelsDoc.vue')
                },
                {
                    path: '/uikit/overlay',
                    name: 'overlay',
                    meta: { title: 'Overlay' },
                    component: () => import('@/views/uikit/OverlayDoc.vue')
                },
                {
                    path: '/uikit/media',
                    name: 'media',
                    meta: { title: 'Media' },
                    component: () => import('@/views/uikit/MediaDoc.vue')
                },
                {
                    path: '/uikit/message',
                    name: 'message',
                    meta: { title: 'Message' },
                    component: () => import('@/views/uikit/MessagesDoc.vue')
                },
                {
                    path: '/uikit/file',
                    name: 'file',
                    meta: { title: 'File' },
                    component: () => import('@/views/uikit/FileDoc.vue')
                },
                {
                    path: '/uikit/menu',
                    name: 'menu',
                    meta: { title: 'Menu' },
                    component: () => import('@/views/uikit/MenuDoc.vue')
                },
                {
                    path: '/uikit/charts',
                    name: 'charts',
                    meta: { title: 'Charts' },
                    component: () => import('@/views/uikit/ChartDoc.vue')
                },
                {
                    path: '/uikit/misc',
                    name: 'misc',
                    meta: { title: 'Misc' },
                    component: () => import('@/views/uikit/MiscDoc.vue')
                },
                {
                    path: '/uikit/timeline',
                    name: 'timeline',
                    meta: { title: 'Timeline' },
                    component: () => import('@/views/uikit/TimelineDoc.vue')
                },
                {
                    path: '/blocks/free',
                    name: 'blocks',
                    meta: {
                        title: 'Free Blocks',
                        breadcrumb: ['Prime Blocks', 'Free Blocks']
                    },
                    component: () => import('@/views/utilities/Blocks.vue')
                },
                {
                    path: '/pages/empty',
                    name: 'empty',
                    meta: { title: 'Empty Page' },
                    component: () => import('@/views/pages/Empty.vue')
                },
                {
                    path: '/pages/crud',
                    name: 'crud',
                    meta: { title: 'CRUD' },
                    component: () => import('@/views/pages/Crud.vue')
                },
                {
                    path: '/start/documentation',
                    name: 'documentation',
                    meta: { title: 'Documentation' },
                    component: () => import('@/views/pages/Documentation.vue')
                },
                {
                    path: '/image/upload',
                    name: 'image-upload',
                    meta: { title: 'อัพโหลดรูปภาพเอกสาร' },
                    component: () => import('@/views/pages/image/ImageUpload.vue')
                },
                {
                    path: '/image/upload/:id',
                    name: 'image-upload-detail',
                    meta: { title: 'รายละเอียดงานอัพโหลด' },
                    component: () => import('@/views/pages/image/ImageUploadDetail.vue')
                }
            ]
        },
        {
            path: '/login',
            name: 'login',
            meta: { title: 'เข้าสู่ระบบ' },
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/select-shop',
            name: 'selectshop',
            meta: { title: 'เลือกกิจการ', requiresAuth: true },
            component: () => import('@/views/pages/SelectShop.vue')
        },
        {
            path: '/landing',
            name: 'landing',
            meta: { title: 'Landing' },
            component: () => import('@/views/pages/Landing.vue')
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            meta: { title: 'ไม่พบหน้า' },
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            meta: { title: 'ไม่มีสิทธิ์เข้าถึง' },
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            meta: { title: 'เกิดข้อผิดพลาด' },
            component: () => import('@/views/pages/auth/Error.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'notfound-catch',
            redirect: '/pages/notfound'
        }
    ]
});

// Navigation guard สำหรับตรวจสอบ authentication
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token');
    const shopid = localStorage.getItem('shopid');
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    // ถ้าหน้าต้องการ authentication
    if (to.matched.some((record) => record.meta.requiresAuth)) {
        // ตรวจสอบว่ามี token หรือไม่
        if (!isAuthenticated || !token) {
            next({ name: 'login' });
            return;
        }

        // ถ้าไม่ใช่หน้า selectshop และยังไม่ได้เลือกร้าน ให้ไปหน้าเลือกร้านก่อน
        if (to.name !== 'selectshop' && !shopid) {
            next({ name: 'selectshop' });
            return;
        }
    }

    // ถ้า login แล้วและพยายามเข้าหน้า login ให้ redirect ไป dashboard
    if (to.name === 'login' && isAuthenticated && token) {
        if (shopid) {
            next({ name: 'dashboard' });
        } else {
            next({ name: 'selectshop' });
        }
        return;
    }

    next();
});

// Set document title หลังจาก navigation เสร็จ
router.afterEach((to) => {
    const pageTitle = to.meta.title;
    document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle;
});

export default router;
