// src/controllers/gateway.controller.js
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

require('dotenv').config()

class GatewayController {
    constructor() {
        if (!process.env.AXIEPAY_SECRET_KEY) {
            throw new Error('AXIEPAY_SECRET_KEY não configurada')
        }
        // Cria o token de autenticação conforme documentação
        this.authToken = Buffer.from(`${process.env.AXIEPAY_SECRET_KEY}:x`).toString('base64')
    }

    async createPayment(req, res) {
        try {
            const { amount, userId } = req.body

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, phone: true }
            })

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' })
            }

            // Converte amount para número
            const amountNumber = parseInt(amount)
            
            if (isNaN(amountNumber)) {
                return res.status(400).json({ error: 'Valor inválido' })
            }

            // Monta o payload conforme documentação
            const paymentData = {
                value: amountNumber, // Valor em centavos já convertido para número
                external_reference: `DEP-EP-${Date.now()}`,
                notification_url: `${process.env.APP_URL}/api/gateway/callback`,
                customer: {
                    phone_number: user.phone.replace(/\D/g, ''),
                    name: `User ${userId}`
                },
                type: "PIX"
            }

            // Configuração do axios conforme documentação
            const config = {
                headers: {
                    'Authorization': `Basic ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            }

            // Faz a requisição para criar a transação
            const response = await axios.post(
                `${process.env.AXIEPAY_URL}/v1/transactions`, 
                paymentData,
                config
            )

            // Registra a transação no banco com o amount como número
            await prisma.transaction.create({
                data: {
                    external_id: paymentData.external_reference,
                    user_id: userId,
                    amount: amountNumber, // Agora é um número
                    type: 'DEPOSIT'
                }
            })

            return res.json(response.data)

        } catch (error) {
            console.error('Erro ao criar pagamento:', error.response?.data || error.message)
            return res.status(500).json({ 
                error: 'Erro ao processar pagamento',
                details: error.response?.data || error.message
            })
        }
    }

    async handleCallback(req, res) {
        try {
            const { external_reference, status } = req.body

            const transaction = await prisma.transaction.findFirst({
                where: { external_id: external_reference }
            })

            if (!transaction) {
                return res.status(404).json({ error: 'Transação não encontrada' })
            }

            if (status === 'approved') {
                await prisma.user.update({
                    where: { id: transaction.user_id },
                    data: {
                        balance: { increment: transaction.amount }
                    }
                })
            }

            return res.json({ success: true })

        } catch (error) {
            console.error('Erro no callback:', error)
            return res.status(500).json({ error: 'Erro ao processar callback' })
        }
    }
}

module.exports = new GatewayController()
    

    
    
