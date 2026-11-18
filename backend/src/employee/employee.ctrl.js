const pool = require('../config/db');

// Вспомогательная функция: Расчет даты окончания с учетом праздников
const calculatePeriodsWithHolidays = async (periods, targetYear) => {
    const { rows: holidayRows } = await pool.query(
        'SELECT holiday_date FROM holidays WHERE year = $1 OR EXTRACT(YEAR FROM holiday_date) = $1',
        [targetYear]
    );
    const holidayStrings = holidayRows.map(h => {
        if (h.holiday_date instanceof Date) {
            return h.holiday_date.toISOString().split('T')[0];
        }
        return String(h.holiday_date).split('T')[0];
    });

    // Определяем, какой именно период (строго один!) отмечен для выплаты лечебного пособия
    const chosenIndex = periods.findIndex(p => Boolean(p.with_health_benefit));
    const benefitPartIndex = chosenIndex >= 0 ? chosenIndex : 0;

    return periods.map((period, idx) => {
        let currentDate = new Date(period.start_date);
        let remainingVacationDays = parseInt(period.vacation_days, 10);
        let holidaysCount = 0;

        while (remainingVacationDays > 0) {
            const dateStr = currentDate.toISOString().split('T')[0];

            if (holidayStrings.includes(dateStr)) {
                holidaysCount++;
            } else {
                remainingVacationDays--;
            }

            if (remainingVacationDays > 0) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        return {
            ...period,
            vacation_days: parseInt(period.vacation_days, 10),
            end_date: currentDate.toISOString().split('T')[0],
            holidays_count: holidaysCount,
            with_health_benefit: idx === benefitPartIndex
        };
    });
};

// Валидация периодов отпуска (включая правило >= 14 дней по ст. 92 ТК РК)
const validatePeriods = (periods, totalAllowed) => {
    if (!periods || !Array.isArray(periods) || periods.length === 0 || periods.length > 2) {
        throw new Error('Заявка должна содержать 1 или 2 периода отпуска');
    }

    for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        if (!p.start_date) {
            throw new Error(`Укажите дату начала для части ${i + 1}`);
        }
        const days = parseInt(p.vacation_days, 10);
        if (isNaN(days) || days < 1) {
            throw new Error(`Количество дней в части ${i + 1} должно быть не менее 1 дня`);
        }
    }

    const requestedDays = periods.reduce((sum, p) => sum + parseInt(p.vacation_days, 10), 0);
    if (requestedDays > totalAllowed) {
        throw new Error(`Превышен лимит дней отпуска. Доступно: ${totalAllowed} дн., запрошено: ${requestedDays} дн.`);
    }

    // Проверка условия >= 14 дней (как для 1 части, так и при разделении на 2 части)
    const hasAtLeast14Days = periods.some(p => parseInt(p.vacation_days, 10) >= 14);
    if (!hasAtLeast14Days) {
        if (periods.length === 1) {
            throw new Error('Продолжительность отпуска не может быть меньше 14 календарных дней (ст. 92 ТК РК)');
        } else {
            throw new Error('При разделении отпуска на части хотя бы одна из частей должна быть не менее 14 календарных дней (ст. 92 ТК РК)');
        }
    }
};

