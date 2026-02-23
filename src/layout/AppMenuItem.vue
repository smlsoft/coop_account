<script setup>
import { layoutState, useLayout } from '@/layout/composables/layout';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const { isDesktop } = useLayout();
const route = useRoute();

const props = defineProps({
    item: {
        type: Object,
        default: () => ({})
    },
    root: {
        type: Boolean,
        default: true
    },
    parentPath: {
        type: String,
        default: null
    }
});

const fullPath = computed(() => (props.item.path ? (props.parentPath ? props.parentPath + props.item.path : props.item.path) : null));

const isRouteActive = computed(() => {
    const currentPath = route.path;
    const hasPath = props.item.path && fullPath.value;
    const hasTo = props.item.to;

    if (hasPath) {
        const startsWithPath = currentPath?.startsWith(fullPath.value);
        if (startsWithPath) {
            const nextChar = currentPath.charAt(fullPath.value.length);
            return nextChar === '' || nextChar === '/';
        }
        return false;
    } else if (hasTo) {
        // match exact หรือ sub-route เช่น /accounting/entry/create
        return currentPath === props.item.to || currentPath.startsWith(props.item.to + '/');
    }

    return false;
});

// ตรวจสอบว่า child ใดๆ ใน group นี้ active หรือไม่ (สำหรับ group ที่ไม่มี path เช่น Home)
const hasActiveChild = computed(() => {
    if (!props.item.items) return false;
    const currentPath = route.path;
    return props.item.items.some((child) => {
        if (child.to) {
            return currentPath === child.to || currentPath.startsWith(child.to + '/');
        }
        return false;
    });
});

// สำหรับ item ที่มี children ให้ track สถานะเปิด/ปิด (ค่าเริ่มต้นปิด ยกเว้น route ที่ active หรือ child ที่ active)
const expanded = ref(isRouteActive.value || hasActiveChild.value);

// เมื่อ route เปลี่ยน ให้ auto-expand group ที่ active
watch(isRouteActive, (val) => {
    if (val) expanded.value = true;
});

watch(hasActiveChild, (val) => {
    if (val) expanded.value = true;
});

const itemClick = (event, item) => {
    if (item.disabled) {
        event.preventDefault();
        return;
    }

    if (item.command) {
        item.command({ originalEvent: event, item: item });
    }

    if (item.items) {
        expanded.value = !expanded.value;
        layoutState.menuHoverActive = expanded.value;
    } else {
        layoutState.overlayMenuActive = false;
        layoutState.mobileMenuActive = false;
        layoutState.menuHoverActive = false;
    }
};

const onMouseEnter = () => {
    if (isDesktop() && props.root && props.item.items && layoutState.menuHoverActive) {
        expanded.value = true;
    }
};
</script>

<template>
    <li :class="{ 'layout-root-menuitem': root, 'active-menuitem': isRouteActive }">
        <div v-if="root && item.visible !== false" class="layout-menuitem-root-text flex items-center justify-between cursor-pointer select-none py-3 px-2" @click="item.items && itemClick($event, item)">
            <span class="text-base font-semibold tracking-wide">{{ item.label }}</span>
            <i v-if="item.items" :class="['pi pi-fw', expanded ? 'pi-angle-up' : 'pi-angle-down']" class="text-sm opacity-70" />
        </div>
        <a v-if="(!item.to || item.items) && item.visible !== false" :href="item.url" @click="itemClick($event, item)" :class="item.class" :target="item.target" tabindex="0" @mouseenter="onMouseEnter">
            <i :class="item.icon" class="layout-menuitem-icon" />
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items" />
        </a>
        <router-link v-if="item.to && !item.items && item.visible !== false" @click="itemClick($event, item)" :class="[item.class, { 'active-route': isRouteActive }]" tabindex="0" :to="item.to" @mouseenter="onMouseEnter">
            <i :class="item.icon" class="layout-menuitem-icon" />
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items" />
        </router-link>
        <Transition v-if="item.items && item.visible !== false" name="layout-submenu">
            <ul v-show="expanded" class="layout-submenu">
                <app-menu-item v-for="child in item.items" :key="child.label + '_' + (child.to || child.path)" :item="child" :root="false" :parentPath="fullPath" />
            </ul>
        </Transition>
    </li>
</template>
