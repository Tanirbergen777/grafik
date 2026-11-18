<template>
  <div class="incoming-tab">
    <div class="tab-top-bar">
      <div class="bar-left">
        <h3>Входящие заявки сотрудников департамента</h3>
        <p>Заявки, предварительно согласованные начальниками управлений и ожидающие вашего утверждения</p>
      </div>
      <div class="bar-right">
        <!-- Фильтр по управлению (если заявок несколько) -->
        <select v-if="uniqueDivisions.length > 1" v-model="selectedDivisionFilter" class="division-filter-select">
          <option value="ALL">Все управления ({{ requests.length }})</option>
          <option v-for="divName in uniqueDivisions" :key="divName" :value="divName">
            {{ divName }}
          </option>
        </select>

        <button class="btn-refresh" @click="$emit('refresh')" :disabled="loading">
          <RefreshCw :size="15" :class="{ spin: loading }" />
          <span>Обновить</span>
        </button>
      </div>
    </div>

    <!-- Уведомление об успешном действии -->
    <Transition name="fade-slide">
      <div v-if="feedbackMsg" class="action-toast" :class="feedbackType">
        <CheckCircle2 v-if="feedbackType === 'success'" :size="18" />
        <AlertCircle v-else :size="18" />
        <span>{{ feedbackMsg }}</span>
      </div>
    </Transition>

    <!-- Состояние загрузки -->
    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка входящих заявок департамента...</p>
    </div>

    <!-- Пустой список -->
    <div v-else-if="filteredRequests.length === 0" class="empty-box">
      <div class="empty-icon-circle">
        <CheckCircle2 :size="36" />
      </div>
      <h4>Все входящие заявки рассмотрены</h4>
      <p>На данный момент нет новых заявок от управлений, ожидающих утверждения начальника департамента.</p>
    </div>

    <!-- Список карточек входящих заявок -->
    <div v-else class="requests-grid">
      <div
        v-for="(req, idx) in filteredRequests"
        :key="req.id"
        class="incoming-card"
        :class="{ 'card-expanded': activeCommentId === req.id }"
      >
        <div class="card-header">
          <div class="emp-info">
            <div class="emp-avatar">
              {{ getInitials(req.last_name, req.first_name) }}
            </div>
            <div>
              <div class="emp-name-row">
                <span class="emp-fullname">
                  {{ req.last_name }} {{ req.first_name }} {{ req.middle_name || '' }}
                </span>
                <span class="req-badge-num">{{ formatReqNum(req.request_number, idx) }}</span>
              </div>
              <div class="emp-meta">
                <span class="pos-pill">
                  <Briefcase :size="12" />
                  {{ req.position_title || 'Сотрудник' }}
                </span>
                <span class="division-pill">
                  <Network :size="12" />
                  {{ req.division_name || 'Без управления' }}
                </span>
                <span class="year-pill">
                  <Calendar :size="12" />
                  График {{ req.year }} г.
                </span>
                <span class="date-pill">
                  Подана: {{ formatDateTime(req.created_at) }}
                </span>
              </div>
            </div>
          </div>

          <div class="header-right">
            <span v-if="req.is_department_checked" class="stage-checked-badge">
              <CheckCircle2 :size="14" />
              Принято в график департамента
            </span>
            <span v-else class="stage-waiting-badge">
              <Clock :size="14" />
              Ожидает проверки департамента
            </span>
          </div>
        </div>

        <!-- Отметка о согласовании начальником управления -->
        <div class="division-approved-banner">
          <CheckCircle2 :size="15" />
          <span>
            <strong>Согласовано в управлении:</strong>
            {{ req.division_head_name || 'Начальник управления' }}
            <span class="div-sub">({{ req.division_name || 'Управление' }})</span>
          </span>
        </div>

        <!-- Сводка по дням и частям -->
        <div class="summary-strip">
          <div class="strip-item">
            <span class="strip-label">Выслуга лет / Лимит:</span>
            <span class="strip-val">
              {{ req.service_years || 0 }} л. (доступно {{ req.vacation_days_available || 30 }} дн.)
            </span>
          </div>
          <div class="strip-item">
            <span class="strip-label">Запрошено всего:</span>
            <span class="strip-val highlight-blue">{{ calcTotalDays(req.periods) }} кал. дн.</span>
          </div>
          <div class="strip-item">
            <span class="strip-label">Количество частей:</span>
            <span class="strip-val">{{ (req.periods || []).length }} ч.</span>
          </div>
          <div class="strip-item">
            <span class="strip-label">Правило 14 дней:</span>
            <span v-if="has14DayPart(req.periods)" class="strip-val ok-green">
              <CheckCircle2 :size="14" /> Выполнено (макс. часть {{ maxPartDays(req.periods) }} дн.)
            </span>
            <span v-else class="strip-val warn-red">
              <AlertTriangle :size="14" /> Нарушено
            </span>
          </div>
        </div>

        <!-- Таблица периодов отпуска -->
        <div class="periods-box">
          <div
            v-for="p in req.periods"
            :key="p.part_number"
            class="period-row"
          >
            <div class="p-num">Часть {{ p.part_number }}</div>
            <div class="p-dates">
              <Calendar :size="14" class="icon-muted" />
              <strong>{{ formatDate(p.start_date) }}</strong>
              <span class="arrow">→</span>
              <strong>{{ formatDate(p.end_date) }}</strong>
            </div>
            <div class="p-days">
              <span class="days-chip">{{ p.days_count }} кал. дн.</span>
              <span v-if="p.holidays_count > 0" class="hol-chip" title="Праздничные дни РК продлевают отпуск">
                +{{ p.holidays_count }} праздн.
              </span>
            </div>
            <div class="p-sub">
              <UserCheck :size="14" class="icon-muted" />
              <span v-if="p.substitute_name">И.О.: <strong>{{ p.substitute_name }}</strong></span>
              <span v-else class="muted-text">Без замещающего</span>
            </div>
          </div>
        </div>

        <!-- Блок ввода причины (если нажали "На доработку" или "Отказать") -->
        <Transition name="fade-slide">
          <div v-if="activeCommentId === req.id" class="reason-panel" :class="'panel-' + activeActionType.toLowerCase()">
            <div class="reason-header">
              <div class="reason-title">
                <RotateCcw v-if="activeActionType === 'REVISION'" :size="16" />
                <XCircle v-else :size="16" />
                <span v-if="activeActionType === 'REVISION'">
                  Возврат заявки на доработку сотруднику (с указанием причины)
                </span>
                <span v-else>
                  Отказ в утверждении заявки департаментом (с указанием причины)
                </span>
              </div>
              <button class="btn-close-reason" @click="cancelActionPrompt">Отмена</button>
            </div>

            <textarea
              v-model="actionComment"
              rows="2"
              class="reason-textarea"
              :placeholder="
                activeActionType === 'REVISION'
                  ? 'Укажите причину возврата (например: Перенести 1-ю часть отпуска в связи с ведомственной проверкой в июле)...'
                  : 'Укажите причину отказа в утверждении заявки...'
              "
            ></textarea>

            <!-- Быстрые шаблоны причин для начальника департамента -->
            <div class="quick-reasons">
              <span class="qr-label">Быстрые причины:</span>
              <button
                type="button"
                class="qr-chip"
                @click="actionComment = 'Совпадение дат отпуска с ключевыми мероприятиями по линии департамента'"
              >
                Мероприятия департамента
              </button>
              <button
                type="button"
                class="qr-chip"
                @click="actionComment = 'Превышение допустимого числа одновременно отсутствующих сотрудников по департаменту'"
              >
                Превышение квоты отсутствующих
              </button>
              <button
                type="button"
                class="qr-chip"
                @click="actionComment = 'Необходимо скорректировать период отпуска и повторно согласовать с начальником управления'"
              >
                Скорректировать даты
              </button>
            </div>

            <div v-if="commentError" class="reason-err">{{ commentError }}</div>

            <div class="reason-footer">
              <button class="btn-cancel-sm" @click="cancelActionPrompt">Отмена</button>
              <button
                class="btn-confirm-reason"
                :class="activeActionType === 'REVISION' ? 'btn-warn' : 'btn-danger'"
                :disabled="submittingId === req.id"
                @click="submitDecision(req.id, activeActionType)"
              >
                <span v-if="submittingId === req.id">Сохранение...</span>
                <span v-else-if="activeActionType === 'REVISION'">Отправить на доработку</span>
                <span v-else>Подтвердить отказ</span>
              </button>
            </div>
          </div>
        </Transition>

        <!-- Кнопки действий -->
        <div class="card-footer">
          <button class="btn-details" @click="$emit('open-details', req.id)">
            <Eye :size="16" />
            <span>Подробно (маршрут и история)</span>
          </button>

          <div class="decision-btns">
            <button
              class="btn-approve"
              :disabled="submittingId === req.id || req.is_department_checked"
              @click="submitDecision(req.id, 'APPROVE')"
            >
              <Check :size="16" />
              <span>{{ req.is_department_checked ? 'Принято в график' : 'Принять в график' }}</span>
            </button>

            <button
              class="btn-revision"
              :class="{ active: activeCommentId === req.id && activeActionType === 'REVISION' }"
              :disabled="submittingId === req.id"
              @click="openActionPrompt(req.id, 'REVISION')"
            >
              <RotateCcw :size="16" />
              <span>На доработку</span>
            </button>

            <button
              class="btn-reject"
              :class="{ active: activeCommentId === req.id && activeActionType === 'REJECT' }"
              :disabled="submittingId === req.id"
              @click="openActionPrompt(req.id, 'REJECT')"
            >
              <X :size="16" />
              <span>Отказать</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import api from '@/services/api';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Network,
  Calendar,
  Clock,
  AlertTriangle,
  UserCheck,
  Eye,
  Check,
  RotateCcw,
  X,
  XCircle
} from 'lucide-vue-next';