// 1. Получить свои данные, руководителей, коллег для замещения и лимит отпуска (GET /api/employee/me)
const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                u.id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                u.department_id,
                u.division_id,
                d.region_id,
                COALESCE(reg.is_central, true) AS is_central,
                reg.name AS region_name,
                d.name AS department_name,
                div.name AS division_name,
                p.title AS position_title,
                r.code AS role_code,
                r.name AS role_name,
                slr.base_days,
                slr.additional_days,
                (slr.base_days + slr.additional_days) AS total_allowed_days,
                -- Начальник управления
                COALESCE(
                    NULLIF(TRIM(CONCAT(div_head.last_name, ' ', div_head.first_name, ' ', COALESCE(div_head.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(u2.last_name, ' ', u2.first_name, ' ', COALESCE(u2.middle_name, '')))
                        FROM users u2
                        JOIN roles r2 ON u2.role_id = r2.id
                        WHERE u2.division_id = u.division_id AND r2.code = 'DIVISION_HEAD' AND u2.is_active = TRUE
                        LIMIT 1
                    )
                ) AS division_head_name,
                COALESCE(
                    div_head_pos.title,
                    (
                        SELECT p2.title
                        FROM users u2
                        JOIN roles r2 ON u2.role_id = r2.id
                        LEFT JOIN positions p2 ON u2.position_id = p2.id
                        WHERE u2.division_id = u.division_id AND r2.code = 'DIVISION_HEAD' AND u2.is_active = TRUE
                        LIMIT 1
                    )
                ) AS division_head_position,
                -- Начальник департамента
                COALESCE(
                    NULLIF(TRIM(CONCAT(dep_head.last_name, ' ', dep_head.first_name, ' ', COALESCE(dep_head.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(u3.last_name, ' ', u3.first_name, ' ', COALESCE(u3.middle_name, '')))
                        FROM users u3
                        JOIN roles r3 ON u3.role_id = r3.id
                        WHERE u3.department_id = u.department_id AND r3.code = 'DEPARTMENT_HEAD' AND u3.is_active = TRUE
                        LIMIT 1
                    )
                ) AS department_head_name,
                COALESCE(
                    dep_head_pos.title,
                    (
                        SELECT p3.title
                        FROM users u3
                        JOIN roles r3 ON u3.role_id = r3.id
                        LEFT JOIN positions p3 ON u3.position_id = p3.id
                        WHERE u3.department_id = u.department_id AND r3.code = 'DEPARTMENT_HEAD' AND u3.is_active = TRUE
                        LIMIT 1
                    )
                ) AS department_head_position
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN divisions div ON u.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN seniority_leave_rules slr 
                ON slr.min_years <= u.service_years 
               AND (slr.max_years >= u.service_years OR slr.max_years IS NULL)
            LEFT JOIN users div_head ON div.head_id = div_head.id
            LEFT JOIN positions div_head_pos ON div_head.position_id = div_head_pos.id
            LEFT JOIN users dep_head ON d.head_id = dep_head.id
            LEFT JOIN positions dep_head_pos ON dep_head.position_id = dep_head_pos.id
            WHERE u.id = $1
        `;
        const { rows } = await pool.query(query, [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        const profile = rows[0];

        // Список коллег (только роль EMPLOYEE) для выбора замещающего сотрудника
        const colleaguesRes = await pool.query(`
            SELECT 
                u.id,
                TRIM(CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, ''))) AS full_name,
                p.title AS position_title,
                div.name AS division_name
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN divisions div ON u.division_id = div.id
            WHERE u.is_active = TRUE 
              AND u.id != $1
              AND rl.code NOT IN ('DIVISION_HEAD', 'DEPARTMENT_HEAD', 'ADMIN')
              AND (u.division_id = $2 OR u.department_id = $3)
            ORDER BY (u.division_id = $2) DESC, u.last_name ASC
        `, [userId, profile.division_id, profile.department_id]);

        // Праздничные дни для точного предпросмотра на фронтенде
        const holidaysRes = await pool.query(`
            SELECT id, holiday_date, name, year 
            FROM holidays 
            ORDER BY holiday_date ASC
        `);

        res.json({
            ...profile,
            colleagues: colleaguesRes.rows,
            holidays: holidaysRes.rows.map(h => ({
                ...h,
                holiday_date: h.holiday_date instanceof Date
                    ? h.holiday_date.toISOString().split('T')[0]
                    : String(h.holiday_date).split('T')[0]
            }))
        });
    } catch (error) {
        console.error('Ошибка getMe:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// Вспомогательная функция определения начального этапа согласования и целевого кадровика (target_hr_id)
const resolveRoutingForUser = async (client, user, action, targetYear) => {
    const roleCode = user.role_code;
    const isCentral = user.is_central !== false && Number(user.region_id || 1) === 1;

    // А. В ЦА (is_central = true) начальники департаментов (DEPARTMENT_HEAD) и их заместители (DEPT_DEPUTY) заблокированы на подачу (403)
    if (isCentral && (roleCode === 'DEPARTMENT_HEAD' || roleCode === 'DEPT_DEPUTY')) {
        const err = new Error('Начальники департаментов ЦА и их заместители не отправляют заявки на отпуск через платформу (403)');
        err.statusCode = 403;
        throw err;
    }

    // Находим Кадровика ЦА (по умолчанию id = 4, Еркежан)
    let centralHrId = 4;
    const centralHrRes = await client.query(`
        SELECT u.id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE r.code = 'HR' AND COALESCE(d.region_id, 1) = 1 AND u.is_active = TRUE
        ORDER BY (u.id = 4) DESC, u.id ASC
        LIMIT 1
    `);
    if (centralHrRes.rows.length > 0) {
        centralHrId = centralHrRes.rows[0].id;
    }

    // Б.1. Начальники департаментов ДЭР (DEPARTMENT_HEAD) и Заместители департаментов ДЭР (DEPT_DEPUTY):
    // Заявка Зама ДЭР сначала проверяется и утверждается Начальником департамента ДЭР,
    // после чего Начальник департамента ДЭР заполняет свою заявку и отправляет ОБЕ заявки (свою + утвержденную заявку Зама) Кадровику ЦА (id = 4).
    // По отдельности ни Зам, ни Начальник департамента ДЭР к Кадровику ЦА не уходят!
    if (!isCentral && (roleCode === 'DEPARTMENT_HEAD' || roleCode === 'DEPT_DEPUTY')) {
        if (action !== 'SEND') {
            return {
                statusCode: 'DRAFT',
                currentStage: 'EMPLOYEE',
                targetHrId: centralHrId,
                isDivisionChecked: false,
                isDepartmentChecked: false,
                deputyRequestIdsToPromote: [],
                historyComment: 'Создан черновик заявки на отпуск'
            };
        }

        if (roleCode === 'DEPARTMENT_HEAD') {
            // Проверяем, есть ли в этом департаменте ДЭР активный Заместитель начальника департамента (DEPT_DEPUTY)
            const deputiesRes = await client.query(`
                SELECT 
                    u.id AS deputy_user_id,
                    u.last_name,
                    u.first_name,
                    r.id AS request_id,
                    r.current_stage,
                    COALESCE(r.is_department_checked, false) AS is_department_checked,
                    rs.code AS status_code
                FROM users u
                JOIN roles rl ON u.role_id = rl.id
                LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $2
                LEFT JOIN request_statuses rs ON r.status_id = rs.id
                WHERE u.department_id = $1
                  AND u.is_active = TRUE
                  AND rl.code = 'DEPT_DEPUTY'
            `, [user.department_id, targetYear]);

            const deputies = deputiesRes.rows;
            const notApprovedDeputies = deputies.filter(dep => {
                if (!dep.request_id || !dep.status_code || ['DRAFT', 'REVISION', 'REJECTED'].includes(dep.status_code)) {
                    return true;
                }
                if (dep.status_code === 'APPROVED' && ['HR', 'ACCOUNTING'].includes(dep.current_stage)) {
                    return false;
                }
                return !(dep.current_stage === 'DEPARTMENT_HEAD' && dep.status_code === 'SENT' && dep.is_department_checked);
            });

            if (notApprovedDeputies.length > 0) {
                const depNames = notApprovedDeputies.map(d => `${d.last_name} ${d.first_name}`).join(', ');
                throw new Error(
                    `Нельзя отправить заявку Начальника департамента ДЭР в ЦА отдельно от заместителя! Сначала Заместитель начальника департамента (${depNames}) должен подать заявку, и вы должны утвердить её во вкладке «1. Входящие заявки» (пока вы можете нажать «Сохранить в черновик»). После утверждения заявки заместителя обе заявки отправятся Кадровику ЦА вместе.`
                );
            }

            const deputyRequestIdsToPromote = deputies
                .filter(dep => dep.request_id && dep.current_stage === 'DEPARTMENT_HEAD' && dep.status_code === 'SENT')
                .map(dep => dep.request_id);

            return {
                statusCode: 'APPROVED',
                currentStage: 'HR',
                targetHrId: centralHrId,
                isDivisionChecked: true,
                isDepartmentChecked: true,
                deputyRequestIdsToPromote,
                historyComment: 'Начальник департамента ДЭР сформировал и отправил пакет руководства департамента (совместно с утвержденной заявкой Заместителя) Кадровику Центрального Аппарата (HR ЦА)'
            };
        }

        // Для Заместителя начальника департамента ДЭР (DEPT_DEPUTY): поступает во Входящие к Начальнику своего департамента ДЭР на утверждение
        return {
            statusCode: 'SENT',
            currentStage: 'DEPARTMENT_HEAD',
            targetHrId: centralHrId,
            isDivisionChecked: true,
            isDepartmentChecked: false,
            deputyRequestIdsToPromote: [],
            historyComment: 'Заместитель начальника департамента ДЭР отправил заявку на утверждение Начальнику департамента ДЭР (для последующей совместной отправки в HR ЦА)'
        };
    }

    // Определяем целевого кадровика для остальных ролей (в ЦА -> id = 4, в ДЭР -> местный кадровик своего ДЭР: 19 в Астане, 33 в Алматы)
    let targetHrId = centralHrId;
    if (!isCentral && user.region_id) {
        const hrRes = await client.query(`
            SELECT u.id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.code = 'HR' AND d.region_id = $1 AND u.is_active = TRUE
            ORDER BY u.id ASC
            LIMIT 1
        `, [user.region_id]);
        if (hrRes.rows.length > 0) {
            targetHrId = hrRes.rows[0].id;
        }
    }

    if (action !== 'SEND') {
        return {
            statusCode: 'DRAFT',
            currentStage: 'EMPLOYEE',
            targetHrId,
            isDivisionChecked: false,
            isDepartmentChecked: false,
            historyComment: 'Создан черновик заявки на отпуск'
        };
    }

    // А.2 / Б.2. Начальники управлений (DIVISION_HEAD) в ЦА и ДЭР:
    // По принципу 100% комплектности заявка Начальника управления сразу получает is_division_checked = true
    // и включается в пакет управления (отправляется в Департамент вместе со всем управлением, когда готово 100% штата управления)
    if (roleCode === 'DIVISION_HEAD') {
        return {
            statusCode: 'SENT',
            currentStage: 'DIVISION_HEAD',
            targetHrId,
            isDivisionChecked: true,
            isDepartmentChecked: false,
            historyComment: 'Начальник управления заполнил и включил свою заявку в сводный график управления'
        };
    }

    // А.3 / Б.3. Обычные сотрудники, Зам. нач. управления, Кадровики, Бухгалтеры (EMPLOYEE, DIV_DEPUTY, HR, ACCOUNTANT):
    // Подают заявку -> попадает в шлюз Управления (DIVISION_HEAD) на локальную проверку начальнику управления
    return {
        statusCode: 'SENT',
        currentStage: 'DIVISION_HEAD',
        targetHrId,
        isDivisionChecked: false,
        isDepartmentChecked: false,
        historyComment: 'Сотрудник создал и отправил заявку начальнику управления для включения в график управления'
    };
};

// 2. Создать заявку (Черновик или Отправить) (POST /api/employee/requests)
const createRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        const { target_year, action, periods } = req.body; // action: 'DRAFT' или 'SEND'
        const userId = req.user.id;
        const divisionId = req.user.division_id || null;
        const departmentId = req.user.department_id || null;

        await client.query('BEGIN');

        // Определяем маршрут и проверяем права на подачу (403 для DEPARTMENT_HEAD / DEPT_DEPUTY ЦА)
        const routing = await resolveRoutingForUser(client, req.user, action, target_year);

        if (!divisionId && !departmentId) {
            return res.status(400).json({ error: 'У пользователя не указано подразделение' });
        }

        // Проверяем, нет ли уже заявки на этот год
        const existingRes = await client.query(
            'SELECT id FROM requests WHERE employee_id = $1 AND target_year = $2',
            [userId, target_year]
        );
        if (existingRes.rows.length > 0) {
            throw new Error(`Заявка на ${target_year} год уже создана. Отредактируйте существующую заявку.`);
        }

        // 1. Проверяем лимит дней сотрудника и правило >= 14 дней
        const userRes = await client.query(`
            SELECT (base_days + additional_days) as total_allowed 
            FROM seniority_leave_rules 
            WHERE min_years <= $1 AND (max_years >= $1 OR max_years IS NULL)
        `, [req.user.service_years]);
        const totalAllowed = userRes.rows[0]?.total_allowed || 30;

        validatePeriods(periods, totalAllowed);

        // Расчет праздников и проверка пересечения периодов
        const calculatedPeriods = await calculatePeriodsWithHolidays(periods, target_year);
        if (calculatedPeriods.length === 2) {
            const [p1, p2] = calculatedPeriods;
            if (!(p1.end_date < p2.start_date || p2.end_date < p1.start_date)) {
                throw new Error('Периоды отпуска пересекаются между собой по датам');
            }
        }

        // 2. Получаем ID статусов
        const { statusCode, currentStage, targetHrId, isDivisionChecked, isDepartmentChecked, historyComment } = routing;
        const statusRes = await client.query('SELECT id FROM request_statuses WHERE code = $1', [statusCode]);
        const statusId = statusRes.rows[0].id;

        // 3. Создаем шапку заявки с понятным порядковым номером
        const seqRes = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_num FROM requests');
        const requestNumber = `Заявка № ${seqRes.rows[0].next_num}`;
        const reqInsert = await client.query(`
            INSERT INTO requests (
                request_number, employee_id, division_id, department_id, status_id,
                target_year, total_allowed_days, current_stage, target_hr_id,
                is_division_checked, is_department_checked
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
        `, [
            requestNumber,
            userId,
            divisionId,
            departmentId,
            statusId,
            target_year,
            totalAllowed,
            currentStage,
            targetHrId,
            Boolean(isDivisionChecked),
            Boolean(isDepartmentChecked)
        ]);
        const requestId = reqInsert.rows[0].id;

        // 4. Вставка периодов (замещающего сотрудника может указывать только Начальник управления DIVISION_HEAD)
        const allowSubstitute = req.user.role_code === 'DIVISION_HEAD';
        for (let i = 0; i < calculatedPeriods.length; i++) {
            const p = calculatedPeriods[i];
            const subId = allowSubstitute ? (p.substitute_user_id || null) : null;
            await client.query(`
                INSERT INTO request_periods (request_id, part_number, start_date, end_date, vacation_days, holidays_count, substitute_user_id, with_health_benefit)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [requestId, i + 1, p.start_date, p.end_date, p.vacation_days, p.holidays_count, subId, Boolean(p.with_health_benefit)]);
        }

        // 5. Запись в историю
        await client.query(`
            INSERT INTO request_history (request_id, acted_by, to_status_id, stage, comment)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            requestId,
            userId,
            statusId,
            currentStage,
            historyComment
        ]);

        // Если Начальник департамента ДЭР отправляет свою заявку и у него есть утвержденная заявка Зама — отправляем заявку Зама вместе с ним в HR ЦА!
        if (routing.deputyRequestIdsToPromote && routing.deputyRequestIdsToPromote.length > 0) {
            for (const depReqId of routing.deputyRequestIdsToPromote) {
                await client.query(`
                    UPDATE requests
                    SET status_id = $1,
                        current_stage = 'HR',
                        target_hr_id = $2,
                        is_department_checked = TRUE,
                        updated_at = NOW()
                    WHERE id = $3
                `, [statusId, targetHrId, depReqId]);

                await client.query(`
                    INSERT INTO request_history (request_id, acted_by, to_status_id, stage, comment)
                    VALUES ($1, $2, $3, 'HR', 'Утвержденная заявка Заместителя начальника департамента ДЭР отправлена в Кадры ЦА совместно с заявкой Начальника департамента ДЭР')
                `, [depReqId, userId, statusId]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Заявка успешно сохранена', request_id: requestId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка createRequest:', error);
        const code = error.statusCode || 400;
        res.status(code).json({ error: error.message || 'Ошибка создания заявки' });
    } finally {
        client.release();
    }
};

// 3. Получить свои заявки с периодами, маршрутом согласования и полной историей (GET /api/employee/requests)
const getMyRequests = async (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.total_allowed_days,
                r.current_stage,
                COALESCE(r.is_division_checked, false) AS is_division_checked,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                r.revision_comment,
                r.created_at,
                r.updated_at,
                rs.code AS status_code,
                rs.name AS status_name,
                div.name AS division_name,
                d.name AS department_name,
                -- ФИО согласующих лиц по маршруту
                COALESCE(
                    NULLIF(TRIM(CONCAT(div_head.last_name, ' ', div_head.first_name, ' ', COALESCE(div_head.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(u2.last_name, ' ', u2.first_name, ' ', COALESCE(u2.middle_name, '')))
                        FROM users u2
                        JOIN roles r2 ON u2.role_id = r2.id
                        WHERE u2.division_id = u.division_id AND r2.code = 'DIVISION_HEAD' AND u2.is_active = TRUE
                        LIMIT 1
                    )
                ) AS division_head_name,
                COALESCE(
                    NULLIF(TRIM(CONCAT(dep_head.last_name, ' ', dep_head.first_name, ' ', COALESCE(dep_head.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(u3.last_name, ' ', u3.first_name, ' ', COALESCE(u3.middle_name, '')))
                        FROM users u3
                        JOIN roles r3 ON u3.role_id = r3.id
                        WHERE u3.department_id = u.department_id AND r3.code = 'DEPARTMENT_HEAD' AND u3.is_active = TRUE
                        LIMIT 1
                    )
                ) AS department_head_name,
                COALESCE(
                    NULLIF(TRIM(CONCAT(target_hr.last_name, ' ', target_hr.first_name, ' ', COALESCE(target_hr.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(uhr.last_name, ' ', uhr.first_name, ' ', COALESCE(uhr.middle_name, '')))
                        FROM users uhr
                        JOIN roles rhr ON uhr.role_id = rhr.id
                        LEFT JOIN departments dhr ON uhr.department_id = dhr.id
                        WHERE rhr.code = 'HR'
                          AND COALESCE(dhr.region_id, 1) = COALESCE(d.region_id, 1)
                          AND uhr.is_active = TRUE
                        LIMIT 1
                    )
                ) AS hr_name,
                (
                    SELECT TRIM(CONCAT(uacc.last_name, ' ', uacc.first_name, ' ', COALESCE(uacc.middle_name, '')))
                    FROM users uacc
                    JOIN roles racc ON uacc.role_id = racc.id
                    LEFT JOIN departments dacc ON uacc.department_id = dacc.id
                    WHERE racc.code = 'ACCOUNTANT'
                      AND COALESCE(dacc.region_id, 1) = COALESCE(d.region_id, 1)
                      AND uacc.is_active = TRUE
                    LIMIT 1
                ) AS accountant_name,
                -- Периоды отпуска
                (
                    SELECT json_agg(json_build_object(
                        'id', rp.id,
                        'part_number', rp.part_number,
                        'start_date', rp.start_date,
                        'end_date', rp.end_date,
                        'vacation_days', rp.vacation_days,
                        'holidays_count', rp.holidays_count,
                        'with_health_benefit', COALESCE(rp.with_health_benefit, rp.part_number = 1),
                        'substitute_user_id', rp.substitute_user_id,
                        'substitute_name', CASE 
                            WHEN sub_u.id IS NOT NULL THEN TRIM(CONCAT(sub_u.last_name, ' ', sub_u.first_name, ' ', COALESCE(sub_u.middle_name, '')))
                            ELSE NULL
                        END,
                        'substitute_position', sub_p.title
                    ) ORDER BY rp.part_number ASC)
                    FROM request_periods rp
                    LEFT JOIN users sub_u ON rp.substitute_user_id = sub_u.id
                    LEFT JOIN positions sub_p ON sub_u.position_id = sub_p.id
                    WHERE rp.request_id = r.id
                ) AS periods,
                -- Полная история действий
                (
                    SELECT json_agg(json_build_object(
                        'id', rh.id,
                        'stage', rh.stage,
                        'comment', rh.comment,
                        'created_at', rh.created_at,
                        'from_status_code', fs.code,
                        'from_status_name', fs.name,
                        'to_status_code', ts.code,
                        'to_status_name', ts.name,
                        'acted_by_name', TRIM(CONCAT(act_u.last_name, ' ', act_u.first_name, ' ', COALESCE(act_u.middle_name, ''))),
                        'acted_by_role', act_r.name,
                        'acted_by_role_code', act_r.code,
                        'acted_by_position', act_p.title
                    ) ORDER BY rh.created_at ASC, rh.id ASC)
                    FROM request_history rh
                    LEFT JOIN request_statuses fs ON rh.from_status_id = fs.id
                    LEFT JOIN request_statuses ts ON rh.to_status_id = ts.id
                    LEFT JOIN users act_u ON rh.acted_by = act_u.id
                    LEFT JOIN roles act_r ON act_u.role_id = act_r.id
                    LEFT JOIN positions act_p ON act_u.position_id = act_p.id
                    WHERE rh.request_id = r.id
                ) AS history
            FROM requests r
            JOIN request_statuses rs ON r.status_id = rs.id
            JOIN users u ON r.employee_id = u.id
            LEFT JOIN divisions div ON r.division_id = div.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN users div_head ON div.head_id = div_head.id
            LEFT JOIN users dep_head ON d.head_id = dep_head.id
            LEFT JOIN users target_hr ON r.target_hr_id = target_hr.id
            WHERE r.employee_id = $1
            ORDER BY r.target_year DESC, r.created_at DESC
        `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getMyRequests:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// 4. Редактирование черновика или заявки на доработке (PATCH /api/employee/requests/:id)
const updateRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        const requestId = req.params.id;
        const { periods, action } = req.body; // action: 'DRAFT' или 'SEND'
        const userId = req.user.id;

        await client.query('BEGIN');

        const checkRes = await client.query(`
            SELECT r.*, rs.code as status_code 
            FROM requests r 
            JOIN request_statuses rs ON r.status_id = rs.id 
            WHERE r.id = $1 AND r.employee_id = $2
        `, [requestId, userId]);

        if (checkRes.rows.length === 0) throw new Error('Заявка не найдена');
        const reqData = checkRes.rows[0];

        if (reqData.status_code !== 'DRAFT' && reqData.status_code !== 'REVISION') {
            throw new Error('Редактировать можно только черновики или заявки на доработке');
        }

        // Валидация периодов и правила >= 14 дней
        if (periods && periods.length > 0) {
            validatePeriods(periods, reqData.total_allowed_days);
        }

        // Расчет праздников и проверка пересечения
        let calculatedPeriods = [];
        if (periods && periods.length > 0) {
            calculatedPeriods = await calculatePeriodsWithHolidays(periods, reqData.target_year);
            if (calculatedPeriods.length === 2) {
                const [p1, p2] = calculatedPeriods;
                if (!(p1.end_date < p2.start_date || p2.end_date < p1.start_date)) {
                    throw new Error('Периоды отпуска пересекаются между собой по датам');
                }
            }
        }

        // Обновляем статусы и пишем историю с учетом роли
        const routing = await resolveRoutingForUser(client, req.user, action, reqData.target_year);
        let statusId = reqData.status_id;
        let currentStage = reqData.current_stage;
        if (action === 'SEND') {
            const statusRes = await client.query('SELECT id FROM request_statuses WHERE code = $1', [routing.statusCode]);
            statusId = statusRes.rows[0].id;
            currentStage = routing.currentStage;

            await client.query(`
                UPDATE requests 
                SET status_id = $1,
                    current_stage = $2,
                    target_hr_id = $3,
                    is_division_checked = $4,
                    is_department_checked = $5,
                    revision_comment = NULL,
                    updated_at = NOW() 
                WHERE id = $6
            `, [
                statusId,
                currentStage,
                routing.targetHrId,
                Boolean(routing.isDivisionChecked),
                Boolean(routing.isDepartmentChecked),
                requestId
            ]);

            await client.query(`
                INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [requestId, userId, reqData.status_id, statusId, currentStage, routing.historyComment]);

            // Если Начальник департамента ДЭР отправляет свою заявку — одновременно переводим утвержденную заявку Зама в HR ЦА
            if (routing.deputyRequestIdsToPromote && routing.deputyRequestIdsToPromote.length > 0) {
                for (const depReqId of routing.deputyRequestIdsToPromote) {
                    await client.query(`
                        UPDATE requests
                        SET status_id = $1,
                            current_stage = 'HR',
                            target_hr_id = $2,
                            is_department_checked = TRUE,
                            updated_at = NOW()
                        WHERE id = $3
                    `, [statusId, routing.targetHrId, depReqId]);

                    await client.query(`
                        INSERT INTO request_history (request_id, acted_by, to_status_id, stage, comment)
                        VALUES ($1, $2, $3, 'HR', 'Утвержденная заявка Заместителя начальника департамента ДЭР отправлена в Кадры ЦА совместно с заявкой Начальника департамента ДЭР')
                    `, [depReqId, userId, statusId]);
                }
            }
        } else {
            await client.query(`
                UPDATE requests SET updated_at = NOW() WHERE id = $1
            `, [requestId]);

            await client.query(`
                INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [requestId, userId, reqData.status_id, statusId, currentStage, 'Сотрудник обновил черновик заявки']);
        }

        // Переписываем периоды (замещающего сотрудника указывает только Начальник управления DIVISION_HEAD)
        if (calculatedPeriods.length > 0) {
            await client.query('DELETE FROM request_periods WHERE request_id = $1', [requestId]);
            const allowSubstitute = req.user.role_code === 'DIVISION_HEAD';

            for (let i = 0; i < calculatedPeriods.length; i++) {
                const p = calculatedPeriods[i];
                const subId = allowSubstitute ? (p.substitute_user_id || null) : null;
                await client.query(`
                    INSERT INTO request_periods (request_id, part_number, start_date, end_date, vacation_days, holidays_count, substitute_user_id, with_health_benefit)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [requestId, i + 1, p.start_date, p.end_date, p.vacation_days, p.holidays_count, subId, Boolean(p.with_health_benefit)]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Заявка успешно обновлена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка updateRequest:', error);
        const code = error.statusCode || 400;
        res.status(code).json({ error: error.message || 'Ошибка обновления заявки' });
    } finally {
        client.release();
    }
};

// 5. Отозвать заявку до утверждения (PATCH /api/employee/requests/:id/revoke)
const revokeRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        const requestId = req.params.id;
        const userId = req.user.id;

        await client.query('BEGIN');

        const checkRes = await client.query(`
            SELECT r.*, rs.code as status_code 
            FROM requests r 
            JOIN request_statuses rs ON r.status_id = rs.id 
            WHERE r.id = $1 AND r.employee_id = $2
        `, [requestId, userId]);

        if (checkRes.rows.length === 0) throw new Error('Заявка не найдена');
        const reqData = checkRes.rows[0];

        if (reqData.status_code !== 'SENT') {
            throw new Error('Отозвать можно только отправленную заявку до ее утверждения');
        }
        const canRevokeByRole =
            reqData.current_stage === 'DIVISION_HEAD' ||
            (reqData.current_stage === 'DEPARTMENT_HEAD' &&
                (req.user.role_code === 'DIVISION_HEAD' || req.user.role_code === 'DEPT_DEPUTY'));
        if (!canRevokeByRole) {
            throw new Error('Отозвать заявку можно только до начала утверждения следующим руководителем');
        }

        const draftStatusRes = await client.query("SELECT id FROM request_statuses WHERE code = 'DRAFT'");
        const draftStatusId = draftStatusRes.rows[0].id;

        await client.query(`
            UPDATE requests
            SET status_id = $1,
                current_stage = 'EMPLOYEE',
                is_division_checked = FALSE,
                is_department_checked = FALSE,
                updated_at = NOW()
            WHERE id = $2
        `, [draftStatusId, requestId]);

        await client.query(`
            INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [requestId, userId, reqData.status_id, draftStatusId, 'EMPLOYEE', 'Сотрудник отозвал заявку на редактирование']);

        await client.query('COMMIT');
        res.json({ message: 'Заявка успешно отозвана' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка revokeRequest:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getMe,
    createRequest,
    getMyRequests,
    updateRequest,
    revokeRequest
};
