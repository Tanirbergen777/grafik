const express = require('express');
const router = express.Router();
const sharedCtrl = require('./shared.ctrl');

router.get('/users', sharedCtrl.getUsersForDropdown);
router.get('/structure', sharedCtrl.getStructure);

module.exports = router;