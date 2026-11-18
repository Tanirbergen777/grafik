const pool = require('../config/db');
const ExcelJS = require('exceljs');

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

const getMonthNameRu = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return MONTH_NAMES_RU[d.getMonth()] || '';
};

// Определение месяца выплаты лечебного пособия по выбору самого сотрудника (with_health_benefit)
const resolveBenefitMonth = (part1, part2) => {
    if (!part1 && !part2) return '';
    if (part1 && !part2) return getMonthNameRu(part1.start_date);
    if (!part1 && part2) return getMonthNameRu(part2.start_date);

    if (part1.with_health_benefit === true) return getMonthNameRu(part1.start_date);
    if (part2.with_health_benefit === true) return getMonthNameRu(part2.start_date);

    return getMonthNameRu(part1.start_date);
};

// Вспомогательная функция генерации Excel строго по шаблону "График отп.2027 УРКП.xlsx"
const buildUrkpExcelWorkbook = async (batchId, fallbackYear) => {
    const batchMetaRes = await pool.query(`
        SELECT 
            b.id,
            b.batch_number,
            b.target_year,
            d.name AS department_name,
            div.name AS division_name
        FROM hr_batches b
        LEFT JOIN departments d ON b.department_id = d.id
        LEFT JOIN divisions div ON b.division_id = div.id
        WHERE b.id = $1
    `, [batchId]);

    const batchMeta = batchMetaRes.rows[0] || {};
    const targetYear = batchMeta.target_year || fallbackYear || new Date().getFullYear() + 1;

    const reqRowsRes = await pool.query(`
        SELECT 
            r.id AS request_id,
            r.target_year,
            u.last_name,
            u.first_name,
            u.middle_name,
            COALESCE(p.title, 'Сотрудник') AS position_title,
            d.name AS department_name,
            COALESCE(div.name, 'Руководство департамента') AS division_name,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'part_number', rp.part_number,
                            'start_date', rp.start_date,
                            'end_date', rp.end_date,
                            'vacation_days', rp.vacation_days,
                            'with_health_benefit', COALESCE(rp.with_health_benefit, rp.part_number = 1)
                        ) ORDER BY rp.part_number
                    )
                    FROM request_periods rp
                    WHERE rp.request_id = r.id
                ),
                '[]'::json
            ) AS periods
        FROM requests r
        JOIN users u ON r.employee_id = u.id
        JOIN departments d ON u.department_id = d.id
        LEFT JOIN divisions div ON r.division_id = div.id
        LEFT JOIN positions p ON u.position_id = p.id
        WHERE r.batch_id = $1
        ORDER BY d.name, div.name NULLS FIRST, u.last_name, u.first_name
    `, [batchId]);

    const rows = reqRowsRes.rows;

    // Вычисляем заголовок Департамента и Управления для строки 5
    const uniqueDeps = [...new Set(rows.map(r => r.department_name).filter(Boolean))];
    const uniqueDivs = [...new Set(rows.map(r => r.division_name).filter(Boolean))];

    const depHeader = batchMeta.department_name || (uniqueDeps.length === 1 ? uniqueDeps[0] : uniqueDeps.join(', ')) || 'Департамент';
    const divHeader = batchMeta.division_name || (uniqueDivs.length === 1 ? uniqueDivs[0] : uniqueDivs.join(', ')) || '';
    const subTitleLine = [depHeader, divHeader].filter(Boolean).join(' ');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('УРКП');

    // Ширина колонок строго по шаблону График отп.2027 УРКП.xlsx
    sheet.columns = [
        { key: 'num', width: 6 },
        { key: 'fio', width: 46 },
        { key: 'pos', width: 54 },
        { key: 'm1', width: 24 },
        { key: 'd1', width: 24 },
        { key: 'm2', width: 23 },
        { key: 'd2', width: 22 },
        { key: 'benefit', width: 24 }
    ];

    // Строки 1 и 2 пустые
    sheet.getRow(1).height = 18.75;
    sheet.getRow(2).height = 15;

    // Строка 3: Шапка ведомства (1)
    sheet.mergeCells('A3:H3');
    const row3 = sheet.getRow(3);
    row3.height = 20;
    row3.getCell(1).value = 'График предоставления трудовых отпусков сотрудникам службы экономических расследований и работникам';
    row3.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Строка 4: Шапка ведомства (2) с годом
    sheet.mergeCells('A4:H4');
    const row4 = sheet.getRow(4);
    row4.height = 20;
    row4.getCell(1).value = `Агентства Республики Казахстан по финансовому мониторингу за ${targetYear} год`;
    row4.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Строка 5: Название Департамента и Управления
    sheet.mergeCells('A5:H5');
    const row5 = sheet.getRow(5);
    row5.height = 22;
    row5.getCell(1).value = subTitleLine;
    row5.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Строки 6 и 7: Двухуровневая шапка таблицы
    sheet.mergeCells('A6:A7');
    sheet.mergeCells('B6:B7');
    sheet.mergeCells('C6:C7');
    sheet.mergeCells('D6:E6');
    sheet.mergeCells('F6:G6');
    sheet.mergeCells('H6:H7');

    const row6 = sheet.getRow(6);
    const row7 = sheet.getRow(7);
    row6.height = 37.5;
    row7.height = 48.75;

    row6.getCell(1).value = '№';
    row6.getCell(2).value = 'ФИО';
    row6.getCell(3).value = 'Должность';
    row6.getCell(4).value = 'Дата с указанием количества дней отпуска I часть';
    row6.getCell(6).value = 'Дата с указанием количества дней отпуска II часть';
    row6.getCell(8).value = 'С выплатой леч. пособия (месяц)';

    row7.getCell(4).value = 'Месяц';
    row7.getCell(5).value = 'Количество дней';
    row7.getCell(6).value = 'Месяц';
    row7.getCell(7).value = 'Количество дней';

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    for (let r = 6; r <= 7; r++) {
        const currentRow = sheet.getRow(r);
        for (let c = 1; c <= 8; c++) {
            const cell = currentRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 13, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = thinBorder;
        }
    }

    // Заполнение строк сотрудников (начиная с 8-й строки)
    rows.forEach((emp, idx) => {
        const periods = Array.isArray(emp.periods) ? emp.periods : [];
        const p1 = periods.find(p => Number(p.part_number) === 1) || periods[0] || null;
        const p2 = periods.find(p => Number(p.part_number) === 2) || periods[1] || null;

        const m1 = p1 ? getMonthNameRu(p1.start_date) : '';
        const d1 = p1 ? Number(p1.vacation_days) : '';
        const m2 = p2 ? getMonthNameRu(p2.start_date) : '';
        const d2 = p2 ? Number(p2.vacation_days) : '';
        const benefitMonth = resolveBenefitMonth(p1, p2);

        const fio = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ');

        const dataRow = sheet.addRow([
            idx + 1,
            fio,
            emp.position_title || 'Сотрудник',
            m1,
            d1,
            m2,
            d2,
            benefitMonth
        ]);

        dataRow.height = 32.25;

        for (let c = 1; c <= 8; c++) {
            const cell = dataRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 13 };
            cell.border = thinBorder;
            if (c === 2 || c === 3) {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
        }
    });

    return {
        workbook,
        batchNumber: batchMeta.batch_number || `BATCH-${targetYear}-${batchId}`
    };
};

