<template>
  <div class="department-cabinet">
    <!-- 1. ВЕРХНИЙ ПРОФИЛЬ НАЧАЛЬНИКА ДЕПАРТАМЕНТА (В ЕДИНОМ СТИЛЕ С КАБИНЕТОМ СОТРУДНИКА И НАЧАЛЬНИКА УПРАВЛЕНИЯ) -->
    <div v-if="profile" class="profile-hero-card">
      <div class="hero-top-banner">
        <div class="hero-left">
          <div class="hero-avatar">
            {{ getInitials(profile.last_name, profile.first_name) }}
          </div>
          <div class="hero-identity">
            <div class="hero-badges">
              <span class="badge-role">
                <ShieldCheck :size="13" />
                Кабинет начальника департамента
              </span>
            </div>
            <h1 class="hero-name">
              {{ profile.last_name }} {{ profile.first_name }} {{ profile.middle_name || '' }}
            </h1>
            <div class="hero-pos">
              <Briefcase :size="15" />
              <span>{{ profile.position_title || profile.role_name }}</span>
            </div>
          </div>
        </div>

        <div class="hero-limit-box">
          <div class="limit-caption">ГОДОВОЙ ЛИМИТ ОТПУСКА</div>
          <div class="limit-main">
            <span class="limit-num">{{ profile.vacation_days_available || 30 }}</span>
            <span class="limit-unit">календарных дней</span>
          </div>
          <div class="limit-pills">
            <span class="lp-base">База: {{ profile.base_days || 30 }} дн.</span>
            <span class="lp-bonus">
              Стаж ({{ profile.service_years || 0 }} л.): +{{ profile.bonus_days || 0 }} дн.
            </span>
          </div>
        </div>
      </div>

      <!-- Нижняя панель из 5 инфо-блоков -->
      <div class="hero-info-grid">
        <div class="info-tile">
          <div class="tile-icon icon-blue"><Building2 :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ДЕПАРТАМЕНТ</span>
            <span class="tile-val">{{ profile.department_name || 'Не указан' }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-purple"><Network :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">СТРУКТУРА ДЕПАРТАМЕНТА</span>
            <span class="tile-val">Управлений: {{ profile.divisions_count || 0 }}</span>
            <span class="tile-sub">В подчинении департамента</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-amber"><Users :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ШТАТ ДЕПАРТАМЕНТА</span>
            <span class="tile-val">{{ profile.total_employees || 0 }} сотрудников</span>
            <span class="tile-sub">По всем управлениям</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-rose"><Inbox :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ОЖИДАЮТ УТВЕРЖДЕНИЯ</span>
            <span class="tile-val">{{ incomingRequests.length }} заявок</span>
            <span class="tile-sub">В архиве решений: {{ archiveRequests.length }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-green"><Award :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ТРУДОВОЙ СТАЖ (1С)</span>
            <span class="tile-val">{{ profile.service_years || 0 }} лет</span>
            <span class="tile-sub">Норматив по ст. 92 ТК РК</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ШЛЮЗ ДЕПАРТАМЕНТА (ПРИНЦИП 100% КОМПЛЕКТНОСТИ ПО УПРАВЛЕНИЯМ) -->
    <div v-if="completeness" class="dept-gateway-card" :class="{ 'gw-ready': completeness.can_submit_department_package, 'gw-sent': completeness.is_department_package_already_sent }">
      <div class="dg-header">
        <div>
          <div class="dg-title-row">
            <span class="dg-badge" :class="completeness.is_department_package_already_sent ? 'b-sent' : completeness.can_submit_department_package ? 'b-ok' : 'b-wait'">
              {{
                completeness.is_department_package_already_sent
                  ? '✓ Сводный график Департамента отправлен в ОК (HR)'
                  : completeness.can_submit_department_package
                  ? '✓ 100% комплектность Департамента достигнута'
                  : 'Ожидание 100%-й готовности управлений.'
              }}
            </span>
            <span class="dg-stat">
              Готовых управлений: <strong>{{ completeness.completed_divisions }} из {{ completeness.total_divisions }}</strong>
              • Проверено людей по департаменту:
              </span>
          </div>
        </div>

        <button
          type="button"
          class="btn-submit-dept-package"
          :disabled="!completeness.can_submit_department_package || submittingDeptPackage"
          @click="handleSubmitDepartmentPackage"
        >
          <Check :size="17" />
          <span v-if="submittingDeptPackage">Отправка в HR...</span>
          <span v-else-if="completeness.is_department_package_already_sent">
            Весь Департамент отправлен в ОК (HR)
          </span>
          <span v-else>
            Утвердить и отправить весь Департамент ({{ completeness.checked_by_department_people }}/{{ completeness.total_required_people }})
          </span>
        </button>
      </div>

      <!-- Карточки прогресса по каждому управлению департамента -->
      <div class="dg-divisions-grid">
        <div
          v-for="div in completeness.divisions_status"
          :key="div.id"
          class="dg-div-pill"
          :class="div.is_sent_to_department ? 'div-ok' : 'div-pending'"
        >
          <div class="div-pill-top">
            <strong>{{ div.is_sent_to_department ? '✅' : '⏳' }} {{ div.name }}</strong>
            <span class="div-cnt">{{ div.at_department_count }} из {{ div.total_staff }}</span>
          </div>
          <div class="div-pill-sub">
            <template v-if="div.is_sent_to_department">
              Сдано полностью ({{ div.total_staff }} из {{ div.total_staff }}). Проверено департаментом: {{ div.checked_by_department_count }}/{{ div.total_staff }}
            </template>
            <template v-else>
              В процессе на уровне управления (сдано внутри управления: {{ div.submitted_in_division }} из {{ div.total_staff }})
            </template>
          </div>
        </div>

        <!-- Для ДЭР: карточка статуса Заместителя начальника департамента -->
        <div
          v-for="dep in completeness.deputies_status || []"
          :key="'dep-' + dep.id"
          class="dg-div-pill"
          :class="dep.is_at_department ? 'div-ok' : 'div-pending'"
        >
          <div class="div-pill-top">
            <strong>{{ dep.is_at_department ? '✅' : '⏳' }} {{ dep.full_name }}</strong>
            <span class="div-cnt">{{ dep.role_name }}</span>
          </div>
          <div class="div-pill-sub">
            {{
              dep.is_at_department
                ? dep.is_checked
                  ? 'Заявка подана и проверена начальником департамента'
                  : 'Заявка поступила в Департамент (ожидает нажатия «Принять в график»)'
                : 'Ожидается подача заявки заместителем начальника департамента ДЭР'
            }}
          </div>
        </div>
      </div>

    </div>

    <!-- ШЛЮЗ РУКОВОДСТВА ДЕПАРТАМЕНТА ДЭР (НАЧАЛЬНИК ДЕПАРТАМЕНТА + ЗАМ -> В КАДРЫ ЦА) -->
    <div
      v-if="completeness?.leadership_package && profile?.role_code === 'DEPARTMENT_HEAD'"
      class="dept-gateway-card"
      :class="{
        'gw-ready': completeness.leadership_package.can_submit_to_ca,
        'gw-sent': completeness.leadership_package.is_sent_to_ca
      }"
    >
      <div class="dg-header">
        <div>
          <div class="dg-title-row">
            <span
              class="dg-badge"
              :class="
                completeness.leadership_package.is_sent_to_ca
                  ? 'b-sent'
                  : completeness.leadership_package.can_submit_to_ca
                  ? 'b-ok'
                  : 'b-wait'
              "
            >
              {{
                completeness.leadership_package.is_sent_to_ca
                  ? 'Отправлен в кадры ЦА'
                  : completeness.leadership_package.can_submit_to_ca
                  ? 'Начальник и Зам готов к отправке в ЦА'
                  : '⏳ Формирование пакета руководства ДЭР для Кадровика ЦА'
              }}
            </span>
            <span class="dg-stat">
              Начальник департамента и Заместитель отправляются в <strong>Кадры ЦА</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          class="btn-submit-dept-package"
          :disabled="!completeness.leadership_package.can_submit_to_ca || submittingLeadershipPackage"
          @click="handleSubmitLeadershipPackage"
        >
          <Check :size="17" />
          <span v-if="submittingLeadershipPackage">Отправка в HR ЦА...</span>
          <span v-else-if="completeness.leadership_package.is_sent_to_ca">
            Отправлено в Кадры ЦА
          </span>
          <span v-else>
            Отправить в Кадры ЦА
          </span>
        </button>
      </div>

      <div class="dg-divisions-grid">
        <div
          v-for="dep in completeness.leadership_package.deputies_status || []"
          :key="'lead-dep-' + dep.id"
          class="dg-div-pill"
          :class="dep.is_checked ? 'div-ok' : 'div-pending'"
        >
          <div class="div-pill-top">
            <strong>{{ dep.is_checked ? '✅' : '⏳' }} {{ dep.full_name }}</strong>
            <span class="div-cnt">{{ dep.role_name }}</span>
          </div>
          <div class="div-pill-sub">
            {{
              dep.is_sent_to_ca
                ? 'Утверждено и отправлено в Кадры ЦА'
                : dep.is_checked
                ? 'Заявка Заместителя утверждена вами (готова к совместной отправке в ЦА)'
                : dep.is_at_department
                ? 'Заявка поступила во вкладку «1. Входящие заявки» — нажмите «Принять в график»'
                : 'Заместитель еще не подал свою заявку на отпуск'
            }}
          </div>
        </div>

        <div
          class="dg-div-pill"
          :class="completeness.leadership_package.head_has_request ? 'div-ok' : 'div-pending'"
        >
          <div class="div-pill-top">
            <strong>
              {{ completeness.leadership_package.head_has_request ? '✅' : '⏳' }}
              {{ completeness.leadership_package.head_name }}
            </strong>
            <span class="div-cnt">Начальник департамента ДЭР</span>
          </div>
          <div class="div-pill-sub">
            {{
              completeness.leadership_package.head_sent_to_ca
                ? 'Отправлено в Кадры ЦА совместно с Заместителем'
                : completeness.leadership_package.head_has_request
                ? 'Ваша заявка заполнена (готова к совместной отправке с Заместителем в ЦА)'
                : 'Заполните собственную заявку во вкладке «3. Мой отпуск (в HR ЦА)»'
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- 2. НАВИГАЦИЯ ПО 2 ВКЛАДКАМ КАБИНЕТА НАЧАЛЬНИКА ДЕПАРТАМЕНТА -->
    <div class="cabinet-tabs-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'incoming' }"
        @click="activeTab = 'incoming'"
      >
        <Inbox :size="17" />
        <span>1. Входящие заявки</span>
        <span v-if="incomingRequests.length > 0" class="tab-counter counter-hot">
          {{ incomingRequests.length }}
        </span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'archive' }"
        @click="activeTab = 'archive'"
      >
        <Archive :size="17" />
        <span>2. Архив решений</span>
        <span class="tab-counter">{{ archiveRequests.length }}</span>
      </button>

      <!-- Для руководителей и заместителей территориальных ДЭР (is_central = false) доступна подача собственной заявки в ЦА -->
      <button
        v-if="canSubmitOwnVacation"
        class="tab-btn"
        :class="{ active: activeTab === 'my_vacation' }"
        @click="activeTab = 'my_vacation'"
      >
        <UserCheck :size="17" />
        <span>3. Мой отпуск (в HR ЦА)</span>
      </button>
    </div>

    <!-- 3. КОНТЕНТ АКТИВНОЙ ВКЛАДКИ -->
    <div class="cabinet-content-card">
      <Transition name="fade-fast" mode="out-in">
        <!-- Вкладка 1: Входящие заявки -->
        <IncomingDepartmentTab
          v-if="activeTab === 'incoming'"
          :requests="incomingRequests"
          :loading="loadingIncoming"
          @refresh="loadAllData"
          @decision-done="loadAllData"
          @open-details="openDetailsModal"
        />

        <!-- Вкладка 2: Архив -->
        <ArchiveDepartmentTab
          v-else-if="activeTab === 'archive'"
          :requests="archiveRequests"
          :loading="loadingArchive"
          @open-details="openDetailsModal"
        />

        <!-- Вкладка 3: Мой отпуск (только для ДЭР: is_central = false) -->
        <div v-else-if="activeTab === 'my_vacation' && canSubmitOwnVacation" class="embedded-my-vacation">
          <EmployeeCabinet :embedded="true" />
        </div>
      </Transition>
    </div>

    <!-- 4. ОБЩЕЕ МОДАЛЬНОЕ ОКНО «ПОДРОБНО» (С 2 ВКЛАДКАМИ: ДАННЫЕ + ИСТОРИЯ) -->
    <Transition name="modal-fade">
      <div v-if="detailsModalOpen" class="modal-backdrop" @click.self="closeDetailsModal">
        <div class="modal-window">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-badge">
                {{ formatModalReqNum(selectedDetails?.request_number) }}
              </div>
              <div>
                <h3>Подробная информация о заявке на отпуск</h3>
                <p v-if="selectedDetails">
                  Сотрудник:
                  <strong>
                    {{ selectedDetails.last_name }} {{ selectedDetails.first_name }}
                    {{ selectedDetails.middle_name || '' }}
                  </strong>
                  ({{ selectedDetails.division_name || 'Без управления' }} —
                  {{ selectedDetails.position_title || 'Сотрудник' }})
                </p>
              </div>
            </div>
            <button class="modal-close-btn" @click="closeDetailsModal">
              <X :size="20" />
            </button>
          </div>

          <!-- Внутренние вкладки модального окна -->
          <div class="modal-subtabs">
            <button
              class="subtab-btn"
              :class="{ active: modalTab === 'info' }"
              @click="modalTab = 'info'"
            >
              <FileText :size="16" />
              <span>1. Данные заявки и маршрут согласования</span>
            </button>
            <button
              class="subtab-btn"
              :class="{ active: modalTab === 'history' }"
              @click="modalTab = 'history'"
            >
              <History :size="16" />
              <span>2. История заявки ({{ selectedDetails?.history?.length || 0 }})</span>
            </button>
          </div>

          <div v-if="loadingDetails" class="modal-loading">
            <div class="loader-spinner"></div>
            <p>Загрузка данных заявки...</p>
          </div>

          <div v-else-if="selectedDetails" class="modal-body">
            <!-- Вкладка 1 внутри модалки: Полные данные и цепочка согласования -->
            <div v-if="modalTab === 'info'" class="modal-info-section">
              <!-- Сводная карточка сотрудника и заявки -->
              <div class="detail-meta-grid">
                <div class="meta-box">
                  <span class="meta-lbl">ФИО СОТРУДНИКА</span>
                  <span class="meta-val">
                    {{ selectedDetails.last_name }} {{ selectedDetails.first_name }}
                    {{ selectedDetails.middle_name || '' }}
                  </span>
                </div>
                <div class="meta-box">
                  <span class="meta-lbl">УПРАВЛЕНИЕ / ДОЛЖНОСТЬ</span>
                  <span class="meta-val">
                    {{ selectedDetails.division_name || '—' }} ({{ selectedDetails.position_title || 'Сотрудник' }})
                  </span>
                </div>
                <div class="meta-box">
                  <span class="meta-lbl">ГОД ГРАФИКА / ЛИМИТ</span>
                  <span class="meta-val">
                    {{ selectedDetails.year }} г. (доступно {{ selectedDetails.vacation_days_available || 30 }} дн.)
                  </span>
                </div>
                <div class="meta-box">
                  <span class="meta-lbl">ТЕКУЩИЙ СТАТУС</span>
                  <span class="meta-val status-highlight">{{ selectedDetails.status_name }}</span>
                </div>
              </div>

              <!-- Если есть замечание на доработку -->
              <div v-if="selectedDetails.revision_comment" class="modal-revision-alert">
                <AlertCircle :size="18" />
                <div>
                  <strong>Причина возврата / отказа:</strong>
                  <p>{{ selectedDetails.revision_comment }}</p>
                </div>
              </div>

              <!-- Визуальный маршрут согласования (кто и что решил по алгоритму) -->
              <div class="route-box">
                <h4>Маршрут согласования по алгоритму</h4>
                <div class="route-steps">
                  <div
                    v-for="(step, idx) in buildApprovalSteps(selectedDetails)"
                    :key="idx"
                    class="route-step"
                    :class="'step-' + step.state"
                  >
                    <div class="step-indicator">
                      <Check v-if="step.state === 'done'" :size="14" />
                      <X v-else-if="step.state === 'rejected'" :size="14" />
                      <Clock v-else-if="step.state === 'active'" :size="14" />
                      <span v-else>{{ idx + 1 }}</span>
                    </div>
                    <div class="step-info">
                      <div class="step-role">{{ step.roleTitle }}</div>
                      <div class="step-person">{{ step.personName }}</div>
                      <div class="step-decision">{{ step.decisionText }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Запланированные части отпуска -->
              <div class="modal-periods-block">
                <h4>Запланированные периоды отпуска ({{ calcTotalDays(selectedDetails.periods) }} кал. дн.)</h4>
                <div class="mp-table">
                  <div class="mp-head">
                    <span>Часть</span>
                    <span>Дата начала</span>
                    <span>Дата окончания</span>
                    <span>Дней</span>
                    <span>И.О. (Замещающий)</span>
                  </div>
                  <div
                    v-for="p in selectedDetails.periods"
                    :key="p.part_number"
                    class="mp-row"
                  >
                    <span class="mp-part">Часть {{ p.part_number }}</span>
                    <span>{{ formatDate(p.start_date) }}</span>
                    <span>{{ formatDate(p.end_date) }}</span>
                    <span>
                      <strong>{{ p.days_count }} кал. дн.</strong>
                      <small v-if="p.holidays_count > 0" class="mp-hol"> (+{{ p.holidays_count }} праздн.)</small>
                    </span>
                    <span>{{ p.substitute_name || 'Не назначен' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Вкладка 2 внутри модалки: История действий -->
            <div v-else class="modal-history-section">
              <div v-if="!selectedDetails.history || selectedDetails.history.length === 0" class="empty-hist">
                История действий пуста
              </div>
              <div v-else class="timeline-list">
                <div
                  v-for="h in selectedDetails.history"
                  :key="h.id"
                  class="timeline-item"
                >
                  <div class="tl-dot"></div>
                  <div class="tl-card">
                    <div class="tl-top">
                      <span class="tl-action">{{ h.action_type }}</span>
                      <span class="tl-date">{{ formatDateTime(h.created_at) }}</span>
                    </div>
                    <div class="tl-actor">
                      Выполнил(а): <strong>{{ h.actor_name }}</strong>
                      <span v-if="h.actor_role" class="tl-role">({{ h.actor_role }})</span>
                    </div>
                    <div v-if="h.comment" class="tl-comment">
                      «{{ h.comment }}»
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-close-modal" @click="closeDetailsModal">Закрыть окно</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '@/services/api';
import IncomingDepartmentTab, {
  type IncomingDepartmentRequest,
  type PeriodItem
} from './IncomingDepartmentTab.vue';
import ArchiveDepartmentTab, { type ArchiveDepartmentRequest } from './ArchiveDepartmentTab.vue';
import EmployeeCabinet from '@/views/Employee/EmployeeCabinet.vue';
import {
  ShieldCheck,
  Briefcase,
  Building2,
  Network,
  Users,
  Inbox,
  Award,
  Archive,
  UserCheck,
  X,
  FileText,
  History,
  AlertCircle,
  Check,
  Clock
} from 'lucide-vue-next';

interface DepartmentProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  role_code: string;
  role_name: string;
  department_id?: number;
  department_name?: string;
  region_id?: number;
  region_name?: string;
  is_central?: boolean;
  divisions_count?: number;
  total_employees?: number;
  service_years?: number;
  base_days?: number;
  bonus_days?: number;
  vacation_days_available?: number;
}

const profile = ref<DepartmentProfile | null>(null);
const activeTab = ref<'incoming' | 'archive' | 'my_vacation'>('incoming');

// Руководители департаментов и заместители ДЭР (is_central = false) могут подавать собственную заявку на отпуск (летит в HR ЦА id = 4).
// Руководители департаментов и заместители ЦА (is_central = true) заблокированы на подачу.
const canSubmitOwnVacation = computed(() => {
  if (!profile.value) return false;
  if (profile.value.is_central === false) return true;
  if (profile.value.region_id && Number(profile.value.region_id) !== 1) return true;
  return false;
});

const incomingRequests = ref<IncomingDepartmentRequest[]>([]);
const archiveRequests = ref<ArchiveDepartmentRequest[]>([]);
const completeness = ref<any | null>(null);
const submittingDeptPackage = ref(false);
const submittingLeadershipPackage = ref(false);

const loadingIncoming = ref(false);
const loadingArchive = ref(false);

// Состояние модального окна «Подробно»
const detailsModalOpen = ref(false);
const loadingDetails = ref(false);
const modalTab = ref<'info' | 'history'>('info');
const selectedDetails = ref<any | null>(null);

const fetchProfile = async () => {
  try {
    const res = await api.get('/department/me');
    profile.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки профиля начальника департамента:', err);
  }
};

const fetchCompleteness = async () => {
  try {
    const res = await api.get('/department/completeness');
    completeness.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки комплектности департамента:', err);
  }
};

const fetchIncoming = async () => {
  loadingIncoming.value = true;
  try {
    const res = await api.get('/department/requests/incoming');
    incomingRequests.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки входящих заявок департамента:', err);
  } finally {
    loadingIncoming.value = false;
  }
};

const fetchArchive = async () => {
  loadingArchive.value = true;
  try {
    const res = await api.get('/department/requests/archive');
    archiveRequests.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки архива департамента:', err);
  } finally {
    loadingArchive.value = false;
  }
};

const loadAllData = async () => {
  await Promise.all([fetchProfile(), fetchCompleteness(), fetchIncoming(), fetchArchive()]);
};

const handleSubmitDepartmentPackage = async () => {
  if (!completeness.value?.can_submit_department_package) return;
  submittingDeptPackage.value = true;
  try {
    const res = await api.post('/department/submit-package', {
      target_year: completeness.value.target_year
    });
    alert(res.data?.message || 'Весь Департамент успешно утвержден и отправлен в Отдел кадров (HR)!');
    await loadAllData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Ошибка при отправке пакета Департамента в HR');
  } finally {
    submittingDeptPackage.value = false;
  }
};

const handleSubmitLeadershipPackage = async () => {
  if (!completeness.value?.leadership_package?.can_submit_to_ca) return;
  submittingLeadershipPackage.value = true;
  try {
    const res = await api.post('/department/submit-leadership-package', {
      target_year: completeness.value.target_year
    });
    alert(res.data?.message || 'Пакет руководства департамента ДЭР (Начальник + Зам) успешно отправлен Кадровику ЦА!');
    await loadAllData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Ошибка при отправке пакета руководства ДЭР в ЦА');
  } finally {
    submittingLeadershipPackage.value = false;
  }
};

const openDetailsModal = async (requestId: number) => {
  detailsModalOpen.value = true;
  loadingDetails.value = true;
  modalTab.value = 'info';
  selectedDetails.value = null;

  try {
    const res = await api.get(`/department/requests/${requestId}`);
    selectedDetails.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки деталей заявки:', err);
  } finally {
    loadingDetails.value = false;
  }
};

const closeDetailsModal = () => {
  detailsModalOpen.value = false;
  selectedDetails.value = null;
};

const buildApprovalSteps = (req: any) => {
  const stageOrder = ['EMPLOYEE', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'HR', 'ACCOUNTANT', 'COMPLETED'];
  const currentIdx = stageOrder.indexOf(req.current_stage || 'DEPARTMENT_HEAD');
  const statusCode = req.status_code || '';

  const getStepState = (stepIdx: number) => {
    if (statusCode === 'REJECTED' && stepIdx === currentIdx) return 'rejected';
    if (statusCode === 'REVISION' && stepIdx === 0) return 'active';
    if (stepIdx < currentIdx || req.current_stage === 'COMPLETED') return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return [
    {
      roleTitle: '1. Сотрудник (Инициатор)',
      personName: `${req.last_name} ${req.first_name}`,
      state: 'done',
      decisionText: 'Заявка сформирована и отправлена'
    },
    {
      roleTitle: '2. Начальник управления',
      personName: req.division_head_name || 'Начальник управления',
      state: getStepState(1),
      decisionText:
        getStepState(1) === 'done'
          ? 'Согласовано в управлении'
          : getStepState(1) === 'rejected'
          ? 'Отказано'
          : 'На рассмотрении'
    },
    {
      roleTitle: '3. Начальник департамента',
      personName: req.department_head_name || 'Начальник департамента',
      state: getStepState(2),
      decisionText:
        getStepState(2) === 'done'
          ? 'Утверждено и передано в ОК'
          : getStepState(2) === 'rejected'
          ? 'Отказано департаментом'
          : getStepState(2) === 'active'
          ? 'Ожидает вашего решения'
          : 'Ожидает очереди'
    },
    {
      roleTitle: '4. Отдел кадров (ОК)',
      personName: req.hr_name || 'Специалист ОК',
      state: getStepState(3),
      decisionText:
        getStepState(3) === 'done'
          ? 'Приказ оформлен'
          : getStepState(3) === 'active'
          ? 'Оформление приказа в ОК'
          : 'Ожидает очереди'
    },
    {
      roleTitle: '5. Бухгалтерия',
      personName: req.accountant_name || 'Бухгалтер',
      state: getStepState(4),
      decisionText:
        getStepState(4) === 'done' || req.current_stage === 'COMPLETED'
          ? 'Расчёт произведён'
          : getStepState(4) === 'active'
          ? 'Начисление отпускных'
          : 'Ожидает очереди'
    }
  ];
};

const getInitials = (last?: string, first?: string) => {
  const l = (last || '').trim()[0] || '';
  const f = (first || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'НД';
};

const formatModalReqNum = (raw?: string) => {
  if (!raw) return 'Заявка № 1';
  if (/^Заявка\s*№/i.test(raw)) return raw;
  return 'Заявка № 1';
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

watch(activeTab, (newTab, oldTab) => {
  if (oldTab === 'my_vacation' && newTab !== 'my_vacation') {
    loadAllData();
  }
});

onMounted(() => {
  loadAllData();
});
</script>

<style scoped>
.department-cabinet {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ВЕРХНИЙ ПРОФИЛЬ (КАК В КАБИНЕТЕ СОТРУДНИКА И НАЧАЛЬНИКА УПРАВЛЕНИЯ) */
.profile-hero-card {
  background: #ffffff;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}

.hero-top-banner {
  background: linear-gradient(125deg, #0f172a 0%, #1e293b 55%, #1d4ed8 100%);
  padding: 26px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  color: #ffffff;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-avatar {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f97316 0%, #c2410c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.55rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.35);
  flex-shrink: 0;
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.badge-tab {
  background: rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-role {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(249, 115, 22, 0.25);
  border: 1px solid rgba(251, 146, 60, 0.45);
  color: #ffedd5;
  padding: 3px 11px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
}

.hero-name {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.hero-pos {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.hero-limit-box {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
  padding: 16px 22px;
  border-radius: 14px;
  min-width: 260px;
}

.limit-caption {
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.limit-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.limit-num {
  font-size: 2rem;
  font-weight: 800;
  color: #34d399;
  line-height: 1;
}

.limit-unit {
  font-size: 0.88rem;
  color: #e2e8f0;
}

.limit-pills {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
}

.lp-base {
  background: rgba(255, 255, 255, 0.12);
  padding: 3px 8px;
  border-radius: 6px;
  color: #cbd5e1;
}

.lp-bonus {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 700;
}

/* 5 ПЛИТОК ПОД БАННЕРОМ */
.hero-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  padding: 18px 24px;
  background: #ffffff;
}

.info-tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
}

.tile-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-blue { background: #eff6ff; color: #2563eb; }
.icon-purple { background: #f3e8ff; color: #7e22ce; }
.icon-amber { background: #fef3c7; color: #d97706; }
.icon-rose { background: #ffedd5; color: #ea580c; }
.icon-green { background: #ecfdf5; color: #059669; }

.tile-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.03em;
}

.tile-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.tile-sub {
  font-size: 0.75rem;
  color: #64748b;
}

/* ВКЛАДКИ */
.cabinet-tabs-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  background: #ffffff;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
}

.tab-btn {
  flex: 1;
  min-width: 220px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 12px 18px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.tab-btn.active {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.tab-counter {
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
}

.tab-btn.active .tab-counter {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.counter-hot {
  background: #ef4444;
  color: #ffffff;
}

.cabinet-content-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

/* МОДАЛЬНОЕ ОКНО «ПОДРОБНО» */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-window {
  background: #ffffff;
  border-radius: 18px;
  max-width: 860px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.modal-header {
  padding: 20px 24px;
  background: #0f172a;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.modal-badge {
  background: #2563eb;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 0.85rem;
  white-space: nowrap;
}

.modal-title-wrap h3 {
  margin: 0 0 4px;
  font-size: 1.15rem;
}

.modal-title-wrap p {
  margin: 0;
  font-size: 0.84rem;
  color: #cbd5e1;
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

.modal-subtabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  gap: 16px;
}

.subtab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.subtab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.modal-body {
  padding: 22px 24px;
  overflow-y: auto;
  flex: 1;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.meta-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-lbl {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 700;
}

.meta-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.status-highlight {
  color: #2563eb;
}

.modal-revision-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 18px;
  font-size: 0.88rem;
}

.modal-revision-alert p {
  margin: 4px 0 0;
}

/* МАРШРУТ СОГЛАСОВАНИЯ */
.route-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 18px;
}

.route-box h4 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  color: #0f172a;
}

.route-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 10px;
}

.route-step {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-done {
  border-color: #a7f3d0;
  background: #f0fdf4;
}

.step-active {
  border-color: #93c5fd;
  background: #eff6ff;
}

.step-rejected {
  border-color: #fecaca;
  background: #fef2f2;
}

.step-indicator {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
  background: #e2e8f0;
  color: #475569;
}

.step-done .step-indicator {
  background: #10b981;
  color: #ffffff;
}

.step-active .step-indicator {
  background: #2563eb;
  color: #ffffff;
}

.step-rejected .step-indicator {
  background: #dc2626;
  color: #ffffff;
}

.step-role {
  font-size: 0.76rem;
  font-weight: 700;
  color: #475569;
}

.step-person {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
}

.step-decision {
  font-size: 0.76rem;
  color: #64748b;
}

/* ТАБЛИЦА ПЕРИОДОВ В МОДАЛКЕ */
.modal-periods-block h4 {
  margin: 0 0 10px;
  font-size: 0.95rem;
}

.mp-table {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.mp-head,
.mp-row {
  display: grid;
  grid-template-columns: 90px 1fr 1fr 1.1fr 1.3fr;
  padding: 10px 14px;
  font-size: 0.85rem;
  align-items: center;
  gap: 8px;
}

.mp-head {
  background: #f1f5f9;
  font-weight: 700;
  color: #475569;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.mp-row {
  border-top: 1px solid #e2e8f0;
}

.mp-part {
  font-weight: 700;
  color: #2563eb;
}

.mp-hol {
  color: #d97706;
}

/* ТАЙМЛАЙН ИСТОРИИ */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  padding-left: 18px;
  border-left: 2px solid #cbd5e1;
}

.timeline-item {
  position: relative;
}

.tl-dot {
  position: absolute;
  left: -24px;
  top: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2563eb;
  border: 2px solid #ffffff;
}

.tl-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}

.tl-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tl-action {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.9rem;
}

.tl-date {
  font-size: 0.78rem;
  color: #64748b;
}

.tl-actor {
  font-size: 0.83rem;
  color: #334155;
}

.tl-role {
  color: #64748b;
  margin-left: 4px;
}

.tl-comment {
  margin-top: 6px;
  padding: 8px 10px;
  background: #ffffff;
  border-left: 3px solid #f59e0b;
  border-radius: 6px;
  font-size: 0.84rem;
  color: #78350f;
}

.modal-footer {
  padding: 14px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.btn-close-modal {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
}

.modal-loading {
  padding: 40px;
  text-align: center;
  color: #64748b;
}

.loader-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.embedded-my-vacation :deep(.profile-hero-card) {
  display: none;
}

/* ШЛЮЗ ДЕПАРТАМЕНТА (100% КОМПЛЕКТНОСТЬ УПРАВЛЕНИЙ) */
.dept-gateway-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-left: 5px solid #f59e0b;
  border-radius: 16px;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
}

.dept-gateway-card.gw-ready {
  border-color: #6ee7b7;
  border-left-color: #10b981;
  background: linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%);
}

.dept-gateway-card.gw-sent {
  border-color: #93c5fd;
  border-left-color: #2563eb;
  background: #f8fafc;
}

.dg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.dg-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dg-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 800;
}

.dg-badge.b-wait {
  background: #fef3c7;
  color: #b45309;
}

.dg-badge.b-ok {
  background: #dcfce7;
  color: #047857;
}

.dg-badge.b-sent {
  background: #dbeafe;
  color: #1d4ed8;
}

.dg-stat {
  font-size: 0.9rem;
  color: #0f172a;
}

.btn-submit-dept-package {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);
  transition: all 0.15s;
}

.btn-submit-dept-package:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(5, 150, 105, 0.36);
}

.btn-submit-dept-package:disabled {
  background: #cbd5e1;
  color: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}

.dg-divisions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.dg-div-pill {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dg-div-pill.div-ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #065f46;
}

.dg-div-pill.div-pending {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.div-pill-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
}

.div-cnt {
  font-weight: 800;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
}

.div-pill-sub {
  font-size: 0.78rem;
  opacity: 0.9;
}

.dg-blockers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.82rem;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 8px 12px;
  border-radius: 8px;
}
</style>
