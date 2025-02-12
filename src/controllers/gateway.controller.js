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
        this.baseUrl = 'https://api.axiepaybr.com/v1'
        this.authToken = Buffer.from(`${process.env.AXIEPAY_SECRET_KEY}:x`).toString('base64')
    }

    // Função para gerar CPF válido
    #generateCPF() {
        const generateDigit = (digits) => {
            let sum = 0
            let weight = digits.length + 1

            for(let i = 0; i < digits.length; i++) {
                sum += digits[i] * weight
                weight--
            }

            const digit = 11 - (sum % 11)
            return digit > 9 ? 0 : digit
        }

        // Gera os 9 primeiros dígitos
        const numbers = []
        for(let i = 0; i < 9; i++) {
            numbers.push(Math.floor(Math.random() * 10))
        }

        // Gera os dígitos verificadores
        const digit1 = generateDigit(numbers)
        numbers.push(digit1)
        const digit2 = generateDigit(numbers)
        numbers.push(digit2)

        return numbers.join('')
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

            // Gera CPF válido
            const cpf = this.#generateCPF()

            const paymentData = {
                value: amountNumber,
                external_reference: `DEP-EP-${Date.now()}`,
                notification_url: `${process.env.APP_URL}/api/gateway/callback`,
                customer: {
                    name: `User ${userId}`,
                    phone_number: user.phone.replace(/\D/g, ''),
                    email: `user${userId}@example.com`,
                    document: cpf,
                    document_type: 'CPF'  // Especifica o tipo do documento
                },
                billing: {
                    street: 'Rua Exemplo',
                    number: '123',
                    district: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    postal_code: '01001000'
                },
                type: "PIX",
                currency: "BRL",
                description: `Depósito - User ${userId}`,
                items: [
                    {
                        name: 'Créditos',
                        value: amountNumber,
                        quantity: 1
                    }
                ]
            }

            console.log('Enviando requisição para:', `${this.baseUrl}/transactions`)
            console.log('Payload:', paymentData)

            const config = {
                headers: {
                    'Authorization': `Basic ${this.authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }

            try {
                console.log('Tentando conectar à API...')
                const response = await axios.post(
                    `${this.baseUrl}/transactions`, 
                    paymentData,
                    {
                        ...config,
                        validateStatus: false // Para ver todos os status de resposta
                    }
                )

                console.log('Status da resposta:', response.status)
                console.log('Resposta da API:', response.data)

                if (response.status >= 400) {
                    throw new Error(`API retornou erro ${response.status}: ${JSON.stringify(response.data)}`)
                }

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
                if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
                    console.error('Não foi possível conectar ao servidor da API')
                    throw new Error('Serviço de pagamento temporariamente indisponível')
                }
                
                console.error('Erro detalhado:', {
                    code: axiosError.code,
                    message: axiosError.message,
                    response: axiosError.response?.data,
                    status: axiosError.response?.status
                })
                
                throw new Error(axiosError.response?.data?.message || 'Erro ao processar pagamento')
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
    

    
    
