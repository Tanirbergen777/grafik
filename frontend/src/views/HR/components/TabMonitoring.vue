<template>
  <div class="monitoring-tab">
    <!-- Верхняя панель управления и выбор года -->
    <div class="mon-top-bar">
      <div>
        <h3>Мониторинг сдачи графиков отпусков</h3>
      </div>

      <div class="mon-controls">
        <div class="year-picker">
          <Calendar :size="15" />
          <span>Плановый год:</span>
          <select v-model="selectedYear" class="year-select" @change="refreshActiveMode">
            <option v-for="y in availableYears" :key="y" :value="y">{{ y }} год</option>
          </select>
        </div>

        <button class="btn-refresh" @click="refreshActiveMode" :disabled="loadingDeps || loadingDer">
          <RefreshCw :size="15" :class="{ spin: loadingDeps || loadingDer }" />
          <span>Обновить</span>
        </button>
      </div>
    </div>

    <!-- ДВЕ ВНУТРЕННИЕ ВКЛАДКИ МОНИТОРИНГА (ДЛЯ КАДРОВИКА ЦЕНТРАЛЬНОГО АППАРАТА) -->
    <div v-if="isCentral" class="inner-subtabs-bar">
      <button
        type="button"
        class="inner-subtab-btn"
        :class="{ active: monitoringMode === 'central' }"
        @click="monitoringMode = 'central'"
      >
        <Building2 :size="16" />
        <span>1. Центральный Аппарат (Департаменты и управления)</span>
        <span class="subtab-pill">{{ totalSubmitted }}/{{ totalStaff }}</span>
      </button>

      <button
        type="button"
        class="inner-subtab-btn"
        :class="{ active: monitoringMode === 'der' }"
        @click="switchToDerMode"
      >
        <Globe :size="16" />
        <span>2. Мониторинг ДЭР (Начальники департаментов и Заместители)</span>
        <span class="subtab-pill">{{ derSubmittedCount }}/{{ derTotalLeaders }}</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- ВНУТРЕННЯЯ ВКЛАДКА 1: ДЕПАРТАМЕНТЫ И УПРАВЛЕНИЯ (ЦА ИЛИ СВОЕГО РЕГИОНА)   -->
    <!-- ========================================================================= -->
    <template v-if="monitoringMode === 'central' || !isCentral">
      <!-- Общие показатели по ведомству / региону -->
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-icon blue"><Building2 :size="20" /></div>
          <div>
            <div class="kpi-lbl">ДЕПАРТАМЕНТОВ</div>
            <div class="kpi-val">{{ departments.length }}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon purple"><Users :size="20" /></div>
          <div>
            <div class="kpi-lbl">ВСЕГО В ШТАТЕ</div>
            <div class="kpi-val">{{ totalStaff }} чел.</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon green"><CheckCircle2 :size="20" /></div>
          <div>
            <div class="kpi-lbl">СДАЛИ ГРАФИК</div>
            <div class="kpi-val text-green">{{ totalSubmitted }} чел.</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon amber"><PieChart :size="20" /></div>
          <div>
            <div class="kpi-lbl">ОБЩИЙ ПРОГРЕСС</div>
            <div class="kpi-val text-blue">{{ overallPercent }}%</div>
          </div>
        </div>
      </div>

      <div v-if="loadingDeps" class="empty-box">
        <div class="loader-spinner"></div>
        <p>Загрузка данных мониторинга департаментов...</p>
      </div>

      <!-- Сетка карточек Департаментов с круговым прогресс-баром -->
      <div v-else class="departments-grid">
        <div
          v-for="dep in departments"
          :key="dep.id"
          class="dep-card"
          @click="openDepartmentModal(dep)"
        >
          <div class="dep-card-main">
            <div class="dep-info">
              <div class="dep-tag">
                <Building2 :size="13" />
                <span>Управлений: {{ dep.divisions_count || 0 }}</span>
              </div>
              <h4 class="dep-name">{{ dep.name }}</h4>

              <div class="dep-metrics">
                <div class="metric-row">
                  <span class="m-dot dot-slate"></span>
                  <span class="m-label">Всего в штате:</span>
                  <strong class="m-val">{{ dep.total_employees }}</strong>
                </div>
                <div class="metric-row">
                  <span class="m-dot dot-green"></span>
                  <span class="m-label">Сдали график:</span>
                  <strong class="m-val text-green">{{ dep.submitted_count }}</strong>
                </div>
                <div class="metric-row">
                  <span class="m-dot dot-amber"></span>
                  <span class="m-label">Ожидается:</span>
                  <strong class="m-val text-amber">
                    {{ Math.max(0, dep.total_employees - dep.submitted_count) }}
                  </strong>
                </div>
              </div>
            </div>

            <!-- Круговой SVG прогресс-бар -->
            <div class="circle-progress-box">
              <svg class="progress-ring" width="88" height="88" viewBox="0 0 88 88">
                <circle
                  class="ring-bg"
                  cx="44"
                  cy="44"
                  r="36"
                  fill="transparent"
                  stroke-width="8"
                />
                <circle
                  class="ring-fill"
                  :class="getRingColorClass(getPercent(dep.submitted_count, dep.total_employees))"
                  cx="44"
                  cy="44"
                  r="36"
                  fill="transparent"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="getDashOffset(dep.submitted_count, dep.total_employees)"
                />
              </svg>
              <div class="ring-label">
                <span class="pct-num">{{ getPercent(dep.submitted_count, dep.total_employees) }}%</span>
                <span class="pct-sub">сдано</span>
              </div>
            </div>
          </div>

          <div class="dep-card-footer">
            <span
              class="status-pill-sm"
              :class="
                getPercent(dep.submitted_count, dep.total_employees) === 100
                  ? 'pill-complete'
                  : 'pill-inprogress'
              "
            >
              {{
                getPercent(dep.submitted_count, dep.total_employees) === 100
                  ? '✓ График сдан на 100%'
                  : 'В процессе сбора заявок'
              }}
            </span>

            <span class="open-hint">
              <span>Управления</span>
              <ChevronRight :size="15" />
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========================================================================= -->
    <!-- ВНУТРЕННЯЯ ВКЛАДКА 2: МОНИТОРИНГ РУКОВОДСТВА ДЭР (ДЛЯ КАДРОВИКА ЦА)       -->
    <!-- ========================================================================= -->
    <template v-else>
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-icon blue"><Globe :size="20" /></div>
          <div>
            <div class="kpi-lbl">РЕГИОНОВ ДЭР</div>
            <div class="kpi-val">{{ derRegions.length }}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon purple"><Users :size="20" /></div>
          <div>
            <div class="kpi-lbl">РУКОВОДИТЕЛЕЙ И ЗАМОВ ДЭР</div>
            <div class="kpi-val">{{ derTotalLeaders }} чел.</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon green"><CheckCircle2 :size="20" /></div>
          <div>
            <div class="kpi-lbl">ПОСТУПИЛО В КАДРЫ ЦА</div>
            <div class="kpi-val text-green">{{ derSubmittedCount }} чел.</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon amber"><PieChart :size="20" /></div>
          <div>
            <div class="kpi-lbl">ПРОГРЕСС ПО ДЭР</div>
            <div class="kpi-val text-blue">{{ getPercent(derSubmittedCount, derTotalLeaders) }}%</div>
          </div>
        </div>
      </div>

      <!-- Карточки территориальных ДЭР -->
      <div class="departments-grid">
        <div
          v-for="reg in derRegions"
          :key="reg.region_id"
          class="dep-card"
          :class="{ 'card-active-filter': selectedDerRegionId === reg.region_id }"
          @click="selectedDerRegionId = selectedDerRegionId === reg.region_id ? 'ALL' : reg.region_id"
        >
          <div class="dep-card-main">
            <div class="dep-info">
              <div class="dep-tag">
                <Globe :size="13" />
                <span>Территориальный орган</span>
              </div>
              <h4 class="dep-name">{{ reg.region_name }}</h4>

              <div class="dep-metrics">
                <div class="metric-row">
                  <span class="m-dot dot-slate"></span>
                  <span class="m-label">Нач. деп. и Замов:</span>
                  <strong class="m-val">{{ reg.total_leaders }}</strong>
                </div>
                <div class="metric-row">
                  <span class="m-dot dot-green"></span>
                  <span class="m-label">Поступило в HR ЦА:</span>
                  <strong class="m-val text-green">{{ reg.submitted_to_ca_count }}</strong>
                </div>
                <div class="metric-row">
                  <span class="m-dot dot-amber"></span>
                  <span class="m-label">Ожидается:</span>
                  <strong class="m-val text-amber">
                    {{ Math.max(0, reg.total_leaders - reg.submitted_to_ca_count) }}
                  </strong>
                </div>
              </div>
            </div>

            <div class="circle-progress-box">
              <svg class="progress-ring" width="88" height="88" viewBox="0 0 88 88">
                <circle class="ring-bg" cx="44" cy="44" r="36" fill="transparent" stroke-width="8" />
                <circle
                  class="ring-fill"
                  :class="getRingColorClass(getPercent(reg.submitted_to_ca_count, reg.total_leaders))"
                  cx="44"
                  cy="44"
                  r="36"
                  fill="transparent"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="getDashOffset(reg.submitted_to_ca_count, reg.total_leaders)"
                />
              </svg>
              <div class="ring-label">
                <span class="pct-num">{{ getPercent(reg.submitted_to_ca_count, reg.total_leaders) }}%</span>
                <span class="pct-sub">в ЦА</span>
              </div>
            </div>
          </div>

          <div class="dep-card-footer">
            <span class="status-pill-sm" :class="selectedDerRegionId === reg.region_id ? 'pill-complete' : 'pill-inprogress'">
              {{ selectedDerRegionId === reg.region_id ? 'Фильтр включен' : 'Нажмите для фильтрации таблицы' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Поименная таблица Начальников департаментов и Заместителей ДЭР -->
      <div class="der-table-section">
        <div class="der-table-header">
          <h4>
            Список руководства ДЭР, направляющего заявки в Кадры ЦА ({{ filteredDerLeaders.length }} чел.)
          </h4>
          <button
            v-if="selectedDerRegionId !== 'ALL'"
            type="button"
            class="btn-reset-reg"
            @click="selectedDerRegionId = 'ALL'"
          >
            Показать все регионы ДЭР
          </button>
        </div>

        <div class="der-table-wrap">
          <table class="der-table">
            <thead>
              <tr>
                <th style="width: 50px">№</th>
                <th>Регион ДЭР</th>
                <th>Департамент</th>
                <th>ФИО руководителя / заместителя</th>
                <th>Роль / Должность</th>
                <th>Статус поступления в HR ЦА</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in filteredDerLeaders" :key="item.id">
                <td class="col-num">{{ idx + 1 }}</td>
                <td>
                  <span class="region-badge">{{ item.region_name }}</span>
                </td>
                <td>
                  <strong>{{ item.department_name }}</strong>
                </td>
                <td>
                  <div class="leader-fio">
                    {{ item.last_name }} {{ item.first_name }} {{ item.middle_name || '' }}
                  </div>
                </td>
                <td>
                  <span class="role-tag" :class="item.role_code === 'DEPARTMENT_HEAD' ? 'tag-head' : 'tag-deputy'">
                    {{ item.role_name }}
                  </span>
                </td>
                <td>
                  <span v-if="item.has_submitted" class="st-badge st-ok">
                    <CheckCircle2 :size="15" />
                    <span>Поступило в Кадры ЦА ({{ item.request_number }})</span>
                  </span>
                  <span v-else-if="item.is_local_submitted" class="st-badge st-local">
                    <Clock :size="15" />
                    <span>
                      {{
                        item.is_department_checked
                          ? 'Утверждено нач. деп. ДЭР (ожидает совместной отправки в ЦА)'
                          : 'На согласовании у начальника департамента ДЭР'
                      }}
                    </span>
                  </span>
                  <span v-else class="st-badge st-wait">
                    <XCircle :size="15" />
                    <span>Ожидается подача</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Модалка 1: Список управлений выбранного департамента -->
    <DivisionsModal
      :is-open="isDivisionsModalOpen"
      :department="selectedDepartment"
      :divisions="divisions"
      :loading="loadingDivisions"
      :target-year="selectedYear"
      @close="closeAllModals"
      @select-division="openEmployeesModal"
    />

    <!-- Модалка 2: Поименный список сотрудников выбранного управления -->
    <EmployeesModal
      :is-open="isEmployeesModalOpen"
      :division="selectedDivision"
      :department-name="selectedDepartment?.name"
      :employees="employees"
      :loading="loadingEmployees"
      :target-year="selectedYear"
      @close="closeAllModals"
      @back-to-divisions="backToDivisionsModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api';
import DivisionsModal, {
  type MonitoringDepartmentItem,
  type MonitoringDivisionItem
} from '../modals/DivisionsModal.vue';
import EmployeesModal, { type MonitoringEmployeeItem } from '../modals/EmployeesModal.vue';
import {
  Calendar,
  RefreshCw,
  Building2,
  Globe,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  PieChart,
  ChevronRight
} from 'lucide-vue-next';

withDefaults(
  defineProps<{
    isCentral?: boolean;
  }>(),
  {
    isCentral: true
  }
);

const currentYear = new Date().getFullYear();
const selectedYear = ref<number>(currentYear + 1);
const availableYears = [currentYear, currentYear + 1, currentYear + 2];

const monitoringMode = ref<'central' | 'der'>('central');

const departments = ref<MonitoringDepartmentItem[]>([]);
const divisions = ref<MonitoringDivisionItem[]>([]);
const employees = ref<MonitoringEmployeeItem[]>([]);

// Данные мониторинга руководства ДЭР
const derRegions = ref<any[]>([]);
const derLeaders = ref<any[]>([]);
const derTotalLeaders = ref(0);
const derSubmittedCount = ref(0);
const selectedDerRegionId = ref<number | 'ALL'>('ALL');

const loadingDeps = ref(false);
const loadingDer = ref(false);
const loadingDivisions = ref(false);
const loadingEmployees = ref(false);

const selectedDepartment = ref<MonitoringDepartmentItem | null>(null);
const selectedDivision = ref<MonitoringDivisionItem | null>(null);

const isDivisionsModalOpen = ref(false);
const isEmployeesModalOpen = ref(false);

const radius = 36;
const circumference = 2 * Math.PI * radius;

const totalStaff = computed(() =>
  departments.value.reduce((acc, d) => acc + Number(d.total_employees || 0), 0)
);

const totalSubmitted = computed(() =>
  departments.value.reduce((acc, d) => acc + Number(d.submitted_count || 0), 0)
);

const overallPercent = computed(() => {
  if (!totalStaff.value) return 0;
  return Math.min(100, Math.round((totalSubmitted.value / totalStaff.value) * 100));
});

const filteredDerLeaders = computed(() => {
  if (selectedDerRegionId.value === 'ALL') return derLeaders.value;
  return derLeaders.value.filter(l => Number(l.region_id) === Number(selectedDerRegionId.value));
});

const getPercent = (submitted: number, total: number) => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((Number(submitted || 0) / Number(total)) * 100));
};

