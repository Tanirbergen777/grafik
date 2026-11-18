const express = require('express');
const router = express.Router();
const employeeCtrl = require('./employee.ctrl');
const mockAuth = require('../shared/middlewares/mockAuth');

router.use(mockAuth);

// Получить свои данные (ФИО, департамент, лимит дней отпуска)
router.get('/me', employeeCtrl.getMe);

// Получить список всех своих заявок (Черновики, Отправленные, Архив) вместе с историей и комментариями
router.get('/requests', employeeCtrl.getMyRequests);

// Создать заявку (action: 'DRAFT' или 'SEND')
router.post('/requests', employeeCtrl.createRequest);

// Редактировать заявку (ответить на доработку или исправить черновик)
router.patch('/requests/:id', employeeCtrl.updateRequest);

// Отозвать отправленную заявку (вернуть статус Черновик)
router.patch('/requests/:id/revoke', employeeCtrl.revokeRequest);

module.exports = router;