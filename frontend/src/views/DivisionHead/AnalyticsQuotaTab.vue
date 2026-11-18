<template>
  <div class="analytics-tab">
    <!-- Сводная информационная панель по квотам управления -->
    <div class="quota-summary-grid">
      <div class="q-stat-card">
        <div class="q-icon blue"><Users :size="22" /></div>
        <div>
          <span class="q-label">Штат управления</span>
          <div class="q-val">{{ totalEmployees }} <small>сотрудников</small></div>
        </div>
      </div>

      <div class="q-stat-card">
        <div class="q-icon indigo"><ShieldAlert :size="22" /></div>
        <div>
          <span class="q-label">Безопасный порог отсутствия</span>
          <div class="q-val">до 30% <small>({{ Math.max(1, Math.floor(totalEmployees * 0.3)) }} чел. в месяц)</small></div>
        </div>
      </div>

      <div class="q-stat-card">
        <div class="q-icon emerald"><CheckCircle2 :size="22" /></div>
        <div>
          <span class="q-label">Свободные месяцы (&lt; 20%)</span>
          <div class="q-val">{{ safeMonthsCount }} <small>из 12 мес.</small></div>
        </div>
      </div>

      <div class="q-stat-card">
        <div class="q-icon red"><Flame :size="22" /></div>
        <div>
          <span class="q-label">Перегруженные месяцы (≥ 30%)</span>
          <div class="q-val" :class="{ 'text-red': overloadedMonthsCount > 0 }">
            {{ overloadedMonthsCount }} <small>мес. «горят»</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Легенда цветовых зон -->
    <div class="legend-bar">
      <div class="legend-title">
        <BarChart3 :size="18" class="text-blue" />
        <span>График нагрузки и квот по месяцам на {{ targetYear }} год</span>
      </div>
      <div class="legend-items">
        <span class="leg-item"><i class="dot-green"></i> Свободно (до 20% штата)</span>
        <span class="leg-item"><i class="dot-amber"></i> Внимание: нагрузка (20% – 29%)</span>
        <span class="leg-item"><i class="dot-red"></i> Перегруз / Лимит превышен (30% и более)</span>
      </div>
    </div>

    <!-- Сетка 12 месяцев -->
    <div class="months-grid">
      <div
        v-for="m in monthsAnalytics"
        :key="m.month"
        class="month-card"
        :class="'level-' + getLevel(m)"
      >
        <div class="month-header">
          <div class="m-title-wrap">
            <span class="m-num">{{ String(m.month).padStart(2, '0') }}</span>
            <h4 class="m-name">{{ m.month_name }}</h4>
          </div>
          <span class="level-badge" :class="'badge-' + getLevel(m)">
            {{ getLevelText(m) }}
          </span>
        </div>

        <!-- Цифры: сколько уходит и процент отсутствующих -->
        <div class="month-metrics">
          <div class="mm-left">
            <span class="mm-big">{{ m.away_count }} <small>из {{ totalEmployees }} чел.</small></span>
            <span class="mm-sub">На службе останется: <strong>{{ Math.max(0, totalEmployees - m.away_count) }} чел.</strong></span>
          </div>
          <div class="mm-percent" :class="'pct-' + getLevel(m)">
            {{ m.percent }}%
            <small>отсутствует</small>
          </div>
        </div>

        <!-- Прогресс-бар загрузки месяца -->
        <div class="month-progress-track">
          <div
            class="month-progress-fill"
            :class="'fill-' + getLevel(m)"
            :style="{ width: Math.min(100, m.percent) + '%' }"
          ></div>
        </div>

        <!-- Список сотрудников, кто уходит в этом месяце -->
        <div class="month-employees-box">
          <div class="me-title">
            <span>Кто уходит в отпуск в этом месяце:</span>
          </div>

          <div v-if="!m.employees || m.employees.length === 0" class="me-empty">
            Никто не запланировал отпуск
          </div>

          <div v-else class="me-list">
            <div
              v-for="emp in m.employees"
              :key="`${emp.request_id}-${emp.part_number}`"
              class="me-item"
              @click="$emit('open-details', emp.request_id)"
              title="Нажмите, чтобы открыть подробности заявки"
            >
              <div class="me-top">
                <strong class="me-name">{{ emp.full_name }}</strong>
                <span class="me-status" :class="'st-' + (emp.status_code || '').toLowerCase()">
                  {{ emp.current_stage === 'DIVISION_HEAD' ? 'Ждет вашего решения' : emp.status_name }}
                </span>
              </div>
              <div class="me-bottom">
                <CalendarDays :size="13" />
                <span>{{ formatDateShort(emp.start_date) }} – {{ formatDateShort(emp.end_date) }} ({{ emp.vacation_days }} дн.)</span>
                <span v-if="emp.position_title" class="me-pos">• {{ emp.position_title }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Users,
  ShieldAlert,
  CheckCircle2,
  Flame,
  BarChart3,
  CalendarDays
} from 'lucide-vue-next';

