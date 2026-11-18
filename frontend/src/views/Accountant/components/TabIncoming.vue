<template>
  <div class="incoming-tab">
    <div class="tab-top-bar">
      <div>
        <h3>Новые реестры отпусков на расчет и оплату</h3>
        <p>Скачайте Excel-реестр для загрузки в 1С:Бухгалтерию и после проведения выплаты нажмите «Отметить как оплаченное»</p>
      </div>

      <button class="btn-refresh" @click="$emit('refresh')" :disabled="loading">
        <RefreshCw :size="15" :class="{ spin: loading }" />
        <span>Обновить</span>
      </button>
    </div>

    <!-- Уведомление об успешной оплате -->
    <Transition name="fade-slide">
      <div v-if="feedbackMsg" class="action-toast" :class="feedbackType">
        <CheckCircle2 v-if="feedbackType === 'success'" :size="18" />
        <AlertCircle v-else :size="18" />
        <span>{{ feedbackMsg }}</span>
      </div>
    </Transition>

    <!-- Состояние загрузки -->
    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка новых реестров от отдела кадров...</p>
    </div>

    <!-- Пустой список -->
    <div v-else-if="batches.length === 0" class="empty-box">
      <div class="empty-icon-circle">
        <CheckCircle2 :size="36" />
      </div>
      <h4>Все поступившие реестры оплачены и закрыты</h4>
      <p>Новых пакетов от Отдела кадров на данный момент нет. История выполненных выплат доступна во вкладке «Архив обработанных».</p>
    </div>

    <!-- Список карточек входящих реестров -->
    <div v-else class="batches-grid">
      <div v-for="b in batches" :key="b.id" class="batch-card">
        <div class="batch-card-top">
          <div class="batch-left">
            <div class="batch-icon-box">
              <FileSpreadsheet :size="24" />
            </div>
            <div>
              <div class="batch-title-row">
                <span class="batch-num">{{ b.batch_number }}</span>
                <span class="year-badge">График {{ b.target_year }} г.</span>
                <span class="new-pill">Новый реестр</span>
              </div>
              <div class="batch-unit">
                <Building2 :size="14" class="icon-muted" />
                <span>{{ b.department_name || 'Сводный реестр по ведомству' }}</span>
                <span v-if="b.division_name" class="div-sep">• {{ b.division_name }}</span>
              </div>
            </div>
          </div>

          <div class="employees-count-badge">
            <Users :size="16" />
            <span>{{ b.requests_count }} {{ pluralizeRequests(b.requests_count) }} на отпуск</span>
          </div>
        </div>

        <div class="batch-meta-strip">
          <div class="meta-cell">
            <span class="m-lbl">ДАТА И ВРЕМЯ ОТПРАВКИ</span>
            <span class="m-val">
              <Clock :size="14" class="icon-muted" />
              {{ formatDateTime(b.created_at) }}
            </span>
          </div>

          <div class="meta-cell">
            <span class="m-lbl">СФОРМИРОВАЛ КАДРОВИК (HR)</span>
            <span class="m-val">
              <UserCheck :size="14" class="icon-muted" />
              {{ b.hr_last_name }} {{ b.hr_first_name }} {{ b.hr_middle_name || '' }}
            </span>
          </div>

          <div class="meta-cell">
            <span class="m-lbl">СТАТУС БУХГАЛТЕРИИ</span>
            <span class="m-val text-amber">Ожидает выплаты отпускных и леч. пособия</span>
          </div>
        </div>

        <div class="batch-card-actions">
          <button
            type="button"
            class="btn-download-excel"
            :disabled="downloadingId === b.id"
            @click="handleDownload(b)"
          >
            <Download :size="17" />
            <span v-if="downloadingId === b.id">Скачивание файла...</span>
            <span v-else>📥 Скачать Excel</span>
          </button>

          <button
            type="button"
            class="btn-mark-paid"
            :disabled="processingId === b.id"
            @click="handleMarkProcessed(b)"
          >
            <CheckCircle2 :size="18" />
            <span v-if="processingId === b.id">Сохранение...</span>
            <span v-else>✅ Отметить как оплаченное / Завершить</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '@/services/api';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Users,
  Clock,
  UserCheck,
  Download
} from 'lucide-vue-next';

