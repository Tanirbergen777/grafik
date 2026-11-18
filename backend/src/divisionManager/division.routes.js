const express = require('express');
const router = express.Router();
const divisionCtrl = require('./division.ctrl');
const mockAuth = require('../shared/middlewares/mockAuth');

// Защищаем роуты: требуется заголовок x-user-id
router.use(mockAuth);

// 0. Данные профиля начальника управления
router.get('/me', divisionCtrl.getDivisionManagerProfile);

// 1. Аналитика (квоты по месяцам для управления)
router.get('/analytics/quota', divisionCtrl.getDivisionQuota);

// 2. Входящие заявки
router.get('/requests/incoming', divisionCtrl.getIncomingRequests);

// 3. Архив заявок
router.get('/requests/archive', divisionCtrl.getArchiveRequests);

// 4. Контроль подачи и 100% комплектности управления (кто отправил, кто проверен, кто ожидается)
router.get('/employees-status', divisionCtrl.getDivisionEmployeesStatus);

// 5. Подробно о заявке (с историей и маршрутом согласования)
router.get('/requests/:id', divisionCtrl.getRequestDetails);

// 6. Локальная проверка заявки внутри управления (Принять в график / На доработку / Отказать)
router.patch('/requests/:id/action', divisionCtrl.processRequestAction);

// 7. Шлюз Управления: Отправить сводный график всего управления (при 100% комплектности) в Департамент
router.post('/submit-package', divisionCtrl.submitDivisionPackage);

module.exports = router;
