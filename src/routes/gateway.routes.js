const express = require('express')
const router = express.Router()
const gatewayController = require('../controllers/gateway.controller')

// Rota para criar pagamento
router.post('/deposit', (req, res) => gatewayController.createPayment(req, res))

// Rota para receber callbacks
router.post('/callback', (req, res) => gatewayController.handleCallback(req, res))

module.exports = router
