<template>
  <div class="portal-app">
    <!-- ВЕРХНЯЯ ШАПКА: ФИЛЬТРЫ ПО РЕГИОНУ / ДЕПАРТАМЕНТУ / УПРАВЛЕНИЮ И ВЫБОР ПОЛЬЗОВАТЕЛЯ -->
    <header class="portal-header">
      <div class="header-inner">
        <div class="user-select-bar">
          <!-- Блок каскадных фильтров для быстрого поиска пользователя -->
          <div class="header-filters-row">
            <div class="filter-chip-select">
              <MapPin :size="14" class="f-ico" />
              <select v-model="selectedRegionId" class="mini-select" @change="onRegionFilterChange">
                <option value="ALL">Все регионы</option>
                <option v-for="reg in availableRegions" :key="reg.id" :value="reg.id">
                  {{ reg.name }}
                </option>
              </select>
            </div>

            <div class="filter-chip-select">
              <Building2 :size="14" class="f-ico" />
              <select v-model="selectedDepartmentId" class="mini-select" @change="onDepartmentFilterChange">
                <option value="ALL">Все департаменты</option>
                <option v-for="dep in filteredDepartments" :key="dep.id" :value="dep.id">
                  {{ dep.name }}
                  <template v-if="selectedRegionId === 'ALL' && dep.region_name">
                    ({{ dep.region_name }})
                  </template>
                </option>
              </select>
            </div>

            <div class="filter-chip-select">
              <Network :size="14" class="f-ico" />
              <select v-model="selectedDivisionId" class="mini-select" @change="onDivisionFilterChange">
                <option value="ALL">Все управления</option>
                <option v-for="div in filteredDivisions" :key="div.id" :value="div.id">
                  {{ div.name }}
                </option>
              </select>
            </div>

            <button
              v-if="hasActiveFilters"
              type="button"
              class="btn-reset-header-filters"
              title="Сбросить фильтры подразделений"
              @click="resetHeaderFilters"
            >
              <RotateCcw :size="13" />
              <span>Сбросить</span>
            </button>
          </div>

          <!-- Основной переключатель пользователя -->
          <div class="picker-wrap">
            <div class="picker-label">
              <UserCheck :size="16" />
              <span>Вход под пользователем:</span>
            </div>

            <div class="select-wrapper">
              <select
                id="user-picker"
                v-model="selectedUserMode"
                class="user-dropdown"
              >
                <option value="1c">🏢 Режим 1С: Управление стажем всех сотрудников</option>
                <optgroup :label="`Личные кабинеты сотрудников (${filteredUsers.length})`">
                  <option v-for="u in filteredUsers" :key="u.id" :value="u.id">
                    {{ u.last_name }} {{ u.first_name }} — {{ u.position_title || u.role_name }} ({{ u.role_name }})
                  </option>
                </optgroup>
              </select>
            </div>

            <span
              v-if="activeUser"
              class="role-pill"
              :class="'pill-' + activeUser.role_code.toLowerCase()"
            >
              <Shield :size="13" />
              {{ activeUser.role_name }}
            </span>
            <span v-else class="role-pill pill-onec">
              <Database :size="13" />
              Администратор 1С
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- ОСНОВНОЙ КОНТЕНТ: ОТОБРАЖЕНИЕ АКТИВНОГО КАБИНЕТА -->
    <main class="portal-main">
      <Transition name="page-fade" mode="out-in">
        <!-- 1. КАБИНЕТ 1С -->
        <UsersList v-if="selectedUserMode === '1c'" key="onec-mode" />

        <!-- 2. КАБИНЕТ СОТРУДНИКА И ЗАМ. НАЧ. УПРАВЛЕНИЯ (EMPLOYEE, DIV_DEPUTY) -->
        <EmployeeCabinet
          v-else-if="activeUser?.role_code === 'EMPLOYEE' || activeUser?.role_code === 'DIV_DEPUTY'"
          :key="'emp-' + selectedUserMode"
        />

        <!-- 3. КАБИНЕТ НАЧАЛЬНИКА УПРАВЛЕНИЯ (DIVISION_HEAD) -->
        <DivisionCabinet
          v-else-if="activeUser?.role_code === 'DIVISION_HEAD'"
          :key="'div-' + selectedUserMode"
        />

        <!-- 4. КАБИНЕТ НАЧАЛЬНИКА ДЕПАРТАМЕНТА И ЗАМ. НАЧ. ДЕПАРТАМЕНТА (DEPARTMENT_HEAD, DEPT_DEPUTY) -->
        <DepartmentCabinet
          v-else-if="activeUser?.role_code === 'DEPARTMENT_HEAD' || activeUser?.role_code === 'DEPT_DEPUTY'"
          :key="'dep-' + selectedUserMode"
        />

        <!-- 5. КАБИНЕТ КАДРОВИКА (HR) -->
        <HrCabinet
          v-else-if="activeUser?.role_code === 'HR'"
          :key="'hr-' + selectedUserMode"
        />

        <!-- 6. КАБИНЕТ БУХГАЛТЕРА (ACCOUNTANT) -->
        <AccountantCabinet
          v-else-if="activeUser?.role_code === 'ACCOUNTANT'"
          :key="'acc-' + selectedUserMode"
        />

        <!-- 7. ДРУГИЕ КАБИНЕТЫ (ПОКА НЕ РЕАЛИЗОВАННЫЕ РОЛИ) -->
        <section v-else key="other-mode" class="user-cabinet-view">
          <div class="cabinet-card">
            <div class="cabinet-banner">
              <div class="cabinet-avatar" :style="{ background: getAvatarGradient(activeUser?.id || 1) }">
                {{ activeUser ? getInitials(activeUser) : 'U' }}
              </div>
              <div class="cabinet-title-block">
                <div class="cabinet-hello">Личный кабинет</div>
                <h2>{{ activeUser?.last_name }} {{ activeUser?.first_name }} {{ activeUser?.middle_name || '' }}</h2>
                <div class="badge-row">
                  <span class="cabinet-pos">
                    <Briefcase :size="14" />
                    {{ activeUser?.position_title || 'Должность' }}
                  </span>
                  <span class="cabinet-role">
                    <Shield :size="14" />
                    {{ activeUser?.role_name }}
                  </span>
                </div>
              </div>
            </div>

            <div class="cabinet-details-grid">
              <div class="detail-cell">
                <span class="cell-label">Департамент</span>
                <span class="cell-val">{{ activeUser?.department_name || 'Не указан' }}</span>
              </div>
              <div class="detail-cell">
                <span class="cell-label">Роль в системе</span>
                <span class="cell-val bold">{{ activeUser?.role_name }}</span>
              </div>
            </div>

            <div class="development-notice">
              <div class="notice-icon-box">
                <Sparkles :size="24" />
              </div>
              <div>
                <h3>Кабинет роли «{{ activeUser?.role_name }}»</h3>
                <p>
                  Интерфейс для роли <strong>{{ activeUser?.role_name }}</strong> находится на стадии разработки. 
                  Когда вы создадите для него отдельный компонент, вы сможете легко подключить его здесь в <code>App.vue</code>!
                </p>
                <p class="notice-sub">
                  Для подачи заявки на отпуск выберите любого сотрудника с ролью «Сотрудник» (например, Батыр Али или Секен Аян).
                </p>
              </div>
            </div>

            <div class="cabinet-actions">
              <button class="btn-back-onec" @click="selectedUserMode = '1c'">
                <ArrowLeft :size="17" />
                <span>Вернуться в Режим 1С (Реестр стажа)</span>
              </button>
            </div>
          </div>
        </section>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '@/services/api';
