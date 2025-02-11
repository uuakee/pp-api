const express = require('express');
const router = express.Router();
const { createPlan, editPlan, deletePlan, getAll } = require('../controllers/plan.controller');

router.post('/create', createPlan);
router.put('/edit/:planId', editPlan);
router.delete('/delete/:planId', deletePlan);
router.get('/all', getAll);

module.exports = router;