export interface AccountantBatchItem {
  id: number;
  batch_number: string;
  target_year: number;
  created_at: string;
  is_processed: boolean;
  processed_at?: string | null;
  hr_last_name: string;
  hr_first_name: string;
  hr_middle_name?: string;
  acc_last_name?: string | null;
  acc_first_name?: string | null;
  acc_middle_name?: string | null;
  department_name?: string | null;
  division_name?: string | null;
  requests_count: number;
}

defineProps<{
  batches: AccountantBatchItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'processed'): void;
}>();

const downloadingId = ref<number | null>(null);
const processingId = ref<number | null>(null);

const feedbackMsg = ref('');
const feedbackType = ref<'success' | 'error'>('success');

const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
  feedbackMsg.value = msg;
  feedbackType.value = type;
  setTimeout(() => {
    feedbackMsg.value = '';
  }, 4500);
};

const handleDownload = async (batch: AccountantBatchItem) => {
  downloadingId.value = batch.id;
  try {
    const res = await api.get(`/accountant/batches/${batch.id}/download`, {
      responseType: 'blob'
    });

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const unitName = [batch.department_name, batch.division_name]
      .filter(Boolean)
      .join(' ')
      .replace(/[^\wа-яА-ЯёЁ\s-]/g, '')
      .trim() || `Реестр_${batch.id}`;
    link.setAttribute('download', `График отп.${batch.target_year} ${unitName}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Ошибка скачивания Excel:', err);
    showFeedback('Ошибка при скачивании Excel-реестра', 'error');
  } finally {
    downloadingId.value = null;
  }
};

const handleMarkProcessed = async (batch: AccountantBatchItem) => {
  processingId.value = batch.id;
  try {
    await api.patch(`/accountant/batches/${batch.id}/process`);
    showFeedback(
      `Реестр «${batch.batch_number}» успешно отмечен как оплаченный и перемещен в архив!`,
      'success'
    );
    emit('processed');
  } catch (err: any) {
    const msg = err?.response?.data?.error || 'Не удалось обновить статус реестра';
    showFeedback(msg, 'error');
  } finally {
    processingId.value = null;
  }
};

const pluralizeRequests = (count: number) => {
  const n = Math.abs(Number(count || 0)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'заявок';
  if (n1 > 1 && n1 < 5) return 'заявки';
  if (n1 === 1) return 'заявка';
  return 'заявок';
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
</script>

<style scoped>
.incoming-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tab-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.tab-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.tab-top-bar p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.84rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
}

.action-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
}

.action-toast.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.action-toast.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.batches-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.batch-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #8b5cf6;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.15s;
}

.batch-card:hover {
  border-color: #cbd5e1;
  border-left-color: #7c3aed;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07);
}

.batch-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.batch-icon-box {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: #f3e8ff;
  color: #7e22ce;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.batch-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 5px;
}

.batch-num {
  font-size: 1.08rem;
  font-weight: 800;
  color: #0f172a;
}

.year-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.new-pill {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 2px 9px;
  border-radius: 20px;
  font-size: 0.74rem;
  font-weight: 800;
}

.batch-unit {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.86rem;
  color: #475569;
  font-weight: 600;
}

.div-sep {
  color: #64748b;
}

.employees-count-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 800;
}

.batch-meta-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
}

.meta-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.m-lbl {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
}

.m-val {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.text-amber {
  color: #d97706;
}

.icon-muted {
  color: #64748b;
}

.batch-card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.btn-download-excel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-download-excel:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #60a5fa;
}

.btn-mark-paid {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.28);
  transition: all 0.15s;
}

.btn-mark-paid:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.36);
}

.btn-mark-paid:disabled,
.btn-download-excel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
  color: #64748b;
}

.empty-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.empty-box h4 {
  margin: 0 0 6px;
  font-size: 1.1rem;
  color: #0f172a;
}

.empty-box p {
  margin: 0;
  font-size: 0.9rem;
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
