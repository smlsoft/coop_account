<script setup>
/**
 * ThaiDatePicker - DatePicker ที่แสดงปี พ.ศ. (Buddhist Era)
 *
 * - แสดงปีเป็น พ.ศ. ทั้งใน input และ calendar popup
 * - modelValue ยังคงเป็น Date object ค.ศ. ปกติ
 * - รองรับ props และ events ทั้งหมดของ PrimeVue DatePicker
 * - รองรับการพิมพ์วันที่โดยตรง (รูปแบบ dd/mm/yyyy พ.ศ.)
 */
import { ref, computed, useAttrs, onUnmounted, nextTick, watch } from 'vue';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';

const props = defineProps({
    modelValue: {
        type: [Date, String, Array, null],
        default: null
    },
    dateFormat: {
        type: String,
        default: 'dd/mm/yy'
    },
    placeholder: {
        type: String,
        default: 'วว/ดด/ปปปป'
    },
    manualInput: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['update:modelValue', 'show', 'hide', 'date-select', 'month-change', 'year-change']);
const attrs = useAttrs();

// Refs
const wrapperRef = ref(null);
const datePickerRef = ref(null);
const inputValue = ref('');
const isFocused = ref(false);
let observer = null;
let conversionTimeout = null;

// แปลงปี ค.ศ. เป็น พ.ศ.
const toBuddhistYear = (year) => year + 543;

// แปลงปี พ.ศ. เป็น ค.ศ.
const toGregorianYear = (year) => year - 543;

// แปลง ISO string หรือ Date เป็น local Date (แก้ปัญหา timezone)
const toLocalDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string') {
        // ถ้าเป็น ISO string (UTC) ให้แปลงเป็น local date
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        return d;
    }

    return null;
};

// Computed สำหรับ modelValue ที่แปลง timezone แล้ว
const localModelValue = computed(() => {
    if (!props.modelValue) return null;

    if (Array.isArray(props.modelValue)) {
        return props.modelValue.map(toLocalDate).filter(Boolean);
    }

    return toLocalDate(props.modelValue);
});

// ตรวจสอบว่าเป็นปี ค.ศ. หรือไม่ (ยังไม่ได้แปลง)
const isGregorianYear = (year) => year >= 1900 && year <= 2100;

// Format date เป็น พ.ศ. สำหรับแสดงใน input
const formatThaiDate = (date) => {
    if (!date) return '';

    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const buddhistYear = toBuddhistYear(d.getFullYear());

    // Parse format string
    let format = props.dateFormat;
    format = format.replace('dd', day);
    format = format.replace('mm', month);
    format = format.replace('yy', String(buddhistYear));

    return format;
};

// Handle date select จาก calendar
const handleDateSelect = (value) => {
    emit('update:modelValue', value);
    emit('date-select', value);
    // อัพเดท input value
    if (value) {
        inputValue.value = formatThaiDate(value);
    } else {
        inputValue.value = '';
    }
};

// Parse วันที่จาก string ที่พิมพ์เข้ามา (รองรับ พ.ศ.)
const parseThaiDate = (text) => {
    if (!text || text.trim() === '') return null;

    // รองรับรูปแบบ dd/mm/yyyy หรือ dd-mm-yyyy
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return null;

    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    // ถ้าปีเป็น 2 หลัก ให้เติมเป็น 4 หลัก (สมมติเป็น พ.ศ.)
    if (year < 100) {
        year += 2500;
    }

    // ถ้าปีมากกว่า 2400 ถือว่าเป็น พ.ศ. ให้แปลงเป็น ค.ศ.
    if (year > 2400) {
        year = toGregorianYear(year);
    }

    // ตรวจสอบความถูกต้องของวันที่
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);

    // ตรวจสอบว่าวันที่ถูกต้อง (เช่น 31/02 จะไม่ถูกต้อง)
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return null;
    }

    return date;
};

// Handle blur - parse และ validate วันที่
const handleInputBlur = () => {
    isFocused.value = false;

    if (!inputValue.value || inputValue.value.trim() === '') {
        emit('update:modelValue', null);
        return;
    }

    const parsedDate = parseThaiDate(inputValue.value);
    if (parsedDate) {
        emit('update:modelValue', parsedDate);
        emit('date-select', parsedDate);
        inputValue.value = formatThaiDate(parsedDate);
    } else {
        // ถ้า parse ไม่ได้ ให้กลับไปใช้ค่าเดิม
        if (localModelValue.value) {
            inputValue.value = formatThaiDate(localModelValue.value);
        } else {
            inputValue.value = '';
        }
    }
};

// Handle focus
const handleInputFocus = () => {
    isFocused.value = true;
};

// Handle keydown - Enter เพื่อ confirm
const handleKeydown = (event) => {
    if (event.key === 'Enter') {
        handleInputBlur();
        event.target.blur();
    }
};

// เปิด calendar popup
const openCalendar = () => {
    if (datePickerRef.value) {
        // Trigger click on datepicker to open popup
        const input = datePickerRef.value.$el?.querySelector('input');
        if (input) {
            input.click();
        }
    }
};

// Sync inputValue เมื่อ modelValue เปลี่ยน
watch(
    localModelValue,
    (newVal) => {
        if (!isFocused.value) {
            inputValue.value = newVal ? formatThaiDate(newVal) : '';
        }
    },
    { immediate: true }
);

