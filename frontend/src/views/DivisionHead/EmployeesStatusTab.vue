<template>
  <div class="employees-status-tab">
    <!-- Сводка по подаче заявок в управлении -->
    <div class="status-summary-row">
      <div class="s-card">
        <div class="s-icon blue"><Users :size="20" /></div>
        <div>
          <span class="s-lbl">Всего в управлении</span>
          <div class="s-val">{{ employees.length }} <small>чел.</small></div>
        </div>
      </div>

      <div class="s-card">
        <div class="s-icon emerald"><CheckCircle2 :size="20" /></div>
        <div>
          <span class="s-lbl">Отправили заявку ({{ targetYear }} г.)</span>
          <div class="s-val text-emerald">{{ submittedCount }} <small>чел.</small></div>
        </div>
      </div>

      <div class="s-card">
        <div class="s-icon rose"><Clock :size="20" /></div>
        <div>
          <span class="s-lbl">Еще не отправили заявку</span>
          <div class="s-val" :class="{ 'text-rose': notSubmittedCount > 0 }">
            {{ notSubmittedCount }} <small>чел.</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Панель фильтрации и поиска -->
    <div class="controls-bar">
      <div class="search-box">
        <Search :size="16" class="s-ico" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск сотрудника по ФИО или должности..."
          class="search-input"
        />
      </div>

      <div class="filter-pills">
        <button
          class="f-pill"
          :class="{ active: statusFilter === 'ALL' }"
          @click="statusFilter = 'ALL'"
        >
          Все сотрудники ({{ employees.length }})
        </button>
        <button
          class="f-pill"
          :class="{ active: statusFilter === 'SUBMITTED' }"
          @click="statusFilter = 'SUBMITTED'"
        >
          Подали заявку ({{ submittedCount }})
        </button>
        <button
          class="f-pill"
          :class="{ active: statusFilter === 'NOT_SUBMITTED' }"
          @click="statusFilter = 'NOT_SUBMITTED'"
        >
          Не подали заявку ({{ notSubmittedCount }})
        </button>
      </div>
    </div>

    <!-- Список карточек сотрудников управления -->
    <div v-if="filteredEmployees.length === 0" class="empty-state">
      Сотрудники по выбранному фильтру не найдены.
    </div>

    <div v-else class="employees-cards-grid">
      <div
        v-for="emp in filteredEmployees"
        :key="emp.id"
        class="emp-status-card"
        :class="emp.has_submitted ? 'card-submitted' : 'card-missing'"
      >
        <div class="esc-top">
          <div class="esc-user">
            <div class="esc-avatar" :class="emp.has_submitted ? 'av-green' : 'av-gray'">
              {{ getInitials(emp.last_name, emp.first_name) }}
            </div>
            <div>
              <div class="esc-badges">
                <span v-if="emp.external_1c_id" class="esc-tab">Таб. {{ emp.external_1c_id }}</span>
                <span class="esc-role">{{ emp.role_name }}</span>
              </div>
              <h4 class="esc-name">
                {{ emp.last_name }} {{ emp.first_name }} {{ emp.middle_name || '' }}
              </h4>
              <div class="esc-pos">
                <Briefcase :size="13" />
                <span>{{ emp.position_title || 'Сотрудник' }}</span>
                <span>•</span>
                <span>Стаж: {{ emp.service_years }} л. (Лимит: {{ emp.total_allowed_days || 30 }} дн.)</span>
              </div>
            </div>
          </div>

          <!-- Индикатор: подал или не подал -->
          <div class="esc-indicator">
            <span v-if="emp.has_submitted" class="sub-badge yes">
              <CheckCircle2 :size="14" />
              Заявка отправлена
            </span>
            <span v-else-if="emp.status_code === 'DRAFT'" class="sub-badge draft">
              <Clock :size="14" />
              В черновике (не отправлена)
            </span>
            <span v-else class="sub-badge no">
              <AlertCircle :size="14" />
              Заявка не подана
            </span>
          </div>
        </div>

        <!-- Если заявка подана — показываем краткие данные и кнопку Подробно -->
        <div v-if="emp.has_submitted" class="esc-request-details">
          <div class="esc-periods">
            <div v-for="p in emp.periods || []" :key="p.part_number" class="esc-p-chip">
              <CalendarDays :size="14" class="text-blue" />
              <span>
                <strong>Часть {{ p.part_number }}:</strong>
                {{ formatDate(p.start_date) }} – {{ formatDate(p.end_date) }} ({{ p.vacation_days }} дн.)
              </span>
            </div>
          </div>

          <div class="esc-bottom-row">
            <div class="esc-stage-info">
              <span>Статус: <strong>{{ emp.status_name }}</strong></span>
              <span>•</span>
              <span>Этап: <strong>{{ formatStage(emp.current_stage) }}</strong></span>
            </div>

            <button
              v-if="emp.request_id"
              class="btn-emp-details"
              @click="$emit('open-details', emp.request_id)"
            >
              <Eye :size="15" />
              <span>Подробно</span>
            </button>
          </div>
        </div>

        <!-- Если заявка еще не подана -->
        <div v-else class="esc-missing-notice">
          Сотрудник еще не направил заявку на отпуск на {{ targetYear }} год на согласование.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Briefcase,
  CalendarDays,
  Eye
} from 'lucide-vue-next';