// ==========================================
// 0. ПРОФИЛЬ КАДРОВИКА (GET /api/hr/me)
// ==========================================
const getHrProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows } = await pool.query(`
            SELECT 
                u.id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                u.department_id,
                u.division_id,
                COALESCE(d.region_id, 1) AS region_id,
                COALESCE(reg.is_central, true) AS is_central,
                COALESCE(reg.name, 'Центральный Аппарат') AS region_name,
                d.name AS department_name,
                div.name AS division_name,
                p.title AS position_title,
                r.code AS role_code,
                r.name AS role_name,
                COALESCE(slr.base_days, 30) AS base_days,
                COALESCE(slr.additional_days, 0) AS bonus_days,
                COALESCE(slr.base_days + slr.additional_days, 30) AS vacation_days_available,
                (SELECT COUNT(*)::int FROM departments) AS total_departments,
                (SELECT COUNT(*)::int FROM divisions) AS total_divisions,
                (
                    SELECT COUNT(*)::int 
                    FROM users u_c 
                    JOIN roles r_c ON u_c.role_id = r_c.id 
                    WHERE u_c.is_active = true AND r_c.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')
                ) AS total_employees
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN divisions div ON u.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN seniority_leave_rules slr 
                ON u.service_years >= slr.min_years 
               AND (slr.max_years IS NULL OR u.service_years <= slr.max_years)
            WHERE u.id = $1
        `, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка getHrProfile:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля кадровика' });
    }
};

