<script setup>
import StatsWidget from '@/components/dashboard/StatsWidget.vue';
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <StatsWidget />

        <!-- สถิติการบันทึกบัญชี และ สถิติรูปภาพเอกสาร -->
        <div class="col-span-12 xl:col-span-6">
            <!-- สถิติการบันทึกบัญชี -->
            <!-- <JournalStatsWidget /> -->
        </div>

        <div class="col-span-12 xl:col-span-6">
            <!-- สถิติรูปภาพเอกสาร -->
            <!-- <DocumentImageStatsWidget /> -->
        </div>

        <!-- <div class="col-span-12 xl:col-span-6">
            <RecentSalesWidget />
            <BestSellingWidget />
        </div>
        <div class="col-span-12 xl:col-span-6">
            <RevenueStreamWidget />
            <NotificationsWidget />
        </div> -->
    </div>
</template>
