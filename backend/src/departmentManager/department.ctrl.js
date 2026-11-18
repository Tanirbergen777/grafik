const pool = require('../config/db');

// 0. Профиль начальника департамента (GET /api/department/me)
const getDepartmentManagerProfile = async (req, res) => {
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
                slr.additional_days AS bonus_days,
                (slr.base_days + slr.additional_days) AS total_allowed_days,
                (slr.base_days + slr.additional_days) AS vacation_days_available,
                (
                    SELECT COUNT(*)::int
                    FROM divisions dv
                    WHERE dv.department_id = u.department_id
                ) AS total_divisions_count,
                (
                    SELECT COUNT(*)::int
                    FROM divisions dv
                    WHERE dv.department_id = u.department_id
                ) AS divisions_count,
                (
                    SELECT COUNT(*)::int
                    FROM users u_cnt
                    JOIN roles r_cnt ON u_cnt.role_id = r_cnt.id
                    WHERE u_cnt.department_id = u.department_id
                      AND u_cnt.is_active = TRUE
                      AND r_cnt.code NOT IN ('DIVISION_HEAD', 'DEPARTMENT_HEAD', 'ADMIN')
                ) AS total_department_employees,
                (
                    SELECT COUNT(*)::int
                    FROM users u_cnt
                    JOIN roles r_cnt ON u_cnt.role_id = r_cnt.id
                    WHERE u_cnt.department_id = u.department_id
                      AND u_cnt.is_active = TRUE
                      AND r_cnt.code NOT IN ('DIVISION_HEAD', 'DEPARTMENT_HEAD', 'ADMIN')
                ) AS total_employees
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN divisions div ON u.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN seniority_leave_rules slr 
                ON slr.min_years <= u.service_years 
               AND (slr.max_years >= u.service_years OR slr.max_years IS NULL)
            WHERE u.id = $1
        `;
        const { rows } = await pool.query(query, [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка getDepartmentManagerProfile:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля начальника департамента' });
    }
};

// 1. Входящие заявки (ждут решения начальника департамента)
const getIncomingRequests = async (req, res) => {
    try {
        const departmentId = req.user.department_id;

        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.target_year AS year,
                r.total_allowed_days,
                r.total_allowed_days AS vacation_days_available,
                r.current_stage,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                r.revision_comment,
                r.created_at,
                r.updated_at,
                u.id AS employee_id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                COALESCE(p.title, rl.name) AS position_title,
                rl.code AS employee_role_code,
                rl.name AS employee_role_name,
                div.id AS division_id,
                COALESCE(div.name, 'Руководство департамента') AS division_name,
                rs.code AS status_code,
                rs.name AS status_name,
                -- Начальник управления, который согласовал заявку
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
                (
                    SELECT json_agg(json_build_object(
                        'id', rp.id,
                        'part_number', rp.part_number,
                        'start_date', rp.start_date,
                        'end_date', rp.end_date,
                        'vacation_days', rp.vacation_days,
                        'days_count', rp.vacation_days,
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
            LEFT JOIN divisions div ON r.division_id = div.id
            LEFT JOIN users div_head ON div.head_id = div_head.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.department_id = $1 
              AND r.current_stage = 'DEPARTMENT_HEAD' 
              AND rs.code = 'SENT'
              AND (
                  ($3 = 'DEPT_DEPUTY' AND r.target_approver_id = $2)
                  OR ($3 != 'DEPT_DEPUTY' AND (r.target_approver_id = $2 OR r.target_approver_id IS NULL))
              )
            ORDER BY COALESCE(r.is_department_checked, false) ASC, div.id NULLS FIRST, r.created_at ASC
        `;
        const { rows } = await pool.query(query, [departmentId, req.user.id, req.user.role_code]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getIncomingRequests:', error);
        res.status(500).json({ error: 'Ошибка получения входящих заявок' });
    }
};