const props = defineProps<{
  employees: any[];
  targetYear: number;
}>();

defineEmits<{
  (e: 'open-details', requestId: number): void;
}>();

const searchQuery = ref('');
const statusFilter = ref<'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED'>('ALL');

const submittedCount = computed(() => props.employees.filter(e => e.has_submitted).length);
const notSubmittedCount = computed(() => props.employees.filter(e => !e.has_submitted).length);

const filteredEmployees = computed(() => {
  return props.employees.filter(emp => {
    if (statusFilter.value === 'SUBMITTED' && !emp.has_submitted) return false;
    if (statusFilter.value === 'NOT_SUBMITTED' && emp.has_submitted) return false;

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase();
      const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.middle_name || ''}`.toLowerCase();
      const pos = (emp.position_title || '').toLowerCase();
      return fullName.includes(q) || pos.includes(q);
    }
    return true;
  });
});

const getInitials = (lastName?: string, firstName?: string) => {
  const l = (lastName || '').trim()[0] || '';
  const f = (firstName || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'С';
};

const formatStage = (stage: string) => {
  const map: Record<string, string> = {
    EMPLOYEE: 'У сотрудника',
    DIVISION_HEAD: 'У начальника управления',
    DEPARTMENT_HEAD: 'У начальника департамента',
    HR: 'В отделе кадров (HR)',
    ACCOUNTING: 'В бухгалтерии',
    ACCOUNTANT: 'В бухгалтерии',
    COMPLETED: 'Завершено'
  };
  return map[stage] || stage;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean ? clean.split('-') : [];
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return new Date(dateStr).toLocaleDateString('ru-RU');
};
</script>

<style scoped>
.employees-status-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.s-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.s-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.s-icon.blue { background: #eff6ff; color: #2563eb; }
.s-icon.emerald { background: #ecfdf5; color: #059669; }
.s-icon.rose { background: #fff1f2; color: #e11d48; }

.s-lbl {
  display: block;
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.s-val {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.s-val small {
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
}

.text-emerald { color: #059669 !important; }
.text-rose { color: #e11d48 !important; }
.text-blue { color: #2563eb; }

.controls-bar {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.s-ico {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 9px 12px 9px 36px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.88rem;
  outline: none;
}

.search-input:focus {
  border-color: #2563eb;
}

.filter-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.f-pill {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
}

.f-pill.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.empty-state {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
}

.employees-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 14px;
}

.emp-status-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #cbd5e1;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-submitted { border-left-color: #10b981; }
.card-missing { border-left-color: #f43f5e; }

.esc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.esc-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.esc-avatar {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1rem;
  flex-shrink: 0;
}

.av-green { background: linear-gradient(135deg, #10b981, #059669); }
.av-gray { background: linear-gradient(135deg, #64748b, #475569); }

.esc-badges {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.esc-tab {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
}

.esc-role {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 600;
}

.esc-name {
  margin: 0 0 3px;
  font-size: 1.02rem;
  color: #0f172a;
}

.esc-pos {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
}

.sub-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
}

.sub-badge.yes { background: #ecfdf5; color: #047857; }
.sub-badge.draft { background: #fffbeb; color: #b45309; }
.sub-badge.no { background: #fff1f2; color: #e11d48; }

.esc-request-details {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.esc-periods {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.esc-p-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #0f172a;
}

.esc-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.esc-stage-info {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.79rem;
  color: #475569;
}

.btn-emp-details {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-emp-details:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.esc-missing-notice {
  background: #fff1f2;
  border: 1px dashed #fecdd3;
  color: #be123c;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
}

@media (max-width: 768px) {
  .employees-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
