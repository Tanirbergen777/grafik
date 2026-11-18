const pool = require('../config/db');

// 0. Профиль начальника управления + данные о руководителе департамента и штате (GET /api/division/me)
const getDivisionManagerProfile = async (req, res) => {
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
                d.name AS department_name,
                div.name AS division_name,
                p.title AS position_title,
                r.code AS role_code,
                r.name AS role_name,
                slr.base_days,
                slr.additional_days,
                (slr.base_days + slr.additional_days) AS total_allowed_days,
                -- Начальник управления (сам пользователь или назначенный)
                COALESCE(
                    NULLIF(TRIM(CONCAT(div_head.last_name, ' ', div_head.first_name, ' ', COALESCE(div_head.middle_name, ''))), ''),
                    TRIM(CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, '')))
                ) AS division_head_name,
                COALESCE(div_head_pos.title, p.title) AS division_head_position,
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
                ) AS department_head_position,
                (
                    SELECT COUNT(*)::int
                    FROM users u_cnt
                    JOIN roles r_cnt ON u_cnt.role_id = r_cnt.id
                    WHERE u_cnt.division_id = u.division_id
                      AND u_cnt.is_active = TRUE
                      AND r_cnt.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')
                ) AS total_division_employees,
                -- Список лиц, которым начальник управления может направить пакет (Начальник департамента или Заместитель начальника департамента)
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', u_app.id,
                                'full_name', TRIM(CONCAT(u_app.last_name, ' ', u_app.first_name, ' ', COALESCE(u_app.middle_name, ''))),
                                'role_code', r_app.code,
                                'role_name', r_app.name,
                                'position_title', COALESCE(p_app.title, r_app.name)
                            ) ORDER BY (r_app.code = 'DEPARTMENT_HEAD') DESC, u_app.id ASC
                        )
                        FROM users u_app
                        JOIN roles r_app ON u_app.role_id = r_app.id
                        LEFT JOIN positions p_app ON u_app.position_id = p_app.id
                        WHERE u_app.department_id = u.department_id
                          AND u_app.is_active = TRUE
                          AND r_app.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')
                    ),
                    '[]'::json
                ) AS department_approvers
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
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
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка getDivisionManagerProfile:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля начальника управления' });
    }
};

