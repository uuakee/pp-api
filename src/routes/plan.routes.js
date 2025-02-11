const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan.controller');

// Rotas com upload de imagem
router.post('/create', planController.createPlan);
router.put('/edit/:planId', planController.editPlan);

// Outras rotas
router.get('/all', planController.getAll);
router.delete('/delete/:planId', planController.deletePlan);

module.exports = router;