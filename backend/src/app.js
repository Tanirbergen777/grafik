const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. СНАЧАЛА ЗАГРУЖАЕМ .env из правильной папки (otpusk/.env)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// 2. ТОЛЬКО ПОСЛЕ ЗАГРУЗКИ .env ПОДКЛЮЧАЕМ БАЗУ И РОУТЫ
const pool = require('./config/db');

app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW()');
        res.json({
            status: 'OK',
            message: 'Бэкенд и БД работают!',
            db_time: dbRes.rows[0].now
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// Подключаем роуты
const sharedRoutes = require('./shared/shared.routes');
const onecRoutes = require('./oneC/onec.routes');
const employeeRoutes = require('./employee/employee.routes');
const divisionRoutes = require('./divisionManager/division.routes');
const departmentRoutes = require('./departmentManager/department.routes');
const accountantRoutes = require('./accountant/accountant.routes');
const hrRoutes = require('./hr/hr.routes');
app.use('/api/shared', sharedRoutes);
app.use('/api/onec', onecRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/division', divisionRoutes);
app.use('/api/department', departmentRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/accountant', accountantRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});