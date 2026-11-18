const express = require('express');
const router = express.Router();
const departmentCtrl = require('./department.ctrl');
const mockAuth = require('../shared/middlewares/mockAuth');

// Защита роутов: требуется x-user-id
router.use(mockAuth);

// 0. Профиль начальника департамента
router.get('/me', departmentCtrl.getDepartmentManagerProfile);

// 1. Статус 100% комплектности управлений и руководства департамента (Шлюз Департамента)
router.get('/completeness', departmentCtrl.getDepartmentCompleteness);

// 2. Входящие заявки
router.get('/requests/incoming', departmentCtrl.getIncomingRequests);

// 3. Архив обработанных заявок
router.get('/requests/archive', departmentCtrl.getArchiveRequests);

// 4. Подробности заявки (с историей)
router.get('/requests/:id', departmentCtrl.getRequestDetails);

// 5. Локальное действие по заявке (Принять в график департамента / На доработку / Отказать)
router.patch('/requests/:id/action', departmentCtrl.processRequestAction);

// 6. Шлюз Департамента: Утвердить и отправить все Управления Департамента (при 100% комплектности) в местный ОК (HR)
router.post('/submit-package', departmentCtrl.submitDepartmentPackage);

// 7. Шлюз Руководства ДЭР: Отправить пакет руководства департамента ДЭР (Начальник + Зам) в Кадры ЦА (region_id = 1)
router.post('/submit-leadership-package', departmentCtrl.submitLeadershipPackage);

module.exports = router;
