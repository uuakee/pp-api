// src/controllers/user.controller.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

require('dotenv').config();


const generateReferalCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'EP-';
    
    // Gera 3 caracteres antes do ponto
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    result += '.';
    
    // Gera 3 caracteres depois do ponto
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
};

const createUser = async (req, res) => {
    try {
        const { phone, password, invited_by } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { phone }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Se existe código de convite, verifica se é válido
        let inviter = null;
        if (invited_by) {
            inviter = await prisma.user.findUnique({
                where: { referal_code: invited_by }
            });

            if (!inviter) {
                return res.status(400).json({ message: 'Invalid referal code' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Cria o usuário
        const user = await prisma.user.create({
            data: {
                phone,
                password: hashedPassword,
                referal_code: generateReferalCode(),
                invited_by: invited_by || null,
                vip_type: 'VIP_0',
            },
        });

        // Se tiver convite, cria o registro na tabela Referal e incrementa o contador
        if (inviter) {
            await Promise.all([
                // Cria o registro de referral
                prisma.referal.create({
                    data: {
                        user_id: inviter.id,
                        referal_id: user.id,
                    }
                }),
                // Incrementa o contador de referrals do convidador
                prisma.user.update({
                    where: { id: inviter.id },
                    data: {
                        referal_count: {
                            increment: 1
                        }
                    }
                })
            ]);
        }

        // Retorna o usuário criado sem a senha
        const userResponse = {
            id: user.id,
            phone: user.phone,
            referal_code: user.referal_code,
            invited_by: user.invited_by
        };

        res.status(201).json({
            message: 'User created successfully',
            user: userResponse
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const loginUser = async (req, res) => {
    try {
        const { phone, password } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                phone,
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        // Retorna o id separadamente junto com o token
        res.status(200).json({
            token,
            id: user.id,
            user: {
                phone: user.phone,
                referal_code: user.referal_code,
                is_admin: user.is_admin
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.update({
            where: {
                id: parseInt(userId)
            },
            data: {
                password: hashedPassword,
            },
        });

        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const getUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Converte userId para número inteiro
        const userIdInt = parseInt(userId, 10);

        if (isNaN(userIdInt)) {
            return res.status(400).json({ message: 'ID de usuário inválido' });
        }

        // Busca o usuário
        const user = await prisma.user.findUnique({
            where: {
                id: userIdInt
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Busca os referidos do usuário
        const referals = await prisma.referal.findMany({
            where: {
                user_id: userIdInt
            }
        });

        const referalIds = referals.map(ref => ref.referal_id);

        // Busca total de investimentos dos referidos
        const investments = await prisma.buyers.count({
            where: {
                user_id: {
                    in: referalIds
                }
            }
        });

        // Busca total de depósitos dos referidos
        const deposits = await prisma.transaction.aggregate({
            where: {
                user_id: {
                    in: referalIds
                },
                type: 'DEPOSIT'
            },
            _sum: {
                amount: true
            }
        });

        // Calcula o bônus baseado no VIP
        const totalDeposits = deposits._sum.amount || 0;
        let bonusPercentage = 0;

        switch (user.vip_type) {
            case 'VIP_0':
                bonusPercentage = 0.20; // 20%
                break;
            case 'VIP_1':
                bonusPercentage = 0.15; // 15%
                break;
            case 'VIP_2':
                bonusPercentage = 0.02; // 2%
                break;
            case 'VIP_3':
                bonusPercentage = 0.01; // 1%
                break;
            default:
                bonusPercentage = 0;
        }

        const referalBonus = Math.floor(totalDeposits * bonusPercentage);

        res.status(200).json({
            ...user,
            referal_investments: investments,
            referal_deposits: totalDeposits,
            referal_bonus: referalBonus
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany();

        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const getBalance = async (req, res) => {
    try {
        // Pega o id do usuário da query
        const userId = req.query.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'ID do usuário não fornecido'
            });
        }

        // Busca o usuário no banco de dados
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { balance: true, withdrawal_balance: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // Retorna os saldos
        return res.status(200).json({
            success: true,
            data: {
                balance: user.balance,
                withdrawal_balance: user.withdrawal_balance
            }
        });

    } catch (error) {
        console.error('Erro ao buscar saldo:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar saldo do usuário'
        });
    }
};

const buyPlan = async (req, res) => {
    try {
        const { userId, planId } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const plan = await prisma.plans.findUnique({
            where: { id: parseInt(planId) }
        });

        if (!plan) {
            return res.status(404).json({ message: 'Plano não encontrado' });
        }

        // Verifica se o usuário tem saldo suficiente
        if (user.balance < plan.price) {
            return res.status(400).json({ message: 'Saldo insuficiente' });
        }

        // Atualiza o saldo do usuário
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: {
                balance: user.balance - plan.price
            }
        });

        // Cria o registro de investimento
        const investment = await prisma.buyers.create({
            data: {
                user_id: parseInt(userId),
                plan_id: parseInt(planId),
                price: plan.price,
                end_date: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
            }
        });

        res.status(200).json({
            message: 'Plano comprado com sucesso',
            investment: {
                id: investment.id,
                user_id: investment.user_id,
                plan_id: investment.plan_id,
                price: investment.price,
                end_date: investment.end_date
            }
        });
    } catch (error) {
        console.error('Erro ao comprar plano:', error);
        res.status(500).json({ message: error.message });
    }
};

const getPlansFromUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const plans = await prisma.buyers.findMany({
            where: {
                user_id: parseInt(userId),
                end_date: {
                    gt: new Date()
                }
            },
            include: {
                plan: true
            },
            orderBy: {
                buy_date: 'desc'
            }
        });

        res.status(200).json(plans);
    } catch (error) {
        console.error('Erro ao buscar planos do usuário:', error);
        res.status(500).json({ message: error.message });
    }
};

const getDeposits = async (req, res) => {
    try {
        const { userId } = req.params;

        const deposits = await prisma.transaction.findMany({
            where: {
                user_id: parseInt(userId),
                type: 'DEPOSIT'
            }
        });

        res.status(200).json(deposits);
    } catch (error) {
        console.error('Erro ao buscar depósitos do usuário:', error);
        res.status(500).json({ message: error.message });
    }
};

const getWithdrawals = async (req, res) => {
    try {
        const { userId } = req.params;

        const withdrawals = await prisma.transaction.findMany({
            where: {
                user_id: parseInt(userId),
                type: 'WITHDRAWAL' 
            }
        });

        res.status(200).json(withdrawals);
    } catch (error) {
        console.error('Erro ao buscar saques do usuário:', error);
        res.status(500).json({ message: error.message });
    }
};

const getVipPercentage = async (req, res) => {
    try {
        const { vipId } = req.params;

        const vip = await prisma.vip.findUnique({
            where: { id: parseInt(vipId) }
        });

        res.status(200).json(vip);
    } catch (error) {
        console.error('Erro ao buscar porcentagem do VIP:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createUser,
    loginUser,
    updateUser,
    getUser,
    getUsers,
    getBalance,
    buyPlan,
    getPlansFromUser,
    getDeposits,
    getWithdrawals,
    getVipPercentage
};