const props = defineProps<{
  monthsAnalytics: any[];
  totalEmployees: number;
  targetYear: number;
}>();

defineEmits<{
  (e: 'open-details', requestId: number): void;
}>();

const getLevel = (m: any): 'SAFE' | 'WARNING' | 'DANGER' => {
  if (m.load_level) return m.load_level;
  if (m.percent >= 30 || m.is_warning) return 'DANGER';
  if (m.percent >= 20) return 'WARNING';
  return 'SAFE';
};

const getLevelText = (m: any) => {
  const lvl = getLevel(m);
  if (lvl === 'DANGER') return 'Перегружен (≥30%)';
  if (lvl === 'WARNING') return 'Нагрузка (20-29%)';
  return 'Свободно';
};

const safeMonthsCount = computed(() => {
  return (props.monthsAnalytics || []).filter(m => getLevel(m) === 'SAFE').length;
});

const overloadedMonthsCount = computed(() => {
  return (props.monthsAnalytics || []).filter(m => getLevel(m) === 'DANGER').length;
});

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean ? clean.split('-') : [];
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  return dateStr;
};
</script>

<style scoped>
.analytics-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.quota-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.q-stat-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.q-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.q-icon.blue { background: #eff6ff; color: #2563eb; }
.q-icon.indigo { background: #eef2ff; color: #4f46e5; }
.q-icon.emerald { background: #ecfdf5; color: #059669; }
.q-icon.red { background: #fef2f2; color: #dc2626; }

.q-label {
  display: block;
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.q-val {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
}

.q-val small {
  font-size: 0.8rem;
  font-weight: 500;
  color: #64748b;
}

.text-red { color: #dc2626 !important; }
.text-blue { color: #2563eb; }

.legend-bar {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.legend-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  color: #0f172a;
  font-size: 0.98rem;
}

.legend-items {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 0.82rem;
  color: #475569;
  font-weight: 600;
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot-green, .dot-amber, .dot-red {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.dot-green { background: #10b981; }
.dot-amber { background: #f59e0b; }
.dot-red { background: #ef4444; }

/* Сетка 12 месяцев */
.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 16px;
}

.month-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #10b981;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
}

.month-card.level-SAFE { border-top-color: #10b981; }
.month-card.level-WARNING { border-top-color: #f59e0b; background: #fffdf7; }
.month-card.level-DANGER { border-top-color: #ef4444; background: #fffafa; border-color: #fecaca; }

.month-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.m-num {
  background: #f1f5f9;
  color: #475569;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 800;
}

.m-name {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  color: #0f172a;
}

.level-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.73rem;
  font-weight: 700;
}

.badge-SAFE { background: #ecfdf5; color: #047857; }
.badge-WARNING { background: #fef3c7; color: #b45309; }
.badge-DANGER { background: #fee2e2; color: #b91c1c; }

.month-metrics {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.mm-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mm-big {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.mm-big small {
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
}

.mm-sub {
  font-size: 0.78rem;
  color: #64748b;
}

.mm-percent {
  text-align: right;
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
}

.mm-percent small {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  margin-top: 2px;
}

.pct-SAFE { color: #059669; }
.pct-WARNING { color: #d97706; }
.pct-DANGER { color: #dc2626; }

.month-progress-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.month-progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.fill-SAFE { background: #10b981; }
.fill-WARNING { background: #f59e0b; }
.fill-DANGER { background: #ef4444; }

.month-employees-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.me-title {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
}

.me-empty {
  font-size: 0.82rem;
  color: #94a3b8;
  font-style: italic;
  padding: 6px 0;
}

.me-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.me-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.me-item:hover {
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
}

.me-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.me-name {
  font-size: 0.83rem;
  color: #0f172a;
}

.me-status {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.st-sent { background: #dbeafe; color: #1e40af; }
.st-approved { background: #d1fae5; color: #065f46; }

.me-bottom {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  color: #475569;
  flex-wrap: wrap;
}

.me-pos { color: #64748b; }
</style>
