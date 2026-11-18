<template>
  <div class="hr-cabinet">
    <!-- 1. ВЕРХНИЙ ПРОФИЛЬ КАДРОВИКА (В ЕДИНОМ СТИЛЕ С ОСТАЛЬНЫМИ КАБИНЕТАМИ) -->
    <div v-if="profile" class="profile-hero-card">
      <div class="hero-top-banner">
        <div class="hero-left">
          <div class="hero-avatar">
            {{ getInitials(profile.last_name, profile.first_name) }}
          </div>
          <div class="hero-identity">
            <div class="hero-badges">
              <span class="badge-tab">Таб. № 1С-{{ String(profile.id).padStart(3, '0') }}</span>
              <span class="badge-role">
                <ShieldCheck :size="13" />
                Кабинет кадровика (Отдел кадров)
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
            <span class="tile-label">ДЕПАРТАМЕНТ КАДРОВ</span>
            <span class="tile-val">{{ profile.department_name || 'Департамент кадровой работы' }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-purple"><Network :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">УПРАВЛЕНИЕ</span>
            <span class="tile-val">{{ profile.division_name || 'Управление кадров' }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-amber"><Users :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">МАСШТАБ ОРГАНИЗАЦИИ</span>
            <span class="tile-val">{{ profile.total_employees || 0 }} сотрудников</span>
            <span class="tile-sub">
              Департаментов: {{ profile.total_departments || 0 }} • Управлений: {{ profile.total_divisions || 0 }}
            </span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-rose"><FileSpreadsheet :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">РЕЕСТРЫ В БУХГАЛТЕРИЮ</span>
            <span class="tile-val">Готово к отправке: {{ readyCount }}</span>
            <span class="tile-sub">Отправлено пакетов: {{ archiveCount }}</span>
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

    <!-- 2. НАВИГАЦИОННОЕ МЕНЮ ИЗ 5 ВКЛАДОК -->
    <div class="cabinet-tabs-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'monitoring' }"
        @click="activeTab = 'monitoring'"
      >
        <PieChart :size="17" />
        <span>1. Мониторинг</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'accounting' }"
        @click="activeTab = 'accounting'"
      >
        <FileSpreadsheet :size="17" />
        <span>2. Бухгалтерия (Excel)</span>
        <span v-if="readyCount > 0" class="tab-counter counter-hot">{{ readyCount }}</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'archive' }"
        @click="activeTab = 'archive'"
      >
        <Archive :size="17" />
        <span>3. Архив реестров</span>
        <span class="tab-counter">{{ archiveCount }}</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'holidays' }"
        @click="activeTab = 'holidays'"
      >
        <Calendar :size="17" />
        <span>4. Справочник праздников</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'my_vacation' }"
        @click="activeTab = 'my_vacation'"
      >
        <UserCheck :size="17" />
        <span>5. Мой отпуск</span>
      </button>
    </div>

    <!-- 3. ОБЛАСТЬ ОТОБРАЖЕНИЯ АКТИВНОЙ ВКЛАДКИ -->
    <div class="cabinet-content-card">
      <Transition name="fade-fast" mode="out-in">
        <TabMonitoring
          v-if="activeTab === 'monitoring'"
          :is-central="Boolean(profile?.is_central !== false && Number(profile?.region_id || 1) === 1)"
        />
        <TabAccounting
          v-else-if="activeTab === 'accounting'"
          :is-central="Boolean(profile?.is_central !== false && Number(profile?.region_id || 1) === 1)"
          @generated="refreshCounters"
        />
        <TabArchive v-else-if="activeTab === 'archive'" />
        <TabHolidays v-else-if="activeTab === 'holidays'" />
        <TabMyVacation v-else />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '@/services/api';
import TabMonitoring from './components/TabMonitoring.vue';
import TabAccounting from './components/TabAccounting.vue';
import TabArchive from './components/TabArchive.vue';
import TabHolidays from './components/TabHolidays.vue';
import TabMyVacation from './components/TabMyVacation.vue';
import {
  ShieldCheck,
  Briefcase,
  Building2,
  Network,
  Users,
  FileSpreadsheet,
  Award,
  PieChart,
  Archive,
  Calendar,
  UserCheck
} from 'lucide-vue-next';

interface HrProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  role_code: string;
  role_name: string;
  region_id?: number;
  is_central?: boolean;
  region_name?: string;
  department_name?: string;
  division_name?: string;
  total_departments?: number;
  total_divisions?: number;
  total_employees?: number;
  service_years?: number;
  base_days?: number;
  bonus_days?: number;
  vacation_days_available?: number;
}

const profile = ref<HrProfile | null>(null);
const activeTab = ref<'monitoring' | 'accounting' | 'archive' | 'holidays' | 'my_vacation'>('monitoring');

const readyCount = ref(0);
const archiveCount = ref(0);

const fetchProfile = async () => {
  try {
    const res = await api.get('/hr/me');
    profile.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки профиля кадровика:', err);
  }
};

const refreshCounters = async () => {
  try {
    const [readyRes, archRes] = await Promise.all([
      api.get('/hr/accounting/ready', { params: { target_year: 'ALL' } }),
      api.get('/hr/accounting/archive')
    ]);
    readyCount.value = Array.isArray(readyRes.data) ? readyRes.data.length : 0;
    archiveCount.value = Array.isArray(archRes.data) ? archRes.data.length : 0;
  } catch (err) {
    console.error('Ошибка загрузки счетчиков кадровика:', err);
  }
};

const getInitials = (last?: string, first?: string) => {
  const l = (last || '').trim()[0] || '';
  const f = (first || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'HR';
};

onMounted(() => {
  fetchProfile();
  refreshCounters();
});
</script>

<style scoped>
.hr-cabinet {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ВЕРХНИЙ ПРОФИЛЬ КАДРОВИКА */
.profile-hero-card {
  background: #ffffff;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}

.hero-top-banner {
  background: linear-gradient(125deg, #0f172a 0%, #1e293b 55%, #047857 100%);
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
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.55rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
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
  background: rgba(16, 185, 129, 0.25);
  border: 1px solid rgba(52, 211, 153, 0.45);
  color: #d1fae5;
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
  background: rgba(16, 185, 129, 0.22);
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
.icon-rose { background: #ecfdf5; color: #059669; }
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

/* 5 ВКЛАДОК */
.cabinet-tabs-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: #ffffff;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
}

.tab-btn {
  flex: 1;
  min-width: 190px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.88rem;
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
  background: #10b981;
  color: #ffffff;
}

.cabinet-content-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}
</style>
