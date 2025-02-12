// src/controllers/gateway.controller.js


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { Buffer } = require('buffer')

class GatewayController {
    constructor() {
        if (!process.env.AXIEPAY_URL) {
            throw new Error('AXIEPAY_URL não configurada')
        }
        if (!process.env.AXIEPAY_SECRET_KEY) {
            throw new Error('AXIEPAY_SECRET_KEY não configurada')
        }

        this.baseUrl = process.env.AXIEPAY_URL.replace(/\/$/, '') // Remove trailing slash
        this.secretKey = process.env.AXIEPAY_SECRET_KEY
    }

    // Método auxiliar para fazer requisições autenticadas
    async #makeRequest(endpoint, method = 'GET', body = null) {
        try {
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

            const url = `${this.baseUrl}${endpoint}`
            console.log('Fazendo requisição para:', url)
            console.log('Headers:', options.headers)
            console.log('Body:', options.body)
            
            const response = await fetch(url, options)
            
            // Adiciona logs para debug
            console.log('Status:', response.status)
            const responseText = await response.text()
            console.log('Response:', responseText)

            try {
                return JSON.parse(responseText)
            } catch (error) {
                throw new Error(`Resposta inválida da API: ${responseText}`)
            }

        } catch (error) {
            console.error('Erro na requisição:', error)
            throw new Error(`Erro na requisição: ${error.message}`)
        }
    }

    // Criar uma nova transação de depósito
    async createDeposit(userId, amount) {
        try {
            // Busca informações do usuário
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                select: {
                    id: true,
                    phone: true
                }
            })

            if (!user) {
                throw new Error('Usuário não encontrado')
            }

            // Cria a transação no gateway
            const paymentData = {
                value: amount,                   // Valor em centavos
                external_reference: `DEP-${userId}-${Date.now()}`,  // ID externo
                notification_url: `${process.env.APP_URL}/api/gateway/callback`, // URL de callback
                customer: {
                    phone_number: user.phone.replace(/\D/g, '')  // Remove não-dígitos do telefone
                },
                type: "PIX"  // Tipo de pagamento
            }

            console.log('Payment Data:', paymentData)

            const payment = await this.#makeRequest('/v1/transactions', 'POST', paymentData)

            // Registra a transação no banco
            await prisma.transaction.create({
                data: {
                    external_id: paymentData.external_reference,
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

