const pool = require('../config/db');

// 1. Получить список всех сотрудников со статусом подачи заявки (с фильтрами)
const getEmployeesStatus = async (req, res) => {
    try {
        // По умолчанию смотрим на следующий год, если фронтенд не передал
        const targetYear = req.query.target_year || new Date().getFullYear() + 1;
        const { department_id, division_id } = req.query;

        let query = `
            SELECT 
                u.id, u.last_name, u.first_name, u.middle_name,
                d.name as department_name, 
                div.name as division_name, 
                p.title as position_title,
                u.service_years,
                CASE WHEN r.id IS NOT NULL THEN true ELSE false END as has_submitted
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN divisions div ON u.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            -- Ищем заявку конкретного сотрудника на конкретный год
            LEFT JOIN requests r ON u.id = r.employee_id AND r.target_year = $1
            WHERE u.is_active = true
        `;

        const params = [targetYear];
        let paramIndex = 2;

        if (department_id) {
            query += ` AND u.department_id = $${paramIndex}`;
            params.push(department_id);
            paramIndex++;
        }
        if (division_id) {
            query += ` AND u.division_id = $${paramIndex}`;
            params.push(division_id);
            paramIndex++;
        }

        query += ` ORDER BY d.name, div.name, u.last_name`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка в getEmployeesStatus:', error);
        res.status(500).json({ error: 'Ошибка при получении списка' });
    }
};

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT
                u.id, u.last_name, u.first_name, u.middle_name, u.service_years, u.position_id,
                p.title as position_title,
                d.name as department_name, div.name as division_name,
                (SELECT base_days + additional_days
                 FROM seniority_leave_rules
                 WHERE min_years <= u.service_years
                   AND (max_years >= u.service_years OR max_years IS NULL)
                ) as total_allowed_days
            FROM users u
                     LEFT JOIN departments d ON u.department_id = d.id
                     LEFT JOIN divisions div ON u.division_id = div.id
                     LEFT JOIN positions p ON u.position_id = p.id
            WHERE u.id = $1
        `;

        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Сотрудник не найден' });

        res.json(rows[0]);
    } catch (error) {
        console.error('Ошибка в getEmployeeById:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// 3. Обновить стаж (PATCH)
const updateExperience = async (req, res) => {
    try {
        const { id } = req.params;
        const { service_years } = req.body;

        if (service_years === undefined || service_years < 0) {
            return res.status(400).json({ error: 'Некорректное значение стажа' });
        }

        // Обновляем стаж и сразу возвращаем обновленные данные с пересчетом дней отпуска
        const query = `
            UPDATE users
            SET service_years = $1
            WHERE id = $2
                RETURNING id, service_years,
            (SELECT base_days + additional_days 
             FROM seniority_leave_rules 
             WHERE min_years <= $1 AND (max_years >= $1 OR max_years IS NULL)
                ) as new_total_allowed_days
        `;

        const { rows } = await pool.query(query, [service_years, id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Сотрудник не найден' });

        res.json({
            message: 'Стаж успешно обновлен',
            data: rows[0]
        });
    } catch (error) {
        console.error('Ошибка в updateExperience:', error);
        res.status(500).json({ error: 'Ошибка при обновлении стажа' });
    }
};

module.exports = {
    getEmployeesStatus,
    getEmployeeById,
    updateExperience
};