const getDashOffset = (submitted: number, total: number) => {
  const pct = getPercent(submitted, total);
  return circumference - (pct / 100) * circumference;
};

const getRingColorClass = (pct: number) => {
  if (pct === 100) return 'stroke-green';
  if (pct >= 50) return 'stroke-blue';
  return 'stroke-amber';
};

const fetchDepartments = async () => {
  loadingDeps.value = true;
  try {
    const res = await api.get('/hr/monitoring/departments', {
      params: { target_year: selectedYear.value }
    });
    departments.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки мониторинга департаментов:', err);
  } finally {
    loadingDeps.value = false;
  }
};

const fetchDerLeadership = async () => {
  loadingDer.value = true;
  try {
    const res = await api.get('/hr/monitoring/der-leadership', {
      params: { target_year: selectedYear.value }
    });
    derRegions.value = res.data?.regions || [];
    derLeaders.value = res.data?.leaders || [];
    derTotalLeaders.value = res.data?.total_leaders || 0;
    derSubmittedCount.value = res.data?.submitted_to_ca_count || 0;
  } catch (err) {
    console.error('Ошибка загрузки мониторинга руководства ДЭР:', err);
  } finally {
    loadingDer.value = false;
  }
};

const switchToDerMode = () => {
  monitoringMode.value = 'der';
  fetchDerLeadership();
};