import UsersList from '@/views/OneC/UsersList.vue';
import EmployeeCabinet from '@/views/Employee/EmployeeCabinet.vue';
import DivisionCabinet from '@/views/DivisionHead/DivisionCabinet.vue';
import DepartmentCabinet from '@/views/DepartmentHead/DepartmentCabinet.vue';
import HrCabinet from '@/views/HR/HrCabinet.vue';
import AccountantCabinet from '@/views/Accountant/AccountantCabinet.vue';
import {
  UserCheck,
  Shield,
  Database,
  Briefcase,
  Sparkles,
  ArrowLeft,
  MapPin,
  Building2,
  Network,
  RotateCcw
} from 'lucide-vue-next';

interface UserDropdownItem {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  role_code: string;
  role_name: string;
  department_id?: number | null;
  department_name?: string;
  division_id?: number | null;
  division_name?: string;
  region_id?: number | null;
  region_name?: string;
  position_title?: string;
}

interface RegionItem {
  id: number;
  name: string;
  is_central?: boolean;
}

interface DepartmentItem {
  id: number;
  name: string;
  region_id?: number | null;
  region_name?: string;
}

interface DivisionItem {
  id: number;
  department_id: number;
  name: string;
}

const allUsers = ref<UserDropdownItem[]>([]);
const regions = ref<RegionItem[]>([]);
const departments = ref<DepartmentItem[]>([]);
const divisions = ref<DivisionItem[]>([]);

