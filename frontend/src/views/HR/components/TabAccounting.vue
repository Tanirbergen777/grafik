<template>
  <div class="accounting-tab">
    <!-- Шапка вкладки и главная кнопка формирования Excel-реестра -->
    <div class="acc-top-bar">
      <div>
        <h3>Формирование</h3>
        <p v-if="isCentral && accountingMode === 'der'">
          Пакеты руководства территориальных ДЭР (Начальники департаментов и их Заместители), поступившие в Кадры ЦА
        </p>
        <p v-else>
          Заявки, утвержденные начальниками департаментов. Выберите подразделение и нажмите «Сформировать».
        </p>
      </div>

      <div class="acc-actions">
        <button class="btn-refresh" @click="fetchReadyRequests" :disabled="loading || generating">
          <RefreshCw :size="15" :class="{ spin: loading }" />
          <span>Обновить</span>
        </button>

        <button
          class="btn-generate-excel"
          :disabled="selectedIds.length === 0 || generating"
          @click="handleGenerateExcel"
        >
          <FileSpreadsheet :size="18" />
          <span v-if="generating">Формирование Excel...</span>
          <span v-else>
            Сформировать ({{ selectedIds.length }})
          </span>
        </button>
      </div>
    </div>

    <!-- ДВЕ ВНУТРЕННИЕ ВКЛАДКИ ДЛЯ КАДРОВИКА ЦА: 1) Сотрудники ЦА, 2) Руководство ДЭР -->
    <div v-if="isCentral" class="inner-subtabs-bar">
      <button
        type="button"
        class="inner-subtab-btn"
        :class="{ active: accountingMode === 'central' }"
        @click="switchAccountingMode('central')"
      >
        <Building2 :size="16" />
        <span>1. Сотрудники Центрального Аппарата</span>
        <span class="subtab-pill">{{ centralRequests.length }}</span>
      </button>

      <button
        type="button"
        class="inner-subtab-btn"
        :class="{ active: accountingMode === 'der' }"
        @click="switchAccountingMode('der')"
      >
        <Globe :size="16" />
        <span>2. Руководство ДЭР (Руководитель и Заместители департаментов)</span>
        <span class="subtab-pill" :class="{ 'pill-hot': derRequests.length > 0 }">
          {{ derRequests.length }}
        </span>
      </button>
    </div>

    <!-- Уведомление об отправке -->
    <Transition name="fade">
      <div v-if="feedbackMsg" class="toast-banner" :class="feedbackType">
        <CheckCircle2 v-if="feedbackType === 'success'" :size="18" />
        <AlertCircle v-else :size="18" />
        <span>{{ feedbackMsg }}</span>
      </div>
    </Transition>

    <!-- Панель фильтров: Год, Регион (для ДЭР), Департамент, Управление -->
    <div class="filters-panel">
      <div class="filter-group">
        <label>Плановый год</label>
        <select v-model="yearFilter" class="filter-select" @change="fetchReadyRequests">
          <option value="ALL">Все годы</option>
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }} год</option>
        </select>
      </div>

      <div v-if="isCentral && accountingMode === 'der'" class="filter-group">
        <label>Регион ДЭР</label>
        <select v-model="selectedRegionName" class="filter-select" @change="onRegionChange">
          <option value="ALL">Все регионы ДЭР ({{ modeRequests.length }})</option>
          <option v-for="rName in uniqueRegionNames" :key="rName" :value="rName">
            {{ rName }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Департамент</label>
        <select v-model="selectedDepartment" class="filter-select" @change="onDepartmentChange">
          <option value="ALL">Все департаменты ({{ modeRequests.length }})</option>
          <option v-for="dep in uniqueDepartments" :key="dep" :value="dep">
            {{ dep }}
          </option>
        </select>
      </div>

      <div v-if="accountingMode === 'central' || !isCentral" class="filter-group">
        <label>Управление</label>
        <select v-model="selectedDivision" class="filter-select" @change="syncSelectionWithFilter">
          <option value="ALL">Все управления</option>
          <option v-for="div in uniqueDivisions" :key="div" :value="div">
            {{ div }}
          </option>
        </select>
      </div>
    </div>

    <!-- Загрузка / Пусто -->
    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка утвержденных заявок, готовых к отправке в бухгалтерию...</p>
    </div>

    <div v-else-if="filteredRequests.length === 0" class="empty-box">
      <div class="empty-icon-circle">
        <FileCheck2 :size="34" />
      </div>
      <h4 v-if="isCentral && accountingMode === 'der'">
        Нет готовых пакетов от руководства территориальных ДЭР
      </h4>
      <h4 v-else>Нет готовых заявок для формирования реестра</h4>
      <p v-if="isCentral && accountingMode === 'der'">
        Заявки руководства ДЭР появятся здесь после того, как в соответствующем департаменте ДЭР Заместитель начальника департамента подаст заявку, а Начальник департамента утвердит её и отправит пакет вместе со своей заявкой в ЦА.
      </p>
      <p v-else>
        Все утвержденные начальниками департаментов заявки уже сформированы в пакеты и отправлены в бухгалтерию (см. вкладку «Архив реестров»).
      </p>
    </div>

    <!-- Двухуровневая таблица строго по формату График отп.2027 УРКП.xlsx -->
    <div v-else class="urkp-table-wrap">
      <table class="urkp-table">
        <thead>
          <tr>
            <th rowspan="2" class="col-check">
              <input
                type="checkbox"
                :checked="isAllFilteredSelected"
                @change="toggleSelectAll"
                title="Выбрать все в списке"
              />
            </th>
            <th rowspan="2" class="col-num">№</th>
            <th rowspan="2">ФИО</th>
            <th rowspan="2">Должность</th>
            <th rowspan="2">Подразделение</th>
            <th colspan="2" class="group-th">
              Дата с указанием количества дней отпуска I часть
            </th>
            <th colspan="2" class="group-th">
              Дата с указанием количества дней отпуска II часть
            </th>
            <th rowspan="2" class="col-benefit">
              С выплатой леч. пособия (месяц)
            </th>
          </tr>
          <tr>
            <th class="sub-th">Месяц</th>
            <th class="sub-th">Кол-во дней</th>
            <th class="sub-th">Месяц</th>
            <th class="sub-th">Кол-во дней</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(req, idx) in filteredRequests"
            :key="req.id"
            :class="{ 'row-selected': selectedIds.includes(req.id) }"
            @click="toggleRowSelection(req.id)"
          >
            <td class="col-check" @click.stop>
              <input
                type="checkbox"
                :value="req.id"
                v-model="selectedIds"
              />
            </td>
            <td class="col-num">{{ idx + 1 }}</td>
            <td class="col-fio">
              <div class="fio-main">
                {{ req.last_name }} {{ req.first_name }} {{ req.middle_name || '' }}
              </div>
              <div class="fio-sub">{{ req.request_number }} • {{ req.target_year }} г.</div>
            </td>
            <td class="col-pos">{{ req.position_title || 'Сотрудник' }}</td>
            <td class="col-unit">
              <div v-if="req.region_name && Number(req.region_id) !== 1" class="unit-reg">
                {{ req.region_name }}
              </div>
              <div class="unit-dep">{{ req.department_name }}</div>
              <div class="unit-div">{{ req.division_name }}</div>
            </td>

            <!-- I часть -->
            <td class="col-center month-cell">
              <span v-if="getPart(req, 1)" class="month-pill">
                {{ getMonthNameRu(getPart(req, 1)?.start_date) }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="col-center">
              <strong v-if="getPart(req, 1)">{{ getPart(req, 1)?.vacation_days }}</strong>
              <span v-else class="text-muted">—</span>
            </td>

            <!-- II часть -->
            <td class="col-center month-cell">
              <span v-if="getPart(req, 2)" class="month-pill">
                {{ getMonthNameRu(getPart(req, 2)?.start_date) }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="col-center">
              <strong v-if="getPart(req, 2)">{{ getPart(req, 2)?.vacation_days }}</strong>
              <span v-else class="text-muted">—</span>
            </td>

            <!-- С выплатой леч. пособия (месяц) -->
            <td class="col-center">
              <span class="benefit-pill">
                {{ getBenefitMonth(req) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api';
import {
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Building2,
  Globe
} from 'lucide-vue-next';

export interface ReadyPeriodItem {
  id: number;
  part_number: number;
  start_date: string;
  end_date: string;
  vacation_days: number;
  holidays_count: number;
  with_health_benefit?: boolean;
}

export interface ReadyAccountingRequest {
  id: number;
  request_number: string;
  target_year: number;
  total_allowed_days: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  role_code?: string;
  role_name?: string;
  position_title?: string;
  region_id?: number;
  is_central_region?: boolean;
  region_name?: string;
  department_id: number;
  department_name: string;
  division_id: number;
  division_name: string;
  periods_count: number;
  periods: ReadyPeriodItem[];
}

const props = withDefaults(
  defineProps<{
    isCentral?: boolean;
  }>(),
  {
    isCentral: true
  }
);

const emit = defineEmits<{
  (e: 'generated'): void;
}>();

const MONTH_NAMES_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь'
];

const currentYear = new Date().getFullYear();
const availableYears = [currentYear, currentYear + 1, currentYear + 2];

const accountingMode = ref<'central' | 'der'>('central');
const yearFilter = ref<string | number>('ALL');
const selectedRegionName = ref<string>('ALL');
const selectedDepartment = ref<string>('ALL');
const selectedDivision = ref<string>('ALL');

const requests = ref<ReadyAccountingRequest[]>([]);
const selectedIds = ref<number[]>([]);
const loading = ref(false);
const generating = ref(false);

const feedbackMsg = ref('');
const feedbackType = ref<'success' | 'error'>('success');

const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
  feedbackMsg.value = msg;
  feedbackType.value = type;
  setTimeout(() => {
    feedbackMsg.value = '';
  }, 5000);
};

// Разделение готовых заявок для Кадровика ЦА:
// 1) Сотрудники Центрального Аппарата (region_id === 1)
// 2) Руководство ДЭР (region_id !== 1: Начальники департаментов и Заместители ДЭР)
const centralRequests = computed(() =>
  requests.value.filter(r => Number(r.region_id || 1) === 1)
);

const derRequests = computed(() =>
  requests.value.filter(r => Number(r.region_id || 1) !== 1)
);

const modeRequests = computed(() => {
  if (!props.isCentral) return requests.value;
  return accountingMode.value === 'der' ? derRequests.value : centralRequests.value;
});

const uniqueRegionNames = computed(() => {
  const set = new Set<string>();
  modeRequests.value.forEach(r => {
    if (r.region_name) set.add(r.region_name);
  });
  return Array.from(set);
});

const uniqueDepartments = computed(() => {
  const set = new Set<string>();
  modeRequests.value.forEach(r => {
    if (selectedRegionName.value === 'ALL' || r.region_name === selectedRegionName.value) {
      if (r.department_name) set.add(r.department_name);
    }
  });
  return Array.from(set);
});

const uniqueDivisions = computed(() => {
  const set = new Set<string>();
  modeRequests.value.forEach(r => {
    if (selectedDepartment.value === 'ALL' || r.department_name === selectedDepartment.value) {
      if (r.division_name) set.add(r.division_name);
    }
  });
  return Array.from(set);
});

const filteredRequests = computed(() => {
  return modeRequests.value.filter(r => {
    if (selectedRegionName.value !== 'ALL' && r.region_name !== selectedRegionName.value) {
      return false;
    }
    if (selectedDepartment.value !== 'ALL' && r.department_name !== selectedDepartment.value) {
      return false;
    }
    if (selectedDivision.value !== 'ALL' && r.division_name !== selectedDivision.value) {
      return false;
    }
    return true;
  });
});

const isAllFilteredSelected = computed(() => {
  if (filteredRequests.value.length === 0) return false;
  return filteredRequests.value.every(r => selectedIds.value.includes(r.id));
});

const previewTargetYear = computed(() => {
  if (yearFilter.value !== 'ALL') return yearFilter.value;
  return filteredRequests.value[0]?.target_year || currentYear + 1;
});

const previewSubtitle = computed(() => {
  const reg =
    accountingMode.value === 'der' && selectedRegionName.value !== 'ALL'
      ? selectedRegionName.value
      : '';
  const dep =
    selectedDepartment.value !== 'ALL'
      ? selectedDepartment.value
      : uniqueDepartments.value.length === 1
      ? uniqueDepartments.value[0]
      : accountingMode.value === 'der'
      ? 'Руководство ДЭР'
      : 'Все департаменты';
  const div =
    selectedDivision.value !== 'ALL'
      ? selectedDivision.value
      : uniqueDivisions.value.length === 1
      ? uniqueDivisions.value[0]
      : '';
  return [reg, dep, div].filter(Boolean).join(' ');
});

const syncSelectionWithFilter = () => {
  selectedIds.value = filteredRequests.value.map(r => r.id);
};

const switchAccountingMode = (mode: 'central' | 'der') => {
  accountingMode.value = mode;
  selectedRegionName.value = 'ALL';
  selectedDepartment.value = 'ALL';
  selectedDivision.value = 'ALL';
  syncSelectionWithFilter();
};

const onRegionChange = () => {
  selectedDepartment.value = 'ALL';
  selectedDivision.value = 'ALL';
  syncSelectionWithFilter();
};

const onDepartmentChange = () => {
  selectedDivision.value = 'ALL';
  syncSelectionWithFilter();
};

const toggleSelectAll = () => {
  if (isAllFilteredSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredRequests.value.map(r => r.id);
  }
};

const toggleRowSelection = (id: number) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

const getPart = (req: ReadyAccountingRequest, partNum: number): ReadyPeriodItem | null => {
  if (!req.periods || !req.periods.length) return null;
  return req.periods.find(p => Number(p.part_number) === partNum) || null;
};

const getMonthNameRu = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return MONTH_NAMES_RU[d.getMonth()] || '—';
};

const getBenefitMonth = (req: ReadyAccountingRequest) => {
  const p1 = getPart(req, 1);
  const p2 = getPart(req, 2);
  if (!p1 && !p2) return '—';
  if (p1 && !p2) return getMonthNameRu(p1.start_date);
  if (!p1 && p2) return getMonthNameRu(p2.start_date);

  if (p1?.with_health_benefit) return getMonthNameRu(p1.start_date);
  if (p2?.with_health_benefit) return getMonthNameRu(p2.start_date);
  return getMonthNameRu(p1?.start_date);
};

const fetchReadyRequests = async () => {
  loading.value = true;
  try {
    const res = await api.get('/hr/accounting/ready', {
      params: { target_year: yearFilter.value }
    });
    requests.value = res.data;
    syncSelectionWithFilter();
  } catch (err) {
    console.error('Ошибка загрузки готовых заявок:', err);
  } finally {
    loading.value = false;
  }
};

const handleGenerateExcel = async () => {
  if (selectedIds.value.length === 0) return;
  generating.value = true;

  try {
    const selectedRows = requests.value.filter(r => selectedIds.value.includes(r.id));
    const targetYear = selectedRows[0]?.target_year || currentYear + 1;

    const res = await api.post(
      '/hr/accounting/generate-excel',
      {
        target_year: targetYear,
        request_ids: selectedIds.value
      },
      {
        responseType: 'blob'
      }
    );

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const subtitleClean = previewSubtitle.value.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').trim() || 'УРКП';
    link.setAttribute('download', `График отп.${targetYear} ${subtitleClean}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    showFeedback(
      `Excel-реестр успешно сформирован и скачан! Отправлено заявок в бухгалтерию: ${selectedIds.value.length}. Заявки перемещены в «Архив реестров».`,
      'success'
    );

    await fetchReadyRequests();
    emit('generated');
  } catch (err: any) {
    console.error('Ошибка выгрузки Excel:', err);
    showFeedback('Ошибка при формировании Excel-реестра', 'error');
  } finally {
    generating.value = false;
  }
};

onMounted(() => {
  fetchReadyRequests();
});
</script>

<style scoped>
.accounting-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.acc-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.acc-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.acc-top-bar p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.acc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

.pill-hot {
  background: #10b981 !important;
  color: #ffffff !important;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 9px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-weight: 700;
  font-size: 0.85rem;
  color: #334155;
  cursor: pointer;
}

.btn-generate-excel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);
  transition: all 0.15s;
}

.btn-generate-excel:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(5, 150, 105, 0.36);
}

.btn-generate-excel:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.toast-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
}

.toast-banner.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.toast-banner.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* Фильтры */
.filters-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
}

.filter-select {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.88rem;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  cursor: pointer;
}

/* Предпросмотр шапки Excel */
.excel-preview-header {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 14px 18px;
}

.ep-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #b45309;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.ep-lines {
  text-align: center;
  font-family: 'Times New Roman', Times, serif;
  color: #0f172a;
}

.ep-line1,
.ep-line2 {
  font-size: 1rem;
  font-weight: 700;
}

.ep-line3 {
  font-size: 1.02rem;
  font-weight: 700;
  color: #1d4ed8;
  margin-top: 2px;
}

/* Таблица по шаблону УРКП */
.urkp-table-wrap {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  overflow-x: auto;
  background: #ffffff;
}

.urkp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.urkp-table th,
.urkp-table td {
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  vertical-align: middle;
}

.urkp-table thead th {
  background: #f1f5f9;
  color: #1e293b;
  font-weight: 800;
  text-align: center;
  font-size: 0.78rem;
}

.group-th {
  background: #e0f2fe !important;
  color: #0369a1 !important;
}

.sub-th {
  background: #f8fafc !important;
  font-size: 0.75rem !important;
}

.col-check {
  width: 42px;
  text-align: center;
}

.col-num {
  width: 46px;
  text-align: center;
  font-weight: 700;
  color: #64748b;
}

.col-center {
  text-align: center;
}

.urkp-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
}

.urkp-table tbody tr:hover {
  background: #f8fafc;
}

.row-selected {
  background: #f0fdf4 !important;
}

.fio-main {
  font-weight: 700;
  color: #0f172a;
}

.fio-sub {
  font-size: 0.75rem;
  color: #64748b;
}

.unit-reg {
  display: inline-block;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  margin-bottom: 2px;
}

.unit-dep {
  font-weight: 700;
  color: #334155;
  font-size: 0.8rem;
}

.unit-div {
  font-size: 0.76rem;
  color: #64748b;
}

.month-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 0.82rem;
}

.benefit-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  font-weight: 800;
  font-size: 0.82rem;
}

.text-muted {
  color: #94a3b8;
}

.empty-box {
  padding: 48px 20px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  color: #64748b;
}

.empty-icon-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.empty-box h4 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 1.05rem;
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

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
