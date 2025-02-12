// src/controllers/gateway.controller.js


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { Buffer } = require('buffer')

class GatewayController {
    constructor() {
        this.baseUrl = process.env.AXIEPAY_URL
        this.secretKey = process.env.AXIEPAY_SECRET_KEY
    }

    // Método auxiliar para fazer requisições autenticadas
    async #makeRequest(endpoint, method = 'GET', body = null) {
        const auth = Buffer.from(`${this.secretKey}:x`).toString('base64')
        
        const options = {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        }

        if (body) {
            options.body = JSON.stringify(body)
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options)
        return await response.json()
    }

    // Criar uma nova transação de depósito
    async createDeposit(userId, amount) {
        try {
            // Cria a transação no gateway
            const paymentData = {
                amount: amount,
                external_id: `DEP-${userId}-${Date.now()}`,
                callback_url: `${process.env.APP_URL}/api/gateway/callback`
            }

            const payment = await this.#makeRequest('/v1/transactions', 'POST', paymentData)

            // Registra a transação no banco
            await prisma.transaction.create({
                data: {
                    external_id: paymentData.external_id,
                    user_id: userId,
                    amount: amount,
                    type: 'DEPOSIT'
                }
            })

            return payment

        } catch (error) {
            console.error('Erro ao criar depósito:', error)
            throw new Error('Falha ao processar pagamento')
        }
    }

    // Processa o callback do gateway
    async handleCallback(data) {
        try {
            const transaction = await prisma.transaction.findFirst({
                where: {
                    external_id: data.external_id
                }
            })

            if (!transaction) {
                throw new Error('Transação não encontrada')
            }

            if (data.status === 'approved') {
                // Atualiza o saldo do usuário
                await prisma.user.update({
                    where: {
                        id: transaction.user_id
                    },
                    data: {
                        balance: {
                            increment: transaction.amount
                        }
                    }
                })
            }

            return { success: true }

        } catch (error) {
            console.error('Erro ao processar callback:', error)
            throw new Error('Falha ao processar callback')
        }
    }
}

module.exports = new GatewayController()

