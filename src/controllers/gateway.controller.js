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

            const cpf = this.#generateCPF()

            // Ajustando o payload conforme erro retornado
            const paymentData = {
                amount: amountNumber,
                externalRef: `DEP-EP-${Date.now()}`,
                postbackUrl: `${process.env.APP_URL}/api/gateway/callback`,
                paymentMethod: "pix",
                pix: {
                    expiresInDays: 1
                },
                customer: {
                    name: `User ${userId}`,
                    phone: user.phone.replace(/\D/g, ''),
                    email: `user${userId}@example.com`,
                    document: {
                        type: 'cpf',
                        number: cpf
                    }
                },
                billingAddress: {
                    street: 'Rua Joaquim Nabuco',
                    number: '643',
                    district: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '77530000'
                },
                items: [
                    {
                        title: 'Créditos',
                        unitPrice: amountNumber,
                        quantity: 1,
                        tangible: false
                    }
                ],                
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
                        validateStatus: false
                    }
                )

                console.log('Status da resposta:', response.status)
                console.log('Resposta da API:', response.data)

                if (response.status >= 400) {
                    throw new Error(`API retornou erro ${response.status}: ${JSON.stringify(response.data)}`)
                }

                await prisma.transaction.create({
                    data: {
                        external_id: paymentData.externalRef,
                        user_id: userId,
                        amount: amountNumber,
                        type: 'DEPOSIT'
                    }
                })

                return res.json({
                    qrcode: response.data.pix.qrcode,
                    expirationDate: response.data.pix.expirationDate,
                    amount: response.data.amount,
                    status: response.data.status
                })

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
            const { type, data } = req.body

            if (type !== 'transaction') {
                return res.json({ received: true })
            }

            const transaction = await prisma.transaction.findFirst({
                where: { external_id: data.externalRef }
            })

            if (!transaction) {
                console.error('Transação não encontrada:', data.externalRef)
                return res.status(404).json({ error: 'Transação não encontrada' })
            }

            console.log(`Postback recebido - Status: ${data.status}, Transação: ${transaction.id}`)

            switch (data.status) {
                case 'paid':
                case 'approved':
                    // Converte o valor de centavos para reais
                    const realAmount = Math.floor(transaction.amount / 100)
                    
                    await prisma.$transaction([
                        // Atualiza status da transação
                        prisma.transaction.update({
                            where: { id: transaction.id },
                            data: { status: 'approved' }
                        }),
                        // Adiciona saldo ao usuário (valor em reais)
                        prisma.user.update({
                            where: { id: transaction.user_id },
                            data: {
                                balance: { increment: realAmount }
                            }
                        })
                    ])
                    console.log(`Pagamento aprovado - Usuário: ${transaction.user_id}, Valor: R$ ${realAmount.toFixed(2)} (${transaction.amount} centavos)`)
                    break

                case 'refused':
                case 'cancelled':
                case 'chargeback':
                    await prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'refused' }
                    })
                    console.log(`Pagamento recusado - Usuário: ${transaction.user_id}, Motivo: ${data.status}`)
                    break

                case 'pending':
                    await prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'pending' }
                    })
                    console.log(`Pagamento pendente - Usuário: ${transaction.user_id}`)
                    break

                case 'waiting_payment':
                    // Mantém o status atual
                    console.log(`Aguardando pagamento - Usuário: ${transaction.user_id}`)
                    break

                default:
                    console.log(`Status não tratado: ${data.status}`)
            }

            return res.json({ received: true })

        } catch (error) {
            console.error('Erro ao processar callback:', error)
            return res.status(500).json({ error: 'Erro ao processar callback' })
        }
    }
}

module.exports = new GatewayController()
    

    
    
