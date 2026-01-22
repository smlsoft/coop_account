<script setup>
import { useLayout } from '@/layout/composables/layout';
import api from '@/services/api';
import Chart from 'primevue/chart';
import Select from 'primevue/select';
import Skeleton from 'primevue/skeleton';
import { onMounted, ref, watch } from 'vue';

const { layoutConfig, isDarkTheme } = useLayout();
const loading = ref(true);
const chartData = ref(null);
const chartOptions = ref(null);
const journalsData = ref(null);
const selectedYear = ref(new Date().getFullYear());

// สร้างรายการปีย้อนหลัง 5 ปี
const yearOptions = ref([]);
const initYearOptions = () => {
    const currentYear = new Date().getFullYear();
    yearOptions.value = [];
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        yearOptions.value.push({
            label: `${year + 543}`,
            value: year
        });
    }
};

const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    chartOptions.value = {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary,
                    font: {
                        weight: 500
                    }
                },
                grid: {
                    display: false,
                    drawBorder: false
                }
            },
            y: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            }
        }
    };
};

const updateChartData = () => {
    if (!journalsData.value) return;

    const documentStyle = getComputedStyle(document.documentElement);
    const { labels, manualData, aiData } = journalsData.value;

    chartData.value = {
        labels: labels,
        datasets: [
            {
                label: 'คีย์บัญชีเอง',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-500'),
                borderColor: documentStyle.getPropertyValue('--p-primary-500'),
                data: manualData
            },
            {
                label: 'AI OCR',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-200'),
                borderColor: documentStyle.getPropertyValue('--p-primary-200'),
                data: aiData
            }
        ]
    };
};

const fetchJournalStats = async () => {
    loading.value = true;
    try {
        const response = await api.getJournals({ page: 1, perPage: 9999, limit: 9999 });

        if (response.data.success) {
            const journals = response.data.data;

            // ใช้ปีที่เลือก
            const targetYear = selectedYear.value;

            // กรองเฉพาะข้อมูลในปีที่เลือก
            const filteredJournals = journals.filter((item) => {
                const docDate = new Date(item.docdate);
                return docDate.getFullYear() === targetYear;
            });

            // นับจำนวนตาม appname
            const manualJournals = filteredJournals.filter((item) => item.appname === '');
            const aiJournals = filteredJournals.filter((item) => item.appname === 'AI');

            // จัดกลุ่มตามเดือน
            const monthlyData = {};

            // สร้างข้อมูลเริ่มต้นสำหรับทุกเดือนในปีที่เลือก
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${targetYear}-${String(month).padStart(2, '0')}`;
                monthlyData[monthKey] = { manual: 0, ai: 0 };
            }

            // ฟังก์ชันแปลง date เป็น key เดือน
            const getMonthKey = (dateString) => {
                const date = new Date(dateString);
                const year = date.getFullYear();
                const month = date.getMonth(); // 0-11
                return `${year}-${String(month + 1).padStart(2, '0')}`;
            };

            // นับข้อมูล Manual
            manualJournals.forEach((journal) => {
                const monthKey = getMonthKey(journal.docdate);
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].manual++;
                }
            });

            // นับข้อมูล AI
            aiJournals.forEach((journal) => {
                const monthKey = getMonthKey(journal.docdate);
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].ai++;
                }
            });

            // เรียงลำดับเดือนทั้งหมด (มกราคม - ธันวาคม)
            const sortedMonths = Object.keys(monthlyData).sort();

            // แปลง key เป็นชื่อเดือน (ภาษาไทย) - แสดงเฉพาะเดือน
            const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const labels = sortedMonths.map((key) => {
                const [, month] = key.split('-');
                return thaiMonths[parseInt(month) - 1];
            });

            const manualData = sortedMonths.map((key) => monthlyData[key].manual);
            const aiData = sortedMonths.map((key) => monthlyData[key].ai);

            // เก็บข้อมูลไว้ใน ref
            journalsData.value = { labels, manualData, aiData };

            // สร้าง chart data และ options
            updateChartData();
            setChartOptions();
        }
    } catch (error) {
        console.error('Error fetching journal stats:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    initYearOptions();
    fetchJournalStats();
});

// Watch for theme changes
watch([() => layoutConfig.primary, () => layoutConfig.surface, isDarkTheme], () => {
    if (journalsData.value) {
        updateChartData();
        setChartOptions();
    }
});

// Watch for year changes
watch(selectedYear, () => {
    fetchJournalStats();
});
</script>

<template>
    <div class="card">
        <div class="flex justify-between items-center mb-6">
            <div class="font-semibold text-xl">สถิติการบันทึกบัญชี</div>
            <div class="flex items-center gap-2">
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="เลือกปี" class="w-32" />
            </div>
        </div>

        <div v-if="loading" class="space-y-4">
            <Skeleton height="2rem" class="mb-4"></Skeleton>
            <Skeleton height="300px"></Skeleton>
        </div>

        <div v-else-if="chartData">
            <Chart type="bar" :data="chartData" :options="chartOptions" class="h-80" />

            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="flex items-center gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10">
                    <div class="w-3 h-3 rounded-full bg-primary-500"></div>
                    <div>
                        <div class="text-sm text-surface-600 dark:text-surface-400">คีย์บัญชีเอง</div>
                        <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                            {{ chartData.datasets[0].data.reduce((a, b) => a + b, 0).toLocaleString() }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10">
                    <div class="w-3 h-3 rounded-full bg-primary-200 dark:bg-primary-300"></div>
                    <div>
                        <div class="text-sm text-surface-600 dark:text-surface-400">AI OCR</div>
                        <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                            {{ chartData.datasets[1].data.reduce((a, b) => a + b, 0).toLocaleString() }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
