<script setup>
import LoadingDialog from '@/components/LoadingDialog.vue';
import { primaryColors, surfaces } from '@/constants/themeConstants';
import { useLayout } from '@/layout/composables/layout';
import { $t } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import { onMounted } from 'vue';

const { layoutConfig } = useLayout();

const presets = {
    Aura,
    Lara
};

function getPresetExt() {
    const color = primaryColors.find((c) => c.name === layoutConfig.primary);

    if (color.name === 'noir') {
        return {
            semantic: {
                primary: {
                    50: '{surface.50}',
                    100: '{surface.100}',
                    200: '{surface.200}',
                    300: '{surface.300}',
                    400: '{surface.400}',
                    500: '{surface.500}',
                    600: '{surface.600}',
                    700: '{surface.700}',
                    800: '{surface.800}',
                    900: '{surface.900}',
                    950: '{surface.950}'
                },
                colorScheme: {
                    light: {
                        primary: {
                            color: '{primary.950}',
                            contrastColor: '#ffffff',
                            hoverColor: '{primary.800}',
                            activeColor: '{primary.700}'
                        },
                        highlight: {
                            background: '{primary.950}',
                            focusBackground: '{primary.700}',
                            color: '#ffffff',
                            focusColor: '#ffffff'
                        }
                    },
                    dark: {
                        primary: {
                            color: '{primary.50}',
                            contrastColor: '{primary.950}',
                            hoverColor: '{primary.200}',
                            activeColor: '{primary.300}'
                        },
                        highlight: {
                            background: '{primary.50}',
                            focusBackground: '{primary.300}',
                            color: '{primary.950}',
                            focusColor: '{primary.950}'
                        }
                    }
                }
            }
        };
    } else {
        return {
            semantic: {
                primary: color.palette,
                colorScheme: {
                    light: {
                        primary: {
                            color: '{primary.500}',
                            contrastColor: '#ffffff',
                            hoverColor: '{primary.600}',
                            activeColor: '{primary.700}'
                        },
                        highlight: {
                            background: '{primary.50}',
                            focusBackground: '{primary.100}',
                            color: '{primary.700}',
                            focusColor: '{primary.800}'
                        }
                    },
                    dark: {
                        primary: {
                            color: '{primary.400}',
                            contrastColor: '{surface.900}',
                            hoverColor: '{primary.300}',
                            activeColor: '{primary.200}'
                        },
                        highlight: {
                            background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
                            focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
                            color: 'rgba(255,255,255,.87)',
                            focusColor: 'rgba(255,255,255,.87)'
                        }
                    }
                }
            }
        };
    }
}

function applyDarkMode(isDark) {
    layoutConfig.darkTheme = isDark;
    if (isDark) {
        document.documentElement.classList.add('app-dark');
    } else {
        document.documentElement.classList.remove('app-dark');
    }
}

function initializeTheme() {
    const presetValue = presets[layoutConfig.preset];
    const surfacePalette = surfaces.find((s) => s.name === layoutConfig.surface)?.palette;

    // ตรวจจับ dark mode จากการตั้งค่าระบบ
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyDarkMode(systemPrefersDark);

    // Listen การเปลี่ยนแปลงจากระบบ
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        applyDarkMode(e.matches);
    });

    $t().preset(presetValue).preset(getPresetExt()).surfacePalette(surfacePalette).use({ useDefaultOptions: true });
}

onMounted(() => {
    initializeTheme();
});
</script>

<template>
    <LoadingDialog />
    <router-view />
</template>

<style scoped></style>
