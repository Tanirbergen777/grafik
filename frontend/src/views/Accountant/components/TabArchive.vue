<template>
  <div class="archive-tab">
    <div class="tab-top-bar">
      <div>
        <h3>Архив оплаченных и закрытых реестров</h3>
        <p>История всех пакетов, по которым бухгалтерия провела начисление и выплату отпускных и лечебного пособия</p>
      </div>

      <button class="btn-refresh" @click="$emit('refresh')" :disabled="loading">
        <RefreshCw :size="15" :class="{ spin: loading }" />
        <span>Обновить</span>
      </button>
    </div>

    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка архива обработанных реестров...</p>
    </div>

    <div v-else-if="batches.length === 0" class="empty-box">
      <Archive :size="36" class="empty-icon" />
      <h4>В архиве пока нет обработанных реестров</h4>
      <p>После того как вы отметите новый реестр как оплаченный во вкладке «Новые реестры», он появится здесь.</p>
    </div>

    <div v-else class="archive-table-wrap">
      <table class="archive-table">
        <thead>
          <tr>
            <th style="width: 50px">№</th>
            <th>Номер реестра и подразделение</th>
            <th>Кадровик (Отправитель)</th>
            <th>Сотрудников</th>
            <th>Когда обработано (Оплачено)</th>
            <th>Кем обработано (Бухгалтер)</th>
            <th style="text-align: right">Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, idx) in batches" :key="b.id">
            <td class="col-num">{{ idx + 1 }}</td>
            <td>
              <div class="batch-title">
                <CheckCircle2 :size="16" class="icon-green" />
                <strong>{{ b.batch_number }}</strong>
                <span class="year-pill">{{ b.target_year }} г.</span>
              </div>
              <div class="unit-sub">
                {{ b.department_name || 'Сводный реестр' }}
                <span v-if="b.division_name">• {{ b.division_name }}</span>
              </div>
              <div class="sent-sub">Отправлен из ОК: {{ formatDateTime(b.created_at) }}</div>
            </td>
            <td>
              <span class="person-name">
                {{ b.hr_last_name }} {{ b.hr_first_name }} {{ b.hr_middle_name || '' }}
              </span>
            </td>
            <td>
              <span class="count-badge">{{ b.requests_count }} заявок</span>
            </td>
            <td>
              <span class="paid-time-badge">
                {{ formatDateTime(b.processed_at || undefined) }}
              </span>
            </td>
            <td>
              <div class="acc-person">
                <UserCheck :size="15" class="icon-green" />
                <strong>
                  {{
                    b.acc_last_name
                      ? `${b.acc_last_name} ${b.acc_first_name || ''} ${b.acc_middle_name || ''}`
                      : 'Бухгалтер'
                  }}
                </strong>
              </div>
            </td>
            <td style="text-align: right">
              <button
                type="button"
                class="btn-download-again"
                :disabled="downloadingId === b.id"
                @click="handleDownloadAgain(b)"
              >
                <Download :size="15" />
                <span v-if="downloadingId === b.id">Скачивание...</span>
                <span v-else>📥 Скачать повторно</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '@/services/api';
import { RefreshCw, Archive, CheckCircle2, UserCheck, Download } from 'lucide-vue-next';
import type { AccountantBatchItem } from './TabIncoming.vue';

defineProps<{
  batches: AccountantBatchItem[];
  loading: boolean;
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();

const downloadingId = ref<number | null>(null);

const handleDownloadAgain = async (batch: AccountantBatchItem) => {
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
    console.error('Ошибка повторного скачивания Excel:', err);
  } finally {
    downloadingId.value = null;
  }
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
.archive-tab {
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

.archive-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  background: #ffffff;
}

.archive-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.archive-table th {
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.archive-table td {
  padding: 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.archive-table tr:last-child td {
  border-bottom: none;
}

.col-num {
  color: #64748b;
  font-weight: 700;
}

.batch-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #0f172a;
  margin-bottom: 3px;
}

.icon-green {
  color: #059669;
  flex-shrink: 0;
}

.year-pill {
  background: #f1f5f9;
  color: #334155;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
}

.unit-sub {
  font-size: 0.82rem;
  color: #334155;
  font-weight: 600;
}

.sent-sub {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
}

.person-name {
  color: #334155;
  font-weight: 600;
}

.count-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.paid-time-badge {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
}

.acc-person {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #0f172a;
}

.btn-download-again {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-download-again:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.empty-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  color: #94a3b8;
  margin-bottom: 10px;
}

.empty-box h4 {
  margin: 0 0 6px;
  color: #0f172a;
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
