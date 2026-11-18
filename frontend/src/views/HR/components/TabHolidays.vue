<template>
  <div class="holidays-tab">
    <!-- Шапка и выбор года -->
    <div class="hol-top-bar">
      <div>
        <h3>Справочник государственных праздничных дней РК</h3>
      </div>

      <div class="year-picker">
        <Calendar :size="15" />
        <span>Год календаря:</span>
        <select v-model="selectedYear" class="year-select" @change="onYearChange">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }} год</option>
        </select>
      </div>
    </div>

    <!-- Форма добавления нового праздника -->
    <form class="add-holiday-card" @submit.prevent="handleAddHoliday">
      <div class="form-title">
        <CalendarPlus :size="18" class="icon-blue" />
        <span>Добавить праздничный день в календарь {{ selectedYear }} года</span>
      </div>

      <div class="form-grid">
        <div class="field-box">
          <label>Дата праздника</label>
          <input
            type="date"
            v-model="newDate"
            class="form-input"
            required
          />
        </div>

        <div class="field-box field-grow">
          <label>Название государственного праздника</label>
          <input
            type="text"
            v-model="newName"
            class="form-input"
            placeholder="Например: День Независимости Республики Казахстан"
            required
          />
        </div>

        <div class="field-action">
          <button type="submit" class="btn-add" :disabled="submitting">
            <Plus :size="17" />
            <span>{{ submitting ? 'Сохранение...' : 'Сохранить' }}</span>
          </button>
        </div>
      </div>

      <!-- Быстрые пресеты гос. праздников РК -->
      <div class="quick-presets">
        <span class="qp-label">Быстрый выбор праздника РК:</span>
        <button
          v-for="preset in kzPresets"
          :key="preset.mmdd + preset.title"
          type="button"
          class="qp-chip"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div v-if="errorMsg" class="err-msg">{{ errorMsg }}</div>
    </form>

    <!-- Таблица праздников -->
    <div v-if="loading" class="empty-box">
      <div class="loader-spinner"></div>
      <p>Загрузка календаря праздников...</p>
    </div>

    <div v-else-if="holidays.length === 0" class="empty-box">
      <Calendar :size="34" class="empty-icon" />
      <h4>На {{ selectedYear }} год праздники еще не добавлены</h4>
      <p>Используйте форму выше или быстрые кнопки, чтобы заполнить производственный календарь.</p>
    </div>

    <div v-else class="hol-table-wrap">
      <table class="hol-table">
        <thead>
          <tr>
            <th style="width: 56px">№</th>
            <th style="width: 170px">Дата</th>
            <th style="width: 170px">День недели</th>
            <th>Название праздника</th>
            <th style="width: 120px; text-align: right">Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(h, idx) in holidays" :key="h.id">
            <td class="col-num">{{ idx + 1 }}</td>
            <td>
              <span class="date-badge">{{ formatDate(h.holiday_date) }}</span>
            </td>
            <td class="col-weekday">{{ getWeekday(h.holiday_date) }}</td>
            <td class="col-name">
              <strong>{{ h.name }}</strong>
            </td>
            <td style="text-align: right">
              <button
                type="button"
                class="btn-delete"
                :disabled="deletingId === h.id"
                @click="handleDeleteHoliday(h.id)"
              >
                <Trash2 :size="15" />
                <span>Удалить</span>
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
import { Calendar, CalendarPlus, Plus, Trash2 } from 'lucide-vue-next';

export interface HolidayItem {
  id: number;
  holiday_date: string;
  year: number;
  name: string;
}

const currentYear = new Date().getFullYear();
const selectedYear = ref<number>(currentYear + 1);
const availableYears = [currentYear, currentYear + 1, currentYear + 2];

const holidays = ref<HolidayItem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const deletingId = ref<number | null>(null);
const errorMsg = ref('');

const newDate = ref(`${selectedYear.value}-12-16`);
const newName = ref('');

