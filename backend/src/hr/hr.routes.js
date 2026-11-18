const express = require('express');
const router = express.Router();
const hrCtrl = require('./hr.ctrl');
const mockAuth = require('../shared/middlewares/mockAuth');

router.use(mockAuth);

// 0. Профиль кадровика
router.get('/me', hrCtrl.getHrProfile);

// 1. Мониторинг (Центральный Аппарат / Свой регион + Мониторинг руководства ДЭР для Кадровика ЦА)
router.get('/monitoring/departments', hrCtrl.getMonitoringDepartments);
router.get('/monitoring/departments/:department_id/divisions', hrCtrl.getMonitoringDivisions);
router.get('/monitoring/divisions/:division_id/employees', hrCtrl.getMonitoringEmployees);
router.get('/monitoring/der-leadership', hrCtrl.getMonitoringDerLeadership);

// 2. Взаимодействие с бухгалтерией
router.get('/accounting/ready', hrCtrl.getReadyForAccounting);
router.post('/accounting/generate-excel', hrCtrl.generateAccountingExcel); // Скачать Excel и создать Batch
router.get('/accounting/archive', hrCtrl.getBatchesArchive);
router.get('/accounting/archive/:id/excel', hrCtrl.downloadBatchExcelAgain); // Скачать Excel повторно из архива

// 3. Праздники
router.get('/holidays', hrCtrl.getHolidays);
router.post('/holidays', hrCtrl.addHoliday);
router.delete('/holidays/:id', hrCtrl.deleteHoliday);

module.exports = router;
