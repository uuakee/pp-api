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

        res.status(200).json({ user, token });
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

        const user = await prisma.user.findUnique({
            where: {
                id: parseInt(userId)
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.status(200).json(user);
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
        // Pega o id do usuário do token (assumindo que está disponível em req.user.id)
        const userId = req.user.id;

        // Busca o usuário no banco de dados
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { balance: true, balance_withdrawal: true }
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
                balance_withdrawal: user.balance_withdrawal
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

module.exports = {
    createUser,
    loginUser,
    updateUser,
    getUser,
    getUsers,
    getBalance
};