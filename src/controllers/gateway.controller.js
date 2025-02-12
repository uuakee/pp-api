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

    async createWithdraw(req, res) {
        try {
            const { amount, userId, pixKey, pixKeyType } = req.body;

            // Validação dos campos obrigatórios
            if (!amount || !userId || !pixKey || !pixKeyType) {
                return res.status(400).json({ 
                    error: 'Dados inválidos',
                    details: 'Todos os campos são obrigatórios'
                });
            }

            // Busca o usuário e verifica saldo
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, balance: true }
            });

            if (!user) {
                return res.status(404).json({ 
                    error: 'Usuário não encontrado',
                    details: 'Usuário não encontrado na base de dados'
                });
            }

            // Verifica se tem saldo suficiente
            if (user.balance < amount) {
                return res.status(400).json({ 
                    error: 'Saldo insuficiente',
                    details: 'Você não possui saldo suficiente para este saque'
                });
            }

            // Validação do tipo de chave PIX
            if (!['cpf', 'email', 'phone'].includes(pixKeyType)) {
                return res.status(400).json({ 
                    error: 'Tipo de chave PIX inválido',
                    details: 'O tipo de chave PIX deve ser cpf, email ou phone'
                });
            }

            const paymentData = {
                amount,
                postbackUrl: `${process.env.APP_URL}/api/gateway/callback`,
                netAmount: false,
                pixKey,
                pixKeyType
            };

            const generateExternalRef = () => {
                return `WITHDRAW-EP-${Date.now()}`
            }

            const config = {
                headers: {
                    'Authorization': `Basic ${this.authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }

            try {
                console.log('Tentando conectar à API...');
                const response = await axios.post(
                    `${this.baseUrl}/transfers`, 
                    paymentData,
                    {
                        ...config,
                        validateStatus: false
                    }
                );

                console.log('Status da resposta:', response.status);
                console.log('Resposta da API:', response.data);

                if (response.status >= 400) {
                    throw new Error(`API retornou erro ${response.status}: ${JSON.stringify(response.data)}`);
                }

                // Cria a transação
                const transaction = await prisma.transaction.create({
                    data: {
                        external_id: generateExternalRef(),
                        user_id: userId,
                        amount,
                        type: 'WITHDRAWAL',
                        status: "pending"
                    }
                });

                // Deduz o valor do saldo do usuário
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        balance: {
                            decrement: amount
                        }
                    }
                });

                return res.json({
                    externalRef: transaction.external_id,
                    status: "pending"
                });

            } catch (axiosError) {
                console.error('Erro na API:', axiosError);
                throw new Error(axiosError.response?.data?.message || 'Erro na comunicação com o serviço de pagamento');
            }

        } catch (error) {
            console.error('Erro ao criar saque:', error);
            return res.status(500).json({ 
                error: 'Erro ao processar saque',
                details: error.message
            });
        }
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
                    
                    // Busca o usuário e seu indicador
                    const user = await prisma.user.findUnique({
                        where: { id: transaction.user_id },
                        select: { 
                            id: true,
                            invited_by: true
                        }
                    });

                    if (user.invited_by) {
                        // Busca o VIP do indicador
                        const inviter = await prisma.user.findUnique({
                            where: { referal_code: user.invited_by },
                            select: {
                                id: true,
                                vip_type: true
                            }
                        });

                        if (inviter && inviter.vip_type) {
                            // Busca a porcentagem de CPA do VIP
                            const vip = await prisma.vip.findFirst({
                                where: { name: inviter.vip_type }
                            });

                            if (vip) {
                                // Calcula a comissão (realAmount * porcentagem / 100)
                                const commission = Math.floor(realAmount * vip.cpa_porcentage / 100);
                                
                                // Atualiza o saldo do indicador
                                await prisma.user.update({
                                    where: { id: inviter.id },
                                    data: {
                                        balance: {
                                            increment: commission
                                        }
                                    }
                                });

                                console.log(`Comissão paga: R$ ${commission} para usuário ${inviter.id} (${vip.cpa_porcentage}% de R$ ${realAmount})`);
                            }
                        }
                    }

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
                    ]);

                    console.log(`Pagamento aprovado - Usuário: ${transaction.user_id}, Valor: R$ ${realAmount.toFixed(2)} (${transaction.amount} centavos)`);
                    break;

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
                    console.log(`Saque pendente - Usuário: ${transaction.user_id}`)
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
    

    
    
