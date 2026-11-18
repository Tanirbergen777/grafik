<template>
  <div class="archive-tab">
    <div class="tab-top-bar">
      <div>
        <h3>Архив решений начальника департамента</h3>
        <p>История заявок, которые были вами утверждены, отправлены на доработку или отклонены</p>
      </div>

      <div class="filter-bar">
        <button
          class="filter-chip"
          :class="{ active: statusFilter === 'ALL' }"
          @click="statusFilter = 'ALL'"
        >
          Все ({{ requests.length }})
        </button>
        <button
          class="filter-chip chip-approved"
          :class="{ active: statusFilter === 'APPROVED' }"
          @click="statusFilter = 'APPROVED'"
        >
          Утвержденные ({{ countByCategory('APPROVED') }})
        </button>
        <button
          class="filter-chip chip-revision"
          :class="{ active: statusFilter === 'REVISION' }"
          @click="statusFilter = 'REVISION'"
        >
          На доработке ({{ countByCategory('REVISION') }})
        </button>
        <button
          class="filter-chip chip-rejected"
          :class="{ active: statusFilter === 'REJECTED' }"
          @click="statusFilter = 'REJECTED'"
        >
          Отказанные ({{ countByCategory('REJECTED') }})
        </button>
      </div>
    </div>

    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка архива решений департамента...</p>
    </div>

    <div v-else-if="filteredRequests.length === 0" class="empty-box">
      <Archive :size="36" class="empty-icon" />
      <h4>Записей в архиве не найдено</h4>
      <p>Обработанные вами заявки появятся в этом списке автоматически.</p>
    </div>

    <div v-else class="archive-list">
      <div v-for="(req, idx) in filteredRequests" :key="req.id" class="archive-card">
        <div class="arch-main">
          <div class="emp-block">
            <div class="emp-avatar">
              {{ getInitials(req.last_name, req.first_name) }}
            </div>
            <div>
              <div class="name-line">
                <span class="emp-name">
                  {{ req.last_name }} {{ req.first_name }} {{ req.middle_name || '' }}
                </span>
                <span class="req-code">{{ formatReqNum(req.request_number, idx) }}</span>
              </div>
              <div class="sub-line">
                <span class="pos-item">
                  <Briefcase :size="12" />
                  {{ req.position_title || 'Сотрудник' }}
                </span>
                <span class="div-badge">
                  <Network :size="12" />
                  {{ req.division_name || 'Управление' }}
                </span>
                <span>• График {{ req.year }} г.</span>
                <span v-if="req.department_approved_at">
                  • Решение принято: {{ formatDateTime(req.department_approved_at) }}
                </span>
              </div>
            </div>
          </div>

          <div class="status-col">
            <span class="decision-badge" :class="getBadgeClass(req)">
              {{ getDecisionLabel(req) }}
            </span>
            <span class="stage-sub">
              Текущий этап: <strong>{{ formatStage(req.current_stage) }}</strong>
            </span>
          </div>
        </div>

        <!-- Периоды кратко -->
        <div v-if="req.periods && req.periods.length" class="arch-periods">
          <div v-for="p in req.periods" :key="p.part_number" class="arch-period-pill">
            <span class="p-tag">Ч.{{ p.part_number }}:</span>
            <span>{{ formatDate(p.start_date) }} — {{ formatDate(p.end_date) }}</span>
            <strong>({{ p.days_count }} дн.)</strong>
          </div>
          <div class="total-days-pill">
            Итого: <strong>{{ calcTotalDays(req.periods) }} кал. дн.</strong>
          </div>
        </div>

        <!-- Комментарий (если был возврат или отказ) -->
        <div
          v-if="req.department_decision_comment || req.revision_comment"
          class="revision-note"
        >
          <MessageSquareWarning :size="15" />
          <span>
            <strong>Комментарий к решению:</strong>
            {{ req.department_decision_comment || req.revision_comment }}
          </span>
        </div>

        <div class="arch-footer">
          <span class="readonly-hint">Только просмотр (решение зафиксировано в истории)</span>
          <button class="btn-details-sm" @click="$emit('open-details', req.id)">
            <Eye :size="15" />
            <span>Подробно (маршрут и история)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Archive, Briefcase, Network, Eye, MessageSquareWarning } from 'lucide-vue-next';
import type { PeriodItem } from './IncomingDepartmentTab.vue';