const selectedRegionId = ref<string | number>('ALL');
const selectedDepartmentId = ref<string | number>('ALL');
const selectedDivisionId = ref<string | number>('ALL');

const selectedUserMode = ref<string | number>('1c');

// Синхронизация с localStorage для axios x-user-id (до рендера дочернего кабинета)
watch(selectedUserMode, (newVal) => {
  if (newVal === '1c') {
    localStorage.removeItem('current_user_id');
  } else {
    localStorage.setItem('current_user_id', newVal.toString());
  }
}, { flush: 'sync' });

// Доступные регионы (из /shared/structure или динамически из пользователей)
const availableRegions = computed<RegionItem[]>(() => {
  if (regions.value.length > 0) return regions.value;
  const map = new Map<number, string>();
  allUsers.value.forEach(u => {
    if (u.region_id && u.region_name) {
      map.set(Number(u.region_id), u.region_name);
    }
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

// Департаменты с учетом выбранного Региона
const filteredDepartments = computed<DepartmentItem[]>(() => {
  let list = departments.value;
  if (selectedRegionId.value !== 'ALL') {
    list = list.filter(d => Number(d.region_id) === Number(selectedRegionId.value));
  }
  return list;
});

// Управления с учетом выбранного Региона и Департамента
const filteredDivisions = computed<DivisionItem[]>(() => {
  if (selectedDepartmentId.value !== 'ALL') {
    return divisions.value.filter(div => Number(div.department_id) === Number(selectedDepartmentId.value));
  }
  if (selectedRegionId.value !== 'ALL') {
    const allowedDepIds = new Set(filteredDepartments.value.map(d => Number(d.id)));
    return divisions.value.filter(div => allowedDepIds.has(Number(div.department_id)));
  }
  return divisions.value;
});

// Отфильтрованный список пользователей для выпадающего списка
const filteredUsers = computed<UserDropdownItem[]>(() => {
  return allUsers.value.filter(u => {
    if (selectedRegionId.value !== 'ALL') {
      const userRegionId =
        u.region_id ??
        departments.value.find(d => Number(d.id) === Number(u.department_id))?.region_id;
      if (Number(userRegionId) !== Number(selectedRegionId.value)) {
        return false;
      }
    }
    if (selectedDepartmentId.value !== 'ALL') {
      if (Number(u.department_id) !== Number(selectedDepartmentId.value)) {
        return false;
      }
    }
    if (selectedDivisionId.value !== 'ALL') {
      if (Number(u.division_id) !== Number(selectedDivisionId.value)) {
        return false;
      }
    }
    return true;
  });
});

const hasActiveFilters = computed(() => {
  return (
    selectedRegionId.value !== 'ALL' ||
    selectedDepartmentId.value !== 'ALL' ||
    selectedDivisionId.value !== 'ALL'
  );
});

// Если при фильтрации выбранный пользователь оказался вне списка — переключаем на первого подходящего
const syncSelectedUserAfterFilter = () => {
  if (selectedUserMode.value === '1c') return;
  const stillExists = filteredUsers.value.some(u => u.id === Number(selectedUserMode.value));
  if (!stillExists) {
    const firstMatch = filteredUsers.value[0];
    if (firstMatch) {
      selectedUserMode.value = firstMatch.id;
    }
  }
};

const onRegionFilterChange = () => {
  selectedDepartmentId.value = 'ALL';
  selectedDivisionId.value = 'ALL';
  syncSelectedUserAfterFilter();
};

const onDepartmentFilterChange = () => {
  selectedDivisionId.value = 'ALL';
  syncSelectedUserAfterFilter();
};

const onDivisionFilterChange = () => {
  syncSelectedUserAfterFilter();
};

const resetHeaderFilters = () => {
  selectedRegionId.value = 'ALL';
  selectedDepartmentId.value = 'ALL';
  selectedDivisionId.value = 'ALL';
};

// Активный пользователь
const activeUser = computed(() => {
  if (selectedUserMode.value === '1c') return null;
  return allUsers.value.find(u => u.id === Number(selectedUserMode.value)) || null;
});

const fetchHeaderData = async () => {
  try {
    const [usersRes, structRes] = await Promise.all([
      api.get('/shared/users'),
      api.get('/shared/structure')
    ]);
    allUsers.value = usersRes.data || [];
    regions.value = structRes.data?.regions || [];
    departments.value = structRes.data?.departments || [];
    divisions.value = structRes.data?.divisions || [];
  } catch (err) {
    console.error('Ошибка загрузки пользователей и структуры:', err);
  }
};

const getInitials = (user: { last_name?: string; first_name?: string }) => {
  const l = (user.last_name || '').trim()[0] || '';
  const f = (user.first_name || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase();
};

const avatarGradients = [
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)'
];

const getAvatarGradient = (id: number) => {
  return avatarGradients[id % avatarGradients.length] || avatarGradients[0];
};

onMounted(async () => {
  const saved = localStorage.getItem('current_user_id');
  if (saved) {
    selectedUserMode.value = Number(saved);
  }
  await fetchHeaderData();
});
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.portal-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ШАПКА */
.portal-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

/* ПЕРЕКЛЮЧАТЕЛЬ С ФИЛЬТРАМИ */
.user-select-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #f8fafc;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
}

.header-filters-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 5px 10px;
  transition: border-color 0.15s;
}

.filter-chip-select:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.f-ico {
  color: #64748b;
  flex-shrink: 0;
}

.mini-select {
  border: none;
  background: transparent;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  max-width: 220px;
}

.btn-reset-header-filters {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reset-header-filters:hover {
  background: #fee2e2;
}

.picker-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
}

.picker-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.select-wrapper {
  position: relative;
}

.user-dropdown {
  padding: 7px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font-size: 0.86rem;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  min-width: 310px;
  max-width: 440px;
  cursor: pointer;
  transition: all 0.15s;
}

.user-dropdown:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.role-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.pill-onec { background: #dbeafe; color: #1e40af; }
.pill-employee { background: #e0f2fe; color: #0369a1; }
.pill-division_head { background: #fef3c7; color: #92400e; }
.pill-department_head { background: #ffedd5; color: #9a3412; }
.pill-hr { background: #dcfce7; color: #166534; }
.pill-accountant { background: #f3e8ff; color: #6b21a8; }

/* КОНТЕНТ */
.portal-main {
  max-width: 1400px;
  margin: 20px auto;
  padding: 0 20px 40px;
  width: 100%;
  flex: 1;
}

/* ЗАГЛУШКА ДЛЯ НЕГОТОВЫХ КАБИНЕТОВ */
.user-cabinet-view {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.cabinet-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 36px;
  max-width: 720px;
  width: 100%;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cabinet-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
}

.cabinet-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 700;
  flex-shrink: 0;
}

.cabinet-hello {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 2px;
}

.cabinet-title-block h2 {
  margin: 0 0 8px;
  font-size: 1.4rem;
  color: #0f172a;
}

.badge-row {
  display: flex;
  gap: 8px;
}

.cabinet-pos {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.cabinet-role {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f3e8ff;
  color: #7e22ce;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.cabinet-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 10px;
}

.detail-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-label {
  font-size: 0.78rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
}

.cell-val {
  font-size: 0.95rem;
  color: #0f172a;
}

.cell-val.bold { font-weight: 700; }

.development-notice {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 20px;
  border-radius: 12px;
}

.notice-icon-box {
  color: #d97706;
  flex-shrink: 0;
  margin-top: 2px;
}

.development-notice h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
  color: #92400e;
}

.development-notice p {
  margin: 0 0 6px;
  font-size: 0.92rem;
  color: #78350f;
  line-height: 1.5;
}

.notice-sub {
  color: #b45309 !important;
  font-size: 0.85rem !important;
}

.cabinet-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-back-onec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.92rem;
  transition: background 0.15s;
}

.btn-back-onec:hover { background: #1d4ed8; }

/* АНИМАЦИИ */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
