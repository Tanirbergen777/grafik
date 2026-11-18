<template>
  <div class="employee-cabinet">
    <!-- Скелетон при загрузке -->
    <div v-if="loading" class="loading-state">
      <Loader2 :size="40" class="spin-icon text-blue" />
      <p>Загрузка личного кабинета сотрудника...</p>
    </div>

    <div v-else-if="me" class="cabinet-content">
      <!-- 1. ШАПКА ПРОФИЛЯ СОТРУДНИКА (отображается только для Сотрудника / Зам. нач. управления; во вкладке «Мой отпуск» других ролей скрыта) -->
      <section
        v-if="!props.embedded && (me.role_code === 'EMPLOYEE' || me.role_code === 'DIV_DEPUTY')"
        class="profile-card"
      >
        <div class="profile-top">
          <div class="profile-identity">
            <div class="avatar-circle">
              {{ getInitials(me.last_name, me.first_name) }}
            </div>
            <div class="identity-text">
              <div class="identity-meta">
                <span class="role-badge">
                  {{ me.role_code === 'DIV_DEPUTY' ? (me.role_name || 'Заместитель начальника управления') : 'Личный кабинет сотрудника' }}
                </span>
              </div>
              <h2 class="employee-fullname">
                {{ me.last_name }} {{ me.first_name }} {{ me.middle_name || '' }}
              </h2>
              <div class="employee-pos">
                <Briefcase :size="16" />
                <span>{{ me.position_title || 'Сотрудник' }}</span>
              </div>
            </div>
          </div>

          <div class="limit-widget">
            <div class="limit-main">
              <span class="limit-caption">Положенный отпуск</span>
              <div class="limit-number">
                {{ me.total_allowed_days }}
                <small>календарных дней</small>
              </div>
            </div>
            <div class="limit-breakdown">
              <span>Базовый: <strong>{{ me.base_days || 30 }} дн.</strong></span>
              <span class="dot">•</span>
              <span>За выслугу ({{ me.service_years }} л.): <strong>+{{ me.additional_days || 0 }} дн.</strong></span>
            </div>
          </div>
        </div>

        <!-- Сетка с полной информацией: Департамент, Управление, Начальник управления, Начальник департамента, Стаж -->
        <div class="profile-grid">
          <div class="info-tile">
            <div class="tile-icon blue"><Building2 :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Департамент</span>
              <span class="tile-value">{{ me.department_name || 'Не указан' }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon indigo"><Network :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Управление</span>
              <span class="tile-value">{{ me.division_name || 'Не указано' }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon amber"><UserCheck :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Начальник управления</span>
              <span class="tile-value">{{ me.division_head_name || 'Не назначен' }}</span>
              <span v-if="me.division_head_position" class="tile-sub">{{ me.division_head_position }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon purple"><ShieldCheck :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Начальник департамента</span>
              <span class="tile-value">{{ me.department_head_name || 'Не назначен' }}</span>
              <span v-if="me.department_head_position" class="tile-sub">{{ me.department_head_position }}</span>
            </div>
          </div>

          <div class="info-tile">
            <div class="tile-icon emerald"><Award :size="18" /></div>
            <div class="tile-body">
              <span class="tile-label">Трудовой стаж (1С)</span>
              <span class="tile-value">{{ me.service_years }} {{ pluralYears(me.service_years) }}</span>
              <span class="tile-sub">Норматив по ст. 92 ТК РК</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. НАВИГАЦИЯ ПО ДВУМ ВКЛАДКАМ КАБИНЕТА -->
      <div class="cabinet-tabs-bar">
        <div class="tabs-left">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'request' }"
            @click="activeTab = 'request'"
          >
            <Send :size="17" />
            <span>Заявка</span>
            <span v-if="currentYearRequest" class="tab-pill" :class="'pill-' + currentYearRequest.status_code.toLowerCase()">
              {{ currentYearRequest.status_name }}
            </span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'archive' }"
            @click="activeTab = 'archive'"
          >
            <Archive :size="17" />
            <span>Архив заявок</span>
            <span class="tab-count">{{ requests.length }}</span>
          </button>
        </div>

        <!-- Переключатель года планирования для вкладки «Заявка» -->
        <div v-if="activeTab === 'request'" class="year-selector">
          <span class="year-label">Плановый год:</span>
          <div class="year-buttons">
            <button
              v-for="yr in availableYears"
              :key="yr"
              class="year-chip"
              :class="{ active: selectedYear === yr }"
              @click="selectPlanningYear(yr)"
            >
              {{ yr }} г.
            </button>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- ВКЛАДКА 1: «ЗАЯВКА» (ПОДАЧА ЗАЯВКИ ИЛИ КАРТОЧКА ТЕКУЩЕЙ ЗАЯВКИ)       -->
      <!-- ===================================================================== -->
      <section v-if="activeTab === 'request'" class="tab-panel">
        <!-- СОСТОЯНИЕ 1: ФОРМА ЗАПОЛНЕНИЯ ЗАЯВКИ ОТКРЫТА -->
        <div v-if="isFormOpen" class="request-form-card">
          <div class="form-card-header">
            <div class="header-title-group">
              <div class="header-icon">
                <CalendarPlus :size="22" />
              </div>
              <div>
                <h3>
                  {{
                    form.id
                      ? `Редактирование: ${formatRequestNumber(currentYearRequest || form)}`
                      : `Оформление заявки на отпуск (${form.target_year} год)`
                  }}
                </h3>
                <p>Заполните периоды отпуска согласно Трудовому кодексу РК (одна из частей должна быть не менее 14 дней)</p>
              </div>
            </div>
            <button class="btn-close-form" @click="closeForm" title="Закрыть форму">
              <X :size="20" />
            </button>
          </div>

          <!-- Панель баланса дней и проверки правила 14 дней -->
          <div class="balance-strip">
            <div class="balance-metrics">
              <div class="metric-item">
                <span class="m-label">Доступный лимит:</span>
                <span class="m-val">{{ me.total_allowed_days }} дн.</span>
              </div>
              <div class="metric-item">
                <span class="m-label">Распределено в заявке:</span>
                <span class="m-val" :class="{ 'text-danger': totalRequestedDays > me.total_allowed_days }">
                  {{ totalRequestedDays }} дн.
                </span>
              </div>
              <div class="metric-item">
                <span class="m-label">Остаток лимита:</span>
                <span class="m-val" :class="remainingDays < 0 ? 'text-danger' : 'text-emerald'">
                  {{ remainingDays }} дн.
                </span>
              </div>
            </div>

            <div class="rule-check" :class="has14DaysRuleMet ? 'rule-ok' : 'rule-warn'">
              <CheckCircle2 v-if="has14DaysRuleMet" :size="16" />
              <AlertTriangle v-else :size="16" />
              <span>
                Условие ТК РК (не менее 14 дней):
                <strong>{{ has14DaysRuleMet ? 'Выполнено' : 'Не выполнено (минимум 14 дней)' }}</strong>
              </span>
            </div>
          </div>

          <!-- Переключатель количества частей отпуска -->
          <div class="split-mode-bar">
            <span class="split-label">Формат отпуска:</span>
            <div class="split-buttons">
              <button
                type="button"
                class="split-btn"
                :class="{ active: form.periods.length === 1 }"
                @click="setPeriodsCount(1)"
              >
                Одним периодом (1 часть)
              </button>
              <button
                type="button"
                class="split-btn"
                :class="{ active: form.periods.length === 2 }"
                @click="setPeriodsCount(2)"
              >
                Разделить на 2 части
              </button>
            </div>
          </div>

          <!-- Карточки периодов отпуска -->
          <div class="periods-grid">
            <div
              v-for="(period, idx) in form.periods"
              :key="idx"
              class="period-editor-card"
            >
              <div class="period-card-top">
                <div class="part-badge">
                  <CalendarDays :size="16" />
                  <span>Часть {{ idx + 1 }} из {{ form.periods.length }}</span>
                </div>
                <span
                  class="part-rule-tag"
                  :class="(period.vacation_days || 0) >= 14 ? 'tag-green' : 'tag-gray'"
                >
                  {{ (period.vacation_days || 0) >= 14 ? '✓ Основная часть (≥ 14 дн.)' : 'Дополнительная часть' }}
                </span>
              </div>

              <div class="period-inputs-row">
                <div class="form-field">
                  <label>Дата начала отпуска <span class="req">*</span></label>
                  <input
                    type="date"
                    v-model="period.start_date"
                    :min="`${form.target_year}-01-01`"
                    :max="`${form.target_year}-12-31`"
                    class="field-input"
                  />
                </div>

                <div class="form-field">
                  <label>Количество календарных дней <span class="req">*</span></label>
                  <input
                    type="number"
                    v-model.number="period.vacation_days"
                    min="1"
                    :max="me.total_allowed_days"
                    class="field-input"
                  />
                  <div class="quick-days">
                    <button type="button" class="q-chip" @click="period.vacation_days = 14">14 дн.</button>
                    <button
                      v-if="me.total_allowed_days >= 16"
                      type="button"
                      class="q-chip"
                      @click="period.vacation_days = me.total_allowed_days - 14"
                    >
                      {{ me.total_allowed_days - 14 }} дн.
                    </button>
                    <button
                      v-if="form.periods.length === 1"
                      type="button"
                      class="q-chip"
                      @click="period.vacation_days = me.total_allowed_days"
                    >
                      Все {{ me.total_allowed_days }} дн.
                    </button>
                  </div>
                </div>
              </div>

              <!-- Выбор периода для выплаты лечебного пособия (только 1 раз в год — либо к 1-й, либо ко 2-й части) -->
              <div
                class="health-benefit-selector"
                :class="{ active: period.with_health_benefit }"
                @click="selectHealthBenefitPeriod(idx)"
              >
                <input
                  type="radio"
                  :name="'health-benefit-part'"
                  :checked="period.with_health_benefit"
                  @change="selectHealthBenefitPeriod(idx)"
                />
                <div class="hb-content">
                  <div class="hb-title">
                    Получить лечебное пособие к Части {{ idx + 1 }} отпуска
                    <span v-if="period.with_health_benefit" class="hb-month-tag">
                      Месяц выплаты: {{ getMonthNameRu(period.start_date) }}
                    </span>
                  </div>
                  <div class="hb-sub">
                    {{
                      form.periods.length > 1
                        ? 'Лечебное пособие выплачивается только один раз в год (при выборе этой части отметка со второй части снимается)'
                        : 'Месяц этой части будет указан в графе «С выплатой леч. пособия (месяц)»'
                    }}
                  </div>
                </div>
              </div>

              <!-- Выбор замещающего сотрудника (ТОЛЬКО для Начальника управления DIVISION_HEAD) -->
              <div v-if="me?.role_code === 'DIVISION_HEAD'" class="form-field substitute-field">
                <label>Замещающий сотрудник на время отпуска (для начальника управления)</label>
                <select v-model="period.substitute_user_id" class="field-input">
                  <option :value="null">— Выберите замещающего сотрудника —</option>
                  <option
                    v-for="col in me.colleagues || []"
                    :key="col.id"
                    :value="col.id"
                  >
                    {{ col.full_name }} — {{ col.position_title || 'Сотрудник' }} ({{ col.division_name || me.department_name }})
                  </option>
                </select>
              </div>

              <!-- Автоматический предпросмотр даты окончания и праздников -->
              <div v-if="periodPreviews[idx]" class="period-preview-box">
                <div class="preview-item">
                  <span class="p-lbl">Дата окончания:</span>
                  <span class="p-val">{{ formatDate(periodPreviews[idx]!.end_date) }}</span>
                </div>
                <div class="preview-item">
                  <span class="p-lbl">Праздничных дней в периоде:</span>
                  <span class="p-val highlight">
                    {{ periodPreviews[idx]!.holidays_count }} дн.
                    <small v-if="periodPreviews[idx]!.holidays_count > 0">(не списываются из лимита)</small>
                  </span>
                </div>
                <div class="preview-item">
                  <span class="p-lbl">Всего дней отдыха:</span>
                  <span class="p-val bold">
                    {{ (period.vacation_days || 0) + periodPreviews[idx]!.holidays_count }} календ. дн.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Блок ошибок валидации (включая правило не менее 14 дней) -->
          <div v-if="validationError" class="validation-banner">
            <AlertCircle :size="18" />
            <span>{{ validationError }}</span>
          </div>

          <!-- Информация о маршруте согласования перед отправкой -->
          <div class="form-route-preview">
            <span class="route-title">Получатели заявки по маршруту согласования:</span>
            <div class="route-chips">
              <span class="r-chip">1. Нач. управления: <strong>{{ me.division_head_name || '—' }}</strong></span>
              <ArrowRight :size="14" class="r-arrow" />
              <span class="r-chip">2. Нач. департамента: <strong>{{ me.department_head_name || '—' }}</strong></span>
              <ArrowRight :size="14" class="r-arrow" />
              <span class="r-chip">3. HR (Кадры) и Бухгалтерия</span>
            </div>
          </div>

          <!-- Кнопки действий формы -->
          <div class="form-footer-actions">
            <button type="button" class="btn-cancel" @click="closeForm" :disabled="isSubmitting">
              Отмена
            </button>
            <div class="right-btns">
              <button
                type="button"
                class="btn-save-draft"
                @click="submitRequest('DRAFT')"
                :disabled="isSubmitting || !!validationError"
              >
                <Save :size="17" />
                <span>Сохранить в черновик</span>
              </button>
              <button
                type="button"
                class="btn-submit-send"
                @click="submitRequest('SEND')"
                :disabled="isSubmitting || !!validationError"
              >
                <Send :size="17" />
                <span>{{ isSubmitting ? 'Отправка...' : 'Отправить заявку на согласование' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- СОСТОЯНИЕ 2: ЗАЯВКА НА ВЫБРАННЫЙ ГОД УЖЕ СУЩЕСТВУЕТ (КРАТКАЯ КАРТОЧКА ЗАЯВКИ) -->
        <div v-else-if="currentYearRequest" class="active-request-summary-card">
          <div class="summary-top-banner" :class="'banner-' + currentYearRequest.status_code.toLowerCase()">
            <div class="summary-left">
              <div class="req-badge-row">
                <span class="req-code-badge">{{ formatRequestNumber(currentYearRequest) }}</span>
                <span class="req-year-badge">График отпусков на {{ currentYearRequest.target_year }} год</span>
                <span class="req-created">от {{ formatDateTime(currentYearRequest.created_at) }}</span>
              </div>
              <h3 class="summary-heading">
                Заявка на ежегодный трудовой отпуск ({{ getTotalRequestDays(currentYearRequest) }} из {{ currentYearRequest.total_allowed_days }} дн.)
              </h3>
            </div>

            <div class="summary-status-box">
              <span class="status-pill-lg" :class="'status-' + currentYearRequest.status_code.toLowerCase()">
                {{ currentYearRequest.status_name }}
              </span>
              <span class="stage-caption">
                Этап: <strong>{{ formatStageName(currentYearRequest.current_stage, currentYearRequest) }}</strong>
              </span>
            </div>
          </div>

          <!-- Уведомление, если заявка возвращена на доработку -->
          <div v-if="currentYearRequest.status_code === 'REVISION' && currentYearRequest.revision_comment" class="revision-alert">
            <AlertTriangle :size="20" class="rev-icon" />
            <div>
              <strong>Заявка возвращена на доработку руководителем:</strong>
              <p>{{ currentYearRequest.revision_comment }}</p>
            </div>
          </div>

          <!-- Уведомление, если заявка в статусе Черновик (например, после отзыва) -->
          <div v-if="currentYearRequest.status_code === 'DRAFT'" class="draft-alert">
            <Info :size="19" />
            <span>
              Заявка находится в статусе <strong>«Черновик»</strong> (не отправлена). Вы можете изменить даты или сразу отправить её на согласование начальнику управления.
            </span>
          </div>

          <!-- Минимальные данные заявки: периоды и согласующий -->
          <div class="summary-body">
            <div class="summary-periods-list">
              <div
                v-for="p in currentYearRequest.periods"
                :key="p.part_number"
                class="summary-period-item"
              >
                <div class="sp-part">Часть {{ p.part_number }}</div>
                <div class="sp-dates">
                  <CalendarDays :size="16" class="text-blue" />
                  <span>с <strong>{{ formatDate(p.start_date) }}</strong> по <strong>{{ formatDate(p.end_date) }}</strong></span>
                </div>
                <div class="sp-days">
                  <span class="days-pill">{{ p.vacation_days }} календ. дн.</span>
                  <span v-if="p.holidays_count > 0" class="holidays-pill">+ {{ p.holidays_count }} праздн. дн.</span>
                  <span v-if="p.with_health_benefit" class="benefit-pill-sm">
                    💊 С выплатой леч. пособия ({{ getMonthNameRu(p.start_date) }})
                  </span>
                </div>
                <div v-if="p.substitute_name" class="sp-sub">
                  <User :size="14" />
                  <span>Замещающий: <strong>{{ p.substitute_name }}</strong></span>
                </div>
              </div>
            </div>

            <div class="summary-approvers-mini">
              <div class="mini-approver">
                <span class="ma-label">Начальник управления:</span>
                <span class="ma-name">{{ currentYearRequest.division_head_name || me.division_head_name || '—' }}</span>
              </div>
              <div class="mini-approver">
                <span class="ma-label">Начальник департамента:</span>
                <span class="ma-name">{{ currentYearRequest.department_head_name || me.department_head_name || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Кнопки управления заявкой: Подробно, Отозвать (до утверждения нач. управления), Отправить/Редактировать -->
          <div class="summary-actions-bar">
            <button class="btn-details" @click="openDetailsModal(currentYearRequest, 'details')">
              <Eye :size="17" />
              <span>Подробно (Решения и история)</span>
            </button>

            <div class="summary-right-actions">
              <!-- Кнопка ОТОЗВАТЬ: доступна пока заявка отправлена (SENT) и находится у начальника управления -->
              <button
                v-if="canRevoke(currentYearRequest)"
                class="btn-revoke-req"
                @click="revoke(currentYearRequest.id)"
              >
                <RotateCcw :size="17" />
                <span>Отозвать заявку</span>
              </button>

              <!-- Если заявка отозвана (DRAFT) или возвращена на доработку (REVISION) — кнопки Редактировать и Отправить заявку -->
              <template v-if="['DRAFT', 'REVISION'].includes(currentYearRequest.status_code)">
                <button class="btn-edit-req" @click="openEditForm(currentYearRequest)">
                  <FileEdit :size="17" />
                  <span>Изменить данные заявки</span>
                </button>
                <button class="btn-send-now" @click="quickSendDraft(currentYearRequest)">
                  <Send :size="17" />
                  <span>Отправить заявку</span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- СОСТОЯНИЕ 3: ЗАЯВКИ НА ВЫБРАННЫЙ ГОД НЕТ — КНОПКА «ОТПРАВИТЬ ЗАЯВКУ» -->
        <div v-else class="empty-request-cta">
          <div class="cta-icon-circle">
            <CalendarPlus :size="36" />
          </div>
          <h3>Заявка на отпуск на {{ selectedYear }} год еще не подана</h3>
          <p class="cta-desc">
            Ваш доступный лимит составляет <strong>{{ me.total_allowed_days }} календарных дней</strong>.
            Вы можете оформить отпуск целиком или разделить его на 2 части (при этом одна из частей должна быть не менее 14 календарных дней).
          </p>
          <div class="cta-supervisors">
            <span>Согласующие руководители:</span>
            <strong>{{ me.division_head_name || 'Начальник управления' }}</strong>
            <span>→</span>
            <strong>{{ me.department_head_name || 'Начальник департамента' }}</strong>
          </div>
          <button class="btn-open-create" @click="openCreateForm">
            <Send :size="18" />
            <span>Отправить заявку</span>
          </button>
        </div>
      </section>

      <!-- ===================================================================== -->
      <!-- ВКЛАДКА 2: «АРХИВ ЗАЯВОК»                                              -->
      <!-- ===================================================================== -->
      <section v-else-if="activeTab === 'archive'" class="tab-panel">
        <div class="archive-header-card">
          <div>
            <h3><Archive :size="20" /> Архив и реестр заявок сотрудника</h3>
            <p>Все поданные заявки на отпуск за разные годы с полной историей согласования и решениями руководителей</p>
          </div>
          <div class="archive-filters">
            <button
              class="filter-chip"
              :class="{ active: archiveFilter === 'ALL' }"
              @click="archiveFilter = 'ALL'"
            >
              Все ({{ requests.length }})
            </button>
            <button
              class="filter-chip"
              :class="{ active: archiveFilter === 'APPROVED' }"
              @click="archiveFilter = 'APPROVED'"
            >
              Утвержденные ({{ requests.filter(r => r.status_code === 'APPROVED').length }})
            </button>
            <button
              class="filter-chip"
              :class="{ active: archiveFilter === 'ACTIVE' }"
              @click="archiveFilter = 'ACTIVE'"
            >
              В процессе ({{ requests.filter(r => r.status_code !== 'APPROVED').length }})
            </button>
          </div>
        </div>

        <div v-if="filteredArchiveRequests.length === 0" class="empty-archive">
          <FolderOpen :size="40" class="text-muted" />
          <h4>Заявки не найдены</h4>
          <p>В выбранной категории пока нет записей.</p>
        </div>

        <div v-else class="archive-list">
          <div
            v-for="req in filteredArchiveRequests"
            :key="req.id"
            class="archive-card"
            :class="'border-' + req.status_code.toLowerCase()"
          >
            <div class="arch-main">
              <div class="arch-title-row">
                <span class="arch-num">{{ formatRequestNumber(req) }}</span>
                <span class="arch-year">На {{ req.target_year }} год</span>
                <span class="status-pill-sm" :class="'status-' + req.status_code.toLowerCase()">
                  {{ req.status_name }}
                </span>
                <span class="arch-stage">
                  Этап: {{ formatStageName(req.current_stage, req) }}
                </span>
              </div>

              <div class="arch-periods">
                <div v-for="p in req.periods" :key="p.part_number" class="arch-period-chip">
                  <CalendarDays :size="14" />
                  <span>
                    <strong>Часть {{ p.part_number }}:</strong>
                    {{ formatDate(p.start_date) }} — {{ formatDate(p.end_date) }}
                    ({{ p.vacation_days }} дн.<template v-if="p.holidays_count > 0"> + {{ p.holidays_count }} пр.</template>)
                  </span>
                </div>
              </div>

              <div class="arch-meta">
                <span>Создана: {{ formatDateTime(req.created_at) }}</span>
                <span>•</span>
                <span>Суммарно: <strong>{{ getTotalRequestDays(req) }} из {{ req.total_allowed_days }} дн.</strong></span>
                <span v-if="req.history?.length">• Событий в истории: {{ req.history.length }}</span>
              </div>
            </div>

            <div class="arch-actions">
              <button
                v-if="canRevoke(req)"
                class="btn-arch-revoke"
                @click="revoke(req.id)"
              >
                <RotateCcw :size="15" />
                <span>Отозвать</span>
              </button>

              <button class="btn-arch-details" @click="openDetailsModal(req, 'details')">
                <Eye :size="16" />
                <span>Подробно</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ===================================================================== -->
    <!-- МОДАЛЬНОЕ ОКНО «ПОДРОБНО» С ДВУМЯ ВКЛАДКАМИ                            -->
    <!-- ===================================================================== -->
    <Transition name="modal-fade">
      <div v-if="selectedModalRequest" class="modal-backdrop" @click.self="closeDetailsModal">
        <div class="detail-modal">
          <!-- Шапка модального окна -->
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="modal-badge-row">
                <span class="m-req-num">{{ formatRequestNumber(selectedModalRequest) }}</span>
                <span class="status-pill-sm" :class="'status-' + selectedModalRequest.status_code.toLowerCase()">
                  {{ selectedModalRequest.status_name }}
                </span>
              </div>
              <h3>Подробная информация по заявке на {{ selectedModalRequest.target_year }} год</h3>
            </div>
            <button class="modal-close-btn" @click="closeDetailsModal">
              <X :size="20" />
            </button>
          </div>

          <!-- Внутренние вкладки модального окна (2 вкладки) -->
          <div class="modal-tabs">
            <button
              class="m-tab-btn"
              :class="{ active: modalTab === 'details' }"
              @click="modalTab = 'details'"
            >
              <FileText :size="16" />
              <span>1. Полные данные и решения согласующих</span>
            </button>
            <button
              class="m-tab-btn"
              :class="{ active: modalTab === 'history' }"
              @click="modalTab = 'history'"
            >
              <History :size="16" />
              <span>2. История заявки ({{ selectedModalRequest.history?.length || 0 }})</span>
            </button>
          </div>

          <!-- Тело модального окна -->
          <div class="modal-body">
            <!-- МОДАЛЬНАЯ ВКЛАДКА 1: ПОЛНЫЕ ДАННЫЕ ЗАЯВКИ И МАРШРУТ СОГЛАСОВАНИЯ -->
            <div v-if="modalTab === 'details'" class="m-tab-content">
              <!-- Общие сведения о заявке -->
              <div class="detail-overview-grid">
                <div class="ov-box">
                  <span class="ov-lbl">Сотрудник</span>
                  <span class="ov-val">{{ me?.last_name }} {{ me?.first_name }} {{ me?.middle_name || '' }}</span>
                  <span class="ov-sub">{{ me?.position_title }}</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Подразделение</span>
                  <span class="ov-val">{{ selectedModalRequest.division_name || me?.division_name }}</span>
                  <span class="ov-sub">{{ selectedModalRequest.department_name || me?.department_name }}</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Использовано дней</span>
                  <span class="ov-val highlight">{{ getTotalRequestDays(selectedModalRequest) }} из {{ selectedModalRequest.total_allowed_days }} календ. дн.</span>
                  <span class="ov-sub">Плановый год: {{ selectedModalRequest.target_year }}</span>
                </div>
                <div class="ov-box">
                  <span class="ov-lbl">Текущий этап</span>
                  <span class="ov-val">{{ formatStageName(selectedModalRequest.current_stage, selectedModalRequest) }}</span>
                  <span class="ov-sub">Создана: {{ formatDateTime(selectedModalRequest.created_at) }}</span>
                </div>
              </div>

              <!-- Блок замечания, если возвращена на доработку -->
              <div v-if="selectedModalRequest.revision_comment" class="modal-revision-box">
                <AlertTriangle :size="18" />
                <div>
                  <strong>Комментарий / причина возврата на доработку:</strong>
                  <p>{{ selectedModalRequest.revision_comment }}</p>
                </div>
              </div>

              <!-- Полные данные по периодам отпуска -->
              <h4 class="section-subtitle"><CalendarDays :size="17" /> Запланированные периоды отпуска</h4>
              <div class="modal-periods-table-wrap">
                <table class="modal-periods-table">
                  <thead>
                    <tr>
                      <th>Часть</th>
                      <th>Дата начала</th>
                      <th>Дата окончания</th>
                      <th>Дней отпуска</th>
                      <th>Праздничных дней</th>
                      <th>Итого отдых</th>
                      <th>Замещающий сотрудник</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in selectedModalRequest.periods" :key="p.part_number">
                      <td><strong>Часть {{ p.part_number }}</strong></td>
                      <td>{{ formatDate(p.start_date) }}</td>
                      <td>{{ formatDate(p.end_date) }}</td>
                      <td><span class="tbl-badge blue">{{ p.vacation_days }} дн.</span></td>
                      <td>
                        <span v-if="p.holidays_count > 0" class="tbl-badge green">+{{ p.holidays_count }} дн.</span>
                        <span v-else class="text-muted">0 дн.</span>
                      </td>
                      <td><strong>{{ p.vacation_days + (p.holidays_count || 0) }} дн.</strong></td>
                      <td>
                        <div v-if="p.substitute_name" class="sub-cell">
                          <strong>{{ p.substitute_name }}</strong>
                          <small v-if="p.substitute_position">{{ p.substitute_position }}</small>
                        </div>
                        <span v-else class="text-muted">Не назначен</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- На кого отправлена заявка и что они решили (Маршрут согласования) -->
              <h4 class="section-subtitle"><UserCheck :size="17" /> На кого отправлена заявка и решения согласующих</h4>
              <div class="approval-chain-list">
                <div
                  v-for="(step, idx) in buildApprovalChain(selectedModalRequest)"
                  :key="step.stageCode"
                  class="chain-step-card"
                  :class="'step-' + step.decisionState"
                >
                  <div class="step-index">{{ idx + 1 }}</div>
                  <div class="step-info">
                    <div class="step-role-row">
                      <span class="step-role-title">{{ step.roleTitle }}</span>
                      <span class="step-decision-badge" :class="'dec-' + step.decisionState">
                        {{ step.decisionLabel }}
                      </span>
                    </div>
                    <div class="step-person-name">
                      {{ step.personName || 'Ответственный сотрудник' }}
                    </div>
                    <div v-if="step.comment" class="step-comment">
                      «{{ step.comment }}»
                    </div>
                    <div v-if="step.actedAt" class="step-time">
                      Дата решения: {{ formatDateTime(step.actedAt) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- МОДАЛЬНАЯ ВКЛАДКА 2: ИСТОРИЯ ЗАЯВКИ (ХРОНОЛОГИЧЕСКИЙ ЖУРНАЛ) -->
            <div v-else-if="modalTab === 'history'" class="m-tab-content">
              <div v-if="!selectedModalRequest.history || selectedModalRequest.history.length === 0" class="empty-history">
                История действий по данной заявке пуста.
              </div>
              <div v-else class="timeline-container">
                <div
                  v-for="(item, idx) in selectedModalRequest.history"
                  :key="item.id || idx"
                  class="timeline-item"
                >
                  <div class="timeline-marker" :class="getTimelineMarkerClass(item.to_status_code)"></div>
                  <div class="timeline-card">
                    <div class="tl-header">
                      <div class="tl-actor">
                        <strong>{{ item.acted_by_name || 'Система' }}</strong>
                        <span v-if="item.acted_by_role" class="tl-role-badge">{{ item.acted_by_role }}</span>
                        <span v-if="item.acted_by_position" class="tl-pos">({{ item.acted_by_position }})</span>
                      </div>
                      <span class="tl-date">{{ formatDateTime(item.created_at) }}</span>
                    </div>

                    <div class="tl-status-row">
                      <span v-if="item.from_status_name" class="tl-status old">{{ item.from_status_name }}</span>
                      <ArrowRight v-if="item.from_status_name && item.to_status_name" :size="14" class="tl-arrow" />
                      <span v-if="item.to_status_name" class="tl-status new" :class="'status-' + (item.to_status_code || '').toLowerCase()">
                        {{ item.to_status_name }}
                      </span>
                      <span class="tl-stage-tag">Этап: {{ formatStageSimple(item.stage) }}</span>
                    </div>

                    <p v-if="item.comment" class="tl-comment">{{ item.comment }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Подвал модального окна -->
          <div class="modal-footer">
            <button
              v-if="canRevoke(selectedModalRequest)"
              class="btn-revoke-req"
              @click="revokeFromModal(selectedModalRequest.id)"
            >
              <RotateCcw :size="16" />
              <span>Отозвать заявку до утверждения</span>
            </button>
            <button class="btn-close-modal" @click="closeDetailsModal">
              Закрыть окно
            </button>
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
  Briefcase,
  Building2,
  Network,
  UserCheck,
  ShieldCheck,
  Award,
  CalendarPlus,
  CalendarDays,
  Save,
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  History,
  FileEdit,
  RotateCcw,
  Loader2,
  Archive,
  Eye,
  X,
  FileText,
  ArrowRight,
  User,
  FolderOpen
} from 'lucide-vue-next';

interface PeriodFormItem {
  start_date: string;
  vacation_days: number;
  substitute_user_id: number | null;
  with_health_benefit: boolean;
}

const props = defineProps<{
  embedded?: boolean;
}>();

const me = ref<any>(null);
const requests = ref<any[]>([]);
const loading = ref(true);
const isSubmitting = ref(false);

// Вкладки кабинета: 'request' (Заявка) | 'archive' (Архив заявок)
const activeTab = ref<'request' | 'archive'>('request');
const archiveFilter = ref<'ALL' | 'APPROVED' | 'ACTIVE'>('ALL');

// Выбранный целевой год
const nextYear = new Date().getFullYear() + 1;
const selectedYear = ref<number>(nextYear);

// Открыта ли форма создания/редактирования заявки
const isFormOpen = ref(false);

// Модальное окно «Подробно» и его внутренние вкладки ('details' | 'history')
const selectedModalRequest = ref<any>(null);
const modalTab = ref<'details' | 'history'>('details');

// Форма заявки
const form = ref<{
  id: number | null;
  request_number?: string;
  target_year: number;
  periods: PeriodFormItem[];
}>({
  id: null,
  target_year: nextYear,
  periods: [{ start_date: `${nextYear}-06-01`, vacation_days: 14, substitute_user_id: null, with_health_benefit: true }]
});

// Доступные годы для переключения
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>([currentYear, currentYear + 1]);
  requests.value.forEach(r => {
    if (r.target_year) yearsSet.add(Number(r.target_year));
  });
  return Array.from(yearsSet).sort((a, b) => a - b);
});

// Заявка на выбранный плановый год
const currentYearRequest = computed(() => {
  return requests.value.find(r => Number(r.target_year) === Number(selectedYear.value)) || null;
});

// Фильтрованный список для вкладки «Архив заявок»
const filteredArchiveRequests = computed(() => {
  if (archiveFilter.value === 'APPROVED') {
    return requests.value.filter(r => r.status_code === 'APPROVED');
  }
  if (archiveFilter.value === 'ACTIVE') {
    return requests.value.filter(r => r.status_code !== 'APPROVED');
  }
  return requests.value;
});

// Подсчет дней в форме
const totalRequestedDays = computed(() => {
  return form.value.periods.reduce((sum, p) => sum + (Number(p.vacation_days) || 0), 0);
});

const remainingDays = computed(() => {
  const limit = me.value?.total_allowed_days || 30;
  return limit - totalRequestedDays.value;
});

// Проверка условия >= 14 дней (ст. 92 ТК РК)
const has14DaysRuleMet = computed(() => {
  return form.value.periods.some(p => (Number(p.vacation_days) || 0) >= 14);
});

// Предпросмотр окончания периодов с учетом праздников из БД
const periodPreviews = computed(() => {
  const holidayList: string[] = (me.value?.holidays || []).map((h: any) => h.holiday_date);

  return form.value.periods.map(p => {
    if (!p.start_date || !p.vacation_days || p.vacation_days < 1) {
      return null;
    }
    const start = new Date(p.start_date);
    if (isNaN(start.getTime())) return null;

    let current = new Date(start);
    let rem = Number(p.vacation_days);
    let holidaysCount = 0;

    while (rem > 0) {
      const dateStr = current.toISOString().split('T')[0] || '';
      if (holidayList.includes(dateStr)) {
        holidaysCount++;
      } else {
        rem--;
      }
      if (rem > 0) {
        current.setDate(current.getDate() + 1);
      }
    }

    return {
      end_date: current.toISOString().split('T')[0] || '',
      holidays_count: holidaysCount
    };
  });
});

// Полная валидация формы перед сохранением/отправкой
const validationError = computed(() => {
  const p1 = form.value.periods[0];
  if (!p1 || !p1.start_date) {
    return 'Укажите дату начала для первой части отпуска.';
  }
  if (!p1.vacation_days || p1.vacation_days < 1) {
    return 'Количество дней отпуска должно быть не менее 1 дня.';
  }

  if (form.value.periods.length === 2) {
    const p2 = form.value.periods[1];
    if (!p2 || !p2.start_date) {
      return 'Укажите дату начала для второй части отпуска.';
    }
    if (!p2.vacation_days || p2.vacation_days < 1) {
      return 'Количество дней во второй части должно быть не менее 1 дня.';
    }
  }

  // Проверка условия >= 14 дней (как для 1 части, так и для 2 частей)
  if (!has14DaysRuleMet.value) {
    if (form.value.periods.length === 1) {
      return 'По Трудовому кодексу РК продолжительность отпуска не должна быть меньше 14 календарных дней.';
    }
    return 'По Трудовому кодексу РК при разделении отпуска хотя бы одна из частей должна быть не менее 14 календарных дней.';
  }

  // Проверка лимита дней
  if (me.value && totalRequestedDays.value > me.value.total_allowed_days) {
    return `Превышен доступный лимит! Положено: ${me.value.total_allowed_days} дн., указано: ${totalRequestedDays.value} дн.`;
  }

  // Проверка пересечения дат двух периодов
  if (form.value.periods.length === 2 && periodPreviews.value[0] && periodPreviews.value[1]) {
    const start1 = form.value.periods[0]?.start_date || '';
    const end1 = periodPreviews.value[0].end_date;
    const start2 = form.value.periods[1]?.start_date || '';
    const end2 = periodPreviews.value[1].end_date;
    if (!(end1 < start2 || end2 < start1)) {
      return 'Часть 1 и Часть 2 пересекаются между собой по датам. Выберите непересекающиеся периоды.';
    }
  }

  return '';
});

// Загрузка профиля и заявок
const loadData = async () => {
  loading.value = true;
  try {
    const [meRes, reqRes] = await Promise.all([
      api.get('/employee/me'),
      api.get('/employee/requests')
    ]);
    me.value = meRes.data;
    requests.value = reqRes.data || [];

    // Если модалка открыта — обновим данные выбранной заявки
    if (selectedModalRequest.value) {
      const updated = requests.value.find(r => r.id === selectedModalRequest.value.id);
      if (updated) selectedModalRequest.value = updated;
    }
  } catch (err) {
    console.error('Ошибка загрузки данных кабинета сотрудника:', err);
  } finally {
    loading.value = false;
  }
};

const selectPlanningYear = (yr: number) => {
  selectedYear.value = yr;
  isFormOpen.value = false;
};

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

const getMonthNameRu = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return MONTH_NAMES_RU[d.getMonth()] || '—';
};

// Выбор периода для получения лечебного пособия (взаимоисключающий выбор: только 1 период)
const selectHealthBenefitPeriod = (selectedIndex: number) => {
  form.value.periods.forEach((p, i) => {
    p.with_health_benefit = i === selectedIndex;
  });
};

// Открыть форму для новой заявки
const openCreateForm = () => {
  const defaultDays = Math.min(14, me.value?.total_allowed_days || 14);
  form.value = {
    id: null,
    target_year: selectedYear.value,
    periods: [
      {
        start_date: `${selectedYear.value}-06-01`,
        vacation_days: defaultDays >= 14 ? defaultDays : 14,
        substitute_user_id: null,
        with_health_benefit: true
      }
    ]
  };
  isFormOpen.value = true;
};

// Открыть форму для редактирования существующего черновика / заявки на доработке
const openEditForm = (req: any) => {
  selectedYear.value = Number(req.target_year);
  const rawPeriods = req.periods || [];
  const hasAnyBenefitSelected = rawPeriods.some((p: any) => Boolean(p.with_health_benefit));

  form.value = {
    id: req.id,
    request_number: req.request_number,
    target_year: Number(req.target_year),
    periods: rawPeriods.map((p: any, idx: number) => ({
      start_date: String(p.start_date).split('T')[0],
      vacation_days: Number(p.vacation_days),
      substitute_user_id: p.substitute_user_id || null,
      with_health_benefit: hasAnyBenefitSelected ? Boolean(p.with_health_benefit) : idx === 0
    }))
  };
  activeTab.value = 'request';
  isFormOpen.value = true;
};

const closeForm = () => {
  isFormOpen.value = false;
};

const setPeriodsCount = (count: 1 | 2) => {
  if (count === 1 && form.value.periods.length > 1) {
    const first = form.value.periods[0]!;
    first.with_health_benefit = true;
    form.value.periods = [first];
  } else if (count === 2 && form.value.periods.length === 1) {
    const firstDays = form.value.periods[0]?.vacation_days || 14;
    const rem = Math.max(1, (me.value?.total_allowed_days || 30) - firstDays);
    if (form.value.periods[0]) {
      form.value.periods[0].with_health_benefit = true;
    }
    form.value.periods.push({
      start_date: `${form.value.target_year}-09-01`,
      vacation_days: rem,
      substitute_user_id: form.value.periods[0]?.substitute_user_id || null,
      with_health_benefit: false
    });
  }
};

// Отправка или сохранение заявки (после отправки форма закрывается и появляется карточка заявки)
const submitRequest = async (action: 'DRAFT' | 'SEND') => {
  if (validationError.value) return;

  isSubmitting.value = true;
  try {
    const payload = {
      target_year: form.value.target_year,
      action,
      periods: form.value.periods
    };

    if (form.value.id) {
      await api.patch(`/employee/requests/${form.value.id}`, payload);
    } else {
      await api.post('/employee/requests', payload);
    }

    selectedYear.value = form.value.target_year;
    isFormOpen.value = false; // Закрываем форму после отправки
    await loadData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Ошибка при сохранении заявки');
  } finally {
    isSubmitting.value = false;
  }
};

// Быстрая отправка уже сохраненного черновика
const quickSendDraft = async (req: any) => {
  try {
    const rawPeriods = req.periods || [];
    const hasAnyBenefit = rawPeriods.some((p: any) => Boolean(p.with_health_benefit));
    const periodsPayload = rawPeriods.map((p: any, idx: number) => ({
      start_date: String(p.start_date).split('T')[0],
      vacation_days: Number(p.vacation_days),
      substitute_user_id: p.substitute_user_id || null,
      with_health_benefit: hasAnyBenefit ? Boolean(p.with_health_benefit) : idx === 0
    }));
    await api.patch(`/employee/requests/${req.id}`, {
      action: 'SEND',
      periods: periodsPayload
    });
    await loadData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Не удалось отправить заявку');
  }
};

// Проверка, можно ли отозвать заявку (только до утверждения начальником управления)
const canRevoke = (req: any) => {
  if (!req || req.status_code !== 'SENT') return false;
  if (req.current_stage === 'DIVISION_HEAD') return true;
  if (
    req.current_stage === 'DEPARTMENT_HEAD' &&
    (me.value?.role_code === 'DIVISION_HEAD' || me.value?.role_code === 'DIV_DEPUTY')
  ) {
    return true;
  }
  return false;
};

// Отзыв заявки
const revoke = async (id: number) => {
  if (!confirm('Отозвать заявку с согласования? После отзыва вы сможете изменить данные и отправить её снова.')) return;
  try {
    await api.patch(`/employee/requests/${id}/revoke`);
    await loadData();
  } catch (err: any) {
    alert(err.response?.data?.error || 'Не удалось отозвать заявку');
  }
};

const revokeFromModal = async (id: number) => {
  await revoke(id);
};

// Открытие модального окна «Подробно»
const openDetailsModal = (req: any, tab: 'details' | 'history' = 'details') => {
  selectedModalRequest.value = req;
  modalTab.value = tab;
};

const closeDetailsModal = () => {
  selectedModalRequest.value = null;
};

// Построение цепочки согласования («На кого отправлена заявка и что они решили»)
const buildApprovalChain = (req: any) => {
  const stageOrder = ['EMPLOYEE', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'HR', 'ACCOUNTANT', 'COMPLETED'];
  const currentIdx = stageOrder.indexOf(req.current_stage || 'EMPLOYEE');
  const historyList: any[] = req.history || [];

  const steps = [
    {
      stageCode: 'DIVISION_HEAD',
      orderIdx: 1,
      roleTitle: '1. Начальник управления',
      personName: req.division_head_name || me.value?.division_head_name || 'Начальник управления'
    },
    {
      stageCode: 'DEPARTMENT_HEAD',
      orderIdx: 2,
      roleTitle: '2. Начальник департамента',
      personName: req.department_head_name || me.value?.department_head_name || 'Начальник департамента'
    },
    {
      stageCode: 'HR',
      orderIdx: 3,
      roleTitle: '3. HR-специалист (Отдел кадров)',
      personName: req.hr_name || 'Специалист HR'
    },
    {
      stageCode: 'ACCOUNTANT',
      orderIdx: 4,
      roleTitle: '4. Бухгалтерия (Расчет отпускных)',
      personName: req.accountant_name || 'Бухгалтер'
    }
  ];

  return steps.map(st => {
    // Ищем последнее действие этого этапа в истории
    const relatedHistory = [...historyList].reverse().find(h => {
      if (st.stageCode === 'DIVISION_HEAD') return h.acted_by_role_code === 'DIVISION_HEAD';
      if (st.stageCode === 'DEPARTMENT_HEAD') return h.acted_by_role_code === 'DEPARTMENT_HEAD';
      if (st.stageCode === 'HR') return h.acted_by_role_code === 'HR';
      if (st.stageCode === 'ACCOUNTANT') return h.acted_by_role_code === 'ACCOUNTANT';
      return false;
    });

    if (req.status_code === 'APPROVED' || currentIdx > st.orderIdx) {
      return {
        ...st,
        decisionState: 'approved',
        decisionLabel: 'Утверждено / Согласовано',
        comment: relatedHistory?.comment || 'Согласовано без замечаний',
        actedAt: relatedHistory?.created_at || null
      };
    }

    if (req.status_code === 'REVISION' && relatedHistory?.to_status_code === 'REVISION') {
      return {
        ...st,
        decisionState: 'revision',
        decisionLabel: 'Возвращено на доработку',
        comment: req.revision_comment || relatedHistory?.comment || 'Требуется корректировка дат',
        actedAt: relatedHistory?.created_at || null
      };
    }

    if (req.status_code === 'SENT' && currentIdx === st.orderIdx) {
      return {
        ...st,
        decisionState: 'current',
        decisionLabel: 'На рассмотрении сейчас',
        comment: 'Ожидается решение руководителя',
        actedAt: null
      };
    }

    return {
      ...st,
      decisionState: 'waiting',
      decisionLabel: req.status_code === 'DRAFT' ? 'Заявка еще не отправлена' : 'Ожидает предыдущего этапа',
      comment: null,
      actedAt: null
    };
  });
};

// Вспомогательные функции форматирования
const getTotalRequestDays = (req: any) => {
  if (!req?.periods) return 0;
  return req.periods.reduce((s: number, p: any) => s + (Number(p.vacation_days) || 0), 0);
};

// Понятный порядковый номер заявки (Заявка № 1, Заявка № 2 и т.д.)
const formatRequestNumber = (req: any) => {
  if (!req) return 'Заявка';
  const sorted = [...requests.value].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  const idx = sorted.findIndex(r => r.id === req.id);
  const num = idx !== -1 ? idx + 1 : (req.id || 1);
  return `Заявка № ${num}`;
};

const formatStageName = (stage: string, req?: any) => {
  switch (stage) {
    case 'EMPLOYEE':
      return 'У сотрудника (Черновик / Доработка)';
    case 'DIVISION_HEAD':
      return `У начальника управления (${req?.division_head_name || me.value?.division_head_name || ''})`;
    case 'DEPARTMENT_HEAD':
      return `У начальника департамента (${req?.department_head_name || me.value?.department_head_name || ''})`;
    case 'HR':
      return 'В отделе кадров (HR)';
    case 'ACCOUNTANT':
      return 'В бухгалтерии';
    case 'COMPLETED':
      return 'Полностью утверждена (В графике отпусков)';
    default:
      return stage;
  }
};

const formatStageSimple = (stage: string) => {
  const map: Record<string, string> = {
    EMPLOYEE: 'Сотрудник',
    DIVISION_HEAD: 'Начальник управления',
    DEPARTMENT_HEAD: 'Начальник департамента',
    HR: 'Отдел кадров (HR)',
    ACCOUNTANT: 'Бухгалтерия',
    COMPLETED: 'Завершено'
  };
  return map[stage] || stage;
};

const getTimelineMarkerClass = (code?: string) => {
  if (code === 'APPROVED') return 'marker-green';
  if (code === 'SENT') return 'marker-blue';
  if (code === 'REVISION') return 'marker-amber';
  return 'marker-gray';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean ? clean.split('-') : [];
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString('ru-RU');
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getInitials = (lastName?: string, firstName?: string) => {
  const l = (lastName || '').trim()[0] || '';
  const f = (firstName || '').trim()[0] || '';
  return `${l}${f}`.toUpperCase() || 'С';
};

const pluralYears = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.employee-cabinet {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading-state {
  background: #ffffff;
  border-radius: 16px;
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.spin-icon {
  animation: spin 1s linear infinite;
  color: #2563eb;
  margin-bottom: 12px;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.cabinet-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* =========================================================
   1. ШАПКА ПРОФИЛЯ СОТРУДНИКА
   ========================================================= */
.profile-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.profile-top {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  color: #ffffff;
  padding: 26px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 18px;
}

.avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.identity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.tab-badge {
  background: rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-badge {
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.employee-fullname {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.employee-pos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.92rem;
}

.limit-widget {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  padding: 14px 20px;
  min-width: 260px;
  backdrop-filter: blur(8px);
}

.limit-caption {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #93c5fd;
  margin-bottom: 4px;
  font-weight: 600;
}

.limit-number {
  font-size: 1.85rem;
  font-weight: 800;
  color: #34d399;
  line-height: 1.1;
}

.limit-number small {
  font-size: 0.85rem;
  font-weight: 500;
  color: #e2e8f0;
  margin-left: 4px;
}

.limit-breakdown {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.78rem;
  color: #cbd5e1;
  display: flex;
  gap: 6px;
}

/* Сетка кадровых данных и руководителей */
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  padding: 20px 26px;
  background: #f8fafc;
}

.info-tile {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 13px 15px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
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

.tile-icon.blue { background: #eff6ff; color: #2563eb; }
.tile-icon.indigo { background: #eef2ff; color: #4f46e5; }
.tile-icon.amber { background: #fffbeb; color: #d97706; }
.tile-icon.purple { background: #f3e8ff; color: #7e22ce; }
.tile-icon.emerald { background: #ecfdf5; color: #059669; }

.tile-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tile-label {
  font-size: 0.73rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.02em;
}

.tile-value {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.tile-sub {
  font-size: 0.78rem;
  color: #64748b;
}

/* =========================================================
   2. ПАНЕЛЬ ВКЛАДОК КАБИНЕТА
   ========================================================= */
.cabinet-tabs-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  background: #ffffff;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
}

.tabs-left {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.tab-btn.active {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.tab-pill {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 700;
}

.pill-draft { background: #e2e8f0; color: #334155; }
.pill-sent { background: #dbeafe; color: #1e40af; }
.pill-approved { background: #d1fae5; color: #065f46; }
.pill-revision { background: #fef3c7; color: #92400e; }

.tab-count {
  background: #e2e8f0;
  color: #334155;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.year-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.year-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
}

.year-buttons {
  display: flex;
  gap: 6px;
}

.year-chip {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.year-chip.active {
  background: #1e293b;
  color: #ffffff;
  border-color: #1e293b;
}

/* =========================================================
   3. ВКЛАДКА «ЗАЯВКА» — ПРИГЛАШЕНИЕ СОЗДАТЬ ЗАЯВКУ (CTA)
   ========================================================= */
.empty-request-cta {
  background: #ffffff;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
  padding: 48px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.cta-icon-circle {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-request-cta h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #0f172a;
}

.cta-desc {
  margin: 0;
  max-width: 600px;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.cta-supervisors {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  color: #475569;
}

.btn-open-create {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-open-create:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.32);
}

/* =========================================================
   4. ФОРМА ЗАПОЛНЕНИЯ ЗАЯВКИ
   ========================================================= */
.request-form-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  padding: 26px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-title-group h3 {
  margin: 0 0 4px;
  font-size: 1.2rem;
  color: #0f172a;
}

.header-title-group p {
  margin: 0;
  font-size: 0.86rem;
  color: #64748b;
}

.btn-close-form {
  background: #f1f5f9;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.balance-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
}

.balance-metrics {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.m-label { color: #64748b; }
.m-val { font-weight: 800; color: #0f172a; }
.text-danger { color: #dc2626 !important; }
.text-emerald { color: #059669 !important; }

.rule-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.83rem;
}

.rule-ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.rule-warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

.split-mode-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.split-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: #475569;
}

.split-buttons {
  display: flex;
  gap: 8px;
}

.split-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}

.split-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.periods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 18px;
}

.period-editor-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.period-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.part-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #0f172a;
  font-size: 0.95rem;
}

.part-rule-tag {
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tag-green { background: #d1fae5; color: #065f46; }
.tag-gray { background: #e2e8f0; color: #475569; }

.period-inputs-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

.req { color: #ef4444; }

.field-input {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font-size: 0.9rem;
  color: #0f172a;
  outline: none;
}

.field-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.quick-days {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.q-chip {
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.74rem;
  font-weight: 600;
  color: #2563eb;
  cursor: pointer;
}

.q-chip:hover { background: #eff6ff; }

.period-preview-box {
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.84rem;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.p-lbl { color: #64748b; }
.p-val { color: #0f172a; font-weight: 600; }
.p-val.highlight { color: #059669; }
.p-val.bold { font-weight: 800; color: #1d4ed8; }

.validation-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.form-route-preview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.83rem;
}

.route-title {
  color: #64748b;
  font-weight: 600;
}

.route-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.r-chip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  color: #334155;
}

.r-arrow { color: #94a3b8; }

.form-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.right-btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-cancel {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-weight: 600;
  cursor: pointer;
}

.btn-save-draft {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-weight: 600;
  cursor: pointer;
}

.btn-submit-send {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.btn-submit-send:disabled,
.btn-save-draft:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* =========================================================
   5. КАРТОЧКА ТЕКУЩЕЙ ЗАЯВКИ (ПОСЛЕ ОТПРАВКИ)
   ========================================================= */
.active-request-summary-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.summary-top-banner {
  padding: 22px 26px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.banner-sent { background: linear-gradient(135deg, #eff6ff, #f8fafc); }
.banner-approved { background: linear-gradient(135deg, #ecfdf5, #f8fafc); }
.banner-revision { background: linear-gradient(135deg, #fffbeb, #f8fafc); }
.banner-draft { background: #f8fafc; }

.req-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.req-code-badge {
  background: #0f172a;
  color: #ffffff;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.req-year-badge {
  background: #dbeafe;
  color: #1e40af;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.req-created {
  font-size: 0.8rem;
  color: #64748b;
}

.summary-heading {
  margin: 0;
  font-size: 1.25rem;
  color: #0f172a;
}

.summary-status-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.status-pill-lg {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.84rem;
  font-weight: 700;
}

.status-pill-sm {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-draft { background: #e2e8f0; color: #334155; }
.status-sent { background: #dbeafe; color: #1d4ed8; }
.status-approved { background: #d1fae5; color: #047857; }
.status-revision { background: #fef3c7; color: #b45309; }

.stage-caption {
  font-size: 0.82rem;
  color: #475569;
}

.revision-alert {
  margin: 18px 26px 0;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 14px 18px;
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.revision-alert p {
  margin: 4px 0 0;
  font-size: 0.9rem;
}

.draft-alert {
  margin: 18px 26px 0;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
}

.summary-body {
  padding: 22px 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.summary-periods-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-period-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
  display: grid;
  grid-template-columns: 90px 1.3fr 1fr 1.2fr;
  align-items: center;
  gap: 12px;
}

.sp-part {
  font-weight: 800;
  color: #1e293b;
  font-size: 0.92rem;
}

.sp-dates {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  color: #0f172a;
}

.sp-days {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.days-pill {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.holidays-pill {
  background: #ecfdf5;
  color: #047857;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.sp-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  color: #475569;
}

.summary-approvers-mini {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.86rem;
}

.mini-approver {
  display: flex;
  gap: 6px;
}

.ma-label { color: #64748b; }
.ma-name { font-weight: 700; color: #0f172a; }

.summary-actions-bar {
  background: #f8fafc;
  padding: 16px 26px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.summary-right-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-details {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-details:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.btn-revoke-req {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #fecdd3;
  background: #fff1f2;
  color: #e11d48;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
}

.btn-revoke-req:hover { background: #ffe4e6; }

.btn-edit-req {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #b45309;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
}

.btn-send-now {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
}

/* =========================================================
   6. ВКЛАДКА «АРХИВ ЗАЯВОК»
   ========================================================= */
.archive-header-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.archive-header-card h3 {
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  color: #0f172a;
}

.archive-header-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.archive-filters {
  display: flex;
  gap: 8px;
}

.filter-chip {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
}

.filter-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.empty-archive {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 50px 20px;
  text-align: center;
  color: #64748b;
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.archive-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #cbd5e1;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.border-sent { border-left-color: #2563eb; }
.border-approved { border-left-color: #10b981; }
.border-revision { border-left-color: #f59e0b; }
.border-draft { border-left-color: #94a3b8; }

.arch-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.arch-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.arch-num {
  font-weight: 800;
  color: #0f172a;
  font-size: 1rem;
}

.arch-year {
  font-weight: 700;
  color: #1e40af;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.arch-stage {
  font-size: 0.82rem;
  color: #475569;
}

.arch-periods {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.arch-period-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.84rem;
  color: #334155;
}

.arch-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
}

.arch-actions {
  display: flex;
  gap: 8px;
}

.btn-arch-revoke {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #fecdd3;
  background: #fff1f2;
  color: #e11d48;
  font-weight: 600;
  font-size: 0.83rem;
  cursor: pointer;
}

.btn-arch-details {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn-arch-details:hover {
  border-color: #2563eb;
  color: #2563eb;
}

/* =========================================================
   7. МОДАЛЬНОЕ ОКНО «ПОДРОБНО» (2 ВКЛАДКИ)
   ========================================================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.detail-modal {
  background: #ffffff;
  width: 100%;
  max-width: 880px;
  max-height: calc(100vh - 32px);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 20px 26px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-shrink: 0;
}

.modal-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.m-req-num {
  background: #0f172a;
  color: #ffffff;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.modal-title-wrap h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #0f172a;
}

.modal-close-btn {
  background: #e2e8f0;
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 26px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.m-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #f8fafc;
  color: #475569;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.m-tab-btn.active {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.modal-body {
  padding: 22px 26px;
  overflow-y: auto;
  flex: 1;
}

.m-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
  gap: 12px;
}

.ov-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ov-lbl {
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #64748b;
}

.ov-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.ov-val.highlight { color: #1d4ed8; }
.ov-sub { font-size: 0.78rem; color: #64748b; }

.modal-revision-box {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  gap: 10px;
  font-size: 0.88rem;
}

.modal-revision-box p { margin: 4px 0 0; }

.section-subtitle {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: #0f172a;
}

.modal-periods-table-wrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.modal-periods-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.modal-periods-table th {
  background: #f8fafc;
  color: #475569;
  text-align: left;
  padding: 10px 14px;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.modal-periods-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
}

.tbl-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.tbl-badge.blue { background: #eff6ff; color: #1d4ed8; }
.tbl-badge.green { background: #ecfdf5; color: #047857; }

.sub-cell {
  display: flex;
  flex-direction: column;
}

.sub-cell small { color: #64748b; font-size: 0.76rem; }

/* Маршрут согласования в модалке */
.approval-chain-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 12px;
}

.chain-step-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  background: #ffffff;
}

.step-approved { border-left: 4px solid #10b981; background: #f0fdf4; }
.step-current { border-left: 4px solid #2563eb; background: #eff6ff; }
.step-revision { border-left: 4px solid #f59e0b; background: #fffbeb; }
.step-waiting { border-left: 4px solid #cbd5e1; background: #f8fafc; }

.step-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0f172a;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.step-role-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-role-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
}

.step-decision-badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.73rem;
  font-weight: 700;
}

.dec-approved { background: #d1fae5; color: #065f46; }
.dec-current { background: #dbeafe; color: #1e40af; }
.dec-revision { background: #fef3c7; color: #92400e; }
.dec-waiting { background: #e2e8f0; color: #475569; }

.step-person-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.step-comment {
  font-size: 0.83rem;
  color: #334155;
  font-style: italic;
}

.step-time {
  font-size: 0.75rem;
  color: #64748b;
}

/* Вкладка 2 модалки: История заявки (Timeline) */
.timeline-container {
  position: relative;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline-container::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #e2e8f0;
}

.timeline-item {
  position: relative;
}

.timeline-marker {
  position: absolute;
  left: -24px;
  top: 14px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px #cbd5e1;
}

.marker-green { background: #10b981; box-shadow: 0 0 0 2px #10b981; }
.marker-blue { background: #2563eb; box-shadow: 0 0 0 2px #2563eb; }
.marker-amber { background: #f59e0b; box-shadow: 0 0 0 2px #f59e0b; }
.marker-gray { background: #64748b; box-shadow: 0 0 0 2px #64748b; }

.timeline-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tl-actor {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: #0f172a;
}

.tl-role-badge {
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tl-pos {
  font-size: 0.8rem;
  color: #64748b;
}

.tl-date {
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
}

.tl-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tl-status {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.tl-status.old {
  background: #e2e8f0;
  color: #475569;
}

.tl-stage-tag {
  font-size: 0.78rem;
  color: #475569;
  margin-left: auto;
}

.tl-comment {
  margin: 0;
  font-size: 0.88rem;
  color: #334155;
  background: #ffffff;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.modal-footer {
  padding: 14px 26px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.btn-close-modal {
  padding: 9px 20px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 768px) {
  .summary-period-item {
    grid-template-columns: 1fr;
  }
  .period-inputs-row {
    grid-template-columns: 1fr;
  }
}

/* ВЫБОР ЛЕЧЕБНОГО ПОСОБИЯ В ФОРМЕ ОТПУСКА */
.health-benefit-selector {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s;
}

.health-benefit-selector:hover {
  border-color: #93c5fd;
  background: #f1f5f9;
}

.health-benefit-selector.active {
  border-color: #10b981;
  background: #ecfdf5;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
}

.health-benefit-selector input[type='radio'] {
  margin-top: 3px;
  accent-color: #059669;
  width: 17px;
  height: 17px;
  cursor: pointer;
}

.hb-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hb-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.hb-month-tag {
  background: #059669;
  color: #ffffff;
  padding: 2px 9px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
}

.hb-sub {
  font-size: 0.78rem;
  color: #475569;
}

.benefit-pill-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 6px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  font-size: 0.76rem;
  font-weight: 700;
}
</style>