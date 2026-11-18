const express = require('express');
const router = express.Router();
const onecCtrl = require('./onec.ctrl');

// GET /api/onec/employees - список всех со статусом (фильтры: ?department_id=1&division_id=2&target_year=2027)
router.get('/employees', onecCtrl.getEmployeesStatus);

// GET /api/onec/employees/:id - карточка одного сотрудника
router.get('/employees/:id', onecCtrl.getEmployeeById);

// PATCH /api/onec/employees/:id/experience - обновить стаж
router.patch('/employees/:id/experience', onecCtrl.updateExperience);

module.exports = router;