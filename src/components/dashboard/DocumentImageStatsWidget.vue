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
const documentsData = ref(null);
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
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
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
    if (!documentsData.value) return;

    const documentStyle = getComputedStyle(document.documentElement);
    const { labels, notRecordedData, recordedData } = documentsData.value;

    chartData.value = {
        labels: labels,
        datasets: [
            {
                label: 'บิลที่ยังไม่บันทึก',
                data: notRecordedData,
                fill: false,
                backgroundColor: documentStyle.getPropertyValue('--p-primary-500'),
                borderColor: documentStyle.getPropertyValue('--p-primary-500'),
                tension: 0.4
            },
            {
                label: 'บิลที่บันทึกแล้ว',
                data: recordedData,
                fill: false,
                backgroundColor: documentStyle.getPropertyValue('--p-primary-200'),
                borderColor: documentStyle.getPropertyValue('--p-primary-200'),
                tension: 0.4
            }
        ]
    };
};

const fetchDocumentStats = async () => {
    loading.value = true;
    try {
        const response = await api.getDocumentImages({ page: 1, perPage: 9999, limit: 9999 });

        if (response.data.success) {
            const documents = response.data.data;

            // ใช้ปีที่เลือก
            const targetYear = selectedYear.value;

            // กรองเฉพาะข้อมูลในปีที่เลือก
            const filteredDocuments = documents.filter((item) => {
                const uploadDate = new Date(item.uploadedat);
                return uploadDate.getFullYear() === targetYear;
            });

            // นับจำนวนบิลตาม references
            const notRecordedDocuments = filteredDocuments.filter((item) => !item.references || item.references.length === 0);
            const recordedDocuments = filteredDocuments.filter((item) => item.references && item.references.length > 0 && item.references.some((ref) => ref.module === 'GL'));

            // จัดกลุ่มตามเดือน
            const monthlyData = {};

            // สร้างข้อมูลเริ่มต้นสำหรับทุกเดือนในปีที่เลือก
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${targetYear}-${String(month).padStart(2, '0')}`;
                monthlyData[monthKey] = { notRecorded: 0, recorded: 0 };
            }

            // ฟังก์ชันแปลง date เป็น key เดือน
            const getMonthKey = (dateString) => {
                const date = new Date(dateString);
                const year = date.getFullYear();
                const month = date.getMonth(); // 0-11
                return `${year}-${String(month + 1).padStart(2, '0')}`;
            };

            // นับข้อมูลบิลที่ยังไม่บันทึก
            notRecordedDocuments.forEach((doc) => {
                const monthKey = getMonthKey(doc.uploadedat);
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].notRecorded++;
                }
            });

            // นับข้อมูลบิลที่บันทึกแล้ว
            recordedDocuments.forEach((doc) => {
                const monthKey = getMonthKey(doc.uploadedat);
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].recorded++;
                }
            });

            // เรียงลำดับเดือนทั้งหมด (มกราคม - ธันวาคม)
            const sortedMonths = Object.keys(monthlyData).sort();

            // แปลง key เป็นชื่อเดือน (ภาษาไทย) - แสดงเฉพาะเดือน
            const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const labels = sortedMonths.map((key) => {
                const [year, month] = key.split('-');
                return thaiMonths[parseInt(month) - 1];
            });

            const notRecordedData = sortedMonths.map((key) => monthlyData[key].notRecorded);
            const recordedData = sortedMonths.map((key) => monthlyData[key].recorded);

            // เก็บข้อมูลไว้ใน ref
            documentsData.value = { labels, notRecordedData, recordedData };

            // สร้าง chart data และ options
            updateChartData();
            setChartOptions();
        }
    } catch (error) {
        console.error('Error fetching document stats:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    initYearOptions();
    fetchDocumentStats();
});

// Watch for theme changes
watch([() => layoutConfig.primary, () => layoutConfig.surface, isDarkTheme], () => {
    if (documentsData.value) {
        updateChartData();
        setChartOptions();
    }
});

// Watch for year changes
watch(selectedYear, () => {
    fetchDocumentStats();
});
</script>

<template>
    <div class="card">
        <div class="flex justify-between items-center mb-6">
            <div class="font-semibold text-xl">สถิติรูปภาพเอกสาร</div>
            <div class="flex items-center gap-2">
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="เลือกปี" class="w-32" />
            </div>
        </div>

        <div v-if="loading" class="space-y-4">
            <Skeleton height="2rem" class="mb-4"></Skeleton>
            <Skeleton height="300px"></Skeleton>
        </div>

        <div v-else-if="chartData">
            <Chart type="line" :data="chartData" :options="chartOptions" class="h-80" />

            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--p-primary-50)">
                    <div class="w-3 h-3 rounded-full" style="background-color: var(--p-primary-500)"></div>
                    <div>
                        <div class="text-sm text-muted-color">บิลที่ยังไม่บันทึก</div>
                        <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                            {{ chartData.datasets[0].data.reduce((a, b) => a + b, 0).toLocaleString() }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--p-primary-50)">
                    <div class="w-3 h-3 rounded-full" style="background-color: var(--p-primary-200)"></div>
                    <div>
                        <div class="text-sm text-muted-color">บิลที่บันทึกแล้ว</div>
                        <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                            {{ chartData.datasets[1].data.reduce((a, b) => a + b, 0).toLocaleString() }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
