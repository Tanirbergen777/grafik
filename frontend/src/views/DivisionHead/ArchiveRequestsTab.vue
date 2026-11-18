<template>
  <div class="archive-tab">
    <!-- Шапка архива и фильтры -->
    <div class="archive-header-card">
      <div>
        <h3><Archive :size="20" class="text-blue" /> Архив рассмотренных заявок управления</h3>
        <p>Заявки сотрудников вашего управления, по которым вы уже приняли решение (согласованные, возвращенные на доработку или отклоненные)</p>
      </div>

      <div class="archive-filters">
        <button
          class="filter-chip"
          :class="{ active: filterMode === 'ALL' }"
          @click="filterMode = 'ALL'"
        >
          Все ({{ archiveRequests.length }})
        </button>
        <button
          class="filter-chip"
          :class="{ active: filterMode === 'APPROVED_BY_DIV' }"
          @click="filterMode = 'APPROVED_BY_DIV'"
        >
          Согласовано ({{ approvedByDivCount }})
        </button>
        <button
          class="filter-chip"
          :class="{ active: filterMode === 'REVISION' }"
          @click="filterMode = 'REVISION'"
        >
          На доработке ({{ archiveRequests.filter(r => r.status_code === 'REVISION').length }})
        </button>
        <button
          class="filter-chip"
          :class="{ active: filterMode === 'REJECTED' }"
          @click="filterMode = 'REJECTED'"
        >
          Отказано ({{ archiveRequests.filter(r => r.status_code === 'REJECTED').length }})
        </button>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-if="filteredList.length === 0" class="empty-archive">
      <FolderOpen :size="38" class="text-muted" />
      <h4>В этой категории архива пока нет записей</h4>
      <p>Рассмотренные вами заявки будут отображаться здесь с полной историей согласования.</p>
    </div>

    <!-- Список карточек архива -->
    <div v-else class="archive-list">
      <div
        v-for="(req, idx) in filteredList"
        :key="req.id"
        class="archive-card"
        :class="'border-' + (req.status_code || 'sent').toLowerCase()"
      >
        <div class="arch-left">
          <div class="arch-top-row">
            <span class="req-num-badge">Заявка № {{ idx + 1 }}</span>
            <span class="req-year-badge">На {{ req.target_year }} год</span>
            <span class="status-pill" :class="'status-' + (req.status_code || 'sent').toLowerCase()">
              {{ getDivisionDecisionLabel(req) }}
            </span>
            <span class="stage-info">
              Текущий этап: <strong>{{ formatStage(req.current_stage, req.status_code) }}</strong>
            </span>
          </div>

          <div class="arch-emp-row">
            <h4 class="emp-fullname">
              {{ req.last_name }} {{ req.first_name }} {{ req.middle_name || '' }}
            </h4>
            <span class="emp-pos"><Briefcase :size="14" /> {{ req.position_title || 'Сотрудник' }}</span>
          </div>

          <!-- Периоды -->
          <div v-if="req.periods?.length" class="arch-periods-row">
            <div v-for="p in req.periods" :key="p.part_number" class="period-chip">
              <CalendarDays :size="14" class="text-blue" />
              <span>
                <strong>Часть {{ p.part_number }}:</strong>
                {{ formatDate(p.start_date) }} — {{ formatDate(p.end_date) }}
                ({{ p.vacation_days }} дн.<template v-if="p.holidays_count > 0"> + {{ p.holidays_count }} пр.</template>)
              </span>
            </div>
          </div>

          <!-- Комментарий решения начальника -->
          <div v-if="req.revision_comment || req.division_decision_comment" class="arch-comment">
            <span>Решение / комментарий:</span>
            <strong>{{ req.revision_comment || req.division_decision_comment }}</strong>
          </div>

          <div class="arch-meta">
            <span v-if="req.division_decided_at">Дата вашего решения: {{ formatDateTime(req.division_decided_at) }}</span>
            <span v-else>Обновлено: {{ formatDateTime(req.updated_at || req.created_at) }}</span>
          </div>
        </div>

        <div class="arch-right">
          <button class="btn-details" @click="$emit('open-details', req.id)">
            <Eye :size="16" />
            <span>Подробно</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Archive,
  FolderOpen,
  Briefcase,
  CalendarDays,
  Eye
} from 'lucide-vue-next';

const props = defineProps<{
  archiveRequests: any[];
}>();

defineEmits<{
  (e: 'open-details', requestId: number): void;
}>();

const filterMode = ref<'ALL' | 'APPROVED_BY_DIV' | 'REVISION' | 'REJECTED'>('ALL');

const approvedByDivCount = computed(() => {
  return props.archiveRequests.filter(r => ['SENT', 'APPROVED'].includes(r.status_code)).length;
});

const filteredList = computed(() => {
  if (filterMode.value === 'APPROVED_BY_DIV') {
    return props.archiveRequests.filter(r => ['SENT', 'APPROVED'].includes(r.status_code));
  }
  if (filterMode.value === 'REVISION') {
    return props.archiveRequests.filter(r => r.status_code === 'REVISION');
  }
  if (filterMode.value === 'REJECTED') {
    return props.archiveRequests.filter(r => r.status_code === 'REJECTED');
  }
  return props.archiveRequests;
});

const getDivisionDecisionLabel = (req: any) => {
  if (req.status_code === 'APPROVED') return 'Утвержден окончательно';
  if (req.status_code === 'SENT' && req.current_stage !== 'DIVISION_HEAD') return 'Согласовано управлением';
  if (req.status_code === 'REVISION') return 'Возвращено на доработку';
  if (req.status_code === 'REJECTED') return 'Отказано';
  return req.status_name;
};

const formatStage = (stage: string, statusCode?: string) => {
  if (statusCode === 'REJECTED') return 'Отклонена (В архиве)';
  if (statusCode === 'APPROVED') return 'Полностью утверждена (В графике)';
  const map: Record<string, string> = {
    EMPLOYEE: 'У сотрудника (на доработке)',
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

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('ru-RU', {
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
  gap: 16px;
}

.archive-header-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.archive-header-card h3 {
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  color: #0f172a;
}

.archive-header-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.text-blue { color: #2563eb; }
.text-muted { color: #94a3b8; }

.archive-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
}

.filter-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.empty-archive {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 50px 24px;
  text-align: center;
  color: #64748b;
}

.empty-archive h4 {
  margin: 10px 0 4px;
  color: #0f172a;
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.archive-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #cbd5e1;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.border-sent { border-left-color: #2563eb; }
.border-approved { border-left-color: #10b981; }
.border-revision { border-left-color: #f59e0b; }
.border-rejected { border-left-color: #ef4444; }

.arch-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.arch-top-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.req-num-badge {
  background: #0f172a;
  color: #ffffff;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.req-year-badge {
  background: #eff6ff;
  color: #1e40af;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-pill {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-sent { background: #dbeafe; color: #1d4ed8; }
.status-approved { background: #d1fae5; color: #047857; }
.status-revision { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #b91c1c; }

.stage-info {
  font-size: 0.82rem;
  color: #475569;
}

.arch-emp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.emp-fullname {
  margin: 0;
  font-size: 1.08rem;
  color: #0f172a;
}

.emp-pos {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.84rem;
  color: #64748b;
}

.arch-periods-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.period-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.83rem;
  color: #334155;
}

.arch-comment {
  background: #f8fafc;
  border-left: 3px solid #94a3b8;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.83rem;
  color: #334155;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.arch-meta {
  font-size: 0.78rem;
  color: #64748b;
}

.btn-details {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-details:hover {
  border-color: #2563eb;
  color: #2563eb;
}
</style>