export interface PeriodItem {
  id?: number;
  part_number: number;
  start_date: string;
  end_date: string;
  days_count: number;
  holidays_count: number;
  substitute_id?: number | null;
  substitute_name?: string | null;
}

export interface IncomingDepartmentRequest {
  id: number;
  request_number: string;
  year: number;
  status_code: string;
  status_name: string;
  current_stage: string;
  is_department_checked?: boolean;
  revision_comment?: string | null;
  created_at: string;
  employee_id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  division_id?: number;
  division_name?: string;
  division_head_name?: string;
  service_years?: number;
  vacation_days_available?: number;
  periods: PeriodItem[];
}

const props = defineProps<{
  requests: IncomingDepartmentRequest[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'decision-done'): void;
  (e: 'open-details', requestId: number): void;
}>();

const selectedDivisionFilter = ref<string>('ALL');

const uniqueDivisions = computed(() => {
  const set = new Set<string>();
  props.requests.forEach((r) => {
    if (r.division_name) set.add(r.division_name);
  });
  return Array.from(set);
});

const filteredRequests = computed(() => {
  if (selectedDivisionFilter.value === 'ALL') return props.requests;
  return props.requests.filter((r) => r.division_name === selectedDivisionFilter.value);
});

const activeCommentId = ref<number | null>(null);
const activeActionType = ref<'REVISION' | 'REJECT'>('REVISION');
const actionComment = ref('');
const commentError = ref('');
const submittingId = ref<number | null>(null);

