<template>
  <div class="incoming-tab">
    <!-- Верхняя панель вкладки -->
    <div class="tab-intro-card">
      <div class="intro-left">
        <h3>
          <Inbox :size="20" class="text-blue" />
          <span>Поступившие заявки на согласование</span>
        </h3>
        <p>
          Заявки сотрудников вашего управления, ожидающие вашего решения. Перед утверждением обратите внимание на индикатор загруженности месяца по квоте штата.
        </p>
      </div>
      <div class="intro-badge-box">
        <span class="cnt-label">Ожидают решения:</span>
        <span class="cnt-num">{{ requests.length }}</span>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-if="requests.length === 0" class="empty-box">
      <div class="empty-icon">
        <CheckCircle2 :size="40" />
      </div>
      <h4>Все поступившие заявки рассмотрены</h4>
      <p>На данный момент нет новых заявок от сотрудников вашего управления, ожидающих согласования.</p>
    </div>

    <!-- Список входящих заявок -->
    <div v-else class="requests-grid">
      <div v-for="(req, idx) in requests" :key="req.id" class="incoming-card">
        <!-- Шапка карточки -->
        <div class="card-top">
          <div class="emp-identity">
            <div class="emp-avatar">
              {{ getInitials(req.last_name, req.first_name) }}
            </div>
            <div>
              <div class="req-meta-row">
                <span class="req-num-badge">Заявка № {{ idx + 1 }}</span>
                <span class="req-year-tag">На {{ req.target_year }} год</span>
                <span v-if="req.external_1c_id" class="tab-tag">Таб. {{ req.external_1c_id }}</span>
                <span class="created-tag">Подана: {{ formatDateTime(req.created_at) }}</span>
              </div>
              <h4 class="emp-name">
                {{ req.last_name }} {{ req.first_name }} {{ req.middle_name || '' }}
              </h4>
              <div class="emp-sub">
                <span><Briefcase :size="14" /> {{ req.position_title || 'Сотрудник' }}</span>
                <span class="dot">•</span>
                <span>Выслуга: <strong>{{ req.service_years || 0 }} л.</strong></span>
                <span class="dot">•</span>
                <span>Лимит: <strong>{{ req.total_allowed_days || 30 }} дн.</strong></span>
              </div>
            </div>
          </div>

          <div class="top-right-status">
            <span
              v-if="req.is_division_checked || req.employee_role_code === 'DIVISION_HEAD'"
              class="stage-pill pill-checked"
            >
              ✓ Принято в график управления
            </span>
            <span v-else class="stage-pill">Ожидает вашей проверки</span>
            <span class="total-days-caption">
              Запрошено: <strong>{{ getTotalDays(req) }} из {{ req.total_allowed_days || 30 }} дн.</strong>
            </span>
          </div>
        </div>

        <!-- Периоды отпуска + автоматическая подсказка по квоте месяца -->
        <div class="periods-section">
          <div
            v-for="p in req.periods || []"
            :key="p.part_number"
            class="period-row-card"
          >
            <div class="p-part-col">
              <span class="part-pill">Часть {{ p.part_number }}</span>
            </div>

            <div class="p-dates-col">
              <CalendarDays :size="16" class="text-blue" />
              <span>
                с <strong>{{ formatDate(p.start_date) }}</strong> по <strong>{{ formatDate(p.end_date) }}</strong>
              </span>
            </div>

            <div class="p-days-col">
              <span class="d-badge">{{ p.vacation_days }} календ. дн.</span>
              <span v-if="p.holidays_count > 0" class="h-badge">+{{ p.holidays_count }} праздн.</span>
            </div>

            <div class="p-sub-col">
              <User :size="14" />
              <span>Замещающий: <strong>{{ p.substitute_name || 'Не указан' }}</strong></span>
            </div>

            <!-- Индикатор квоты месяца для начальника -->
            <div
              v-if="getMonthQuotaInfo(p.start_date)"
              class="p-quota-col"
              :class="'quota-' + getMonthQuotaInfo(p.start_date)!.level"
            >
              <AlertTriangle v-if="getMonthQuotaInfo(p.start_date)!.level !== 'SAFE'" :size="14" />
              <CheckCircle2 v-else :size="14" />
              <span>
                {{ getMonthQuotaInfo(p.start_date)!.monthName }}:
                <strong>
                  {{ getMonthQuotaInfo(p.start_date)!.awayCount }}/{{ totalEmployees }} чел.
                  ({{ getMonthQuotaInfo(p.start_date)!.percent }}%)
                </strong>
                — {{ getMonthQuotaInfo(p.start_date)!.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Форма ввода причины (открывается при нажатии «На доработку» или «Отказать») -->
        <div v-if="activeActionReqId === req.id" class="action-reason-box" :class="'reason-' + activeActionType.toLowerCase()">
          <div class="reason-header">
            <strong>
              {{
                activeActionType === 'REVISION'
                  ? 'Укажите причину возврата заявки на доработку сотруднику:'
                  : 'Укажите причину отказа по заявке:'
              }}
            </strong>
            <button class="btn-close-reason" @click="cancelActionForm">
              <X :size="16" />
            </button>
          </div>

          <!-- Быстрые шаблоны комментариев для удобства начальника -->
          <div class="quick-reasons">
            <button
              type="button"
              class="reason-chip"
              @click="actionComment = 'Выбранный месяц перегружен по квоте управления (более 30% штата). Прошу перенести отпуск на другой месяц.'"
            >
              Месяц перегружен по квоте
            </button>
            <button
              type="button"
              class="reason-chip"
              @click="actionComment = 'Пересечение дат отпуска с ключевыми сотрудниками управления. Скорректируйте даты.'"
            >
              Пересечение с коллегами
            </button>
            <button
              type="button"
              class="reason-chip"
              @click="actionComment = 'Необходимо согласовать и указать замещающего сотрудника на период отпуска.'"
            >
              Указать замещающего
            </button>
          </div>

          <textarea
            v-model="actionComment"
            rows="2"
            class="reason-textarea"
            placeholder="Например: Август перегружен, уже 35% штата в отпуске. Перенесите на сентябрь..."
          ></textarea>

          <div class="reason-footer">
            <button type="button" class="btn-cancel-sm" @click="cancelActionForm">
              Отмена
            </button>
            <button
              type="button"
              class="btn-confirm-reason"
              :class="activeActionType === 'REVISION' ? 'btn-amber' : 'btn-red'"
              :disabled="submittingId === req.id || !actionComment.trim()"
              @click="submitDecision(req.id, activeActionType, actionComment)"
            >
              <Send :size="15" />
              <span>
                {{
                  activeActionType === 'REVISION'
                    ? 'Отправить на доработку'
                    : 'Подтвердить отказ'
                }}
              </span>
            </button>
          </div>
        </div>

        <!-- Нижняя панель кнопок управления -->
        <div class="card-actions-bar">
          <button class="btn-details" @click="$emit('open-details', req.id)">
            <Eye :size="16" />
            <span>Подробно (Данные и история)</span>
          </button>

          <div class="decision-btns">
            <button
              class="btn-revision"
              :disabled="submittingId === req.id"
              @click="openActionForm(req.id, 'REVISION')"
            >
              <RotateCcw :size="16" />
              <span>На доработку</span>
            </button>

            <button
              class="btn-reject"
              :disabled="submittingId === req.id"
              @click="openActionForm(req.id, 'REJECT')"
            >
              <XCircle :size="16" />
              <span>Отказать</span>
            </button>

            <button
              class="btn-approve"
              :disabled="submittingId === req.id || req.is_division_checked || req.employee_role_code === 'DIVISION_HEAD'"
              @click="submitDecision(req.id, 'APPROVE', '')"
            >
              <CheckCircle2 :size="16" />
              <span>
                {{
                  submittingId === req.id
                    ? 'Сохранение...'
                    : req.is_division_checked || req.employee_role_code === 'DIVISION_HEAD'
                    ? 'Принято в график'
                    : 'Принять в график'
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Inbox,
  Briefcase,
  CalendarDays,
  User,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Eye,
  Send,
  X
} from 'lucide-vue-next';

const props = defineProps<{
  requests: any[];
  monthsAnalytics: any[];
  totalEmployees: number;
  submittingId: number | null;
}>();

const emit = defineEmits<{
  (e: 'open-details', requestId: number): void;
  (e: 'process-action', payload: { id: number; action: 'APPROVE' | 'REVISION' | 'REJECT'; comment: string }): void;
}>();

const activeActionReqId = ref<number | null>(null);
const activeActionType = ref<'REVISION' | 'REJECT'>('REVISION');
const actionComment = ref('');

const openActionForm = (reqId: number, type: 'REVISION' | 'REJECT') => {
  activeActionReqId.value = reqId;
  activeActionType.value = type;
  actionComment.value = '';
};

const cancelActionForm = () => {
  activeActionReqId.value = null;
  actionComment.value = '';
};

const submitDecision = (id: number, action: 'APPROVE' | 'REVISION' | 'REJECT', comment: string) => {
  if ((action === 'REVISION' || action === 'REJECT') && !comment.trim()) {
    alert('Пожалуйста, укажите причину возврата на доработку или отказа');
    return;
  }
  emit('process-action', { id, action, comment: comment.trim() });
  cancelActionForm();
};

const getMonthQuotaInfo = (dateStr: string) => {
  if (!dateStr || !props.monthsAnalytics?.length) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const monthNum = d.getMonth() + 1;
  const found = props.monthsAnalytics.find((m: any) => Number(m.month) === monthNum);
  if (!found) return null;

  let label = 'Свободно';
  if (found.load_level === 'DANGER' || found.percent >= 30) {
    label = 'Месяц перегружен!';
  } else if (found.load_level === 'WARNING' || found.percent >= 20) {
    label = 'Внимание (нагрузка)';
  }

  return {
    monthName: found.month_name,
    awayCount: found.away_count,
    percent: found.percent,
    level: found.load_level || (found.percent >= 30 ? 'DANGER' : found.percent >= 20 ? 'WARNING' : 'SAFE'),
    label
  };
};

const getTotalDays = (req: any) => {
  if (!req?.periods) return 0;
  return req.periods.reduce((s: number, p: any) => s + (Number(p.vacation_days) || 0), 0);
};

const getInitials = (lastName?: string, firstName?: string) => {
  const l = (lastName || '').trim()[0] || '';
  const f = (firstName || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'С';
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
.incoming-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tab-intro-card {
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

.intro-left h3 {
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  color: #0f172a;
}

.intro-left p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.text-blue { color: #2563eb; }

.intro-badge-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 10px 18px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.cnt-label {
  font-size: 0.84rem;
  font-weight: 600;
  color: #1e40af;
}

.cnt-num {
  font-size: 1.35rem;
  font-weight: 800;
  color: #2563eb;
}

.empty-box {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 56px 24px;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: #ecfdf5;
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.empty-box h4 {
  margin: 0 0 6px;
  font-size: 1.15rem;
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
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #2563eb;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.card-top {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.emp-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.emp-avatar {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.req-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.req-num-badge {
  background: #0f172a;
  color: #ffffff;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.req-year-tag {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.tab-tag {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.created-tag {
  font-size: 0.78rem;
  color: #64748b;
}

.emp-name {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.emp-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.84rem;
  color: #475569;
}

.emp-sub span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dot { color: #cbd5e1; }

.top-right-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.stage-pill {
  background: #dbeafe;
  color: #1e40af;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.total-days-caption {
  font-size: 0.84rem;
  color: #475569;
}

.periods-section {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.period-row-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.part-pill {
  background: #e2e8f0;
  color: #1e293b;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 800;
}

.p-dates-col {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #0f172a;
}

.p-days-col {
  display: flex;
  gap: 6px;
}

.d-badge {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.h-badge {
  background: #ecfdf5;
  color: #047857;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.p-sub-col {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.83rem;
  color: #475569;
}

.p-quota-col {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.79rem;
}

.quota-SAFE {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.quota-WARNING {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.quota-DANGER {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

/* Блок ввода причины возврата / отказа */
.action-reason-box {
  margin: 0 24px 16px;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reason-revision {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.reason-reject {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.reason-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
  color: #0f172a;
}

.btn-close-reason {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
}

.quick-reasons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reason-chip {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.reason-chip:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.reason-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-family: inherit;
  font-size: 0.88rem;
  outline: none;
  resize: vertical;
}

.reason-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel-sm {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-weight: 600;
  font-size: 0.83rem;
  cursor: pointer;
}

.btn-confirm-reason {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.83rem;
  cursor: pointer;
}

.btn-confirm-reason:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-amber { background: #d97706; }
.btn-red { background: #dc2626; }

/* Нижняя панель кнопок */
.card-actions-bar {
  background: #f8fafc;
  padding: 14px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.btn-details {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.decision-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-revision {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #b45309;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-revision:hover { background: #fef3c7; }

.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-reject:hover { background: #fee2e2; }

.btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 10px;
  border: none;
  background: #10b981;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-approve:hover { background: #059669; }
</style>
