<template>
  <Transition name="modal-fade">
    <div v-if="isOpen && department" class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-window">
        <!-- Шапка модального окна -->
        <div class="modal-header">
          <div class="header-left">
            <div class="dep-icon-box">
              <Building2 :size="20" />
            </div>
            <div>
              <div class="modal-sub">Мониторинг управлений департамента ({{ targetYear }} г.)</div>
              <h3>{{ department.name }}</h3>
            </div>
          </div>
          <button class="modal-close-btn" @click="$emit('close')">
            <X :size="20" />
          </button>
        </div>

        <!-- Сводная полоса по департаменту -->
        <div class="dep-summary-bar">
          <div class="sum-pill">
            <span class="s-lbl">Всего в штате:</span>
            <strong class="s-val">{{ department.total_employees }} чел.</strong>
          </div>
          <div class="sum-pill">
            <span class="s-lbl">Сдали график:</span>
            <strong class="s-val text-green">{{ department.submitted_count }} чел.</strong>
          </div>
          <div class="sum-pill">
            <span class="s-lbl">Ожидается:</span>
            <strong class="s-val text-amber">
              {{ Math.max(0, department.total_employees - department.submitted_count) }} чел.
            </strong>
          </div>
          <div class="sum-pill">
            <span class="s-lbl">Процент сдачи:</span>
            <strong class="s-val text-blue">
              {{ getPercent(department.submitted_count, department.total_employees) }}%
            </strong>
          </div>
        </div>

        <!-- Тело модального окна: список управлений -->
        <div class="modal-body">
          <div v-if="loading" class="loading-box">
            <div class="loader-spinner"></div>
            <p>Загрузка управлений департамента...</p>
          </div>

          <div v-else-if="divisions.length === 0" class="empty-box">
            <Network :size="32" />
            <p>В данном департаменте пока нет зарегистрированных управлений.</p>
          </div>

          <div v-else class="divisions-list">
            <div
              v-for="div in divisions"
              :key="div.id"
              class="division-row-card"
              @click="$emit('select-division', div)"
            >
              <div class="div-left">
                <div class="div-icon">
                  <Network :size="18" />
                </div>
                <div>
                  <div class="div-title">{{ div.name }}</div>
                  <div class="div-sub">
                    Нажмите, чтобы открыть поименный список сотрудников управления
                  </div>
                </div>
              </div>

              <div class="div-stats">
                <div class="stat-col">
                  <span class="st-label">Штат / Сдали</span>
                  <span class="st-value">
                    <strong>{{ div.submitted_count }}</strong> из <strong>{{ div.total_employees }}</strong>
                  </span>
                </div>

                <div class="progress-col">
                  <div class="prog-top">
                    <span
                      class="prog-pct"
                      :class="getBadgeColorClass(getPercent(div.submitted_count, div.total_employees))"
                    >
                      {{ getPercent(div.submitted_count, div.total_employees) }}%
                    </span>
                  </div>
                  <div class="prog-track">
                    <div
                      class="prog-fill"
                      :class="getFillColorClass(getPercent(div.submitted_count, div.total_employees))"
                      :style="{ width: getPercent(div.submitted_count, div.total_employees) + '%' }"
                    ></div>
                  </div>
                </div>

                <button type="button" class="btn-open-employees">
                  <span>Сотрудники</span>
                  <ChevronRight :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-close" @click="$emit('close')">Закрыть</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Building2, Network, X, ChevronRight } from 'lucide-vue-next';

export interface MonitoringDepartmentItem {
  id: number;
  name: string;
  total_employees: number;
  submitted_count: number;
  approved_count?: number;
  divisions_count?: number;
}

export interface MonitoringDivisionItem {
  id: number;
  name: string;
  total_employees: number;
  submitted_count: number;
  approved_count?: number;
}

defineProps<{
  isOpen: boolean;
  department: MonitoringDepartmentItem | null;
  divisions: MonitoringDivisionItem[];
  loading: boolean;
  targetYear: number;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'select-division', division: MonitoringDivisionItem): void;
}>();

const getPercent = (submitted: number, total: number) => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((Number(submitted || 0) / Number(total)) * 100));
};

const getBadgeColorClass = (pct: number) => {
  if (pct === 100) return 'pct-green';
  if (pct >= 50) return 'pct-blue';
  return 'pct-amber';
};

const getFillColorClass = (pct: number) => {
  if (pct === 100) return 'fill-green';
  if (pct >= 50) return 'fill-blue';
  return 'fill-amber';
};
</script>

<style scoped>
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
  max-width: 820px;
  width: 100%;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
}

.modal-header {
  padding: 20px 24px;
  background: linear-gradient(125deg, #0f172a 0%, #1e293b 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dep-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.22);
  border: 1px solid rgba(96, 165, 250, 0.4);
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-sub {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 2px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
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

.dep-summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  padding: 14px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.sum-pill {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.s-lbl {
  font-size: 0.75rem;
  color: #64748b;
}

.s-val {
  font-size: 0.98rem;
  color: #0f172a;
}

.text-green { color: #059669; }
.text-amber { color: #d97706; }
.text-blue { color: #2563eb; }

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.divisions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.division-row-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.15s;
  flex-wrap: wrap;
}

.division-row-card:hover {
  border-color: #93c5fd;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}

.div-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 240px;
}

.div-icon {
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

.div-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.96rem;
  margin-bottom: 2px;
}

.div-sub {
  font-size: 0.78rem;
  color: #64748b;
}

.div-stats {
  display: flex;
  align-items: center;
  gap: 18px;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.st-label {
  font-size: 0.72rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
}

.st-value {
  font-size: 0.9rem;
  color: #0f172a;
}

.progress-col {
  width: 110px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prog-top {
  display: flex;
  justify-content: flex-end;
}

.prog-pct {
  font-size: 0.78rem;
  font-weight: 800;
}

.pct-green { color: #059669; }
.pct-blue { color: #2563eb; }
.pct-amber { color: #d97706; }

.prog-track {
  height: 7px;
  border-radius: 99px;
  background: #e2e8f0;
  overflow: hidden;
}

.prog-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}

.fill-green { background: #10b981; }
.fill-blue { background: #3b82f6; }
.fill-amber { background: #f59e0b; }

.btn-open-employees {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.division-row-card:hover .btn-open-employees {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.loading-box,
.empty-box {
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-footer {
  padding: 14px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.btn-close {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
}
</style>