export interface ArchiveDepartmentRequest {
  id: number;
  request_number: string;
  year: number;
  status_code: string;
  status_name: string;
  current_stage: string;
  revision_comment?: string | null;
  department_decision_comment?: string | null;
  department_approved_at?: string | null;
  created_at: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  division_name?: string;
  division_head_name?: string;
  periods?: PeriodItem[];
}

const props = defineProps<{
  requests: ArchiveDepartmentRequest[];
  loading: boolean;
}>();

defineEmits<{
  (e: 'open-details', requestId: number): void;
}>();

const statusFilter = ref<'ALL' | 'APPROVED' | 'REVISION' | 'REJECTED'>('ALL');

const isApprovedByDep = (r: ArchiveDepartmentRequest) => {
  return (
    r.status_code === 'APPROVED' ||
    ['HR', 'ACCOUNTANT', 'COMPLETED'].includes(r.current_stage)
  );
};

const countByCategory = (cat: 'APPROVED' | 'REVISION' | 'REJECTED') => {
  return props.requests.filter((r) => {
    if (cat === 'APPROVED') return isApprovedByDep(r);
    if (cat === 'REVISION') return r.status_code === 'REVISION';
    if (cat === 'REJECTED') return r.status_code === 'REJECTED';
    return false;
  }).length;
};

const filteredRequests = computed(() => {
  if (statusFilter.value === 'ALL') return props.requests;
  return props.requests.filter((r) => {
    if (statusFilter.value === 'APPROVED') return isApprovedByDep(r);
    if (statusFilter.value === 'REVISION') return r.status_code === 'REVISION';
    if (statusFilter.value === 'REJECTED') return r.status_code === 'REJECTED';
    return true;
  });
});

const getDecisionLabel = (req: ArchiveDepartmentRequest) => {
  if (req.status_code === 'REJECTED') return 'Отказано департаментом';
  if (req.status_code === 'REVISION') return 'Возвращено на доработку';
  if (isApprovedByDep(req)) return 'Утверждено (передано в ОК)';
  return req.status_name;
};

const getBadgeClass = (req: ArchiveDepartmentRequest) => {
  if (req.status_code === 'REJECTED') return 'badge-red';
  if (req.status_code === 'REVISION') return 'badge-amber';
  return 'badge-green';
};

const formatStage = (stage: string) => {
  const map: Record<string, string> = {
    EMPLOYEE: 'У сотрудника (на доработке)',
    DIVISION_HEAD: 'У начальника управления',
    DEPARTMENT_HEAD: 'У начальника департамента',
    HR: 'В отделе кадров (ОК)',
    ACCOUNTANT: 'В бухгалтерии',
    COMPLETED: 'Завершено (приказ подписан)'
  };
  return map[stage] || stage;
};

const getInitials = (last?: string, first?: string) => {
  const l = (last || '').trim()[0] || '';
  const f = (first || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'С';
};

const formatReqNum = (raw: string | undefined, idx: number) => {
  if (!raw) return `Заявка № ${idx + 1}`;
  if (/^Заявка\s*№/i.test(raw)) return raw;
  return `Заявка № ${idx + 1}`;
};

const calcTotalDays = (periods?: PeriodItem[]) => {
  if (!periods || !periods.length) return 0;
  return periods.reduce((acc, p) => acc + Number(p.days_count || 0), 0);
};

const formatDate = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped>
.archive-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tab-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.tab-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.15rem;
  color: #0f172a;
}

.tab-top-bar p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 6px 13px;
  border-radius: 20px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.empty-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  color: #94a3b8;
  margin-bottom: 10px;
}

.empty-box h4 {
  margin: 0 0 6px;
  color: #0f172a;
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.archive-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.arch-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.emp-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.emp-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #334155;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.emp-name {
  font-weight: 700;
  color: #0f172a;
  font-size: 1rem;
}

.req-code {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.sub-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
}

.pos-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.div-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f3e8ff;
  color: #6b21a8;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.76rem;
}

.status-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.decision-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.badge-green {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.badge-amber {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.badge-red {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.stage-sub {
  font-size: 0.78rem;
  color: #64748b;
}

.arch-periods {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.arch-period-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
}

.p-tag {
  font-weight: 700;
  color: #2563eb;
}

.total-days-pill {
  margin-left: auto;
  font-size: 0.84rem;
  color: #334155;
}

.revision-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.84rem;
}

.arch-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.readonly-hint {
  font-size: 0.78rem;
  color: #94a3b8;
  font-style: italic;
}

.btn-details-sm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-details-sm:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
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
</style>
