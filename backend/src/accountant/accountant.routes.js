const express = require('express');
const router = express.Router();
const accountantCtrl = require('./accountant.ctrl');
const mockAuth = require('../shared/middlewares/mockAuth');

router.use(mockAuth);

// Профиль бухгалтера
router.get('/me', accountantCtrl.getAccountantProfile);

// Получить все реестры (и новые, и обработанные)
router.get('/batches', accountantCtrl.getBatches);

// Скачать Excel реестра
router.get('/batches/:id/download', accountantCtrl.downloadBatchExcel);

// Отметить как обработанный
router.patch('/batches/:id/process', accountantCtrl.markBatchAsProcessed);

module.exports = router;