// 1. Аналитика квот: сколько сотрудников уходит в отпуск по месяцам + список сотрудников по каждому месяцу
const getDivisionQuota = async (req, res) => {
    try {
        const divisionId = req.user.division_id;
        const targetYear = parseInt(req.query.target_year, 10) || new Date().getFullYear() + 1;

        // Общее количество активных людей в управлении (все сотрудники управления + сам начальник управления)
        const totalEmpRes = await pool.query(
            `SELECT COUNT(*)::int as total 
             FROM users u
             JOIN roles rl ON u.role_id = rl.id
             WHERE u.division_id = $1
               AND u.is_active = true
               AND rl.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')`,
            [divisionId]
        );
        const totalEmployees = totalEmpRes.rows[0]?.total || 0;

        // Получаем все периоды заявок сотрудников этого управления на выбранный год
        // (включая находящиеся на рассмотрении SENT и утвержденные APPROVED)
        const periodsQuery = `
            SELECT 
                rp.id AS period_id,
                rp.part_number,
                rp.start_date,
                rp.end_date,
                rp.vacation_days,
                rp.holidays_count,
                r.id AS request_id,
                r.request_number,
                r.employee_id,
                r.current_stage,
                rs.code AS status_code,
                rs.name AS status_name,
                u.last_name,
                u.first_name,
                u.middle_name,
                p.title AS position_title
            FROM request_periods rp
            JOIN requests r ON rp.request_id = r.id
            JOIN request_statuses rs ON r.status_id = rs.id
            JOIN users u ON r.employee_id = u.id
            LEFT JOIN positions p ON u.position_id = p.id
            WHERE r.division_id = $1 
              AND r.target_year = $2
              AND rs.code IN ('SENT', 'APPROVED')
              AND r.current_stage != 'EMPLOYEE'
            ORDER BY rp.start_date ASC
        `;
        const { rows: periodRows } = await pool.query(periodsQuery, [divisionId, targetYear]);

        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        // Формируем аналитику по 12 месяцам (учитываем все месяцы, которые затрагивает период отпуска)
        const monthsData = Array.from({ length: 12 }, (_, i) => {
            const monthNum = i + 1;
            const monthStart = new Date(Date.UTC(targetYear, i, 1));
            const monthEnd = new Date(Date.UTC(targetYear, i + 1, 0, 23, 59, 59));

            const employeesMap = new Map();

            periodRows.forEach(row => {
                const pStart = new Date(row.start_date);
                const pEnd = new Date(row.end_date);

                if (pStart <= monthEnd && pEnd >= monthStart) {
                    const existing = employeesMap.get(row.employee_id);
                    const periodInfo = {
                        request_id: row.request_id,
                        request_number: row.request_number,
                        employee_id: row.employee_id,
                        full_name: `${row.last_name || ''} ${row.first_name || ''} ${row.middle_name || ''}`.trim(),
                        position_title: row.position_title,
                        part_number: row.part_number,
                        start_date: row.start_date,
                        end_date: row.end_date,
                        vacation_days: row.vacation_days,
                        holidays_count: row.holidays_count,
                        status_code: row.status_code,
                        status_name: row.status_name,
                        current_stage: row.current_stage
                    };

                    if (!existing) {
                        employeesMap.set(row.employee_id, periodInfo);
                    }
                }
            });

            const employeesInMonth = Array.from(employeesMap.values());
            const awayCount = employeesInMonth.length;
            const percent = totalEmployees > 0 ? Math.round((awayCount / totalEmployees) * 100) : 0;

            let load_level = 'SAFE'; // < 20%
            if (percent >= 30) {
                load_level = 'DANGER'; // >= 30% — перегруз (красный)
            } else if (percent >= 20) {
                load_level = 'WARNING'; // 20-29% — внимание (желтый)
            }

            return {
                month: monthNum,
                month_name: monthNames[i],
                away_count: awayCount,
                remaining_count: Math.max(0, totalEmployees - awayCount),
                percent: percent,
                is_warning: percent >= 30,
                load_level,
                employees: employeesInMonth
            };
        });

        res.json({
            target_year: targetYear,
            total_employees: totalEmployees,
            max_recommended_percent: 30,
            months_analytics: monthsData
        });
    } catch (error) {
        console.error('Ошибка getDivisionQuota:', error);
        res.status(500).json({ error: 'Ошибка расчета квот' });
    }
};

// 2. Входящие заявки (те, что ждут решения начальника управления)
const getIncomingRequests = async (req, res) => {
    try {
        const divisionId = req.user.division_id;
        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.total_allowed_days,
                r.current_stage,
                COALESCE(r.is_division_checked, false) AS is_division_checked,
                r.revision_comment,
                r.created_at,
                u.id AS employee_id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                p.title AS position_title,
                rl.code AS employee_role_code,
                rl.name AS employee_role_name,
                rs.code AS status_code,
                rs.name AS status_name,
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
                ) AS periods
            FROM requests r
            JOIN users u ON r.employee_id = u.id
            LEFT JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE r.division_id = $1 
              AND r.current_stage = 'DIVISION_HEAD' 
              AND rs.code = 'SENT'
            ORDER BY COALESCE(r.is_division_checked, false) ASC, r.created_at ASC
        `;
        const { rows } = await pool.query(query, [divisionId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getIncomingRequests:', error);
        res.status(500).json({ error: 'Ошибка получения входящих заявок' });
    }
};

// 3. Архив (заявки управления, по которым начальник управления уже принял решение)
const getArchiveRequests = async (req, res) => {
    try {
        const divisionId = req.user.division_id;
        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.total_allowed_days,
                r.current_stage,
                r.revision_comment,
                r.created_at,
                r.updated_at,
                u.id AS employee_id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                p.title AS position_title,
                rs.code AS status_code,
                rs.name AS status_name,
                -- Дата и комментарий последнего решения начальника управления из истории
                (
                    SELECT rh.created_at
                    FROM request_history rh
                    LEFT JOIN users au ON rh.acted_by = au.id
                    LEFT JOIN roles ar ON au.role_id = ar.id
                    WHERE rh.request_id = r.id
                      AND (rh.acted_by = $2 OR ar.code = 'DIVISION_HEAD')
                    ORDER BY rh.created_at DESC
                    LIMIT 1
                ) AS division_decided_at,
                (
                    SELECT rh.comment
                    FROM request_history rh
                    LEFT JOIN users au ON rh.acted_by = au.id
                    LEFT JOIN roles ar ON au.role_id = ar.id
                    WHERE rh.request_id = r.id
                      AND (rh.acted_by = $2 OR ar.code = 'DIVISION_HEAD')
                    ORDER BY rh.created_at DESC
                    LIMIT 1
                ) AS division_decision_comment,
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
                ) AS periods
            FROM requests r
            JOIN users u ON r.employee_id = u.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE r.division_id = $1 
              AND NOT (r.current_stage = 'DIVISION_HEAD' AND rs.code = 'SENT')
              AND rs.code != 'DRAFT'
            ORDER BY r.updated_at DESC, r.created_at DESC
        `;
        const { rows } = await pool.query(query, [divisionId, req.user.id]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getArchiveRequests:', error);
        res.status(500).json({ error: 'Ошибка получения архива заявок' });
    }
};