// 2. Архив (заявки, обработанные начальником департамента)
const getArchiveRequests = async (req, res) => {
    try {
        const departmentId = req.user.department_id;
        const userId = req.user.id;

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
                div.id AS division_id,
                div.name AS division_name,
                rs.code AS status_code,
                rs.name AS status_name,
                -- Дата принятия решения начальником департамента (из истории)
                (
                    SELECT rh.created_at
                    FROM request_history rh
                    LEFT JOIN users au ON rh.acted_by = au.id
                    LEFT JOIN roles ar ON au.role_id = ar.id
                    WHERE rh.request_id = r.id
                      AND (rh.acted_by = $2 OR ar.code = 'DEPARTMENT_HEAD')
                    ORDER BY rh.created_at DESC
                    LIMIT 1
                ) AS department_approved_at,
                -- Комментарий решения начальника департамента
                (
                    SELECT rh.comment
                    FROM request_history rh
                    LEFT JOIN users au ON rh.acted_by = au.id
                    LEFT JOIN roles ar ON au.role_id = ar.id
                    WHERE rh.request_id = r.id
                      AND (rh.acted_by = $2 OR ar.code = 'DEPARTMENT_HEAD')
                    ORDER BY rh.created_at DESC
                    LIMIT 1
                ) AS department_decision_comment,
                (
                    SELECT json_agg(json_build_object(
                        'id', rp.id,
                        'part_number', rp.part_number,
                        'start_date', rp.start_date,
                        'end_date', rp.end_date,
                        'vacation_days', rp.vacation_days,
                        'holidays_count', rp.holidays_count,
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
            LEFT JOIN divisions div ON r.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.department_id = $1 
              AND (
                  r.current_stage IN ('HR', 'ACCOUNTING', 'ACCOUNTANT', 'COMPLETED')
                  OR rs.code = 'APPROVED'
                  OR EXISTS (
                      SELECT 1 FROM request_history rh 
                      LEFT JOIN users au ON rh.acted_by = au.id
                      LEFT JOIN roles ar ON au.role_id = ar.id
                      WHERE rh.request_id = r.id AND (rh.acted_by = $2 OR ar.code = 'DEPARTMENT_HEAD')
                  )
              )
              AND NOT (r.current_stage = 'DEPARTMENT_HEAD' AND rs.code = 'SENT')
            ORDER BY r.updated_at DESC, r.created_at DESC
        `;
        const { rows } = await pool.query(query, [departmentId, userId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getArchiveRequests:', error);
        res.status(500).json({ error: 'Ошибка получения архива' });
    }
};

// 3. Детальный просмотр заявки (с периодами, маршрутом и историей)
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
                        'author', TRIM(CONCAT(act_u.last_name, ' ', act_u.first_name)),
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
            LEFT JOIN divisions div ON r.division_id = div.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN users div_head ON div.head_id = div_head.id
            LEFT JOIN users dep_head ON d.head_id = dep_head.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE r.id = $1
        `;
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Заявка не найдена' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка getRequestDetails:', error);
        res.status(500).json({ error: 'Ошибка получения деталей' });
    }
};

// 4. Принятие решения по заявке (Утвердить / Отказать / На доработку)
const processRequestAction = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { action, comment } = req.body;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Проверяем, что заявка у начальника департамента
        const checkRes = await client.query(`
            SELECT r.*, rs.code as status_code 
            FROM requests r 
            JOIN users u ON r.employee_id = u.id
            JOIN request_statuses rs ON r.status_id = rs.id 
            WHERE r.id = $1 AND u.department_id = $2 AND r.current_stage = 'DEPARTMENT_HEAD'
        `, [id, req.user.department_id]);

        if (checkRes.rows.length === 0) {
            throw new Error('Заявка недоступна для обработки или уже рассмотрена');
        }
        const reqData = checkRes.rows[0];

        const statRes = await client.query('SELECT id, code FROM request_statuses');
        const statuses = {};
        statRes.rows.forEach(s => { statuses[s.code] = s.id; });

        let newStatusId;
        let newStage;
        let historyComment;

        if (action === 'APPROVE') {
            // Локальная проверка внутри Департамента ("Принять в график департамента"):
            // Заявка получает признак is_department_checked = true и ждет 100% комплектности всего Департамента
            newStatusId = statuses['SENT'];
            newStage = 'DEPARTMENT_HEAD';
            historyComment = comment
                ? `Проверено начальником департамента (${comment}). Ожидает 100% комплектности департамента для отправки в ОК`
                : 'Проверено начальником департамента (принято в сводный график департамента). Ожидает 100% комплектности департамента';

            await client.query(`
                UPDATE requests 
                SET is_department_checked = TRUE, revision_comment = NULL, updated_at = NOW() 
                WHERE id = $1
            `, [id]);

        } else if (action === 'REVISION') {
            if (!comment || !String(comment).trim()) {
                throw new Error('Для возврата на доработку обязателен комментарий');
            }
            newStatusId = statuses['REVISION'];
            newStage = 'EMPLOYEE';
            historyComment = 'Возвращено на доработку Департаментом: ' + comment.trim();

            await client.query(`
                UPDATE requests 
                SET status_id = $1,
                    current_stage = $2,
                    is_division_checked = FALSE,
                    is_department_checked = FALSE,
                    revision_comment = $3,
                    updated_at = NOW() 
                WHERE id = $4
            `, [newStatusId, newStage, comment.trim(), id]);

        } else if (action === 'REJECT') {
            if (!comment || !String(comment).trim()) {
                throw new Error('При отказе обязателен комментарий');
            }
            newStatusId = statuses['REJECTED'];
            newStage = 'DEPARTMENT_HEAD'; // Остается в архиве
            historyComment = 'Департаментом отказано: ' + comment.trim();

            await client.query(`
                UPDATE requests 
                SET status_id = $1,
                    current_stage = $2,
                    is_division_checked = FALSE,
                    is_department_checked = FALSE,
                    revision_comment = $3,
                    updated_at = NOW() 
                WHERE id = $4
            `, [newStatusId, newStage, comment.trim(), id]);
        } else {
            throw new Error('Неизвестное действие');
        }

        // Запись в историю
        await client.query(`
            INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, userId, reqData.status_id, newStatusId, newStage, historyComment]);

        await client.query('COMMIT');
        res.json({ message: 'Решение успешно сохранено' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка processRequestAction (Dep):', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

// 5. Статус 100% комплектности всех управлений департамента (Шлюз Департамента) (GET /api/department/completeness)
const getDepartmentCompleteness = async (req, res) => {
    try {
        const departmentId = req.user.department_id;
        const userId = req.user.id;
        const userRoleCode = req.user.role_code;
        const targetYear = parseInt(req.query.target_year, 10) || new Date().getFullYear() + 1;
        const isCentral = req.user.is_central !== false && Number(req.user.region_id || 1) === 1;

        // 1. Все управления данного департамента
        const divsRes = await pool.query(
            'SELECT id, name FROM divisions WHERE department_id = $1 ORDER BY id ASC',
            [departmentId]
        );

        // 2. Все активные сотрудники этого департамента с их заявками на targetYear
        const staffRes = await pool.query(`
            SELECT 
                u.id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.division_id,
                rl.code AS role_code,
                rl.name AS role_name,
                r.id AS request_id,
                r.current_stage,
                r.target_approver_id,
                COALESCE(r.is_division_checked, false) AS is_division_checked,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                rs.code AS status_code
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $2
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.department_id = $1
              AND u.is_active = TRUE
              AND rl.code NOT IN ('ADMIN')
            ORDER BY u.division_id NULLS FIRST, u.last_name ASC
        `, [departmentId, targetYear]);

        const allDeptStaff = staffRes.rows;

        // Проверка, адресована ли заявка текущему руководителю (для DEPT_DEPUTY учитываются только заявки, отправленные начальником управления именно ему)
        const isAddressedToCurrentManager = (u) => {
            if (!u.request_id) return false;
            if (['HR', 'ACCOUNTING'].includes(u.current_stage) || u.status_code === 'APPROVED') return true;
            if (userRoleCode === 'DEPT_DEPUTY') {
                // Если это собственная заявка самого зама в ДЭР — она тоже учитывается, когда зам формирует пакет департамента
                if (u.role_code === 'DEPT_DEPUTY' && Number(u.id) === Number(userId)) return true;
                return Number(u.target_approver_id) === Number(userId);
            }
            return !u.target_approver_id || Number(u.target_approver_id) === Number(userId) || u.role_code === 'DEPT_DEPUTY';
        };

        // Статистика по каждому управлению
        const divisionsStatus = divsRes.rows.map(div => {
            const divMembers = allDeptStaff.filter(
                u => Number(u.division_id) === Number(div.id) &&
                     !['DEPARTMENT_HEAD', 'DEPT_DEPUTY'].includes(u.role_code)
            );
            const totalStaff = divMembers.length;

            // Сколько сдали заявку вообще (на уровне управления или выше)
            const submittedInDivision = divMembers.filter(
                u => u.request_id && u.status_code && !['DRAFT', 'REVISION', 'REJECTED'].includes(u.status_code)
            ).length;

            // Сколько уже дошли до этапа DEPARTMENT_HEAD (и адресованы данному руководителю / заму)
            const atDepartmentCount = divMembers.filter(
                u => u.request_id &&
                     ['SENT', 'APPROVED'].includes(u.status_code) &&
                     ['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(u.current_stage) &&
                     isAddressedToCurrentManager(u)
            ).length;

            // Сколько проверено начальником / замом департамента (или уже в HR / ACCOUNTING)
            const checkedByDepartmentCount = divMembers.filter(
                u => u.request_id &&
                     isAddressedToCurrentManager(u) &&
                     ((u.current_stage === 'DEPARTMENT_HEAD' && u.status_code === 'SENT' && u.is_department_checked) ||
                      ['HR', 'ACCOUNTING'].includes(u.current_stage) ||
                      u.status_code === 'APPROVED')
            ).length;

            const isSentToDepartment = totalStaff > 0 && atDepartmentCount === totalStaff;

            const missingNames = divMembers
                .filter(
                    u => !(u.request_id &&
                           ['SENT', 'APPROVED'].includes(u.status_code) &&
                           ['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(u.current_stage))
                )
                .map(u => `${u.last_name} ${u.first_name}`);

            return {
                id: div.id,
                name: div.name,
                total_staff: totalStaff,
                submitted_in_division: submittedInDivision,
                at_department_count: atDepartmentCount,
                checked_by_department_count: checkedByDepartmentCount,
                is_sent_to_department: isSentToDepartment,
                missing_names: missingNames
            };
        });

        // Для Территориальных ДЭР (is_central = false): проверяем Пакет Руководства ДЭР (Начальник департамента + Зам. начальника департамента) -> отправляется в Кадры ЦА
        const deputies = !isCentral
            ? allDeptStaff.filter(u => u.role_code === 'DEPT_DEPUTY')
            : [];
        const deptHeadRow = !isCentral
            ? allDeptStaff.find(u => u.role_code === 'DEPARTMENT_HEAD') || null
            : null;

        const deputiesStatus = deputies.map(dep => {
            const isAtDeptOrHigher = Boolean(
                dep.request_id &&
                ['SENT', 'APPROVED'].includes(dep.status_code) &&
                ['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(dep.current_stage)
            );
            const isChecked = Boolean(
                isAtDeptOrHigher &&
                (dep.is_department_checked || ['HR', 'ACCOUNTING'].includes(dep.current_stage) || dep.status_code === 'APPROVED')
            );
            const isSentToCa = Boolean(
                dep.request_id &&
                dep.status_code === 'APPROVED' &&
                ['HR', 'ACCOUNTING'].includes(dep.current_stage)
            );
            return {
                id: dep.id,
                full_name: `${dep.last_name} ${dep.first_name} ${dep.middle_name || ''}`.trim(),
                role_name: dep.role_name,
                is_at_department: isAtDeptOrHigher,
                is_checked: isChecked,
                is_sent_to_ca: isSentToCa
            };
        });

        const headHasRequest = Boolean(
            deptHeadRow &&
            deptHeadRow.request_id &&
            deptHeadRow.status_code &&
            !['REVISION', 'REJECTED'].includes(deptHeadRow.status_code)
        );
        const headSentToCa = Boolean(
            deptHeadRow &&
            deptHeadRow.request_id &&
            deptHeadRow.status_code === 'APPROVED' &&
            ['HR', 'ACCOUNTING'].includes(deptHeadRow.current_stage)
        );

        const allDeputiesChecked = deputiesStatus.length === 0 || deputiesStatus.every(d => d.is_checked);
        const allDeputiesSentToCa = deputiesStatus.length === 0 || deputiesStatus.every(d => d.is_sent_to_ca);

        const leadershipPackage = !isCentral
            ? {
                head_name: deptHeadRow ? `${deptHeadRow.last_name} ${deptHeadRow.first_name}`.trim() : 'Начальник департамента',
                head_has_request: headHasRequest,
                head_sent_to_ca: headSentToCa,
                deputies_status: deputiesStatus,
                can_submit_to_ca: allDeputiesChecked && headHasRequest && (!headSentToCa || !allDeputiesSentToCa),
                is_sent_to_ca: headSentToCa && allDeputiesSentToCa
            }
            : null;

        // В обязательную 100% формулу Управлений Департамента входят все сотрудники и начальники управлений всех управлений департамента
        const requiredMembers = allDeptStaff.filter(u => {
            if (u.role_code === 'DEPARTMENT_HEAD' || u.role_code === 'DEPT_DEPUTY') return false;
            return Boolean(u.division_id);
        });

        const totalRequired = requiredMembers.length;
        const arrivedAtDepartment = requiredMembers.filter(
            u => u.request_id &&
                 ['SENT', 'APPROVED'].includes(u.status_code) &&
                 ['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(u.current_stage) &&
                 isAddressedToCurrentManager(u)
        ).length;

        const checkedAtDepartment = requiredMembers.filter(
            u => u.request_id &&
                 isAddressedToCurrentManager(u) &&
                 ((u.current_stage === 'DEPARTMENT_HEAD' && u.status_code === 'SENT' && u.is_department_checked) ||
                  ['HR', 'ACCOUNTING'].includes(u.current_stage) ||
                  u.status_code === 'APPROVED')
        ).length;

        const pendingAtDepartmentCount = requiredMembers.filter(
            u => u.request_id &&
                 u.status_code === 'SENT' &&
                 u.current_stage === 'DEPARTMENT_HEAD' &&
                 isAddressedToCurrentManager(u)
        ).length;

        const completedDivisionsCount = divisionsStatus.filter(d => d.is_sent_to_department).length;

        // Список причин блокировки кнопки отправки Управлений Департамента в HR
        const blockers = [];
        divisionsStatus.forEach(d => {
            if (!d.is_sent_to_department) {
                blockers.push(`${d.name}: в процессе (в управлении сдано ${d.submitted_in_division} из ${d.total_staff}, в Департамент поступило ${d.at_department_count} из ${d.total_staff})`);
            }
        });

        const uncheckedInDept = requiredMembers.filter(
            u => u.request_id && u.status_code === 'SENT' && u.current_stage === 'DEPARTMENT_HEAD' && !u.is_department_checked
        );
        if (blockers.length === 0 && uncheckedInDept.length > 0) {
            blockers.push(`Ожидает вашего одобрения («Принять в график») во Входящих: еще ${uncheckedInDept.length} заявок`);
        }

        const canSubmitDepartmentPackage =
            totalRequired > 0 &&
            arrivedAtDepartment === totalRequired &&
            checkedAtDepartment === totalRequired &&
            pendingAtDepartmentCount > 0;

        const isDepartmentPackageAlreadySent =
            totalRequired > 0 &&
            arrivedAtDepartment === totalRequired &&
            pendingAtDepartmentCount === 0;

        res.json({
            target_year: targetYear,
            is_central: isCentral,
            total_divisions: divisionsStatus.length,
            completed_divisions: completedDivisionsCount,
            divisions_status: divisionsStatus,
            deputies_status: deputiesStatus,
            leadership_package: leadershipPackage,
            total_required_people: totalRequired,
            arrived_at_department_people: arrivedAtDepartment,
            checked_by_department_people: checkedAtDepartment,
            pending_at_department_count: pendingAtDepartmentCount,
            can_submit_department_package: canSubmitDepartmentPackage,
            is_department_package_already_sent: isDepartmentPackageAlreadySent,
            blockers
        });
    } catch (error) {
        console.error('Ошибка getDepartmentCompleteness:', error);
        res.status(500).json({ error: 'Ошибка проверки комплектности департамента' });
    }
};

// 6. Шлюз Департамента: Утвердить весь Департамент и отправить в ОК (HR) (POST /api/department/submit-package)
const submitDepartmentPackage = async (req, res) => {
    const client = await pool.connect();
    try {
        const departmentId = req.user.department_id;
        const userId = req.user.id;
        const targetYear = parseInt(req.body.target_year, 10) || new Date().getFullYear() + 1;
        const isCentral = req.user.is_central !== false && Number(req.user.region_id || 1) === 1;
        const regionId = Number(req.user.region_id) || 1;

        await client.query('BEGIN');

        // Проверяем 100% комплектность по всему департаменту
        const staffRes = await client.query(`
            SELECT 
                u.id,
                u.last_name,
                u.first_name,
                u.division_id,
                rl.code AS role_code,
                r.id AS request_id,
                r.current_stage,
                r.status_id,
                r.target_hr_id,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                rs.code AS status_code
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $2
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.department_id = $1
              AND u.is_active = TRUE
              AND rl.code NOT IN ('ADMIN')
        `, [departmentId, targetYear]);

        const requiredMembers = staffRes.rows.filter(u => {
            if (u.role_code === 'DEPARTMENT_HEAD' || u.role_code === 'DEPT_DEPUTY') return false;
            return Boolean(u.division_id);
        });

        if (requiredMembers.length === 0) {
            throw new Error('В департаменте нет активных сотрудников для отправки');
        }

        const missingOrNotReady = requiredMembers.filter(u => {
            if (!u.request_id || !['SENT', 'APPROVED'].includes(u.status_code)) return true;
            if (!['DEPARTMENT_HEAD', 'HR', 'ACCOUNTING'].includes(u.current_stage)) return true;
            if (u.current_stage === 'DEPARTMENT_HEAD' && !u.is_department_checked) return true;
            return false;
        });

        if (missingOrNotReady.length > 0) {
            const names = missingOrNotReady.map(u => `${u.last_name} ${u.first_name}`).join(', ');
            throw new Error(`Невозможно отправить неполный график Департамента в HR! Не готовы или не проверены (${missingOrNotReady.length} чел.): ${names}`);
        }

        // Определяем ID статуса APPROVED и целевых кадровиков
        const approvedStatusRes = await client.query("SELECT id FROM request_statuses WHERE code = 'APPROVED'");
        const approvedStatusId = approvedStatusRes.rows[0].id;

        let localHrId = 4;
        if (!isCentral) {
            const hrRes = await client.query(`
                SELECT u.id
                FROM users u
                JOIN roles r ON u.role_id = r.id AND r.code = 'HR'
                JOIN departments d ON u.department_id = d.id
                WHERE d.region_id = $1 AND u.is_active = TRUE
                ORDER BY u.id ASC
                LIMIT 1
            `, [regionId]);
            if (hrRes.rows.length > 0) {
                localHrId = hrRes.rows[0].id;
            }
        }

        const toApprove = requiredMembers.filter(
            u => u.request_id && u.current_stage === 'DEPARTMENT_HEAD' && u.status_code === 'SENT'
        );

        if (toApprove.length === 0) {
            throw new Error('Сводный график Департамента уже был отправлен в Отдел кадров (HR)');
        }

        for (const emp of toApprove) {
            // Заявка Зам. нач. департамента ДЭР (DEPT_DEPUTY) летит в ЦА к Кадровику ЦА (id = 4), остальные — к местному HR региона
            const resolvedTargetHrId =
                emp.role_code === 'DEPT_DEPUTY' || emp.role_code === 'DEPARTMENT_HEAD' || isCentral
                    ? 4
                    : (emp.target_hr_id || localHrId);

            await client.query(`
                UPDATE requests
                SET status_id = $1,
                    current_stage = 'HR',
                    target_hr_id = $2,
                    is_department_checked = TRUE,
                    revision_comment = NULL,
                    updated_at = NOW()
                WHERE id = $3
            `, [approvedStatusId, resolvedTargetHrId, emp.request_id]);

            await client.query(`
                INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
                VALUES ($1, $2, $3, $4, 'HR', 'Сводный график Департамента (100% комплектность) утвержден начальником департамента и передан в Отдел кадров (HR)')
            `, [emp.request_id, userId, emp.status_id, approvedStatusId]);
        }

        await client.query('COMMIT');
        res.json({
            message: `Сводный график всего Департамента (${requiredMembers.length} чел.) успешно утвержден и отправлен в Отдел кадров (HR)!`,
            sent_count: toApprove.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка submitDepartmentPackage:', error);
        res.status(400).json({ error: error.message || 'Ошибка отправки сводного графика департамента' });
    } finally {
        client.release();
    }
};

// 7. Шлюз Руководства ДЭР: Отправить пакет руководства департамента ДЭР (Начальник департамента + Зам) в Кадры ЦА (POST /api/department/submit-leadership-package)
const submitLeadershipPackage = async (req, res) => {
    const client = await pool.connect();
    try {
        const departmentId = req.user.department_id;
        const userId = req.user.id;
        const targetYear = parseInt(req.body.target_year, 10) || new Date().getFullYear() + 1;
        const isCentral = req.user.is_central !== false && Number(req.user.region_id || 1) === 1;

        if (isCentral) {
            return res.status(403).json({ error: 'Руководство ЦА не отправляет заявки через платформу' });
        }

        await client.query('BEGIN');

        const leadersRes = await client.query(`
            SELECT 
                u.id,
                u.last_name,
                u.first_name,
                rl.code AS role_code,
                rl.name AS role_name,
                r.id AS request_id,
                r.status_id,
                r.current_stage,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                rs.code AS status_code
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $2
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.department_id = $1
              AND u.is_active = TRUE
              AND rl.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')
        `, [departmentId, targetYear]);

        const leaders = leadersRes.rows;
        const deputies = leaders.filter(l => l.role_code === 'DEPT_DEPUTY');
        const head = leaders.find(l => l.role_code === 'DEPARTMENT_HEAD');

        const notReadyDeputies = deputies.filter(dep => {
            if (!dep.request_id || !dep.status_code || ['DRAFT', 'REVISION', 'REJECTED'].includes(dep.status_code)) {
                return true;
            }
            if (dep.status_code === 'APPROVED' && ['HR', 'ACCOUNTING'].includes(dep.current_stage)) {
                return false;
            }
            return !dep.is_department_checked;
        });

        if (notReadyDeputies.length > 0) {
            const names = notReadyDeputies.map(d => `${d.last_name} ${d.first_name}`).join(', ');
            throw new Error(`Сначала необходимо получить и утвердить заявку Заместителя начальника департамента (${names}) во вкладке «1. Входящие заявки»!`);
        }

        if (!head || !head.request_id || ['REVISION', 'REJECTED'].includes(head.status_code)) {
            throw new Error('Начальник департамента ДЭР еще не заполнил собственную заявку во вкладке «3. Мой отпуск»!');
        }

        const approvedStatusRes = await client.query("SELECT id FROM request_statuses WHERE code = 'APPROVED'");
        const approvedStatusId = approvedStatusRes.rows[0].id;

        let centralHrId = 4;
        const hrRes = await client.query(`
            SELECT u.id
            FROM users u
            JOIN roles r ON u.role_id = r.id AND r.code = 'HR'
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE COALESCE(d.region_id, 1) = 1 AND u.is_active = TRUE
            ORDER BY (u.id = 4) DESC, u.id ASC
            LIMIT 1
        `);
        if (hrRes.rows.length > 0) {
            centralHrId = hrRes.rows[0].id;
        }

        for (const leader of leaders) {
            if (leader.request_id) {
                await client.query(`
                    UPDATE requests
                    SET status_id = $1,
                        current_stage = 'HR',
                        target_hr_id = $2,
                        is_division_checked = TRUE,
                        is_department_checked = TRUE,
                        revision_comment = NULL,
                        updated_at = NOW()
                    WHERE id = $3
                `, [approvedStatusId, centralHrId, leader.request_id]);

                await client.query(`
                    INSERT INTO request_history (request_id, acted_by, from_status_id, to_status_id, stage, comment)
                    VALUES ($1, $2, $3, $4, 'HR', 'Пакет руководства департамента ДЭР (Начальник департамента + Заместитель) утвержден и отправлен в Кадры Центрального Аппарата (HR ЦА)')
                `, [leader.request_id, userId, leader.status_id, approvedStatusId]);
            }
        }

        await client.query('COMMIT');
        res.json({
            message: 'Пакет руководства департамента ДЭР (Начальник департамента + Заместитель) успешно отправлен Кадровику ЦА!'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка submitLeadershipPackage:', error);
        res.status(400).json({ error: error.message || 'Ошибка отправки пакета руководства в ЦА' });
    } finally {
        client.release();
    }
};

module.exports = {
    getDepartmentManagerProfile,
    getDepartmentCompleteness,
    getIncomingRequests,
    getArchiveRequests,
    getRequestDetails,
    processRequestAction,
    submitDepartmentPackage,
    submitLeadershipPackage
};
