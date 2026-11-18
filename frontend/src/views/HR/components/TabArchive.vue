<template>
  <div class="archive-tab">
    <div class="arch-top-bar">
      <div>
        <h3>Архив отправленных списков</h3>
      </div>

      <button class="btn-refresh" @click="fetchArchive" :disabled="loading">
        <RefreshCw :size="15" :class="{ spin: loading }" />
        <span>Обновить</span>
      </button>
    </div>

    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка архива реестров...</p>
    </div>

    <div v-else-if="batches.length === 0" class="empty-box">
      <Archive :size="36" class="empty-icon" />
      <h4>Архив реестров пока пуст</h4>
      <p>Когда вы сформируете первый Excel во вкладке «Бухгалтерия», он появится здесь.</p>
    </div>

    <div v-else class="batches-table-wrap">
      <table class="batches-table">
        <thead>
          <tr>
            <th style="width: 56px">№</th>
            <th>Номер пакета и дата отправки</th>
            <th>Подразделение (Департамент / Управление)</th>
            <th>Плановый год</th>
            <th>Отправлено заявок</th>
            <th>Сформировал кадровик</th>
            <th style="text-align: right">Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, idx) in batches" :key="b.id">
            <td class="col-num">{{ idx + 1 }}</td>
            <td>
              <div class="batch-title">
                <PackageCheck :size="16" class="icon-green" />
                <strong>Пакет №{{ b.id }} ({{ b.batch_number }})</strong>
              </div>
              <div class="batch-sub">
                от {{ formatDateTime(b.created_at) }}
              </div>
            </td>
            <td>
              <div class="dep-line">{{ b.department_name || 'Сводный реестр' }}</div>
              <div v-if="b.division_name" class="div-line">{{ b.division_name }}</div>
            </td>
            <td>
              <span class="year-chip">{{ b.target_year }} год</span>
            </td>
            <td>
              <span class="count-pill">Отправлено: {{ b.requests_count }} заявок</span>
            </td>
            <td>
              <span class="creator-name">
                {{ b.last_name }} {{ b.first_name }} {{ b.middle_name || '' }}
              </span>
            </td>
            <td style="text-align: right">
              <button
                class="btn-download-again"
                :disabled="downloadingId === b.id"
                @click="downloadExcelAgain(b)"
              >
                <Download :size="15" />
                <span v-if="downloadingId === b.id">Скачивание...</span>
                <span v-else>Скачать Excel повторно</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '@/services/api';
import { RefreshCw, Archive, PackageCheck, Download } from 'lucide-vue-next';

export interface HrBatchItem {
  id: number;
  batch_number: string;
  target_year: number;
  status: string;
  created_at: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  department_name?: string;
  division_name?: string;
  requests_count: number;
}

const batches = ref<HrBatchItem[]>([]);
const loading = ref(false);
const downloadingId = ref<number | null>(null);

const fetchArchive = async () => {
  loading.value = true;
  try {
    const res = await api.get('/hr/accounting/archive');
    batches.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки архива реестров:', err);
  } finally {
    loading.value = false;
  }
};

const downloadExcelAgain = async (batch: HrBatchItem) => {
  downloadingId.value = batch.id;
  try {
    const res = await api.get(`/hr/accounting/archive/${batch.id}/excel`, {
      responseType: 'blob'
    });

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const unitName = [batch.department_name, batch.division_name]
      .filter(Boolean)
      .join(' ')
      .replace(/[^\wа-яА-ЯёЁ\s-]/g, '')
      .trim() || `Пакет_${batch.id}`;
    link.setAttribute('download', `График отп.${batch.target_year} ${unitName}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
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

onMounted(() => {
  fetchArchive();
});
</script>

<style scoped>
.archive-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.arch-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.arch-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.arch-top-bar p {
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

.batches-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  background: #ffffff;
}

.batches-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.batches-table th {
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.76rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.batches-table td {
  padding: 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.batches-table tr:last-child td {
  border-bottom: none;
}

.col-num {
  color: #64748b;
  font-weight: 700;
}

.batch-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0f172a;
  margin-bottom: 2px;
}

.icon-green {
  color: #059669;
}

.batch-sub {
  font-size: 0.78rem;
  color: #64748b;
}

.dep-line {
  font-weight: 700;
  color: #1e293b;
}

.div-line {
  font-size: 0.8rem;
  color: #64748b;
}

.year-chip {
  background: #f1f5f9;
  color: #334155;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.8rem;
}

.count-pill {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.8rem;
}

.creator-name {
  color: #334155;
  font-weight: 600;
}

.btn-download-again {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-download-again:hover:not(:disabled) {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.empty-box {
  padding: 48px 20px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
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
