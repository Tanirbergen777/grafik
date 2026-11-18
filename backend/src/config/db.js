const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Автоматическая миграция полей и назначение пользователя id = 10 (Жұма Ерден) Заместителем начальника департамента (DEPT_DEPUTY) с удалением дублирующего зама (id = 14)
pool.query(`
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_division_checked BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_department_checked BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS department_id INT REFERENCES departments(id) ON DELETE RESTRICT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_approver_id INT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE requests ALTER COLUMN division_id DROP NOT NULL;
    ALTER TABLE request_periods ADD COLUMN IF NOT EXISTS with_health_benefit BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE request_periods SET with_health_benefit = TRUE
    WHERE part_number = 1
      AND request_id NOT IN (SELECT request_id FROM request_periods WHERE with_health_benefit = TRUE);

    INSERT INTO positions (title)
    VALUES ('Заместитель начальника департамента')
    ON CONFLICT (title) DO NOTHING;

    UPDATE divisions SET head_id = NULL WHERE head_id = 10;

    UPDATE users
    SET role_id = (SELECT id FROM roles WHERE code = 'DEPT_DEPUTY'),
        position_id = COALESCE((SELECT id FROM positions WHERE title = 'Заместитель начальника департамента' LIMIT 1), position_id)
    WHERE id = 10;

    UPDATE requests SET target_approver_id = 10 WHERE target_approver_id = 14;
    UPDATE request_history SET acted_by = 10 WHERE acted_by = 14;
    DELETE FROM requests WHERE employee_id = 14;
    DELETE FROM users
    WHERE id = 14
       OR (department_id = 2 AND id != 10 AND role_id = (SELECT id FROM roles WHERE code = 'DEPT_DEPUTY'));
`).catch(err => {
    console.error('Предупреждение авто-миграции БД:', err.message);
});

module.exports = pool;
