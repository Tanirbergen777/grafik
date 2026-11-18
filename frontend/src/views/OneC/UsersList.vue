<template>
  <div class="onec-container">
    <!-- ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ (TOASTS) -->
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast-item', `toast-${toast.type}`]"
      >
        <CheckCircle2 v-if="toast.type === 'success'" :size="20" class="toast-icon" />
        <AlertCircle v-else :size="20" class="toast-icon" />
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" @click="removeToast(toast.id)">
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>

    <!-- РЕЖИМ 1С: ПОЛНЫЙ ФУНКЦИОНАЛ РЕЕСТРА СОТРУДНИКОВ -->
    <div class="onec-view">
          <!-- Блок фильтрации и статистики -->
          <div class="controls-card">
            <div class="controls-top">
              <div class="controls-title-area">
                <div class="sync-badge">
                  <span class="pulse-dot"></span>
                  <Database :size="14" />
                  <span>Интеграция с 1С</span>
                </div>
                <h2>Реестр сотрудников и трудовой стаж</h2>
                <p class="desc">
                  Управление выслугой лет, автоматический расчёт лимитов отпуска по Закону РК и мониторинг подачи заявок
                </p>
              </div>

              <!-- Интерактивные счётчики статистики (работают как быстрые фильтры) -->
              <div class="stats-group">
                <button
                    type="button"
                    class="stat-badge"
                    :class="{ active: statusFilter === 'all' }"
                    @click="statusFilter = 'all'"
                >
                  <div class="stat-icon-wrap blue">
                    <Users :size="18" />
                  </div>
                  <div class="stat-text">
                    <span class="num">{{ employees.length }}</span>
                    <span class="lbl">Всего в штате</span>
                  </div>
                </button>

                <button
                    type="button"
                    class="stat-badge green"
                    :class="{ active: statusFilter === 'submitted' }"
                    @click="statusFilter = statusFilter === 'submitted' ? 'all' : 'submitted'"
                >
                  <div class="stat-icon-wrap emerald">
                    <FileCheck2 :size="18" />
                  </div>
                  <div class="stat-text">
                    <span class="num">{{ submittedCount }}</span>
                    <span class="lbl">Подали заявку</span>
                  </div>
                </button>

                <button
                    type="button"
                    class="stat-badge red"
                    :class="{ active: statusFilter === 'not_submitted' }"
                    @click="statusFilter = statusFilter === 'not_submitted' ? 'all' : 'not_submitted'"
                >
                  <div class="stat-icon-wrap rose">
                    <FileClock :size="18" />
                  </div>
                  <div class="stat-text">
                    <span class="num">{{ notSubmittedCount }}</span>
                    <span class="lbl">Ожидают подачи</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Панель фильтров -->
            <div class="filters-grid">
              <!-- Фильтр по Департаментам -->
              <div class="filter-item">
                <label>Департамент</label>
                <div class="input-icon-wrap">
                  <Building2 :size="17" class="f-icon" />
                  <select v-model="selectedDepartmentId" @change="onDepartmentChange" class="filter-select">
                    <option value="">Все департаменты</option>
                    <option v-for="dep in departments" :key="dep.id" :value="dep.id">
                      {{ dep.name }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Фильтр по Управлениям -->
              <div class="filter-item">
                <label>Управление</label>
                <div class="input-icon-wrap">
                  <Briefcase :size="17" class="f-icon" />
                  <select
                      v-model="selectedDivisionId"
                      @change="fetchEmployees"
                      class="filter-select"
                      :disabled="!selectedDepartmentId && availableDivisions.length === 0"
                  >
                    <option value="">Все управления</option>
                    <option v-for="div in availableDivisions" :key="div.id" :value="div.id">
                      {{ div.name }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Поиск сотрудника -->
              <div class="filter-item search-item">
                <label>Быстрый поиск</label>
                <div class="input-icon-wrap">
                  <Search :size="17" class="f-icon" />
                  <input
                      type="text"
                      v-model="searchQuery"
                      placeholder="Введите ФИО или должность..."
                      class="filter-input"
                  />
                  <button v-if="searchQuery" class="clear-input-btn" @click="searchQuery = ''">
                    <X :size="14" />
                  </button>
                </div>
              </div>

              <Transition name="fade">
                <button
                    v-if="hasActiveFilters"
                    class="btn-reset"
                    @click="resetFilters"
                >
                  <RotateCcw :size="15" />
                  <span>Сбросить</span>
                </button>
              </Transition>
            </div>
          </div>

          <!-- Скелетон-загрузка карточек -->
          <div v-if="loading" class="cards-grid">
            <div v-for="n in 6" :key="'skel-' + n" class="user-card skeleton-card">
              <div class="card-head">
                <div class="skel skel-avatar"></div>
                <div class="skel-info">
                  <div class="skel skel-line w-70"></div>
                  <div class="skel skel-line w-45"></div>
                </div>
              </div>
              <div class="skel skel-strip"></div>
              <div class="skel skel-box"></div>
              <div class="skel skel-exp"></div>
              <div class="skel skel-btn"></div>
            </div>
          </div>

          <!-- Если список пуст -->
          <div v-else-if="filteredEmployees.length === 0" class="state-box empty">
            <div class="empty-icon-circle">
              <Search :size="32" />
            </div>
            <h3>Сотрудники не найдены</h3>
            <p>По выбранным параметрам фильтрации нет подходящих записей</p>
            <button class="btn-empty-reset" @click="resetFilters">
              <RotateCcw :size="16" />
              <span>Сбросить все фильтры</span>
            </button>
          </div>

          <!-- СЕТКА КАРТОЧЕК СОТРУДНИКОВ -->
          <TransitionGroup v-else name="cards" tag="div" class="cards-grid">
            <div
                v-for="user in filteredEmployees"
                :key="user.id"
                class="user-card"
                :class="{
                'card-modified': isModified(user),
                'card-saved': recentlySavedIds.has(user.id)
              }"
            >
              <!-- Шапка карточки -->
              <div class="card-head">
                <div class="avatar" :style="{ background: getAvatarGradient(user.id) }">
                  {{ getInitials(user) }}
                </div>
                <div class="head-info">
                  <h3 class="name" :title="`${user.last_name} ${user.first_name} ${user.middle_name || ''}`">
                    {{ user.last_name }} {{ user.first_name }}
                    <span v-if="user.middle_name" class="middle">{{ user.middle_name }}</span>
                  </h3>
                  <span class="pos-tag">
                    {{ user.position_title || 'Должность не указана' }}
                  </span>
                </div>
              </div>

              <!-- Индикатор подачи заявки -->
              <div class="status-strip" :class="user.has_submitted ? 'strip-green' : 'strip-red'">
                <CheckCircle2 v-if="user.has_submitted" :size="15" />
                <Clock v-else :size="15" />
                <span>{{ user.has_submitted ? 'Заявка на отпуск подана' : 'Заявка на отпуск не подана' }}</span>
              </div>

              <!-- Подразделение -->
              <div class="unit-box">
                <div class="unit-row">
                  <span class="unit-lbl">
                    <Building2 :size="13" />
                    Департамент
                  </span>
                  <span class="unit-val" :title="user.department_name">
                    {{ user.department_name || 'Не указан' }}
                  </span>
                </div>
                <div class="unit-row">
                  <span class="unit-lbl">
                    <Briefcase :size="13" />
                    Управление
                  </span>
                  <span class="unit-val" :title="user.division_name">
                    {{ user.division_name || 'Не указано' }}
                  </span>
                </div>
              </div>

              <!-- Редактирование стажа со степпером -->
              <div class="exp-edit-card" :class="{ 'exp-changed': isModified(user) }">
                <div class="exp-meta">
                  <div class="exp-title-row">
                    <Award :size="15" class="exp-icon" />
                    <span class="exp-title">Стаж в 1С:</span>
                  </div>
                  <span class="exp-hint">{{ formatYearsLabel(user.service_years) }}</span>
                </div>

                <div class="exp-action">
                  <button
                      v-if="isModified(user)"
                      type="button"
                      class="btn-undo-mini"
                      title="Отменить изменение"
                      @click="undoChange(user)"
                  >
                    <RotateCcw :size="13" />
                  </button>

                  <div class="mini-stepper">
                    <button
                        type="button"
                        class="step-btn"
                        :disabled="user.service_years <= 0 || savingId === user.id"
                        @click="changeExperience(user, -1)"
                    >
                      <Minus :size="13" />
                    </button>
                    <input
                        type="number"
                        min="0"
                        max="70"
                        v-model.number="user.service_years"
                        @blur="normalizeExperience(user)"
                        class="exp-input"
                    />
                    <button
                        type="button"
                        class="step-btn"
                        :disabled="savingId === user.id"
                        @click="changeExperience(user, 1)"
                    >
                      <Plus :size="13" />
                    </button>
                  </div>

                  <button
                      class="btn-save"
                      :class="{
                      'btn-save-ready': isModified(user),
                      'btn-save-done': recentlySavedIds.has(user.id)
                    }"
                      :disabled="!isModified(user) || savingId === user.id"
                      @click="saveExperience(user)"
                  >
                    <Loader2 v-if="savingId === user.id" :size="15" class="spin-icon" />
                    <Check v-else-if="recentlySavedIds.has(user.id)" :size="15" />
                    <Save v-else :size="15" />
                    <span>
                      {{
                        savingId === user.id
                            ? '...'
                            : recentlySavedIds.has(user.id)
                                ? 'Ок'
                                : 'Сохранить'
                      }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Кнопка "Подробно" -->
              <button class="btn-details" @click="openDetails(user.id)">
                <span>Подробная карточка и расчёт</span>
                <ChevronRight :size="16" class="arr-icon" />
              </button>
            </div>
          </TransitionGroup>
        </div>

    <!-- МОДАЛЬНОЕ ОКНО "ПОДРОБНО" -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-window">
          <div class="modal-top">
            <div class="modal-hdr">
              <div class="m-icon-box">
                <CalendarDays :size="20" />
              </div>
              <div>
                <h3>Карточка сотрудника из 1С</h3>
                <span class="m-sub">Детальные кадровые данные и расчёт нормы отпуска</span>
              </div>
            </div>
            <button class="m-close" @click="closeModal" aria-label="Закрыть">
              <X :size="18" />
            </button>
          </div>

          <div v-if="selectedEmployee" class="modal-content">
            <!-- Профиль в модалке -->
            <div class="m-profile">
              <div class="m-avatar" :style="{ background: getAvatarGradient(selectedEmployee.id) }">
                {{ getInitials(selectedEmployee) }}
              </div>
              <div class="m-profile-text">
                <h4>{{ selectedEmployee.last_name }} {{ selectedEmployee.first_name }} {{ selectedEmployee.middle_name || '' }}</h4>
                <div class="m-pos-badge">
                  <Briefcase :size="13" />
                  <span>{{ selectedEmployee.position_title || 'Должность не указана' }}</span>
                </div>
              </div>
            </div>

            <!-- Сетка свойств -->
            <div class="m-grid">
              <div class="m-field">
                <span class="f-lbl">Департамент</span>
                <span class="f-val">{{ selectedEmployee.department_name || 'Не указан' }}</span>
              </div>
              <div class="m-field">
                <span class="f-lbl">Управление</span>
                <span class="f-val">{{ selectedEmployee.division_name || 'Не указано' }}</span>
              </div>
              <div class="m-field">
                <span class="f-lbl">Выслуга лет (1С)</span>
                <span class="f-val highlight">{{ formatYearsLabel(selectedEmployee.service_years) }}</span>
              </div>
              <div class="m-field">
                <span class="f-lbl">Статус графика</span>
                <span class="f-val status-inline" :class="selectedEmployee.has_submitted ? 'text-green' : 'text-red'">
                  <CheckCircle2 v-if="selectedEmployee.has_submitted" :size="14" />
                  <Clock v-else :size="14" />
                  {{ selectedEmployee.has_submitted ? 'Заявка подана' : 'Заявка не подана' }}
                </span>
              </div>
            </div>

            <!-- Расчёт дней по закону РК -->
            <div class="vacation-calc">
              <div class="calc-row">
                <div class="calc-title-wrap">
                  <Sparkles :size="16" class="calc-spark" />
                  <span class="calc-txt">Норматив отпуска по Закону РК:</span>
                </div>
                <span class="calc-val">{{ selectedEmployee.total_allowed_days }} дней</span>
              </div>
              <p class="calc-info">
                30 базовых дней + дополнительные дни за трудовой стаж ({{ formatYearsLabel(selectedEmployee.service_years) }}).
              </p>
            </div>
          </div>

          <div class="modal-bottom">
            <button class="btn-m-close" @click="closeModal">Закрыть</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api';
import {
  Database,
  Users,
  FileCheck2,
  FileClock,
  Building2,
  Briefcase,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Plus,
  Minus,
  Save,
  Check,
  Loader2,
  ChevronRight,
  X,
  Sparkles,
  CalendarDays
} from 'lucide-vue-next';

// Интерфейсы
interface Employee {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  department_name?: string;
  division_name?: string;
  position_title?: string;
  service_years: number;
  has_submitted: boolean;
}

interface EmployeeDetail extends Employee {
  total_allowed_days: number;
}

interface Department {
  id: number;
  name: string;
}

interface Division {
  id: number;
  department_id: number;
  name: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}

// Уведомления
const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;

const showToast = (type: 'success' | 'error', title: string, message: string) => {
  const id = ++toastIdCounter;
  toasts.value.push({ id, type, title, message });
  setTimeout(() => removeToast(id), 4500);
};

const removeToast = (id: number) => {
  toasts.value = toasts.value.filter(t => t.id !== id);
};

// Состояние реестра 1С
const employees = ref<Employee[]>([]);
const originalExperience = ref<Record<number, number>>({});
const departments = ref<Department[]>([]);
const divisions = ref<Division[]>([]);
const loading = ref(false);
const savingId = ref<number | null>(null);
const recentlySavedIds = ref<Set<number>>(new Set());

const selectedDepartmentId = ref<string | number>('');
const selectedDivisionId = ref<string | number>('');
const searchQuery = ref('');
const statusFilter = ref<'all' | 'submitted' | 'not_submitted'>('all');

// Модальное окно "Подробно"
const showModal = ref(false);
const selectedEmployee = ref<EmployeeDetail | null>(null);

// Статистика
const submittedCount = computed(() => employees.value.filter(e => e.has_submitted).length);
const notSubmittedCount = computed(() => employees.value.filter(e => !e.has_submitted).length);

const hasActiveFilters = computed(() => {
  return Boolean(
      selectedDepartmentId.value ||
      selectedDivisionId.value ||
      searchQuery.value.trim() ||
      statusFilter.value !== 'all'
  );
});

// Фильтрация управлений по выбранному департаменту
const availableDivisions = computed(() => {
  if (!selectedDepartmentId.value) {
    return divisions.value;
  }
  const depId = Number(selectedDepartmentId.value);
  return divisions.value.filter(d => d.department_id === depId);
});

// Фильтрация списка на клиенте (поисковая строка + статус заявки)
const filteredEmployees = computed(() => {
  let list = employees.value;

  if (statusFilter.value === 'submitted') {
    list = list.filter(emp => emp.has_submitted);
  } else if (statusFilter.value === 'not_submitted') {
    list = list.filter(emp => !emp.has_submitted);
  }

  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return list;

  return list.filter(emp => {
    const fullName = `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.toLowerCase();
    const pos = (emp.position_title || '').toLowerCase();
    return fullName.includes(q) || pos.includes(q);
  });
});

// Проверка изменения стажа
const isModified = (user: Employee): boolean => {
  return (
      originalExperience.value[user.id] !== undefined &&
      Number(user.service_years) !== originalExperience.value[user.id]
  );
};

const changeExperience = (user: Employee, delta: number) => {
  const nextVal = (Number(user.service_years) || 0) + delta;
  user.service_years = Math.max(0, nextVal);
};

const normalizeExperience = (user: Employee) => {
  if (
      user.service_years === null ||
      user.service_years === undefined ||
      isNaN(user.service_years) ||
      user.service_years < 0
  ) {
    user.service_years = 0;
  } else {
    user.service_years = Math.floor(user.service_years);
  }
};

const undoChange = (user: Employee) => {
  const orig = originalExperience.value[user.id];
  if (orig !== undefined) {
    user.service_years = orig;
  }
};

const formatYearsLabel = (years: number) => {
  const n = Math.abs(Number(years) || 0);
  const n10 = n % 10;
  const n100 = n % 100;
  if (n100 >= 11 && n100 <= 19) return `${n} полных лет`;
  if (n10 === 1) return `${n} полный год`;
  if (n10 >= 2 && n10 <= 4) return `${n} полных года`;
  return `${n} полных лет`;
};

// Смена департамента
const onDepartmentChange = () => {
  selectedDivisionId.value = '';
  fetchEmployees();
};

const resetFilters = () => {
  selectedDepartmentId.value = '';
  selectedDivisionId.value = '';
  searchQuery.value = '';
  statusFilter.value = 'all';
  fetchEmployees();
};

// Загрузка структуры (департаменты и управления)
const fetchStructure = async () => {
  try {
    const res = await api.get('/shared/structure');
    departments.value = res.data.departments;
    divisions.value = res.data.divisions;
  } catch (err) {
    console.error('Ошибка загрузки отделов:', err);
  }
};

// Загрузка списка сотрудников с фильтрами
const fetchEmployees = async () => {
  loading.value = true;
  try {
    let url = '/onec/employees?';
    const params: string[] = [];

    if (selectedDepartmentId.value) {
      params.push(`department_id=${selectedDepartmentId.value}`);
    }
    if (selectedDivisionId.value) {
      params.push(`division_id=${selectedDivisionId.value}`);
    }
    url += params.join('&');

    const res = await api.get(url);
    employees.value = res.data;

    // Сохраняем слепок стажа для отслеживания изменений
    const snapshot: Record<number, number> = {};
    employees.value.forEach(emp => {
      snapshot[emp.id] = Number(emp.service_years) || 0;
    });
    originalExperience.value = snapshot;
  } catch (err) {
    console.error('Ошибка при загрузке сотрудников:', err);
    showToast('error', 'Ошибка загрузки', 'Не удалось загрузить данные сотрудников из 1С');
  } finally {
    loading.value = false;
  }
};

// Сохранение стажа
const saveExperience = async (user: Employee) => {
  normalizeExperience(user);
  savingId.value = user.id;
  try {
    const res = await api.patch(`/onec/employees/${user.id}/experience`, {
      service_years: user.service_years
    });

    originalExperience.value[user.id] = user.service_years;
    recentlySavedIds.value.add(user.id);
    setTimeout(() => recentlySavedIds.value.delete(user.id), 2500);

    const days = res.data?.data?.new_total_allowed_days;
    showToast(
        'success',
        'Стаж обновлён в 1С',
        `${user.last_name} ${user.first_name}: ${formatYearsLabel(user.service_years)}. Положено отпуска: ${days} дн.`
    );
  } catch (err) {
    console.error('Ошибка сохранения стажа:', err);
    showToast('error', 'Ошибка сохранения', `Не удалось сохранить стаж для ${user.last_name}`);
  } finally {
    savingId.value = null;
  }
};

// Открытие модального окна "Подробно"
const openDetails = async (id: number) => {
  try {
    const res = await api.get(`/onec/employees/${id}`);
    const match = employees.value.find(e => e.id === id);
    selectedEmployee.value = {
      ...res.data,
      has_submitted: match ? match.has_submitted : false
    };
    showModal.value = true;
  } catch (err) {
    console.error('Ошибка загрузки карточки:', err);
    showToast('error', 'Ошибка', 'Не удалось открыть детальную карточку сотрудника');
  }
};

const closeModal = () => {
  showModal.value = false;
  selectedEmployee.value = null;
};

// Инициалы и градиенты аватаров
const getInitials = (user: { last_name?: string; first_name?: string }) => {
  const l = (user.last_name || '').trim()[0] || '';
  const f = (user.first_name || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase();
};

const avatarGradients = [
  'linear-gradient(135deg, #2563eb, #1d4ed8)',
  'linear-gradient(135deg, #059669, #047857)',
  'linear-gradient(135deg, #7c3aed, #6d28d9)',
  'linear-gradient(135deg, #db2777, #be185d)',
  'linear-gradient(135deg, #d97706, #b45309)',
  'linear-gradient(135deg, #0284c7, #0369a1)'
];
const getAvatarGradient = (id: number) => avatarGradients[id % avatarGradients.length];

onMounted(async () => {
  await Promise.all([fetchStructure(), fetchEmployees()]);
});
</script>

<style scoped>
.portal-app {
  min-height: 100vh;
  background: radial-gradient(circle at top right, #eff6ff 0%, #f8fafc 45%, #f1f5f9 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #0f172a;
}

/* ВЕРХНЯЯ ШАПКА (GLASSMORPHISM) */
.portal-header {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.03);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 14px 28px;
  display: flex;
  justify-content: right;
  flex-wrap: wrap;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.brand-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.system-tag {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.brand-sub {
  font-size: 0.8rem;
  color: #64748b;
  display: block;
  margin-top: 2px;
}

/* ВЫБОР ПОЛЬЗОВАТЕЛЯ */
.user-select-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 7px 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.02);
}

.picker-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.picker-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-dropdown {
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  font-size: 0.88rem;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  min-width: 330px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-dropdown:hover {
  border-color: #94a3b8;
}

.user-dropdown:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.role-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.pill-onec { background: #dbeafe; color: #1e40af; }
.pill-employee { background: #e0f2fe; color: #0369a1; }
.pill-division_head { background: #fef3c7; color: #92400e; }
.pill-department_head { background: #ffedd5; color: #9a3412; }
.pill-hr { background: #dcfce7; color: #166534; }
.pill-accountant { background: #f3e8ff; color: #6b21a8; }

/* ГЛАВНАЯ ЧАСТЬ */
.portal-main {
  max-width: 1400px;
  margin: 28px auto;
  padding: 0 28px 60px;
}

/* КАРТОЧКА УПРАВЛЕНИЯ И ФИЛЬТРОВ 1С */
.controls-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 26px 28px;
  box-shadow: 0 4px 24px -4px rgba(15, 23, 42, 0.04);
  border: 1px solid #e2e8f0;
  margin-bottom: 28px;
}

.controls-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 20px;
}

.sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.controls-top h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.desc {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 0.92rem;
}

/* ИНТЕРАКТИВНЫЕ КАРТОЧКИ СТАТИСТИКИ */
.stats-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 12px 18px;
  border-radius: 14px;
  min-width: 155px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.stat-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.05);
}

.stat-badge.active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.stat-badge.green.active {
  border-color: #10b981;
  background: #ecfdf5;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.stat-badge.red.active {
  border-color: #f43f5e;
  background: #fff1f2;
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
}

.stat-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-wrap.blue { background: #dbeafe; color: #2563eb; }
.stat-icon-wrap.emerald { background: #d1fae5; color: #059669; }
.stat-icon-wrap.rose { background: #ffe4e6; color: #e11d48; }

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-badge .num {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.15;
}

.stat-badge .lbl {
  font-size: 0.76rem;
  font-weight: 600;
  color: #64748b;
}

/* ПАНЕЛЬ ФИЛЬТРОВ */
.filters-grid {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
  min-width: 220px;
}

.filter-item label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.f-icon {
  position: absolute;
  left: 13px;
  color: #94a3b8;
  pointer-events: none;
  transition: color 0.2s;
}

.input-icon-wrap:focus-within .f-icon {
  color: #2563eb;
}

.filter-select,
.filter-input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  border: 1px solid #cbd5e1;
  border-radius: 11px;
  font-size: 0.9rem;
  background-color: #f8fafc;
  color: #0f172a;
  outline: none;
  transition: all 0.2s ease;
}

.filter-select:hover:not(:disabled),
.filter-input:hover {
  background-color: #ffffff;
  border-color: #94a3b8;
}

.filter-select:focus,
.filter-input:focus {
  background-color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.filter-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-item {
  flex: 1.4;
  min-width: 260px;
}

.clear-input-btn {
  position: absolute;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: #e2e8f0;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.clear-input-btn:hover {
  background: #cbd5e1;
  color: #0f172a;
}

.btn-reset {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border-radius: 11px;
  border: 1px solid #fecdd3;
  background: #fff1f2;
  color: #e11d48;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  height: 41px;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #ffe4e6;
  transform: translateY(-1px);
}

/* СЕТКА КАРТОЧЕК */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 22px;
}

.user-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.user-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 28px -6px rgba(15, 23, 42, 0.08);
  border-color: #cbd5e1;
}

.card-modified {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
}

.card-saved {
  border-color: #10b981 !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.16);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.05rem;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.head-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
}

.name {
  margin: 0;
  font-size: 1.04rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.middle {
  font-weight: 500;
  color: #64748b;
  font-size: 0.92rem;
}

.pos-tag {
  display: inline-block;
  align-self: flex-start;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
  padding: 3px 9px;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.status-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
}

.strip-green {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.strip-red {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

.unit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 0.84rem;
}

.unit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.unit-lbl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-weight: 500;
}

.unit-val {
  color: #1e293b;
  font-weight: 600;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 190px;
}

/* БЛОК РЕДАКТИРОВАНИЯ СТАЖА */
.exp-edit-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.2s;
}

.exp-changed {
  background: #fffbeb;
  border-color: #fde68a;
}

.exp-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exp-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.exp-icon {
  color: #2563eb;
}

.exp-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: #0f172a;
}

.exp-hint {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.exp-action {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-undo-mini {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  background: #fef3c7;
  color: #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-undo-mini:hover {
  background: #fde68a;
}

.mini-stepper {
  display: inline-flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 2px;
}

.step-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #475569;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.step-btn:hover:not(:disabled) {
  background: #e2e8f0;
  color: #0f172a;
}

.step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.exp-input {
  width: 38px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
  outline: none;
  -moz-appearance: textfield;
}

.exp-input::-webkit-outer-spin-button,
.exp-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: not-allowed;
  transition: all 0.2s;
}

.btn-save-ready {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border-color: transparent;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.25);
}

.btn-save-ready:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(16, 185, 129, 0.35);
}

.btn-save-done {
  background: #059669 !important;
  color: #ffffff !important;
  border-color: transparent !important;
}

.btn-details {
  width: 100%;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  background: #f8fafc;
  color: #2563eb;
  border: 1px solid #dbeafe;
  border-radius: 11px;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-details .arr-icon {
  transition: transform 0.2s ease;
}

.btn-details:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.btn-details:hover .arr-icon {
  transform: translateX(4px);
}

/* КАБИНЕТ КОНКРЕТНОГО СОТРУДНИКА */
.user-cabinet-view {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.cabinet-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 36px;
  max-width: 760px;
  width: 100%;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.cabinet-banner {
  display: flex;
  align-items: center;
  gap: 22px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f1f5f9;
}

.cabinet-avatar {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  font-weight: 800;
  flex-shrink: 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
}

.cabinet-hello {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #2563eb;
  margin-bottom: 4px;
}

.cabinet-title-block h2 {
  margin: 0 0 10px;
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cabinet-pos,
.cabinet-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 600;
}

.cabinet-pos {
  background: #eff6ff;
  color: #1d4ed8;
}

.cabinet-role {
  background: #f3e8ff;
  color: #7e22ce;
}

.cabinet-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 18px 20px;
  border-radius: 14px;
}

.detail-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cell-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.cell-val {
  font-size: 0.96rem;
  color: #0f172a;
  font-weight: 500;
}

.cell-val.bold { font-weight: 700; }

.status-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.development-notice {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fde68a;
  padding: 22px;
  border-radius: 16px;
}

.notice-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #ffffff;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.15);
}

.development-notice h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #92400e;
}

.development-notice p {
  margin: 0 0 6px;
  font-size: 0.9rem;
  color: #78350f;
  line-height: 1.5;
}

.notice-sub {
  color: #b45309 !important;
  font-size: 0.83rem !important;
  font-weight: 500;
}

.cabinet-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-back-onec {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.92rem;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  transition: all 0.2s;
}

.btn-back-onec:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
}

/* ПУСТОЕ СОСТОЯНИЕ И СКЕЛЕТОНЫ */
.state-box.empty {
  text-align: center;
  padding: 64px 24px;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
}

.empty-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.state-box h3 { margin: 0 0 6px; font-size: 1.15rem; color: #0f172a; }
.state-box p { margin: 0 0 18px; color: #64748b; font-size: 0.9rem; }

.btn-empty-reset {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.btn-empty-reset:hover {
  background: #f8fafc;
}

@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skel {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 800px 100%;
  animation: shimmer 1.6s infinite linear;
  border-radius: 8px;
}

.skel-avatar { width: 50px; height: 50px; border-radius: 14px; flex-shrink: 0; }
.skel-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.skel-line { height: 12px; }
.w-70 { width: 70%; }
.w-45 { width: 45%; }
.skel-strip { height: 34px; border-radius: 10px; }
.skel-box { height: 64px; border-radius: 12px; }
.skel-exp { height: 48px; border-radius: 12px; }
.skel-btn { height: 38px; border-radius: 11px; }

/* МОДАЛЬНОЕ ОКНО */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  overflow-y: auto;
}

.modal-window {
  background: #ffffff;
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35);
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  margin: auto;
}

.modal-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.modal-hdr {
  display: flex;
  align-items: center;
  gap: 12px;
}

.m-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-hdr h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.m-sub {
  font-size: 0.78rem;
  color: #64748b;
  display: block;
}

.m-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.m-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.modal-content {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.m-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.m-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  font-weight: 800;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.m-profile-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.m-profile h4 {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-pos-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  width: fit-content;
}

.m-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  background: #f8fafc;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.m-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.f-lbl {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.f-val {
  font-size: 0.88rem;
  color: #0f172a;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.f-val.highlight {
  color: #2563eb;
  font-weight: 700;
}

.text-green { color: #059669 !important; font-weight: 700; }
.text-red { color: #e11d48 !important; font-weight: 700; }

.vacation-calc {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  padding: 12px 16px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.calc-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.calc-spark { color: #059669; }
.calc-txt { font-weight: 700; color: #065f46; font-size: 0.88rem; }
.calc-val { font-size: 1.25rem; font-weight: 800; color: #047857; }

.calc-info {
  margin: 0;
  font-size: 0.78rem;
  color: #065f46;
  line-height: 1.35;
}

.modal-bottom {
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-m-close {
  padding: 8px 18px;
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-m-close:hover { background: #1e293b; }

/* ТОСТ-УВЕДОМЛЕНИЯ */
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px -6px rgba(15, 23, 42, 0.18);
  border: 1px solid #e2e8f0;
}

.toast-success { border-left: 4px solid #10b981; }
.toast-error { border-left: 4px solid #ef4444; }
.toast-success .toast-icon { color: #10b981; flex-shrink: 0; }
.toast-error .toast-icon { color: #ef4444; flex-shrink: 0; }

.toast-content { flex: 1; }
.toast-title { font-weight: 700; font-size: 0.88rem; color: #0f172a; margin-bottom: 2px; }
.toast-message { font-size: 0.82rem; color: #475569; line-height: 1.35; }

.toast-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
}

/* АНИМАЦИИ */
.spin-icon {
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.cards-enter-active,
.cards-leave-active {
  transition: all 0.25s ease;
}
.cards-enter-from,
.cards-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>