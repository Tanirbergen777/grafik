<template>
  <div class="my-vacation-wrapper">
    <div class="embedded-employee-cabinet">
      <EmployeeCabinet :embedded="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import EmployeeCabinet from '@/views/Employee/EmployeeCabinet.vue';
</script>

<style scoped>
.my-vacation-wrapper {
  display: flex;
  flex-direction: column;
}
</style>
