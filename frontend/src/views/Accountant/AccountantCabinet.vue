<template>
  <div class="accountant-cabinet">
    <!-- 1. ВЕРХНЯЯ ШАПКА ПРОФИЛЯ БУХГАЛТЕРА (В ЕДИНОМ СТИЛЕ С ОСТАЛЬНЫМИ КАБИНЕТАМИ) -->
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
                Кабинет бухгалтера (Расчетный отдел)
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

      <!-- Нижняя панель из 5 инфо-плиток -->
      <div class="hero-info-grid">
        <div class="info-tile">
          <div class="tile-icon icon-blue"><Building2 :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ДЕПАРТАМЕНТ</span>
            <span class="tile-val">{{ profile.department_name || 'Финансовый департамент' }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-purple"><Network :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">УПРАВЛЕНИЕ</span>
            <span class="tile-val">{{ profile.division_name || 'Управление бухгалтерского учета' }}</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-rose"><Inbox :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">НОВЫЕ РЕЕСТРЫ НА ОПЛАТУ</span>
            <span class="tile-val" :class="{ 'text-danger': incomingBatches.length > 0 }">
              {{ incomingBatches.length }} пакетов
            </span>
            <span class="tile-sub">Требуют начисления отпускных</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-green"><CheckCircle2 :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ОПЛАЧЕНО И ЗАКРЫТО</span>
            <span class="tile-val">{{ archiveBatches.length }} пакетов</span>
            <span class="tile-sub">В архиве обработанных</span>
          </div>
        </div>

        <div class="info-tile">
          <div class="tile-icon icon-amber"><Award :size="18" /></div>
          <div class="tile-body">
            <span class="tile-label">ТРУДОВОЙ СТАЖ (1С)</span>
            <span class="tile-val">{{ profile.service_years || 0 }} лет</span>
            <span class="tile-sub">Норматив по ст. 92 ТК РК</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. НАВИГАЦИЯ (ДВЕ БОЛЬШИЕ КНОПКИ-ВКЛАДКИ С КРАСНЫМ БЕЙДЖИКОМ НА НОВЫХ РЕЕСТРАХ) -->
    <div class="cabinet-tabs-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'incoming' }"
        @click="activeTab = 'incoming'"
      >
        <Inbox :size="18" />
        <span>1. Новые реестры на оплату</span>
        <span v-if="incomingBatches.length > 0" class="tab-counter counter-hot">
          {{ incomingBatches.length }}
        </span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'archive' }"
        @click="activeTab = 'archive'"
      >
        <Archive :size="18" />
        <span>2. Архив обработанных</span>
        <span class="tab-counter">{{ archiveBatches.length }}</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'my_vacation' }"
        @click="activeTab = 'my_vacation'"
      >
        <UserCheck :size="18" />
        <span>3. Мой отпуск</span>
      </button>
    </div>

    <!-- 3. КОНТЕНТ АКТИВНОЙ ВКЛАДКИ -->
    <div class="cabinet-content-card">
      <Transition name="fade-fast" mode="out-in">
        <TabIncoming
          v-if="activeTab === 'incoming'"
          :batches="incomingBatches"
          :loading="loadingBatches"
          @refresh="fetchBatches"
          @processed="fetchBatches"
        />

        <TabArchive
          v-else-if="activeTab === 'archive'"
          :batches="archiveBatches"
          :loading="loadingBatches"
          @refresh="fetchBatches"
        />

        <div v-else class="embedded-my-vacation">
          <EmployeeCabinet :embedded="true" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api';
import TabIncoming, { type AccountantBatchItem } from './components/TabIncoming.vue';
import TabArchive from './components/TabArchive.vue';
import EmployeeCabinet from '@/views/Employee/EmployeeCabinet.vue';
import {
  ShieldCheck,
  Briefcase,
  Building2,
  Network,
  Inbox,
  CheckCircle2,
  Award,
  Archive,
  UserCheck
} from 'lucide-vue-next';

interface AccountantProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  position_title?: string;
  role_code: string;
  role_name: string;
  department_name?: string;
  division_name?: string;
  service_years?: number;
  base_days?: number;
  bonus_days?: number;
  vacation_days_available?: number;
}

const profile = ref<AccountantProfile | null>(null);
const activeTab = ref<'incoming' | 'archive' | 'my_vacation'>('incoming');

const allBatches = ref<AccountantBatchItem[]>([]);
const loadingBatches = ref(false);

const incomingBatches = computed(() =>
  allBatches.value.filter(b => !b.is_processed)
);

const archiveBatches = computed(() =>
  allBatches.value.filter(b => Boolean(b.is_processed))
);

const fetchProfile = async () => {
  try {
    const res = await api.get('/accountant/me');
    profile.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки профиля бухгалтера:', err);
  }
};

const fetchBatches = async () => {
  loadingBatches.value = true;
  try {
    const res = await api.get('/accountant/batches');
    allBatches.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки реестров бухгалтера:', err);
  } finally {
    loadingBatches.value = false;
  }
};

const getInitials = (last?: string, first?: string) => {
  const l = (last || '').trim()[0] || '';
  const f = (first || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'БХ';
};

onMounted(() => {
  fetchProfile();
  fetchBatches();
});
</script>

<style scoped>
.accountant-cabinet {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ВЕРХНИЙ ПРОФИЛЬ БУХГАЛТЕРА */
.profile-hero-card {
  background: #ffffff;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}

.hero-top-banner {
  background: linear-gradient(125deg, #0f172a 0%, #1e1b4b 55%, #6d28d9 100%);
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
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.55rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.35);
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
  background: rgba(167, 139, 250, 0.25);
  border: 1px solid rgba(196, 181, 253, 0.45);
  color: #ede9fe;
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
  color: #cbd5e1;
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

/* 5 ИНФО-ПЛИТОК */
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
.icon-rose { background: #fef2f2; color: #dc2626; }
.icon-green { background: #ecfdf5; color: #059669; }
.icon-amber { background: #fef3c7; color: #d97706; }

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

.text-danger {
  color: #dc2626;
}

.tile-sub {
  font-size: 0.75rem;
  color: #64748b;
}

/* НАВИГАЦИЯ ПО 2 БОЛЬШИМ ВКЛАДКАМ */
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
  min-width: 240px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 20px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.94rem;
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
  padding: 2px 9px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 800;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
}

.tab-btn.active .tab-counter {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

/* Яркий красный бейджик для новых реестров */
.counter-hot {
  background: #ef4444 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
}

.cabinet-content-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.embedded-my-vacation :deep(.profile-hero-card) {
  display: none;
}
</style>