const feedbackMsg = ref('');
const feedbackType = ref<'success' | 'error'>('success');

const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
  feedbackMsg.value = msg;
  feedbackType.value = type;
  setTimeout(() => {
    feedbackMsg.value = '';
  }, 4000);
};

const openActionPrompt = (reqId: number, action: 'REVISION' | 'REJECT') => {
  if (activeCommentId.value === reqId && activeActionType.value === action) {
    cancelActionPrompt();
    return;
  }
  activeCommentId.value = reqId;
  activeActionType.value = action;
  actionComment.value = '';
  commentError.value = '';
};

const cancelActionPrompt = () => {
  activeCommentId.value = null;
  actionComment.value = '';
  commentError.value = '';
};

const submitDecision = async (reqId: number, action: 'APPROVE' | 'REVISION' | 'REJECT') => {
  if ((action === 'REVISION' || action === 'REJECT') && !actionComment.value.trim()) {
    commentError.value = 'Пожалуйста, укажите причину возврата на доработку или отказа';
    return;
  }

  submittingId.value = reqId;
  commentError.value = '';

  try {
    const res = await api.patch(`/department/requests/${reqId}/action`, {
      action,
      comment: action === 'APPROVE' ? null : actionComment.value.trim()
    });
    showFeedback(res.data?.message || 'Решение успешно сохранено', 'success');
    cancelActionPrompt();
    emit('decision-done');
  } catch (err: any) {
    const errMsg = err?.response?.data?.error || 'Ошибка при обработке заявки';
    showFeedback(errMsg, 'error');
  } finally {
    submittingId.value = null;
  }
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

const maxPartDays = (periods?: PeriodItem[]) => {
  if (!periods || !periods.length) return 0;
  return Math.max(...periods.map(p => Number(p.days_count || 0)));
};

const has14DayPart = (periods?: PeriodItem[]) => {
  return maxPartDays(periods) >= 14;
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
.incoming-tab {
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

.bar-left h3 {
  margin: 0 0 4px;
  font-size: 1.15rem;
  color: #0f172a;
}

.bar-left p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.division-filter-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  outline: none;
  cursor: pointer;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-refresh:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.action-toast.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.action-toast.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.empty-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
  color: #64748b;
}

.empty-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.empty-box h4 {
  margin: 0 0 6px;
  font-size: 1.1rem;
  color: #0f172a;
}

.empty-box p {
  margin: 0;
  font-size: 0.9rem;
}

.requests-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.incoming-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.incoming-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.card-expanded {
  border-color: #94a3b8;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.emp-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.emp-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
  color: #ffffff;
  font-weight: 700;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.emp-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 5px;
}

.emp-fullname {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.req-badge-num {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.emp-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.82rem;
  color: #64748b;
}

.pos-pill,
.year-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-weight: 500;
}

.division-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f3e8ff;
  color: #6b21a8;
  border: 1px solid #e9d5ff;
  padding: 2px 9px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.78rem;
}

.stage-waiting-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: #ffedd5;
  color: #9a3412;
  border: 1px solid #fed7aa;
  font-size: 0.8rem;
  font-weight: 700;
}