// 4. Детальный просмотр заявки (с периодами, цепочкой согласования и полной историей)
const getRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.total_allowed_days,
                r.current_stage,
                r.revision_comment,
                r.created_at,
                r.updated_at,
                rs.code AS status_code,
                rs.name AS status_name,
                u.id AS employee_id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                p.title AS position_title,
                div.name AS division_name,
                d.name AS department_name,
                -- ФИО согласующих лиц по маршруту
                COALESCE(
                    NULLIF(TRIM(CONCAT(div_head.last_name, ' ', div_head.first_name, ' ', COALESCE(div_head.middle_name, ''))), ''),
                    (
                        SELECT TRIM(CONCAT(u2.last_name, ' ', u2.first_name, ' ', COALESCE(u2.middle_name, '')))
                        FROM users u2
                        JOIN roles r2 ON u2.role_id = r2.id
                        WHERE u2.division_id = r.division_id AND r2.code = 'DIVISION_HEAD' AND u2.is_active = TRUE
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
                (
                    SELECT TRIM(CONCAT(uhr.last_name, ' ', uhr.first_name, ' ', COALESCE(uhr.middle_name, '')))
                    FROM users uhr
                    JOIN roles rhr ON uhr.role_id = rhr.id
                    WHERE rhr.code = 'HR' AND uhr.is_active = TRUE
                    LIMIT 1
                ) AS hr_name,
                (
                    SELECT TRIM(CONCAT(uacc.last_name, ' ', uacc.first_name, ' ', COALESCE(uacc.middle_name, '')))
                    FROM users uacc
                    JOIN roles racc ON uacc.role_id = racc.id
                    WHERE racc.code = 'ACCOUNTANT' AND uacc.is_active = TRUE
                    LIMIT 1
                ) AS accountant_name,
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
            JOIN users u ON r.employee_id = u.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN divisions div ON r.division_id = div.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN users div_head ON div.head_id = div_head.id
            LEFT JOIN users dep_head ON d.head_id = dep_head.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE r.id = $1
        `;
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Заявка не найдена' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка getRequestDetails:', error);
        res.status(500).json({ error: 'Ошибка получения деталей заявки' });
    }
};

// 5. Принятие решения по заявке (Утвердить / Отказать / На доработку)
const processRequestAction = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { action, comment } = req.body; // action: 'APPROVE', 'REJECT', 'REVISION'
        const userId = req.user.id;

        await client.query('BEGIN');

        // Проверяем заявку
        const checkRes = await client.query(`
            SELECT r.*, rs.code as status_code 
            FROM requests r 
            JOIN request_statuses rs ON r.status_id = rs.id 
            WHERE r.id = $1 AND r.division_id = $2 AND r.current_stage = 'DIVISION_HEAD'
        `, [id, req.user.division_id]);

        if (checkRes.rows.length === 0) {
            throw new Error('Заявка недоступна для обработки или уже рассмотрена');
        }
        const reqData = checkRes.rows[0];

        // Загружаем справочник статусов
        const statRes = await client.query('SELECT id, code FROM request_statuses');
        const statuses = {};
        statRes.rows.forEach(s => { statuses[s.code] = s.id; });

        let newStatusId;
        let newStage;
        let historyComment;

        if (action === 'APPROVE') {
            // Локальная проверка внутри управления ("Принять в график"):
            // Заявка НЕ улетает одна в Департамент, а получает признак is_division_checked = true
            // и ждет, пока будут готовы 100% сотрудников управления + сам начальник управления.
            newStatusId = statuses['SENT'];
            newStage = 'DIVISION_HEAD';
            historyComment = comment
                ? `Принято в график управления начальником управления (${comment}). Ожидает 100% комплектности управления`
                : 'Принято в график управления (локальное одобрение начальника управления). Ожидает 100% комплектности управления';

            await client.query(`
                UPDATE requests 
                SET is_division_checked = TRUE, revision_comment = NULL, updated_at = NOW() 
                WHERE id = $1
            `, [id]);

        } else if (action === 'REVISION') {
            if (!comment || !String(comment).trim()) {
                throw new Error('Для возврата на доработку обязательно укажите причину');
            }
            newStatusId = statuses['REVISION'];
            newStage = 'EMPLOYEE';
            historyComment = `Возвращено на доработку начальником управления: ${comment.trim()}`;

            await client.query(`
                UPDATE requests 
                SET status_id = $1, current_stage = $2, is_division_checked = FALSE, revision_comment = $3, updated_at = NOW() 
                WHERE id = $4
            `, [newStatusId, newStage, comment.trim(), id]);

        } else if (action === 'REJECT') {
            if (!comment || !String(comment).trim()) {
                throw new Error('При отказе обязательно укажите причину');
            }
            newStatusId = statuses['REJECTED'];
            newStage = 'DIVISION_HEAD';
            historyComment = `Отказано начальником управления: ${comment.trim()}`;

            await client.query(`
                UPDATE requests 
                SET status_id = $1, current_stage = $2, is_division_checked = FALSE, revision_comment = $3, updated_at = NOW() 
                WHERE id = $4
            `, [newStatusId, newStage, comment.trim(), id]);
        } else {
            throw new Error('Неизвестное действие');
        }

        // Пишем в историю
        await client.query(`
            INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, userId, reqData.status_id, newStatusId || reqData.status_id, newStage, historyComment]);

        await client.query('COMMIT');
        res.json({ message: 'Решение успешно сохранено' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка processRequestAction:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

// 6. Контроль подачи и 100% комплектности управления (все сотрудники управления + сам начальник управления) (GET /api/division/employees-status)
const getDivisionEmployeesStatus = async (req, res) => {
    try {
        const divisionId = req.user.division_id;
        const targetYear = parseInt(req.query.target_year, 10) || new Date().getFullYear() + 1;

        const query = `
            SELECT 
                u.id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                COALESCE(p.title, rl.name) AS position_title,
                rl.code AS role_code,
                rl.name AS role_name,
                (slr.base_days + slr.additional_days) AS total_allowed_days,
                r.id AS request_id,
                r.request_number,
                r.target_year,
                r.current_stage,
                COALESCE(r.is_division_checked, false) AS is_division_checked,
                r.created_at AS request_created_at,
                rs.code AS status_code,
                rs.name AS status_name,
                (
                    SELECT json_agg(json_build_object(
                        'part_number', rp.part_number,
                        'start_date', rp.start_date,
                        'end_date', rp.end_date,
                        'vacation_days', rp.vacation_days,
                        'holidays_count', rp.holidays_count
                    ) ORDER BY rp.part_number ASC)
                    FROM request_periods rp
                    WHERE rp.request_id = r.id
                ) AS periods
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN seniority_leave_rules slr 
                ON slr.min_years <= u.service_years 
               AND (slr.max_years >= u.service_years OR slr.max_years IS NULL)
            LEFT JOIN requests r 
                ON r.employee_id = u.id AND r.target_year = $2
            LEFT JOIN request_statuses rs 
                ON r.status_id = rs.id
            WHERE u.division_id = $1
              AND u.is_active = TRUE
              AND rl.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')
            ORDER BY 
                (CASE WHEN rl.code = 'DIVISION_HEAD' THEN 0 ELSE 1 END) ASC,
                (CASE WHEN r.id IS NOT NULL AND rs.code != 'DRAFT' THEN 0 ELSE 1 END) ASC,
                u.last_name ASC,
                u.first_name ASC
        `;
        const { rows } = await pool.query(query, [divisionId, targetYear]);

        const employees = rows.map(row => {
            const hasSubmitted = Boolean(
                row.request_id &&
                row.status_code &&
                !['DRAFT', 'REVISION', 'REJECTED'].includes(row.status_code)
            );
            const isCheckedInDivision = Boolean(
                hasSubmitted &&
                ((row.current_stage === 'DIVISION_HEAD' && (row.is_division_checked || row.role_code === 'DIVISION_HEAD')) ||
                 ['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(row.current_stage) ||
                 row.status_code === 'APPROVED')
            );

            let missingReason = null;
            if (!row.request_id || row.status_code === 'DRAFT') {
                missingReason = row.role_code === 'DIVISION_HEAD'
                    ? 'Начальник управления еще не заполнил свой отпуск («Мой отпуск»)'
                    : 'Не подал заявку';
            } else if (row.status_code === 'REVISION') {
                missingReason = 'На доработке у сотрудника';
            } else if (row.status_code === 'REJECTED') {
                missingReason = 'Отказано (требуется пересмотр)';
            } else if (!isCheckedInDivision) {
                missingReason = 'Ожидает проверки начальника («Принять в график»)';
            }

            return {
                ...row,
                has_submitted: hasSubmitted,
                is_ready_for_department: isCheckedInDivision,
                missing_reason: missingReason
            };
        });

        const totalEmployees = employees.length;
        const submittedCount = employees.filter(e => e.has_submitted).length;
        const readyCount = employees.filter(e => e.is_ready_for_department).length;
        const pendingAtDivisionCount = employees.filter(
            e => e.request_id && e.status_code === 'SENT' && e.current_stage === 'DIVISION_HEAD'
        ).length;

        const missingEmployees = employees
            .filter(e => !e.is_ready_for_department)
            .map(e => ({
                id: e.id,
                full_name: `${e.last_name} ${e.first_name} ${e.middle_name || ''}`.trim(),
                role_code: e.role_code,
                role_name: e.role_name,
                reason: e.missing_reason
            }));

        const canSubmitPackage =
            totalEmployees > 0 &&
            readyCount === totalEmployees &&
            pendingAtDivisionCount > 0;

        const isPackageAlreadySent =
            totalEmployees > 0 &&
            readyCount === totalEmployees &&
            pendingAtDivisionCount === 0;

        res.json({
            target_year: targetYear,
            total_employees: totalEmployees,
            submitted_count: submittedCount,
            not_submitted_count: totalEmployees - submittedCount,
            ready_count: readyCount,
            pending_at_division_count: pendingAtDivisionCount,
            can_submit_package: canSubmitPackage,
            is_package_already_sent: isPackageAlreadySent,
            missing_employees: missingEmployees,
            employees
        });
    } catch (error) {
        console.error('Ошибка getDivisionEmployeesStatus:', error);
        res.status(500).json({ error: 'Ошибка получения списка сотрудников управления' });
    }
};

// 7. Шлюз Управления: Отправить сводный график всего управления в Департамент (POST /api/division/submit-package)
const submitDivisionPackage = async (req, res) => {
    const client = await pool.connect();
    try {
        const divisionId = req.user.division_id;
        const departmentId = req.user.department_id;
        const userId = req.user.id;
        const targetYear = parseInt(req.body.target_year, 10) || new Date().getFullYear() + 1;
        const requestedApproverId = req.body.target_approver_id ? parseInt(req.body.target_approver_id, 10) : null;

        await client.query('BEGIN');

        // Определяем получателя пакета на уровне Департамента (Начальник департамента или его Заместитель)
        let approverUser = null;
        if (requestedApproverId) {
            const appRes = await client.query(`
                SELECT u.id, u.last_name, u.first_name, u.middle_name, r.code AS role_code, r.name AS role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1 AND u.department_id = $2 AND r.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')
            `, [requestedApproverId, departmentId]);
            approverUser = appRes.rows[0] || null;
        }
        if (!approverUser) {
            const defRes = await client.query(`
                SELECT u.id, u.last_name, u.first_name, u.middle_name, r.code AS role_code, r.name AS role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.department_id = $1 AND u.is_active = TRUE AND r.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')
                ORDER BY (r.code = 'DEPARTMENT_HEAD') DESC, u.id ASC
                LIMIT 1
            `, [departmentId]);
            approverUser = defRes.rows[0] || null;
        }

        const resolvedApproverId = approverUser ? approverUser.id : null;
        const approverDisplay = approverUser
            ? `${approverUser.role_name}: ${approverUser.last_name} ${approverUser.first_name}`
            : 'Руководитель департамента';

        // Проверяем 100% комплектность по всем активным людям управления (сотрудники + сам начальник управления)
        const staffRes = await client.query(`
            SELECT 
                u.id,
                u.last_name,
                u.first_name,
                rl.code AS role_code,
                r.id AS request_id,
                r.current_stage,
                COALESCE(r.is_division_checked, false) AS is_division_checked,
                rs.code AS status_code
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $2
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.division_id = $1
              AND u.is_active = TRUE
              AND rl.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')
        `, [divisionId, targetYear]);

        const staff = staffRes.rows;
        if (staff.length === 0) {
            throw new Error('В управлении нет активных сотрудников');
        }

        const notReady = staff.filter(s => {
            if (!s.request_id || !s.status_code || ['DRAFT', 'REVISION', 'REJECTED'].includes(s.status_code)) {
                return true;
            }
            if (s.current_stage === 'DIVISION_HEAD' && !s.is_division_checked && s.role_code !== 'DIVISION_HEAD') {
                return true;
            }
            return false;
        });

        if (notReady.length > 0) {
            const names = notReady.map(s => `${s.last_name} ${s.first_name}`).join(', ');
            throw new Error(`Невозможно отправить неполный график управления! Ожидается готовность (${notReady.length} чел.): ${names}`);
        }

        // Переводим все заявки управления за этот год с этапа DIVISION_HEAD на этап DEPARTMENT_HEAD с указанием выбранного согласующего (Нач. деп. или Зам. нач. деп.)
        const updateRes = await client.query(`
            UPDATE requests
            SET current_stage = 'DEPARTMENT_HEAD',
                target_approver_id = $3,
                is_division_checked = TRUE,
                is_department_checked = FALSE,
                revision_comment = NULL,
                updated_at = NOW()
            WHERE division_id = $1
              AND target_year = $2
              AND current_stage = 'DIVISION_HEAD'
              AND status_id = (SELECT id FROM request_statuses WHERE code = 'SENT')
            RETURNING id, status_id
        `, [divisionId, targetYear, resolvedApproverId]);

        if (updateRes.rows.length === 0) {
            throw new Error('Сводный график управления уже был отправлен в Департамент');
        }

        for (const rRow of updateRes.rows) {
            await client.query(`
                INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
                VALUES ($1, $2, $3, $3, 'DEPARTMENT_HEAD', $4)
            `, [
                rRow.id,
                userId,
                rRow.status_id,
                `Сводный график управления (100% комплектность) утвержден начальником управления и направлен на согласование — ${approverDisplay}`
            ]);
        }

        await client.query('COMMIT');
        res.json({
            message: `Сводный график управления (${staff.length} из ${staff.length} чел.) успешно отправлен (${approverDisplay})!`,
            sent_count: updateRes.rows.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка submitDivisionPackage:', error);
        res.status(400).json({ error: error.message || 'Ошибка отправки сводного графика управления' });
    } finally {
        client.release();
    }
};

module.exports = {
    getDivisionManagerProfile,
    getDivisionQuota,
    getIncomingRequests,
    getArchiveRequests,
    getRequestDetails,
    processRequestAction,
    getDivisionEmployeesStatus,
    submitDivisionPackage
};
