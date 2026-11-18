const pool = require('../config/db');

const getUsersForDropdown = async (req, res) => {
    try {
        const query = `
            SELECT
                u.id,
                u.last_name,
                u.first_name,
                u.middle_name,
                r.code AS role_code,
                r.name AS role_name,
                u.department_id,
                d.name AS department_name,
                u.division_id,
                div.name AS division_name,
                d.region_id,
                reg.name AS region_name,
                p.title AS position_title
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            LEFT JOIN divisions div ON u.division_id = div.id
            LEFT JOIN positions p ON u.position_id = p.id
            WHERE u.is_active = TRUE
            ORDER BY COALESCE(d.region_id, 1), d.id, div.id NULLS FIRST, r.id, u.last_name;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
};

const getStructure = async (req, res) => {
    try {
        const regs = await pool.query('SELECT id, name, is_central FROM regions ORDER BY id');
        const deps = await pool.query(`
            SELECT d.id, d.name, d.region_id, reg.name AS region_name
            FROM departments d
            LEFT JOIN regions reg ON d.region_id = reg.id
            ORDER BY COALESCE(d.region_id, 1), d.id
        `);
        const divs = await pool.query('SELECT id, department_id, name FROM divisions ORDER BY id');
        res.json({
            regions: regs.rows,
            departments: deps.rows,
            divisions: divs.rows
        });
    } catch (error) {
        console.error('Ошибка при получении структуры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
};

module.exports = {
    getUsersForDropdown,
    getStructure
};
