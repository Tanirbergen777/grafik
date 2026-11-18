<template>
  <div class="division-cabinet">
    <!-- Скелетон при загрузке -->
    <div v-if="loading" class="loading-state">
      <Loader2 :size="40" class="spin-icon" />
      <p>Загрузка кабинета начальника управления...</p>
    </div>

    <div v-else-if="me" class="cabinet-content">
      <!-- 1. ШАПКА ПРОФИЛЯ НАЧАЛЬНИКА УПРАВЛЕНИЯ (В ТОМ ЖЕ ДИЗАЙНЕ, КАК НА ФОТО У СОТРУДНИКА) -->
      <section class="profile-card">
        <div class="profile-top">
          <div class="profile-identity">
            <div class="avatar-circle">
              {{ getInitials(me.last_name, me.first_name) }}
            </div>
            <div class="identity-text">
              <div class="identity-meta">
                <span class="tab-badge">Таб. № {{ me.external_1c_id || me.id }}</span>
                <span class="role-badge">✨ Кабинет начальника управления</span>
              </div>
              <h2 class="employee-fullname">
                {{ me.last_name }} {{ me.first_name }} {{ me.middle_name || '' }}
              </h2>
              <div class="employee-pos">
                <Briefcase :size="16" />
                <span>{{ me.position_title || 'Начальник управления' }}</span>
              </div>
            </div>
          </div>

          <div class="limit-widget">
            <div class="limit-main">
              <span class="limit-caption">Годовой лимит отпуска</span>
              <div class="limit-number">
                {{ me.total_allowed_days || 30 }}
                <small>календарных дней</small>
              </div>
            </div>
            <div class="limit-breakdown">
              <span class="bd-chip">База: <strong>{{ me.base_days || 30 }} дн.</strong></span>
              <span class="bd-chip green">Стаж ({{ me.service_years }} л.): <strong>+{{ me.additional_days || 0 }} дн.</strong></span>
            </div>
          </div>
        </div>

        <!-- 5 информационных карточек под шапкой (как на фото) -->
        <div class="profile-grid">
          <div class="info-tile">
            <div class="tile-icon blue"><Building2 :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Департамент</span>
              <span class="tile-value">{{ me.department_name || 'Не указан' }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon indigo"><Network :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Управление</span>
              <span class="tile-value">{{ me.division_name || 'Не указано' }}</span>
              <span class="tile-sub">Штат управления: {{ totalEmployees }} чел.</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon amber"><UserCheck :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Начальник управления</span>
              <span class="tile-value">{{ me.division_head_name || `${me.last_name} ${me.first_name}` }}</span>
              <span v-if="me.division_head_position" class="tile-sub">{{ me.division_head_position }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon purple"><ShieldCheck :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Начальник департамента</span>
              <span class="tile-value">{{ me.department_head_name || 'Не назначен' }}</span>
              <span v-if="me.department_head_position" class="tile-sub">{{ me.department_head_position }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon emerald"><Award :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Трудовой стаж (1С)</span>
              <span class="tile-value">{{ me.service_years }} {{ pluralYears(me.service_years) }}</span>
              <span class="tile-sub">Норматив по ст. 92 ТК РК</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ШЛЮЗ УПРАВЛЕНИЯ (ПРИНЦИП 100% КОМПЛЕКТНОСТИ) -->
      <section class="gateway-card" :class="{ 'gateway-ready': canSubmitDivisionPackage, 'gateway-sent': isDivisionPackageSent }">
        <div class="gateway-left">
          <div class="gw-title-row">
            <span class="gw-badge" :class="isDivisionPackageSent ? 'gw-badge-sent' : canSubmitDivisionPackage ? 'gw-badge-ok' : 'gw-badge-wait'">
              {{
                isDivisionPackageSent
                  ? '✓ Сводный график отправлен в Департамент'
                  : canSubmitDivisionPackage
                  ? '✓ 100% комплектность достигнута'
                  : 'Ожидание 100%-й готовности управлений.'
              }}
            </span>
            <span class="gw-progress-text">
              Готовность управления ({{ targetYear }} г.):
              <strong>{{ readyEmployeesCount }} из {{ totalEmployees }} чел.</strong>
            </span>
          </div>

          <div class="gw-bar-track">
            <div
              class="gw-bar-fill"
              :style="{ width: (totalEmployees > 0 ? Math.round((readyEmployeesCount / totalEmployees) * 100) : 0) + '%' }"
            ></div>
          </div>

          <p v-if="isDivisionPackageSent" class="gw-hint gw-hint-ok">
            Все {{ totalEmployees }} заявок управления (включая вашу заявку) успешно переданы Начальнику департамента.
          </p>
          <p v-else-if="canSubmitDivisionPackage" class="gw-hint gw-hint-ok">
            Все {{ totalEmployees }} из {{ totalEmployees }} сотрудников управления (включая начальника управления) заполнили и согласовали даты! Вы можете отправить сводный график в Департамент.
          </p>
          <p v-else class="gw-hint gw-hint-warn">
            Ожидается сдача / проверка: <strong>еще {{ missingEmployeesList.length }} чел.</strong>
            ({{ missingEmployeesList.map((m: any) => `${m.full_name} — ${m.reason}`).join('; ') }})
          </p>
        </div>

        <div class="gateway-right">
          <!-- Выбор получателя пакета: Начальник департамента или Заместитель начальника департамента (если начальник в командировке) -->
          <div v-if="departmentApprovers.length > 0 && !isDivisionPackageSent" class="approver-select-box">
            <label>Кому направить график управления на утверждение:</label>
            <select v-model="selectedTargetApproverId" class="approver-select">
              <option v-for="app in departmentApprovers" :key="app.id" :value="app.id">
                {{ app.role_code === 'DEPARTMENT_HEAD' ? '👤 Начальник департамента' : '🔄 Зам. начальника департамента (при отсутствии начальника)' }}
                — {{ app.full_name }}
              </option>
            </select>
          </div>

          <button
            type="button"
            class="btn-submit-gateway"
            :disabled="!canSubmitDivisionPackage || submittingPackage"
            @click="handleSubmitDivisionPackage"
          >
            <Send :size="17" />
            <span v-if="submittingPackage">Отправка пакета...</span>
            <span v-else-if="isDivisionPackageSent">График уже в Департаменте ({{ totalEmployees }}/{{ totalEmployees }})</span>
            <span v-else>
              Отправить сводный график в Департамент ({{ readyEmployeesCount }}/{{ totalEmployees }})
            </span>
          </button>
        </div>
      </section>

      <!-- 2. НАВИГАЦИЯ ПО 5 ВКЛАДКАМ КАБИНЕТА НАЧАЛЬНИКА УПРАВЛЕНИЯ -->
      <div class="cabinet-tabs-bar">
        <div class="tabs-left">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'incoming' }"
            @click="activeTab = 'incoming'"
          >
            <Inbox :size="17" />
            <span>Поступившие заявки</span>
            <span class="tab-count" :class="{ 'count-blue': incomingRequests.length > 0 }">
              {{ incomingRequests.length }}
            </span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'analytics' }"
            @click="activeTab = 'analytics'"
          >
            <BarChart3 :size="17" />
            <span>Аналитика и квоты</span>
            <span v-if="overloadedCount > 0" class="tab-count count-red" title="Количество перегруженных месяцев">
              ! {{ overloadedCount }}
            </span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'archive' }"
            @click="activeTab = 'archive'"
          >
            <Archive :size="17" />
            <span>Архив решений</span>
            <span class="tab-count">{{ archiveRequests.length }}</span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'employees' }"
            @click="activeTab = 'employees'"
          >
            <Users :size="17" />
            <span>Контроль подачи</span>
            <span class="tab-count">
              {{ submittedEmployeesCount }}/{{ divisionEmployees.length }}
            </span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'my_vacation' }"
            @click="activeTab = 'my_vacation'"
          >
            <UserCheck :size="17" />
            <span>Мой отпуск</span>
          </button>
        </div>

        <!-- Выбор целевого года -->
        <div class="year-selector">
          <span class="year-label">Плановый год:</span>
          <div class="year-buttons">
            <button
              v-for="yr in availableYears"
              :key="yr"
              class="year-chip"
              :class="{ active: targetYear === yr }"
              @click="changeYear(yr)"
            >
              {{ yr }} г.
            </button>
          </div>
        </div>
      </div>

      <!-- 3. КОНТЕНТ 4 ДОЧЕРНИХ КОМПОНЕНТОВ ВКЛАДОК -->
      <IncomingRequestsTab
        v-if="activeTab === 'incoming'"
        :requests="incomingRequests"
        :months-analytics="monthsAnalytics"
        :total-employees="totalEmployees"
        :submitting-id="submittingId"
        @open-details="openRequestDetails"
        @process-action="handleProcessAction"
      />

      <AnalyticsQuotaTab
        v-else-if="activeTab === 'analytics'"
        :months-analytics="monthsAnalytics"
        :total-employees="totalEmployees"
        :target-year="targetYear"
        @open-details="openRequestDetails"
      />

      <ArchiveRequestsTab
        v-else-if="activeTab === 'archive'"
        :archive-requests="archiveRequests"
        @open-details="openRequestDetails"
      />

      <EmployeesStatusTab
        v-else-if="activeTab === 'employees'"
        :employees="divisionEmployees"
        :target-year="targetYear"
        @open-details="openRequestDetails"
      />

      <div v-else-if="activeTab === 'my_vacation'" class="embedded-my-vacation">
        <EmployeeCabinet :embedded="true" />
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- МОДАЛЬНОЕ ОКНО «ПОДРОБНО» С 2 ВКЛАДКАМИ:                               -->
    <!-- 1) Данные о заявке и маршрут согласования                              -->
    <!-- 2) Полная история заявки                                               -->
    <!-- ===================================================================== -->
    <Transition name="modal-fade">
      <div v-if="selectedRequest" class="modal-backdrop" @click.self="closeModal">
        <div class="detail-modal">
          <!-- Шапка модального окна -->
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-badge-row">
                <span class="m-req-num">Заявка № {{ selectedRequest.id }}</span>
                <span class="status-pill-sm" :class="'status-' + (selectedRequest.status_code || 'sent').toLowerCase()">
                  {{ selectedRequest.status_name }}
                </span>
                <span class="m-year-tag">На {{ selectedRequest.target_year }} год</span>
              </div>
              <h3>
                {{ selectedRequest.last_name }} {{ selectedRequest.first_name }} {{ selectedRequest.middle_name || '' }}
                — {{ selectedRequest.position_title || 'Сотрудник' }}
              </h3>
            </div>
            <button class="modal-close-btn" @click="closeModal">
              <X :size="20" />
            </button>
          </div>

          <!-- Внутренние вкладки модального окна (2 вкладки) -->
          <div class="modal-tabs">
            <button
              class="m-tab-btn"
              :class="{ active: modalTab === 'details' }"
              @click="modalTab = 'details'"
            >
              <FileText :size="16" />
              <span>1. Данные заявки и маршрут согласования</span>
            </button>
            <button
              class="m-tab-btn"
              :class="{ active: modalTab === 'history' }"
              @click="modalTab = 'history'"
            >
              <History :size="16" />
              <span>2. История заявки ({{ selectedRequest.history?.length || 0 }})</span>
            </button>
          </div>

          <!-- Тело модального окна -->
          <div class="modal-body">
            <!-- МОДАЛЬНАЯ ВКЛАДКА 1: ДАННЫЕ О ЗАЯВКЕ И КТО ДОЛЖЕН УТВЕРДИТЬ ПО АЛГОРИТМУ -->
            <div v-if="modalTab === 'details'" class="m-tab-content">
              <div class="detail-overview-grid">
                <div class="ov-box">
                  <span class="ov-lbl">Сотрудник</span>
                  <span class="ov-val">{{ selectedRequest.last_name }} {{ selectedRequest.first_name }} {{ selectedRequest.middle_name || '' }}</span>
                  <span class="ov-sub">{{ selectedRequest.position_title }} (Стаж: {{ selectedRequest.service_years || 0 }} л.)</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Подразделение</span>
                  <span class="ov-val">{{ selectedRequest.division_name || me?.division_name }}</span>
                  <span class="ov-sub">{{ selectedRequest.department_name || me?.department_name }}</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Запрошено дней</span>
                  <span class="ov-val highlight">{{ getTotalRequestDays(selectedRequest) }} из {{ selectedRequest.total_allowed_days || 30 }} календ. дн.</span>
                  <span class="ov-sub">Плановый год: {{ selectedRequest.target_year }}</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Текущий этап</span>
                  <span class="ov-val">{{ formatStageName(selectedRequest.current_stage, selectedRequest) }}</span>
                  <span class="ov-sub">Подана: {{ formatDateTime(selectedRequest.created_at) }}</span>
                </div>
              </div>

              <!-- Причина возврата/отказа (если есть) -->
              <div v-if="selectedRequest.revision_comment" class="modal-revision-box">
                <AlertTriangle :size="18" />
                <div>
                  <strong>Комментарий / замечание руководителя:</strong>
                  <p>{{ selectedRequest.revision_comment }}</p>
                </div>
              </div>

              <!-- Таблица периодов отпуска -->
              <h4 class="section-subtitle"><CalendarDays :size="17" /> Запланированные периоды отпуска</h4>
              <div class="modal-periods-table-wrap">
                <table class="modal-periods-table">
                  <thead>
                    <tr>
                      <th>Часть</th>
                      <th>Дата начала</th>
                      <th>Дата окончания</th>
                      <th>Дней отпуска</th>
                      <th>Праздничных дней</th>
                      <th>Итого отдых</th>
                      <th>Замещающий сотрудник</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in selectedRequest.periods || []" :key="p.part_number">
                      <td><strong>Часть {{ p.part_number }}</strong></td>
                      <td>{{ formatDate(p.start_date) }}</td>
                      <td>{{ formatDate(p.end_date) }}</td>
                      <td><span class="tbl-badge blue">{{ p.vacation_days }} дн.</span></td>
                      <td>
                        <span v-if="p.holidays_count > 0" class="tbl-badge green">+{{ p.holidays_count }} дн.</span>
                        <span v-else class="text-muted">0 дн.</span>
                      </td>
                      <td><strong>{{ p.vacation_days + (p.holidays_count || 0) }} дн.</strong></td>
                      <td>
                        <div v-if="p.substitute_name" class="sub-cell">
                          <strong>{{ p.substitute_name }}</strong>
                          <small v-if="p.substitute_position">{{ p.substitute_position }}</small>
                        </div>
                        <span v-else class="text-muted">Не назначен</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Маршрут согласования по алгоритму -->
              <h4 class="section-subtitle"><UserCheck :size="17" /> Алгоритм согласования и решения</h4>
              <div class="approval-chain-list">
                <div
                  v-for="(step, idx) in buildApprovalChain(selectedRequest)"
                  :key="step.stageCode"
                  class="chain-step-card"
                  :class="'step-' + step.decisionState"
                >
                  <div class="step-index">{{ idx + 1 }}</div>
                  <div class="step-info">
                    <div class="step-role-row">
                      <span class="step-role-title">{{ step.roleTitle }}</span>
                      <span class="step-decision-badge" :class="'dec-' + step.decisionState">
                        {{ step.decisionLabel }}
                      </span>
                    </div>
                    <div class="step-person-name">
                      {{ step.personName || 'Ответственный сотрудник' }}
                    </div>
                    <div v-if="step.comment" class="step-comment">
                      «{{ step.comment }}»
                    </div>
                    <div v-if="step.actedAt" class="step-time">
                      Дата решения: {{ formatDateTime(step.actedAt) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- МОДАЛЬНАЯ ВКЛАДКА 2: ИСТОРИЯ ЗАЯВКИ -->
            <div v-else-if="modalTab === 'history'" class="m-tab-content">
              <div v-if="!selectedRequest.history || selectedRequest.history.length === 0" class="empty-history">
                История действий по данной заявке пуста.
              </div>
              <div v-else class="timeline-container">
                <div
                  v-for="(item, idx) in selectedRequest.history"
                  :key="item.id || idx"
                  class="timeline-item"
                >
                  <div class="timeline-marker" :class="getTimelineMarkerClass(item.to_status_code)"></div>
                  <div class="timeline-card">
                    <div class="tl-header">
                      <div class="tl-actor">
                        <strong>{{ item.acted_by_name || item.author || 'Система' }}</strong>
                        <span v-if="item.acted_by_role" class="tl-role-badge">{{ item.acted_by_role }}</span>
                        <span v-if="item.acted_by_position" class="tl-pos">({{ item.acted_by_position }})</span>
                      </div>
                      <span class="tl-date">{{ formatDateTime(item.created_at) }}</span>
                    </div>

                    <div class="tl-status-row">
                      <span v-if="item.from_status_name" class="tl-status old">{{ item.from_status_name }}</span>
                      <ArrowRight v-if="item.from_status_name && item.to_status_name" :size="14" class="tl-arrow" />
                      <span v-if="item.to_status_name" class="tl-status new" :class="'status-' + (item.to_status_code || '').toLowerCase()">
                        {{ item.to_status_name }}
                      </span>
                      <span class="tl-stage-tag">Этап: {{ formatStageSimple(item.stage) }}</span>
                    </div>

                    <p v-if="item.comment" class="tl-comment">{{ item.comment }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Подвал модального окна -->
          <div class="modal-footer">
            <button class="btn-close-modal" @click="closeModal">
              Закрыть окно
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '@/services/api';
import IncomingRequestsTab from './IncomingRequestsTab.vue';
import AnalyticsQuotaTab from './AnalyticsQuotaTab.vue';
import ArchiveRequestsTab from './ArchiveRequestsTab.vue';
import EmployeesStatusTab from './EmployeesStatusTab.vue';
import EmployeeCabinet from '@/views/Employee/EmployeeCabinet.vue';
import {
  Briefcase,
  Building2,
  Network,
  UserCheck,
  ShieldCheck,
  Award,
  Inbox,
  BarChart3,
  Archive,
  Users,
  Loader2,
  X,
  FileText,
  History,
  AlertTriangle,
  CalendarDays,
  ArrowRight,
  Send
} from 'lucide-vue-next';

const me = ref<any>(null);
const loading = ref(true);
const submittingId = ref<number | null>(null);
const submittingPackage = ref(false);

// Активная вкладка из 5
const activeTab = ref<'incoming' | 'analytics' | 'archive' | 'employees' | 'my_vacation'>('incoming');

// Плановый год
const nextYear = new Date().getFullYear() + 1;
const targetYear = ref<number>(nextYear);
const availableYears = [nextYear - 1, nextYear, nextYear + 1];

// Данные для вкладок и шлюза 100% комплектности
const incomingRequests = ref<any[]>([]);
const archiveRequests = ref<any[]>([]);
const monthsAnalytics = ref<any[]>([]);
const totalEmployees = ref<number>(0);
const divisionEmployees = ref<any[]>([]);
const readyEmployeesCount = ref<number>(0);
const canSubmitDivisionPackage = ref<boolean>(false);
const isDivisionPackageSent = ref<boolean>(false);
const missingEmployeesList = ref<any[]>([]);
const departmentApprovers = ref<any[]>([]);
const selectedTargetApproverId = ref<number | null>(null);

// Модальное окно «Подробно»
const selectedRequest = ref<any>(null);
const modalTab = ref<'details' | 'history'>('details');

const overloadedCount = computed(() => {
  return monthsAnalytics.value.filter(m => m.percent >= 30 || m.load_level === 'DANGER').length;
});

const submittedEmployeesCount = computed(() => {
  return divisionEmployees.value.filter(e => e.has_submitted).length;
});

// При переключении с вкладки "Мой отпуск" обновляем статус комплектности управления
watch(activeTab, (newTab, oldTab) => {
  if (oldTab === 'my_vacation' && newTab !== 'my_vacation') {
    loadAllDivisionData();
  }
});

const applyEmployeeStatusData = (empStatusData: any) => {
  const rawEmployees = empStatusData?.employees || [];
  divisionEmployees.value = rawEmployees.filter(
    (e: any) => !['DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN'].includes(e.role_code)
  );
  totalEmployees.value = empStatusData?.total_employees ?? divisionEmployees.value.length;
  readyEmployeesCount.value =
    empStatusData?.ready_count ??
    divisionEmployees.value.filter((e: any) => e.is_ready_for_department).length;
  canSubmitDivisionPackage.value = Boolean(empStatusData?.can_submit_package);
  isDivisionPackageSent.value = Boolean(empStatusData?.is_package_already_sent);
  missingEmployeesList.value = empStatusData?.missing_employees || [];
};

const loadAllDivisionData = async () => {
  loading.value = true;
  try {
    const [meRes, incRes, archRes, quotaRes, empStatusRes] = await Promise.all([
      api.get('/division/me'),
      api.get('/division/requests/incoming'),
      api.get('/division/requests/archive'),
      api.get('/division/analytics/quota', { params: { target_year: targetYear.value } }),
      api.get('/division/employees-status', { params: { target_year: targetYear.value } })
    ]);

    me.value = meRes.data;
    departmentApprovers.value = meRes.data?.department_approvers || [];
    if (!selectedTargetApproverId.value && departmentApprovers.value.length > 0) {
      selectedTargetApproverId.value = departmentApprovers.value[0].id;
    }
    incomingRequests.value = incRes.data || [];
    archiveRequests.value = archRes.data || [];
    monthsAnalytics.value = quotaRes.data?.months_analytics || [];
    applyEmployeeStatusData(empStatusRes.data);
  } catch (err) {
    console.error('Ошибка загрузки кабинета начальника управления:', err);
  } finally {
    loading.value = false;
  }
};

const changeYear = async (yr: number) => {
  targetYear.value = yr;
  try {
    const [quotaRes, empStatusRes] = await Promise.all([
      api.get('/division/analytics/quota', { params: { target_year: yr } }),
      api.get('/division/employees-status', { params: { target_year: yr } })
    ]);
    monthsAnalytics.value = quotaRes.data?.months_analytics || [];
    applyEmployeeStatusData(empStatusRes.data);
  } catch (err) {
    console.error('Ошибка обновления аналитики за год:', err);
  }
};

// Отправка сводного графика всего управления (100% комплектность) в Департамент
const handleSubmitDivisionPackage = async () => {
  if (!canSubmitDivisionPackage.value) return;
  submittingPackage.value = true;
  try {
    const res = await api.post('/division/submit-package', {
      target_year: targetYear.value,
      target_approver_id: selectedTargetApproverId.value
    });
    alert(res.data?.message || 'Сводный график управления успешно отправлен в Департамент!');
    await loadAllDivisionData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Не удалось отправить сводный график управления');
  } finally {
    submittingPackage.value = false;
  }
};

// Принятие решения по заявке (APPROVE, REVISION, REJECT)
const handleProcessAction = async (payload: { id: number; action: 'APPROVE' | 'REVISION' | 'REJECT'; comment: string }) => {
  submittingId.value = payload.id;
  try {
    await api.patch(`/division/requests/${payload.id}/action`, {
      action: payload.action,
      comment: payload.comment
    });
    await loadAllDivisionData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Не удалось сохранить решение по заявке');
  } finally {
    submittingId.value = null;
  }
};

// Открытие модального окна «Подробно»
const openRequestDetails = async (requestId: number) => {
  try {
    const res = await api.get(`/division/requests/${requestId}`);
    selectedRequest.value = res.data;
    modalTab.value = 'details';
  } catch (err: any) {
    alert(err.response?.data?.error || 'Не удалось загрузить подробные данные заявки');
  }
};

const closeModal = () => {
  selectedRequest.value = null;
};

// Цепочка согласования для модального окна
const buildApprovalChain = (req: any) => {
  const stageOrder = ['EMPLOYEE', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'HR', 'ACCOUNTING', 'ACCOUNTANT', 'COMPLETED'];
  const currentIdx = stageOrder.indexOf(req.current_stage || 'EMPLOYEE');
  const historyList: any[] = req.history || [];

  const steps = [
    {
      stageCode: 'DIVISION_HEAD',
      orderIdx: 1,
      roleTitle: '1. Начальник управления',
      personName: req.division_head_name || me.value?.division_head_name || 'Начальник управления'
    },
    {
      stageCode: 'DEPARTMENT_HEAD',
      orderIdx: 2,
      roleTitle: '2. Начальник департамента',
      personName: req.department_head_name || me.value?.department_head_name || 'Начальник департамента'
    },
    {
      stageCode: 'HR',
      orderIdx: 3,
      roleTitle: '3. HR-специалист (Отдел кадров)',
      personName: req.hr_name || 'Специалист HR'
    },
    {
      stageCode: 'ACCOUNTANT',
      orderIdx: 4,
      roleTitle: '4. Бухгалтерия (Расчет отпускных)',
      personName: req.accountant_name || 'Бухгалтер'
    }
  ];

  return steps.map(st => {
    const relatedHistory = [...historyList].reverse().find(h => {
      if (st.stageCode === 'DIVISION_HEAD') return h.acted_by_role_code === 'DIVISION_HEAD';
      if (st.stageCode === 'DEPARTMENT_HEAD') return h.acted_by_role_code === 'DEPARTMENT_HEAD';
      if (st.stageCode === 'HR') return h.acted_by_role_code === 'HR';
      if (st.stageCode === 'ACCOUNTANT') return h.acted_by_role_code === 'ACCOUNTANT';
      return false;
    });

    if (req.status_code === 'REJECTED' && st.stageCode === 'DIVISION_HEAD') {
      return {
        ...st,
        decisionState: 'rejected',
        decisionLabel: 'Отказано',
        comment: req.revision_comment || relatedHistory?.comment || 'В согласовании отказано',
        actedAt: relatedHistory?.created_at || null
      };
    }

    if (req.status_code === 'APPROVED' || currentIdx > st.orderIdx) {
      return {
        ...st,
        decisionState: 'approved',
        decisionLabel: 'Утверждено / Согласовано',
        comment: relatedHistory?.comment || 'Согласовано',
        actedAt: relatedHistory?.created_at || null
      };
    }

    if (req.status_code === 'REVISION' && relatedHistory?.to_status_code === 'REVISION') {
      return {
        ...st,
        decisionState: 'revision',
        decisionLabel: 'Возвращено на доработку',
        comment: req.revision_comment || relatedHistory?.comment || 'Направлено на доработку',
        actedAt: relatedHistory?.created_at || null
      };
    }

    if (req.status_code === 'SENT' && currentIdx === st.orderIdx) {
      return {
        ...st,
        decisionState: 'current',
        decisionLabel: 'На рассмотрении сейчас',
        comment: 'Ожидается решение',
        actedAt: null
      };
    }

    return {
      ...st,
      decisionState: 'waiting',
      decisionLabel: 'Ожидает очереди согласования',
      comment: null,
      actedAt: null
    };
  });
};

const getTotalRequestDays = (req: any) => {
  if (!req?.periods) return 0;
  return req.periods.reduce((s: number, p: any) => s + (Number(p.vacation_days) || 0), 0);
};

const formatStageName = (stage: string, req?: any) => {
  if (req?.status_code === 'REJECTED') return 'Отказано начальником управления';
  switch (stage) {
    case 'EMPLOYEE':
      return 'У сотрудника (На доработке / Черновик)';
    case 'DIVISION_HEAD':
      return `У начальника управления (${req?.division_head_name || me.value?.division_head_name || ''})`;
    case 'DEPARTMENT_HEAD':
      return `У начальника департамента (${req?.department_head_name || me.value?.department_head_name || ''})`;
    case 'HR':
      return 'В отделе кадров (HR)';
    case 'ACCOUNTING':
    case 'ACCOUNTANT':
      return 'В бухгалтерии';
    case 'COMPLETED':
      return 'Полностью утверждена';
    default:
      return stage;
  }
};

const formatStageSimple = (stage: string) => {
  const map: Record<string, string> = {
    EMPLOYEE: 'Сотрудник',
    DIVISION_HEAD: 'Начальник управления',
    DEPARTMENT_HEAD: 'Начальник департамента',
    HR: 'Отдел кадров (HR)',
    ACCOUNTING: 'Бухгалтерия',
    ACCOUNTANT: 'Бухгалтерия',
    COMPLETED: 'Завершено'
  };
  return map[stage] || stage;
};

const getTimelineMarkerClass = (code?: string) => {
  if (code === 'APPROVED') return 'marker-green';
  if (code === 'SENT') return 'marker-blue';
  if (code === 'REVISION') return 'marker-amber';
  if (code === 'REJECTED') return 'marker-red';
  return 'marker-gray';
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

const getInitials = (lastName?: string, firstName?: string) => {
  const l = (lastName || '').trim()[0] || '';
  const f = (firstName || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'Н';
};

const pluralYears = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
};

onMounted(() => {
  loadAllDivisionData();
});
</script>

<style scoped>
.division-cabinet {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading-state {
  background: #ffffff;
  border-radius: 18px;
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.spin-icon {
  animation: spin 1s linear infinite;
  color: #2563eb;
  margin-bottom: 12px;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.cabinet-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* =========================================================
   1. ШАПКА ПРОФИЛЯ НАЧАЛЬНИКА УПРАВЛЕНИЯ (КАК НА ФОТО)
   ========================================================= */
.profile-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.profile-top {
  background: linear-gradient(135deg, #0f172a 0%, #172554 55%, #1e3a8a 100%);
  color: #ffffff;
  padding: 28px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 18px;
}

.avatar-circle {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: linear-gradient(135deg, #3b82f6, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.55rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.identity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.tab-badge {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f1f5f9;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-badge {
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #7dd3fc;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.employee-fullname {
  margin: 0 0 6px;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.employee-pos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.92rem;
}

.limit-widget {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  padding: 16px 22px;
  min-width: 270px;
  backdrop-filter: blur(10px);
}

.limit-caption {
  display: block;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #93c5fd;
  margin-bottom: 4px;
  font-weight: 700;
}

.limit-number {
  font-size: 2rem;
  font-weight: 800;
  color: #34d399;
  line-height: 1.1;
}

.limit-number small {
  font-size: 0.85rem;
  font-weight: 500;
  color: #e2e8f0;
  margin-left: 4px;
}

.limit-breakdown {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bd-chip {
  font-size: 0.76rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px 9px;
  border-radius: 6px;
  color: #e2e8f0;
}

.bd-chip.green {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

/* 5 плиток под шапкой */
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  padding: 20px 28px;
  background: #f8fafc;
}

.info-tile {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.tile-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tile-icon.blue { background: #eff6ff; color: #2563eb; }
.tile-icon.indigo { background: #eef2ff; color: #4f46e5; }
.tile-icon.amber { background: #fffbeb; color: #d97706; }
.tile-icon.purple { background: #f3e8ff; color: #7e22ce; }
.tile-icon.emerald { background: #ecfdf5; color: #059669; }

.tile-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tile-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.02em;
}

.tile-value {
  font-size: 0.93rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.tile-sub {
  font-size: 0.77rem;
  color: #64748b;
}

/* =========================================================
   2. ПАНЕЛЬ 4 ВКЛАДОК
   ========================================================= */
.cabinet-tabs-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  background: #ffffff;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
}

.tabs-left {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.tab-btn.active {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.tab-count {
  background: #e2e8f0;
  color: #334155;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.74rem;
  font-weight: 800;
}

.count-blue {
  background: #2563eb;
  color: #ffffff;
}

.count-red {
  background: #ef4444;
  color: #ffffff;
}

.year-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.year-label {
  font-size: 0.84rem;
  font-weight: 600;
  color: #64748b;
}

.year-buttons {
  display: flex;
  gap: 6px;
}

.year-chip {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.year-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

/* =========================================================
   3. МОДАЛЬНОЕ ОКНО «ПОДРОБНО»
   ========================================================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.detail-modal {
  background: #ffffff;
  width: 100%;
  max-width: 880px;
  max-height: calc(100vh - 32px);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 20px 26px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-shrink: 0;
}

.modal-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.m-req-num {
  background: #0f172a;
  color: #ffffff;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.m-year-tag {
  background: #eff6ff;
  color: #1e40af;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.status-pill-sm {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-sent { background: #dbeafe; color: #1d4ed8; }
.status-approved { background: #d1fae5; color: #047857; }
.status-revision { background: #fef3c7; color: #b45309; }
.status-rejected { background: #fee2e2; color: #b91c1c; }

.modal-title-wrap h3 {
  margin: 0;
  font-size: 1.18rem;
  color: #0f172a;
}

.modal-close-btn {
  background: #e2e8f0;
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 26px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.m-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #f8fafc;
  color: #475569;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.m-tab-btn.active {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.modal-body {
  padding: 22px 26px;
  overflow-y: auto;
  flex: 1;
}

.m-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
  gap: 12px;
}

.ov-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ov-lbl {
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #64748b;
}

.ov-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.ov-val.highlight { color: #1d4ed8; }
.ov-sub { font-size: 0.78rem; color: #64748b; }

.modal-revision-box {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  gap: 10px;
  font-size: 0.88rem;
}

.modal-revision-box p { margin: 4px 0 0; }

.section-subtitle {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: #0f172a;
}

.modal-periods-table-wrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.modal-periods-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.modal-periods-table th {
  background: #f8fafc;
  color: #475569;
  text-align: left;
  padding: 10px 14px;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.modal-periods-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
}

.tbl-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.tbl-badge.blue { background: #eff6ff; color: #1d4ed8; }
.tbl-badge.green { background: #ecfdf5; color: #047857; }

.sub-cell {
  display: flex;
  flex-direction: column;
}

.sub-cell small { color: #64748b; font-size: 0.76rem; }
.text-muted { color: #94a3b8; }

.approval-chain-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 12px;
}

.chain-step-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  background: #ffffff;
}

.step-approved { border-left: 4px solid #10b981; background: #f0fdf4; }
.step-current { border-left: 4px solid #2563eb; background: #eff6ff; }
.step-revision { border-left: 4px solid #f59e0b; background: #fffbeb; }
.step-rejected { border-left: 4px solid #ef4444; background: #fef2f2; }
.step-waiting { border-left: 4px solid #cbd5e1; background: #f8fafc; }

.step-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0f172a;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.step-role-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-role-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
}

.step-decision-badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.73rem;
  font-weight: 700;
}

.dec-approved { background: #d1fae5; color: #065f46; }
.dec-current { background: #dbeafe; color: #1e40af; }
.dec-revision { background: #fef3c7; color: #92400e; }
.dec-rejected { background: #fee2e2; color: #b91c1c; }
.dec-waiting { background: #e2e8f0; color: #475569; }

.step-person-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.step-comment {
  font-size: 0.83rem;
  color: #334155;
  font-style: italic;
}

.step-time {
  font-size: 0.75rem;
  color: #64748b;
}

.timeline-container {
  position: relative;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline-container::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #e2e8f0;
}

.timeline-item { position: relative; }

.timeline-marker {
  position: absolute;
  left: -24px;
  top: 14px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px #cbd5e1;
}

.marker-green { background: #10b981; box-shadow: 0 0 0 2px #10b981; }
.marker-blue { background: #2563eb; box-shadow: 0 0 0 2px #2563eb; }
.marker-amber { background: #f59e0b; box-shadow: 0 0 0 2px #f59e0b; }
.marker-red { background: #ef4444; box-shadow: 0 0 0 2px #ef4444; }
.marker-gray { background: #64748b; box-shadow: 0 0 0 2px #64748b; }

.timeline-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tl-actor {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: #0f172a;
}

.tl-role-badge {
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tl-pos { font-size: 0.8rem; color: #64748b; }
.tl-date { font-size: 0.78rem; color: #64748b; font-weight: 600; }

.tl-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tl-status {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.tl-status.old { background: #e2e8f0; color: #475569; }
.tl-stage-tag { font-size: 0.78rem; color: #475569; margin-left: auto; }

.tl-comment {
  margin: 0;
  font-size: 0.88rem;
  color: #334155;
  background: #ffffff;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.modal-footer {
  padding: 14px 26px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.btn-close-modal {
  padding: 9px 20px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}

.embedded-my-vacation :deep(.profile-hero-card) {
  display: none;
}

/* ШЛЮЗ УПРАВЛЕНИЯ (100% КОМПЛЕКТНОСТЬ) */
.gateway-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-left: 5px solid #f59e0b;
  border-radius: 16px;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
}

.gateway-card.gateway-ready {
  border-color: #6ee7b7;
  border-left-color: #10b981;
  background: linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%);
}

.gateway-card.gateway-sent {
  border-color: #93c5fd;
  border-left-color: #2563eb;
  background: #f8fafc;
}

.gateway-left {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gw-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.gw-badge {
  padding: 4px 11px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 800;
}

.gw-badge-wait {
  background: #fef3c7;
  color: #b45309;
}

.gw-badge-ok {
  background: #dcfce7;
  color: #047857;
}

.gw-badge-sent {
  background: #dbeafe;
  color: #1d4ed8;
}

.gw-progress-text {
  font-size: 0.92rem;
  color: #0f172a;
}

.gw-bar-track {
  height: 8px;
  border-radius: 99px;
  background: #e2e8f0;
  overflow: hidden;
  max-width: 500px;
}

.gw-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%);
  border-radius: 99px;
  transition: width 0.3s ease;
}

.gw-hint {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.4;
}

.gw-hint-warn {
  color: #b45309;
}

.gw-hint-ok {
  color: #047857;
  font-weight: 600;
}

.gateway-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.approver-select-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 320px;
}

.approver-select-box label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
}

.approver-select {
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  outline: none;
  cursor: pointer;
}

.approver-select:focus {
  border-color: #2563eb;
}

.btn-submit-gateway {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  transition: all 0.15s;
}

.btn-submit-gateway:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.38);
}

.btn-submit-gateway:disabled {
  background: #cbd5e1;
  color: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}
</style>