const kzPresets = [
  { mmdd: '01-01', label: '1 янв — Новый год', title: 'Новый год' },
  { mmdd: '03-08', label: '8 мар — Международный женский день', title: 'Международный женский день' },
  { mmdd: '03-21', label: '21 мар — Наурыз мейрамы', title: 'Наурыз мейрамы' },
  { mmdd: '05-01', label: '1 мая — День единства народа РК', title: 'Праздник единства народа Казахстана' },
  { mmdd: '05-07', label: '7 мая — День защитника Отечества', title: 'День защитника Отечества' },
  { mmdd: '05-09', label: '9 мая — День Победы', title: 'День Победы' },
  { mmdd: '07-06', label: '6 июл — День Столицы', title: 'День Столицы' },
  { mmdd: '08-30', label: '30 авг — День Конституции РК', title: 'День Конституции Республики Казахстан' },
  { mmdd: '10-25', label: '25 окт — День Республики', title: 'День Республики' },
  { mmdd: '12-16', label: '16 дек — День Независимости', title: 'День Независимости Республики Казахстан' }
];

const applyPreset = (preset: { mmdd: string; title: string }) => {
  newDate.value = `${selectedYear.value}-${preset.mmdd}`;
  newName.value = preset.title;
  errorMsg.value = '';
};

const onYearChange = () => {
  newDate.value = `${selectedYear.value}-01-01`;
  fetchHolidays();
};

const fetchHolidays = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await api.get('/hr/holidays', {
      params: { year: selectedYear.value }
    });
    holidays.value = res.data;
  } catch (err) {
    console.error('Ошибка загрузки праздников:', err);
  } finally {
    loading.value = false;
  }
};

const handleAddHoliday = async () => {
  if (!newDate.value || !newName.value.trim()) return;
  submitting.value = true;
  errorMsg.value = '';

  try {
    const dateYear = new Date(newDate.value).getFullYear() || selectedYear.value;
    await api.post('/hr/holidays', {
      holiday_date: newDate.value,
      year: dateYear,
      name: newName.value.trim()
    });
    newName.value = '';
    if (dateYear !== selectedYear.value) {
      selectedYear.value = dateYear;
    }
    await fetchHolidays();
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || 'Не удалось добавить праздничный день';
  } finally {
    submitting.value = false;
  }
};

const handleDeleteHoliday = async (id: number) => {
  deletingId.value = id;
  try {
    await api.delete(`/hr/holidays/${id}`);
    holidays.value = holidays.value.filter(h => h.id !== id);
  } catch (err) {
    console.error('Ошибка удаления праздника:', err);
  } finally {
    deletingId.value = null;
  }
};

const formatDate = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
};

const getWeekday = (val?: string) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { weekday: 'long' });
};

onMounted(() => {
  fetchHolidays();
});
</script>

<style scoped>
.holidays-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hol-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.hol-top-bar h3 {
  margin: 0 0 4px;
  font-size: 1.18rem;
  color: #0f172a;
}

.hol-top-bar p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.year-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 7px 14px;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.year-select {
  border: none;
  background: transparent;
  font-weight: 800;
  color: #0f172a;
  font-size: 0.88rem;
  outline: none;
  cursor: pointer;
}

/* Форма добавления */
.add-holiday-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 0.95rem;
  color: #0f172a;
}

.icon-blue {
  color: #2563eb;
}

.form-grid {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.field-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 190px;
}

.field-grow {
  flex: 1;
  min-width: 260px;
}

.field-box label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
}

.form-input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.9rem;
  color: #0f172a;
  outline: none;
}

.form-input:focus {
  border-color: #2563eb;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
}

.btn-add:hover:not(:disabled) {
  background: #1d4ed8;
}

.quick-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.qp-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
}

.qp-chip {
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}

.qp-chip:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.err-msg {
  color: #dc2626;
  font-size: 0.84rem;
  font-weight: 700;
}

/* Таблица */
.hol-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}

.hol-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.hol-table th {
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.76rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.hol-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.hol-table tr:last-child td {
  border-bottom: none;
}

.col-num {
  color: #64748b;
  font-weight: 700;
}

.date-badge {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.83rem;
}

.col-weekday {
  color: #64748b;
  text-transform: capitalize;
}

.col-name {
  color: #0f172a;
}

.btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 7px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