// แปลงปีใน calendar popup เป็น พ.ศ.
const convertYearsToBuddhist = () => {
    // Clear previous timeout
    if (conversionTimeout) {
        clearTimeout(conversionTimeout);
    }

    conversionTimeout = setTimeout(() => {
        // หา datepicker panel ที่เปิดอยู่
        const panels = document.querySelectorAll('.p-datepicker-panel');

        panels.forEach((panel) => {
            // แปลงปีในปุ่มเลือกปี (header)
            const yearButtons = panel.querySelectorAll('.p-datepicker-select-year');
            yearButtons.forEach((btn) => {
                const year = parseInt(btn.textContent);
                if (isGregorianYear(year)) {
                    btn.textContent = toBuddhistYear(year);
                }
            });

            // แปลงปีใน year picker view
            const yearCells = panel.querySelectorAll('.p-datepicker-year');
            yearCells.forEach((cell) => {
                // ตรวจสอบว่าไม่ใช่ปุ่มในแต่เป็น cell
                if (cell.classList.contains('p-datepicker-select-year')) return;

                const year = parseInt(cell.textContent);
                if (isGregorianYear(year)) {
                    cell.textContent = toBuddhistYear(year);
                }
            });

            // แปลง decade range
            const decadeSpan = panel.querySelector('.p-datepicker-decade');
            if (decadeSpan) {
                const text = decadeSpan.textContent;
                const match = text.match(/(\d{4})\s*-\s*(\d{4})/);
                if (match) {
                    const startYear = parseInt(match[1]);
                    const endYear = parseInt(match[2]);
                    if (isGregorianYear(startYear) && isGregorianYear(endYear)) {
                        decadeSpan.textContent = `${toBuddhistYear(startYear)} - ${toBuddhistYear(endYear)}`;
                    }
                }
            }
        });
    }, 10);
};

// Setup MutationObserver
const setupObserver = () => {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
        let shouldConvert = false;

        for (const mutation of mutations) {
            // ตรวจสอบว่ามี datepicker panel ถูกเพิ่มหรือเปลี่ยนแปลง
            if (mutation.type === 'childList') {
                const hasDatepicker = Array.from(mutation.addedNodes).some((node) => node.nodeType === 1 && (node.classList?.contains('p-datepicker-panel') || node.querySelector?.('.p-datepicker-panel')));
                if (hasDatepicker) {
                    shouldConvert = true;
                    break;
                }
            }

            // ตรวจสอบการเปลี่ยนแปลงใน datepicker panel ที่มีอยู่
            if (mutation.target.closest?.('.p-datepicker-panel')) {
                shouldConvert = true;
                break;
            }
        }

        if (shouldConvert) {
            convertYearsToBuddhist();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false
    });
};

const destroyObserver = () => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (conversionTimeout) {
        clearTimeout(conversionTimeout);
        conversionTimeout = null;
    }
};

// Event handlers
const handleShow = () => {
    setupObserver();
    nextTick(() => {
        convertYearsToBuddhist();
    });
    emit('show');
};

const handleHide = () => {
    destroyObserver();
    emit('hide');
};

const handleMonthChange = (event) => {
    nextTick(() => {
        convertYearsToBuddhist();
    });
    emit('month-change', event);
};

const handleYearChange = (event) => {
    nextTick(() => {
        convertYearsToBuddhist();
    });
    emit('year-change', event);
};

// แปลงปีใน decade slot
const getDecadeLabel = (years) => {
    if (!years || years.length === 0) return '';
    const startYear = toBuddhistYear(years[0].value);
    const endYear = toBuddhistYear(years[years.length - 1].value);
    return `${startYear} - ${endYear}`;
};

onUnmounted(() => {
    destroyObserver();
});
</script>

<template>
    <div ref="wrapperRef" class="thai-datepicker-wrapper">
        <!-- Input สำหรับพิมพ์วันที่ -->
        <InputText
            v-if="manualInput && !attrs.inline"
            v-model="inputValue"
            :placeholder="placeholder"
            class="thai-date-input"
            :class="{ 'has-icon': attrs.showIcon !== false }"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            @keydown="handleKeydown"
            :disabled="attrs.disabled"
            :invalid="attrs.invalid"
        />

        <!-- ปุ่มเปิด calendar -->
        <button v-if="manualInput && !attrs.inline && attrs.showIcon !== false" type="button" class="thai-date-icon-btn" @click="openCalendar" :disabled="attrs.disabled" tabindex="-1">
            <i class="pi pi-calendar"></i>
        </button>

        <!-- Hidden DatePicker สำหรับ calendar popup -->
        <DatePicker
            ref="datePickerRef"
            :modelValue="localModelValue"
            @update:modelValue="handleDateSelect"
            :dateFormat="dateFormat"
            @show="handleShow"
            @hide="handleHide"
            @month-change="handleMonthChange"
            @year-change="handleYearChange"
            v-bind="attrs"
            :class="{ 'hidden-datepicker': manualInput && !attrs.inline }"
            :showIcon="false"
        >
            <!-- Override decade display -->
            <template #decade="{ years }">
                {{ getDecadeLabel(years) }}
            </template>
        </DatePicker>
    </div>
</template>

<style scoped>
.thai-datepicker-wrapper {
    position: relative;
    display: inline-flex;
    width: 100%;
}

/* Input สำหรับพิมพ์วันที่ */
.thai-date-input {
    width: 100%;
    padding-right: 2.5rem;
}

.thai-date-input.has-icon {
    padding-right: 2.75rem;
}

/* ปุ่ม calendar icon */
.thai-date-icon-btn {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--p-inputtext-color);
    opacity: 0.7;
    transition: opacity 0.2s;
}

.thai-date-icon-btn:hover:not(:disabled) {
    opacity: 1;
}

.thai-date-icon-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
}

/* ซ่อน DatePicker input เมื่อใช้ manual input */
.hidden-datepicker {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
}

.hidden-datepicker :deep(.p-datepicker-input) {
    width: 0;
    height: 0;
    padding: 0;
    border: none;
}

.thai-datepicker-wrapper :deep(.p-datepicker) {
    width: 100%;
}
</style>