.stage-checked-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: #dcfce7;
  color: #047857;
  border: 1px solid #a7f3d0;
  font-size: 0.8rem;
  font-weight: 700;
}

.division-approved-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 0.84rem;
}

.div-sub {
  color: #15803d;
  font-size: 0.8rem;
  margin-left: 4px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.strip-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.strip-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
}

.strip-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.highlight-blue {
  color: #2563eb;
}

.ok-green {
  color: #059669;
}

.warn-red {
  color: #dc2626;
}

.periods-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-row {
  display: grid;
  grid-template-columns: 95px 1.3fr 1fr 1.2fr;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.88rem;
}

@media (max-width: 780px) {
  .period-row {
    grid-template-columns: 1fr;
  }
}

.p-num {
  font-weight: 700;
  color: #334155;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
  text-align: center;
  font-size: 0.8rem;
}

.p-dates {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0f172a;
}

.arrow {
  color: #94a3b8;
}

.p-days {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.days-chip {
  background: #eff6ff;
  color: #1e40af;
  padding: 3px 9px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.8rem;
}

.hol-chip {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.p-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 0.84rem;
}

.muted-text {
  color: #94a3b8;
}

.icon-muted {
  color: #64748b;
  flex-shrink: 0;
}

/* Блок ввода причины */
.reason-panel {
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-revision {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.panel-reject {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.reason-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reason-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  color: #0f172a;
}

.btn-close-reason {
  background: transparent;
  border: none;
  font-size: 0.82rem;
  color: #64748b;
  cursor: pointer;
  text-decoration: underline;
}

.reason-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 0.88rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.reason-textarea:focus {
  border-color: #2563eb;
}

.quick-reasons {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.qr-label {
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
}

.qr-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  padding: 3px 10px;
  font-size: 0.76rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.qr-chip:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.reason-err {
  color: #dc2626;
  font-size: 0.82rem;
  font-weight: 600;
}

.reason-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel-sm {
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-reason {
  padding: 7px 16px;
  border-radius: 7px;
  border: none;
  color: #ffffff;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-warn {
  background: #d97706;
}
.btn-warn:hover {
  background: #b45309;
}

.btn-danger {
  background: #dc2626;
}
.btn-danger:hover {
  background: #b91c1c;
}

/* Футер карточки */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.btn-details {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #1e293b;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-details:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.decision-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-approve,
.btn-revision,
.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-approve {
  background: #059669;
  color: #ffffff;
  border: 1px solid #059669;
}

.btn-approve:hover:not(:disabled) {
  background: #047857;
}

.btn-revision {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fcd34d;
}

.btn-revision:hover:not(:disabled),
.btn-revision.active {
  background: #fef3c7;
  border-color: #f59e0b;
}

.btn-reject {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.btn-reject:hover:not(:disabled),
.btn-reject.active {
  background: #fee2e2;
  border-color: #ef4444;
}

.loader-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
</style>