const refreshActiveMode = () => {
  fetchDepartments();
  fetchDerLeadership();
};

const openDepartmentModal = async (dep: MonitoringDepartmentItem) => {
  selectedDepartment.value = dep;
  isEmployeesModalOpen.value = false;
  isDivisionsModalOpen.value = true;
  loadingDivisions.value = true;
  divisions.value = [];

  try {
    const res = await api.get(`/hr/monitoring/departments/${dep.id}/divisions`, {
      params: { target_year: selectedYear.value }
    });
    divisions.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки управлений департамента:', err);
  } finally {
    loadingDivisions.value = false;
  }
};

const openEmployeesModal = async (div: MonitoringDivisionItem) => {
  selectedDivision.value = div;
  isDivisionsModalOpen.value = false;
  isEmployeesModalOpen.value = true;
  loadingEmployees.value = true;
  employees.value = [];

  try {
    const res = await api.get(`/hr/monitoring/divisions/${div.id}/employees`, {
      params: { target_year: selectedYear.value }
    });
    employees.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки сотрудников управления:', err);
  } finally {
    loadingEmployees.value = false;
  }
};

const backToDivisionsModal = () => {
  isEmployeesModalOpen.value = false;
  isDivisionsModalOpen.value = true;
};

const closeAllModals = () => {
  isDivisionsModalOpen.value = false;
  isEmployeesModalOpen.value = false;
};

