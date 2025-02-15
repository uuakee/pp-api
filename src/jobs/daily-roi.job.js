const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');
const prisma = new PrismaClient();

// Função para calcular o rendimento diário
async function calculateDailyROI() {
    try {
        console.log('Iniciando cálculo de rendimentos diários...');

        // Busca todos os planos ativos que não expiraram
        const activePlans = await prisma.buyers.findMany({
            where: {
                end_date: {
                    gt: new Date() // Planos não expirados
                }
            },
            include: {
                plan: true // Inclui os dados do plano
            }
        });

        console.log(`Processando ${activePlans.length} planos ativos`);

        // Processa cada plano
        for (const investment of activePlans) {
            // O daily_roi já é o valor direto que o usuário deve receber
            const dailyEarning = Number(investment.plan.daily_roi);

            console.log(`Usuário ${investment.user_id} - Plano: ${investment.plan.name} - Rendimento: ${dailyEarning}`);

            // Atualiza o saldo do usuário
            await prisma.user.update({
                where: {
                    id: investment.user_id
                },
                data: {
                    balance: {
                        increment: dailyEarning
                    }
                }
            });

            // Salva o registro do rendimento diário
            await prisma.dailyEarning.create({
                data: {
                    user_id: investment.user_id,
                    amount: dailyEarning
                }
            });
        }

        console.log('Rendimentos diários processados com sucesso!');

    } catch (error) {
        console.error('Erro ao processar rendimentos diários:', error);
    }
}

// Agenda o job para rodar todos os dias às 00:00
function scheduleDailyROI() {
    cron.schedule('0 0 * * *', () => {
        calculateDailyROI();
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('Job de rendimentos diários agendado');
}

module.exports = {
    scheduleDailyROI,
    calculateDailyROI // Exporta também para testes manuais
}; 