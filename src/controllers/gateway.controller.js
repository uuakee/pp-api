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
        this.baseUrl = 'https://api.axiepay.com.br/api'
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

            const amountNumber = parseInt(amount)
            
            if (isNaN(amountNumber)) {
                return res.status(400).json({ error: 'Valor inválido' })
            }

            // Payload atualizado conforme documentação
            const paymentData = {
                value: amountNumber,
                external_reference: `DEP-EP-${Date.now()}`,
                notification_url: `${process.env.APP_URL}/api/gateway/callback`,
                customer: {
                    phone_number: user.phone.replace(/\D/g, ''),
                    name: `User ${userId}`
                },
                type: "PIX",
                currency: "BRL"  // Adicionando moeda
            }

            console.log('Enviando requisição para:', `${this.baseUrl}/v1/transactions`)
            console.log('Payload:', paymentData)

            const config = {
                headers: {
                    'Authorization': `Basic ${this.authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 segundos de timeout
            }

            try {
                const response = await axios.post(
                    `${this.baseUrl}/v1/transactions`, 
                    paymentData,
                    config
                )

                console.log('Resposta da API:', response.data)

                // Registra a transação no banco
                await prisma.transaction.create({
                    data: {
                        external_id: paymentData.external_reference,
                        user_id: userId,
                        amount: amountNumber,
                        type: 'DEPOSIT'
                    }
                })

                return res.json(response.data)

            } catch (axiosError) {
                console.error('Erro na chamada da API:', {
                    status: axiosError.response?.status,
                    data: axiosError.response?.data,
                    headers: axiosError.response?.headers
                })
                throw new Error(`Erro na API: ${axiosError.response?.data?.message || axiosError.message}`)
            }

        } catch (error) {
            console.error('Erro ao criar pagamento:', error)
            return res.status(500).json({ 
                error: 'Erro ao processar pagamento',
                details: error.message
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
    

    
    
