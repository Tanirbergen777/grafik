const pool = require('../../config/db');

const mockAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'Не указан пользователь (отсутствует x-user-id)' });
    }

    try {
        const { rows } = await pool.query(`
            SELECT 
                u.*,
                r.code AS role_code,
                r.name AS role_name,
                d.region_id,
                COALESCE(reg.is_central, true) AS is_central,
                reg.name AS region_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN regions reg ON d.region_id = reg.id
            WHERE u.id = $1
        `, [userId]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        req.user = rows[0];
        next();
    } catch (error) {
        console.error('Ошибка в mockAuth:', error);
        res.status(500).json({ error: 'Ошибка сервера при проверке пользователя' });
    }
};

module.exports = mockAuth;
