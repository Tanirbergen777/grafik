<template>
  <Transition name="modal-fade">
    <div v-if="isOpen && division" class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-window">
        <!-- Шапка модального окна -->
        <div class="modal-header">
          <div class="header-left">
            <button class="btn-back-div" @click="$emit('back-to-divisions')" title="Назад к управлениям">
              <ArrowLeft :size="18" />
            </button>
            <div>
              <div class="modal-sub">
                {{ departmentName || 'Департамент' }} • График {{ targetYear }} г.
              </div>
              <h3>{{ division.name }}</h3>
            </div>
          </div>
          <button class="modal-close-btn" @click="$emit('close')">
            <X :size="20" />
          </button>
        </div>

        <!-- Фильтр сотрудников по статусу подачи -->
        <div class="filter-strip">
          <div class="filter-chips">
            <button
              class="f-chip"
              :class="{ active: statusFilter === 'ALL' }"
              @click="statusFilter = 'ALL'"
            >
              Все сотрудники ({{ employees.length }})
            </button>
            <button
              class="f-chip chip-ok"
              :class="{ active: statusFilter === 'SUBMITTED' }"
              @click="statusFilter = 'SUBMITTED'"
            >
              <CheckCircle2 :size="14" />
              Отправили ({{ submittedCount }})
            </button>
            <button
              class="f-chip chip-wait"
              :class="{ active: statusFilter === 'PENDING' }"
              @click="statusFilter = 'PENDING'"
            >
              <XCircle :size="14" />
              Ожидается ({{ employees.length - submittedCount }})
            </button>
          </div>
        </div>

        <!-- Список сотрудников -->
        <div class="modal-body">
          <div v-if="loading" class="loading-box">
            <div class="loader-spinner"></div>
            <p>Загрузка списка сотрудников управления...</p>
          </div>

          <div v-else-if="filteredEmployees.length === 0" class="empty-box">
            <Users :size="32" />
            <p>Сотрудники по выбранному фильтру не найдены.</p>
          </div>

          <div v-else class="emp-table-wrap">
            <table class="emp-table">
              <thead>
                <tr>
                  <th style="width: 50px">№</th>
                  <th>ФИО сотрудника</th>
                  <th>Должность</th>
                  <th>Статус подачи</th>
                  <th>Этап согласования</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(emp, idx) in filteredEmployees" :key="emp.id">
                  <td class="col-num">{{ idx + 1 }}</td>
                  <td>
                    <div class="emp-cell">
                      <div class="emp-avatar" :class="emp.has_submitted ? 'av-green' : 'av-slate'">
                        {{ getInitials(emp.last_name, emp.first_name) }}
                      </div>
                      <div>
                        <div class="emp-fio">
                          {{ emp.last_name }} {{ emp.first_name }} {{ emp.middle_name || '' }}
                        </div>
                        <div v-if="emp.request_number" class="emp-req-num">
                          {{ emp.request_number }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="col-pos">{{ emp.position_title || 'Сотрудник' }}</td>
                  <td>
                    <span v-if="emp.has_submitted" class="status-badge badge-submitted">
                      <CheckCircle2 :size="15" />
                      <span>Отправил</span>
                    </span>
                    <span v-else class="status-badge badge-pending">
                      <XCircle :size="15" />
                      <span>Ожидается</span>
                    </span>
                  </td>
                  <td>
                    <span v-if="emp.has_submitted" class="stage-pill">
                      {{ formatStage(emp.current_stage, emp.status_name) }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-back" @click="$emit('back-to-divisions')">
            <ArrowLeft :size="16" />
            <span>Назад к управлениям</span>
          </button>
          <button class="btn-close" @click="$emit('close')">Закрыть</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ArrowLeft, X, CheckCircle2, XCircle, Users } from 'lucide-vue-next';
import type { MonitoringDivisionItem } from './DivisionsModal.vue';

export interface MonitoringEmployeeItem {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  has_submitted: boolean;
  request_id?: number;
  request_number?: string;
  current_stage?: string;
  status_code?: string;
  status_name?: string;
}

const props = defineProps<{
  isOpen: boolean;
  division: MonitoringDivisionItem | null;
  departmentName?: string;
  employees: MonitoringEmployeeItem[];
  loading: boolean;
  targetYear: number;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'back-to-divisions'): void;
}>();

const statusFilter = ref<'ALL' | 'SUBMITTED' | 'PENDING'>('ALL');

const submittedCount = computed(() => props.employees.filter(e => e.has_submitted).length);

const filteredEmployees = computed(() => {
  if (statusFilter.value === 'SUBMITTED') {
    return props.employees.filter(e => e.has_submitted);
  }
  if (statusFilter.value === 'PENDING') {
    return props.employees.filter(e => !e.has_submitted);
  }
  return props.employees;
});

const getInitials = (last?: string, first?: string) => {
  const l = (last || '').trim()[0] || '';
  const f = (first || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'С';
};

const formatStage = (stage?: string, statusName?: string) => {
  const map: Record<string, string> = {
    EMPLOYEE: 'Черновик / На доработке',
    DIVISION_HEAD: 'У начальника управления',
    DEPARTMENT_HEAD: 'У начальника департамента',
    HR: 'Утверждено (в Отделе кадров)',
    ACCOUNTING: 'Передано в бухгалтерию'
  };
  return (stage && map[stage]) || statusName || 'Подана';
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 110;
}

.modal-window {
  background: #ffffff;
  border-radius: 18px;
  max-width: 880px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 52px rgba(15, 23, 42, 0.3);
}

.modal-header {
  padding: 20px 24px;
  background: linear-gradient(125deg, #0f172a 0%, #1e3a8a 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-back-div {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.btn-back-div:hover {
  background: rgba(255, 255, 255, 0.24);
}

.modal-sub {
  font-size: 0.78rem;
  color: #93c5fd;
  margin-bottom: 2px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.modal-close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #ffffff;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.filter-strip {
  padding: 12px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.filter-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.f-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.f-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.emp-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.emp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.emp-table th {
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.76rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.emp-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.emp-table tr:last-child td {
  border-bottom: none;
}

.col-num {
  color: #64748b;
  font-weight: 600;
}

.emp-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.emp-avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 800;
  flex-shrink: 0;
}

.av-green {
  background: #dcfce7;
  color: #166534;
}

.av-slate {
  background: #f1f5f9;
  color: #475569;
}

.emp-fio {
  font-weight: 700;
  color: #0f172a;
}

.emp-req-num {
  font-size: 0.75rem;
  color: #2563eb;
  font-weight: 600;
}

.col-pos {
  color: #334155;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
}

.badge-submitted {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.badge-pending {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.stage-pill {
  font-size: 0.8rem;
  color: #475569;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
}

.text-muted {
  color: #94a3b8;
}

.loading-box,
.empty-box {
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
}

.loader-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-footer {
  padding: 14px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-close {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: #0f172a;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
}
</style>