// ==========================================
// 1. МОНИТОРИНГ (ДРИЛЛ-ДАУН: Департаменты -> Управления -> Сотрудники)
// ==========================================

// 1.1 Статистика по всем департаментам (в рамках региона кадровика)
const getMonitoringDepartments = async (req, res) => {
    try {
        const targetYear = Number(req.query.target_year) || new Date().getFullYear() + 1;
        const userRegionId = Number(req.user.region_id) || 1;
        const query = `
            SELECT 
                d.id,
                d.name,
                COUNT(DISTINCT u.id)::int AS total_employees,
                COUNT(DISTINCT r.employee_id)::int AS submitted_count,
                COUNT(DISTINCT CASE WHEN rs.code = 'APPROVED' THEN r.employee_id END)::int AS approved_count,
                (SELECT COUNT(*)::int FROM divisions dv WHERE dv.department_id = d.id) AS divisions_count
            FROM departments d
            LEFT JOIN users u 
                ON u.department_id = d.id 
               AND u.is_active = true 
               AND u.role_id NOT IN (SELECT id FROM roles WHERE code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN'))
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $1
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE COALESCE(d.region_id, 1) = $2
            GROUP BY d.id, d.name
            ORDER BY d.id
        `;
        const { rows } = await pool.query(query, [targetYear, userRegionId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getMonitoringDepartments:', error);
        res.status(500).json({ error: 'Ошибка загрузки мониторинга департаментов' });
    }
};

// 1.2 Статистика по управлениям внутри конкретного департамента
const getMonitoringDivisions = async (req, res) => {
    try {
        const { department_id } = req.params;
        const targetYear = Number(req.query.target_year) || new Date().getFullYear() + 1;
        const query = `
            SELECT 
                div.id,
                div.name,
                COUNT(DISTINCT u.id)::int AS total_employees,
                COUNT(DISTINCT r.employee_id)::int AS submitted_count,
                COUNT(DISTINCT CASE WHEN rs.code = 'APPROVED' THEN r.employee_id END)::int AS approved_count
            FROM divisions div
            LEFT JOIN users u 
                ON u.division_id = div.id 
               AND u.is_active = true 
               AND u.role_id NOT IN (SELECT id FROM roles WHERE code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN'))
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $1
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE div.department_id = $2
            GROUP BY div.id, div.name
            ORDER BY div.id
        `;
        const { rows } = await pool.query(query, [targetYear, department_id]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getMonitoringDivisions:', error);
        res.status(500).json({ error: 'Ошибка загрузки мониторинга управлений' });
    }
};

// 1.3 Список сотрудников конкретного управления со статусами
const getMonitoringEmployees = async (req, res) => {
    try {
        const { division_id } = req.params;
        const targetYear = Number(req.query.target_year) || new Date().getFullYear() + 1;
        const query = `
            SELECT 
                u.id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                COALESCE(p.title, rl.name, 'Сотрудник') AS position_title,
                CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS has_submitted,
                r.id AS request_id,
                r.request_number,
                r.current_stage,
                rs.code AS status_code,
                rs.name AS status_name
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN roles rl ON u.role_id = rl.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $1
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.division_id = $2
              AND u.is_active = true
              AND rl.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY', 'ADMIN')
            ORDER BY u.last_name, u.first_name
        `;
        const { rows } = await pool.query(query, [targetYear, division_id]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getMonitoringEmployees:', error);
        res.status(500).json({ error: 'Ошибка загрузки списка сотрудников' });
    }
};

// 1.4 Мониторинг руководства ДЭР (Начальники департаментов и Заместители нач. департаментов ДЭР -> для Кадровика ЦА)
const getMonitoringDerLeadership = async (req, res) => {
    try {
        const targetYear = Number(req.query.target_year) || new Date().getFullYear() + 1;

        const query = `
            SELECT 
                u.id,
                u.external_1c_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                u.service_years,
                rl.code AS role_code,
                rl.name AS role_name,
                COALESCE(p.title, rl.name) AS position_title,
                d.id AS department_id,
                d.name AS department_name,
                reg.id AS region_id,
                reg.name AS region_name,
                r.id AS request_id,
                r.request_number,
                r.current_stage,
                COALESCE(r.is_department_checked, false) AS is_department_checked,
                rs.code AS status_code,
                rs.name AS status_name
            FROM users u
            JOIN roles rl ON u.role_id = rl.id
            JOIN departments d ON u.department_id = d.id
            JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN requests r ON r.employee_id = u.id AND r.target_year = $1
            LEFT JOIN request_statuses rs ON r.status_id = rs.id
            WHERE u.is_active = TRUE
              AND COALESCE(reg.is_central, false) = FALSE
              AND reg.id != 1
              AND rl.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')
            ORDER BY reg.id ASC, d.id ASC, (rl.code = 'DEPARTMENT_HEAD') DESC, u.last_name ASC
        `;
        const { rows } = await pool.query(query, [targetYear]);

        const leaders = rows.map(row => {
            const isSentToCa = Boolean(
                row.request_id &&
                row.status_code === 'APPROVED' &&
                ['HR', 'ACCOUNTING'].includes(row.current_stage)
            );
            const isLocalReady = Boolean(
                row.request_id &&
                row.status_code &&
                !['DRAFT', 'REVISION', 'REJECTED'].includes(row.status_code)
            );
            return {
                ...row,
                has_submitted: isSentToCa,
                is_local_submitted: isLocalReady
            };
        });

        // Группируем по регионам ДЭР (ДЭР Астана, ДЭР Алматы)
        const regionMap = new Map();
        leaders.forEach(item => {
            if (!regionMap.has(item.region_id)) {
                regionMap.set(item.region_id, {
                    region_id: item.region_id,
                    region_name: item.region_name,
                    total_leaders: 0,
                    submitted_to_ca_count: 0,
                    leaders: []
                });
            }
            const group = regionMap.get(item.region_id);
            group.total_leaders++;
            if (item.has_submitted) {
                group.submitted_to_ca_count++;
            }
            group.leaders.push(item);
        });

        res.json({
            target_year: targetYear,
            total_leaders: leaders.length,
            submitted_to_ca_count: leaders.filter(l => l.has_submitted).length,
            regions: Array.from(regionMap.values()),
            leaders
        });
    } catch (error) {
        console.error('Ошибка getMonitoringDerLeadership:', error);
        res.status(500).json({ error: 'Ошибка загрузки мониторинга руководства ДЭР' });
    }
};

// ==========================================
// 2. ОТПРАВКА В БУХГАЛТЕРИЮ (EXCEL И РЕЕСТРЫ)
// ==========================================

// 2.1 Получить список заявок, ГОТОВЫХ к отправке в бухгалтерию (с учетом target_hr_id кадровика)
const getReadyForAccounting = async (req, res) => {
    try {
        const rawYear = req.query.target_year;
        const hrUserId = req.user.id;
        const hrRegionId = Number(req.user.region_id) || 1;
        const isCentralHr = req.user.is_central !== false && hrRegionId === 1;

        const params = [hrUserId, hrRegionId, isCentralHr];
        let yearFilter = '';

        if (rawYear && rawYear !== 'ALL') {
            params.push(Number(rawYear));
            yearFilter = `AND r.target_year = $${params.length}`;
        }

        const query = `
            SELECT 
                r.id,
                r.request_number,
                r.target_year,
                r.total_allowed_days,
                r.created_at,
                u.id AS employee_id,
                u.last_name,
                u.first_name,
                u.middle_name,
                emp_role.code AS role_code,
                emp_role.name AS role_name,
                COALESCE(p.title, emp_role.name, 'Сотрудник') AS position_title,
                div.id AS division_id,
                COALESCE(div.name, 'Руководство департамента') AS division_name,
                d.id AS department_id,
                d.name AS department_name,
                COALESCE(d.region_id, 1) AS region_id,
                COALESCE(reg.is_central, true) AS is_central_region,
                COALESCE(reg.name, 'Центральный Аппарат') AS region_name,
                (SELECT COUNT(*)::int FROM request_periods rp WHERE rp.request_id = r.id) AS periods_count,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', rp.id,
                                'part_number', rp.part_number,
                                'start_date', rp.start_date,
                                'end_date', rp.end_date,
                                'vacation_days', rp.vacation_days,
                                'holidays_count', rp.holidays_count,
                                'with_health_benefit', COALESCE(rp.with_health_benefit, rp.part_number = 1)
                            ) ORDER BY rp.part_number
                        )
                        FROM request_periods rp
                        WHERE rp.request_id = r.id
                    ),
                    '[]'::json
                ) AS periods
            FROM requests r
            JOIN users u ON r.employee_id = u.id
            JOIN roles emp_role ON u.role_id = emp_role.id
            LEFT JOIN divisions div ON r.division_id = div.id
            JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN positions p ON u.position_id = p.id
            JOIN request_statuses rs ON r.status_id = rs.id
            WHERE rs.code = 'APPROVED' 
              AND r.current_stage = 'HR'
              AND r.batch_id IS NULL
              AND (
                  r.target_hr_id = $1
                  OR (
                      r.target_hr_id IS NULL
                      AND (
                          ($3 = true AND (COALESCE(d.region_id, 1) = 1 OR emp_role.code IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY')))
                          OR ($3 = false AND COALESCE(d.region_id, 1) = $2 AND emp_role.code NOT IN ('DEPARTMENT_HEAD', 'DEPT_DEPUTY'))
                      )
                  )
              )
              ${yearFilter}
            ORDER BY d.name, div.name NULLS FIRST, u.last_name, u.first_name
        `;
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getReadyForAccounting:', error);
        res.status(500).json({ error: 'Ошибка загрузки готовых заявок' });
    }
};

// 2.2 Сформировать реестр (Batch), привязать заявки, изменить этап и выдать Excel по шаблону УРКП
const generateAccountingExcel = async (req, res) => {
    const client = await pool.connect();
    try {
        const { target_year, request_ids, department_id, division_id } = req.body;
        const userId = req.user.id;

        if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
            return res.status(400).json({ error: 'Нет выбранных заявок для формирования реестра' });
        }

        await client.query('BEGIN');

        // Определяем департамент, управление и год по выбранным заявкам (если не переданы явно)
        const metaCheck = await client.query(`
            SELECT 
                u.department_id,
                r.division_id,
                r.target_year
            FROM requests r
            JOIN users u ON r.employee_id = u.id
            WHERE r.id = ANY($1::int[])
        `, [request_ids]);

        const depIds = [...new Set(metaCheck.rows.map(r => r.department_id).filter(Boolean))];
        const divIds = [...new Set(metaCheck.rows.map(r => r.division_id).filter(Boolean))];
        const years = [...new Set(metaCheck.rows.map(r => r.target_year).filter(Boolean))];

        const resolvedDepId = department_id || (depIds.length === 1 ? depIds[0] : null);
        const resolvedDivId = division_id || (divIds.length === 1 ? divIds[0] : null);
        const resolvedYear = Number(target_year) || years[0] || new Date().getFullYear() + 1;

        // Создаем порядковый номер пакета
        const seqRes = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM hr_batches');
        const nextBatchNum = seqRes.rows[0].next_id;
        const batchNumber = `Пакет №${nextBatchNum} (${resolvedYear})`;

        const batchRes = await client.query(`
            INSERT INTO hr_batches (batch_number, department_id, division_id, target_year, created_by, status)
            VALUES ($1, $2, $3, $4, $5, 'SENT_TO_ACCOUNTING') RETURNING id
        `, [batchNumber, resolvedDepId, resolvedDivId, resolvedYear, userId]);
        const batchId = batchRes.rows[0].id;

        // Привязываем заявки к реестру и меняем этап на ACCOUNTING
        const updateQuery = `
            UPDATE requests 
            SET batch_id = $1, current_stage = 'ACCOUNTING', updated_at = NOW() 
            WHERE id = ANY($2::int[]) AND batch_id IS NULL
            RETURNING id, employee_id
        `;
        const updatedRequests = await client.query(updateQuery, [batchId, request_ids]);

        if (updatedRequests.rows.length === 0) {
            throw new Error('Выбранные заявки уже включены в другой реестр или недоступны');
        }

        // Пишем в историю для каждой заявки
        for (const reqRow of updatedRequests.rows) {
            await client.query(`
                INSERT INTO request_history (request_id, acted_by, to_status_id, stage, comment)
                VALUES (
                    $1,
                    $2,
                    (SELECT id FROM request_statuses WHERE code = 'APPROVED'),
                    'ACCOUNTING',
                    'Сформирован Excel-реестр и передан в бухгалтерию: ' || $3
                )
            `, [reqRow.id, userId, batchNumber]);
        }

        await client.query('COMMIT');

        // Формируем книгу Excel по шаблону УРКП
        const { workbook } = await buildUrkpExcelWorkbook(batchId, resolvedYear);

        const safeFileName = `Grafik_otpuskov_${resolvedYear}_Paket_${nextBatchNum}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка generateAccountingExcel:', error);
        res.status(500).json({ error: error.message || 'Ошибка формирования реестра' });
    } finally {
        client.release();
    }
};

// 2.3 Архив реестров (по текущему кадровику / его региону)
const getBatchesArchive = async (req, res) => {
    try {
        const hrUserId = req.user.id;
        const hrRegionId = Number(req.user.region_id) || 1;
        const query = `
            SELECT 
                b.id,
                b.batch_number,
                b.target_year,
                b.status,
                b.created_at,
                u.last_name,
                u.first_name,
                u.middle_name,
                COALESCE(
                    d.name,
                    (
                        SELECT d2.name
                        FROM requests r2
                        JOIN users u2 ON r2.employee_id = u2.id
                        JOIN departments d2 ON u2.department_id = d2.id
                        WHERE r2.batch_id = b.id
                        LIMIT 1
                    )
                ) AS department_name,
                COALESCE(
                    div.name,
                    (
                        SELECT div2.name
                        FROM requests r3
                        JOIN divisions div2 ON r3.division_id = div2.id
                        WHERE r3.batch_id = b.id
                        LIMIT 1
                    )
                ) AS division_name,
                (SELECT COUNT(*)::int FROM requests r WHERE r.batch_id = b.id) AS requests_count
            FROM hr_batches b
            JOIN users u ON b.created_by = u.id
            LEFT JOIN departments u_dep ON u.department_id = u_dep.id
            LEFT JOIN departments d ON b.department_id = d.id
            LEFT JOIN divisions div ON b.division_id = div.id
            WHERE b.created_by = $1 OR COALESCE(u_dep.region_id, 1) = $2
            ORDER BY b.created_at DESC
        `;
        const { rows } = await pool.query(query, [hrUserId, hrRegionId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getBatchesArchive:', error);
        res.status(500).json({ error: 'Ошибка загрузки архива реестров' });
    }
};

// 2.4 Повторное скачивание Excel из архива по ID пакета (GET /api/hr/accounting/archive/:id/excel)
const downloadBatchExcelAgain = async (req, res) => {
    try {
        const { id } = req.params;
        const { workbook } = await buildUrkpExcelWorkbook(id);

        const safeFileName = `Grafik_otpuskov_Paket_${id}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Ошибка downloadBatchExcelAgain:', error);
        res.status(500).json({ error: 'Ошибка повторного формирования Excel-файла' });
    }
};

// ==========================================
// 3. СПРАВОЧНИК ПРАЗДНИКОВ
// ==========================================

const getHolidays = async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getFullYear() + 1;
        const { rows } = await pool.query(
            'SELECT * FROM holidays WHERE year = $1 ORDER BY holiday_date ASC',
            [year]
        );
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getHolidays:', error);
        res.status(500).json({ error: 'Ошибка загрузки праздников' });
    }
};

const addHoliday = async (req, res) => {
    try {
        const { holiday_date, year, name } = req.body;
        const userId = req.user.id;

        if (!holiday_date || !name || !String(name).trim()) {
            return res.status(400).json({ error: 'Укажите дату и название праздничного дня' });
        }

        const resolvedYear = Number(year) || new Date(holiday_date).getFullYear();

        const { rows } = await pool.query(`
            INSERT INTO holidays (holiday_date, year, name, created_by) 
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [holiday_date, resolvedYear, String(name).trim(), userId]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка addHoliday:', error);
        res.status(400).json({ error: 'Ошибка добавления праздника (возможно, эта дата уже добавлена в календарь)' });
    }
};

const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM holidays WHERE id = $1', [id]);
        res.json({ message: 'Праздник удален' });
    } catch (error) {
        console.error('Ошибка deleteHoliday:', error);
        res.status(500).json({ error: 'Ошибка удаления' });
    }
};

module.exports = {
    getHrProfile,
    getMonitoringDepartments,
    getMonitoringDivisions,
    getMonitoringEmployees,
    getMonitoringDerLeadership,
    getReadyForAccounting,
    generateAccountingExcel,
    getBatchesArchive,
    downloadBatchExcelAgain,
    getHolidays,
    addHoliday,
    deleteHoliday
};
