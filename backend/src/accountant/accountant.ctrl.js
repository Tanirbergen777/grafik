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

const resolveBenefitMonth = (part1, part2) => {
    if (!part1 && !part2) return '';
    if (part1 && !part2) return getMonthNameRu(part1.start_date);
    if (!part1 && part2) return getMonthNameRu(part2.start_date);

    if (part1.with_health_benefit === true) return getMonthNameRu(part1.start_date);
    if (part2.with_health_benefit === true) return getMonthNameRu(part2.start_date);

    return getMonthNameRu(part1.start_date);
};

// Генерация книги Excel строго по шаблону "График отп.2027 УРКП.xlsx"
const buildUrkpExcelWorkbook = async (batchId) => {
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

    if (batchMetaRes.rows.length === 0) {
        return null;
    }

    const batchMeta = batchMetaRes.rows[0];
    const targetYear = batchMeta.target_year || new Date().getFullYear() + 1;

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

    const uniqueDeps = [...new Set(rows.map(r => r.department_name).filter(Boolean))];
    const uniqueDivs = [...new Set(rows.map(r => r.division_name).filter(Boolean))];

    const depHeader = batchMeta.department_name || (uniqueDeps.length === 1 ? uniqueDeps[0] : uniqueDeps.join(', ')) || 'Департамент';
    const divHeader = batchMeta.division_name || (uniqueDivs.length === 1 ? uniqueDivs[0] : uniqueDivs.join(', ')) || '';
    const subTitleLine = [depHeader, divHeader].filter(Boolean).join(' ');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('УРКП');

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

    sheet.getRow(1).height = 18.75;
    sheet.getRow(2).height = 15;

    sheet.mergeCells('A3:H3');
    const row3 = sheet.getRow(3);
    row3.height = 20;
    row3.getCell(1).value = 'График предоставления трудовых отпусков сотрудникам службы экономических расследований и работникам';
    row3.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A4:H4');
    const row4 = sheet.getRow(4);
    row4.height = 20;
    row4.getCell(1).value = `Агентства Республики Казахстан по финансовому мониторингу за ${targetYear} год`;
    row4.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A5:H5');
    const row5 = sheet.getRow(5);
    row5.height = 22;
    row5.getCell(1).value = subTitleLine;
    row5.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
    row5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

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
        targetYear,
        batchNumber: batchMeta.batch_number
    };
};

// 0. Профиль бухгалтера (GET /api/accountant/me)
const getAccountantProfile = async (req, res) => {
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
                d.name AS department_name,
                div.name AS division_name,
                p.title AS position_title,
                r.code AS role_code,
                r.name AS role_name,
                COALESCE(slr.base_days, 30) AS base_days,
                COALESCE(slr.additional_days, 0) AS bonus_days,
                COALESCE(slr.base_days + slr.additional_days, 30) AS vacation_days_available
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
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
        console.error('Ошибка getAccountantProfile:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля бухгалтера' });
    }
};

// 1. Получить список всех пакетов (реестров) от HR (в рамках региона бухгалтера)
const getBatches = async (req, res) => {
    try {
        const accRegionId = Number(req.user.region_id) || 1;
        const query = `
            SELECT 
                b.id,
                b.batch_number,
                b.target_year,
                b.created_at,
                COALESCE(b.is_processed, false) AS is_processed,
                b.processed_at,
                hr.last_name AS hr_last_name,
                hr.first_name AS hr_first_name,
                hr.middle_name AS hr_middle_name,
                acc.last_name AS acc_last_name,
                acc.first_name AS acc_first_name,
                acc.middle_name AS acc_middle_name,
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
            JOIN users hr ON b.created_by = hr.id
            LEFT JOIN departments hr_dep ON hr.department_id = hr_dep.id
            LEFT JOIN users acc ON b.processed_by = acc.id
            LEFT JOIN departments d ON b.department_id = d.id
            LEFT JOIN divisions div ON b.division_id = div.id
            WHERE COALESCE(hr_dep.region_id, 1) = $1
            ORDER BY COALESCE(b.is_processed, false) ASC, b.created_at DESC
        `;
        const { rows } = await pool.query(query, [accRegionId]);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка getBatches:', error);
        res.status(500).json({ error: 'Ошибка при загрузке реестров' });
    }
};

// 2. Отметить пакет как "Обработан / Оплачен"
const markBatchAsProcessed = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        const query = `
            UPDATE hr_batches 
            SET is_processed = true,
                status = 'PROCESSED',
                processed_at = NOW(),
                processed_by = $1
            WHERE id = $2 AND COALESCE(is_processed, false) = false
            RETURNING *
        `;
        const { rows } = await client.query(query, [userId, id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Реестр не найден или уже обработан' });
        }

        const batchRow = rows[0];

        // Записываем в историю каждой заявки из этого пакета, что бухгалтерия произвела расчет и выплату
        const batchReqs = await client.query('SELECT id FROM requests WHERE batch_id = $1', [id]);
        for (const reqItem of batchReqs.rows) {
            await client.query(`
                INSERT INTO request_history (request_id, acted_by, to_status_id, stage, comment)
                VALUES (
                    $1,
                    $2,
                    (SELECT id FROM request_statuses WHERE code = 'APPROVED'),
                    'ACCOUNTING',
                    'Бухгалтерия обработала реестр (' || $3 || ') и произвела расчет отпускных и лечебного пособия'
                )
            `, [reqItem.id, userId, batchRow.batch_number]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Реестр успешно отмечен как оплаченный и перенесен в архив' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка markBatchAsProcessed:', error);
        res.status(500).json({ error: 'Ошибка обновления статуса реестра' });
    } finally {
        client.release();
    }
};

// 3. Скачать Excel-файл конкретного реестра (по формату УРКП)
const downloadBatchExcel = async (req, res) => {
    try {
        const { id } = req.params;

        const built = await buildUrkpExcelWorkbook(id);
        if (!built) {
            return res.status(404).json({ error: 'Реестр не найден' });
        }

        const safeFileName = `Grafik_otpuskov_Reestr_${id}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        await built.workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Ошибка скачивания Excel бухгалтером:', error);
        res.status(500).json({ error: 'Ошибка формирования файла' });
    }
};

module.exports = {
    getAccountantProfile,
    getBatches,
    markBatchAsProcessed,
    downloadBatchExcel
};