onMounted(() => {
  fetchDepartments();
  fetchDerLeadership();
});
</script>

<style scoped>
.monitoring-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mon-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.mon-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.mon-top-bar p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.mon-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Внутренние вкладки ЦА vs ДЭР */
.inner-subtabs-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  background: #f1f5f9;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.inner-subtab-btn {
  flex: 1;
  min-width: 240px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.inner-subtab-btn.active {
  background: #ffffff;
  color: #1d4ed8;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.subtab-pill {
  background: #e2e8f0;
  color: #334155;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
}

.inner-subtab-btn.active .subtab-pill {
  background: #dbeafe;
  color: #1d4ed8;
}

.year-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 9px;
  font-size: 0.84rem;
  font-weight: 600;
  color: #334155;
}

.year-select {
  border: none;
  background: transparent;
  font-weight: 800;
  color: #0f172a;
  font-size: 0.86rem;
  outline: none;
  cursor: pointer;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  font-size: 0.84rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* KPI Полоса */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-icon.blue { background: #eff6ff; color: #2563eb; }
.kpi-icon.purple { background: #f3e8ff; color: #7e22ce; }
.kpi-icon.green { background: #ecfdf5; color: #059669; }
.kpi-icon.amber { background: #fef3c7; color: #d97706; }

.kpi-lbl {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.04em;
}

.kpi-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.text-green { color: #059669; }
.text-blue { color: #2563eb; }
.text-amber { color: #d97706; }

/* Сетка карточек Департаментов / ДЭР */
.departments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 18px;
}

.dep-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
  transition: all 0.18s ease;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
}

.dep-card:hover,
.dep-card.card-active-filter {
  border-color: #60a5fa;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.09);
}

.dep-card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.dep-info {
  flex: 1;
}

.dep-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  background: #f1f5f9;
  color: #475569;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.dep-name {
  margin: 0 0 12px;
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.35;
}

.dep-metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.85rem;
  color: #475569;
}

.m-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot-slate { background: #64748b; }
.dot-green { background: #10b981; }
.dot-amber { background: #f59e0b; }

.m-val {
  color: #0f172a;
}

/* Круговой прогресс-бар */
.circle-progress-box {
  position: relative;
  width: 88px;
  height: 88px;
  flex-shrink: 0;
}

.progress-ring {
  transform: rotate(-90deg);
}

.ring-bg {
  stroke: #f1f5f9;
}

.ring-fill {
  transition: stroke-dashoffset 0.5s ease;
}

.stroke-green { stroke: #10b981; }
.stroke-blue { stroke: #3b82f6; }
.stroke-amber { stroke: #f59e0b; }

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.pct-num {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
}

.pct-sub {
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 600;
}

.dep-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.status-pill-sm {
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
}

.pill-complete {
  background: #ecfdf5;
  color: #047857;
}

.pill-inprogress {
  background: #eff6ff;
  color: #1d4ed8;
}

.open-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #2563eb;
}

/* Таблица руководства ДЭР */
.der-table-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.der-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.der-table-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #0f172a;
}

.btn-reset-reg {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  color: #2563eb;
  cursor: pointer;
}

.der-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  background: #ffffff;
}

.der-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.der-table th {
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.der-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.der-table tr:last-child td {
  border-bottom: none;
}

.col-num {
  color: #64748b;
  font-weight: 700;
}

.region-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.leader-fio {
  font-weight: 700;
  color: #0f172a;
}

.role-tag {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.tag-head {
  background: #ffedd5;
  color: #9a3412;
}

.tag-deputy {
  background: #f3e8ff;
  color: #6b21a8;
}

.st-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.st-ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.st-local {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.st-wait {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.empty-box {
  padding: 48px 20px;
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
</style>
