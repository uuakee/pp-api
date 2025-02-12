const express = require('express')
const router = express.Router()
const gatewayController = require('../controllers/gateway.controller')

// Protege todas as rotas com autenticação

router.post('/deposit', async (req, res) => {
    try {
        const { amount, userId } = req.body

        if (!userId || !amount) {
            return res.status(400).json({ error: 'UserId e amount são obrigatórios' })
        }

        const payment = await gatewayController.createDeposit(userId, amount)
        res.json(payment)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

router.post('/callback', async (req, res) => {
    try {
        await gatewayController.handleCallback(req.body)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

module.exports = router 