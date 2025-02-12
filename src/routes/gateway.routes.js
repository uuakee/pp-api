const express = require('express')
const router = express.Router()
const gatewayController = require('../controllers/gateway.controller')

router.post('/deposit', async (req, res) => {
    try {
        const { amount } = req.body
        const payment = await gatewayController.createDeposit(amount)
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