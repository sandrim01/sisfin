import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorizeDescription } from '@/lib/ai-advisor';

const DEFAULT_ADMIN_EMAIL = 'admin@sisfin.com.br';

async function getOrCreateAdminUser() {
  let user = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
      advisorMessages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Sandrim (Admin & Cobaia #01)',
        email: DEFAULT_ADMIN_EMAIL,
        role: 'ADMIN',
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: 'FUNDADOR_VITALICIO',
        monthlyIncome: 4200,
        payday: 5,
        essentialFixedCosts: 2350,
        currentInvested: 3800,
        totalDebt: 0,
        monthlyDebtPayment: 0,
        targetMonthlyIncome: 4200,
        annualRealYield: 0.06,
        maturityLevel: 3,
        transactions: {
          create: [
            {
              description: 'Salário Mensal Recebido',
              amount: 4200,
              type: 'INCOME',
              category: 'Renda / Salário',
              source: 'MANUAL',
            },
            {
              description: 'Aporte Pague-se 1º (Tesouro Selic)',
              amount: 630,
              type: 'INVESTMENT',
              category: 'Investimento & Reserva',
              source: 'AI_CHAT',
            },
            {
              description: 'Aluguel + Condomínio + Internet',
              amount: 1450,
              type: 'EXPENSE',
              category: 'Custo Essencial',
              source: 'MANUAL',
            },
            {
              description: 'Supermercado Mensal Atacadão',
              amount: 620,
              type: 'EXPENSE',
              category: 'Custo Essencial',
              source: 'WHATSAPP',
            },
            {
              description: 'Jantar Fim de Semana & Cinema',
              amount: 165,
              type: 'EXPENSE',
              category: 'Estilo de Vida & Lazer',
              source: 'AI_CHAT',
            },
          ],
        },
        advisorMessages: {
          create: [
            {
              role: 'assistant',
              content:
                'Olá, **Sandrim (Admin & Cobaia #01)**! Seu banco PostgreSQL na Railway já está conectado e sincronizado em tempo real.\n\n💡 **Experimente agora:**\n- Digite *"Gastei 55 na farmácia"* ou *"Investi 300 no CDB"* para salvar direto no banco da Railway.\n- Ou pergunte: *"Posso comprar um notebook de R$ 2800 esse mês?"*',
            },
          ],
        },
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
        advisorMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  return user;
}

export async function GET() {
  try {
    const user = await getOrCreateAdminUser();

    const formattedTransactions = user.transactions.map((tx) => {
      const cat = categorizeDescription(tx.description);
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        potType: tx.type === 'INVESTMENT' ? 'FREEDOM_INVEST' : cat.potType,
        source: tx.source,
        date: tx.date.toISOString().slice(0, 10),
      };
    });

    const formattedMessages = user.advisorMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        monthlyIncome: user.monthlyIncome,
        payday: user.payday,
        essentialFixedCosts: user.essentialFixedCosts,
        currentInvested: user.currentInvested,
        totalDebt: user.totalDebt,
        monthlyDebtPayment: user.monthlyDebtPayment,
        targetMonthlyIncome: user.targetMonthlyIncome,
        annualRealYield: user.annualRealYield,
      },
      transactions: formattedTransactions,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error('Erro ao buscar estado no PostgreSQL Railway:', error);
    return NextResponse.json({ error: 'Falha ao carregar dados do banco.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile } = body;

    const user = await getOrCreateAdminUser();

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: profile.name,
        monthlyIncome: Number(profile.monthlyIncome),
        payday: Number(profile.payday),
        essentialFixedCosts: Number(profile.essentialFixedCosts),
        currentInvested: Number(profile.currentInvested),
        totalDebt: Number(profile.totalDebt),
        monthlyDebtPayment: Number(profile.monthlyDebtPayment || 0),
        targetMonthlyIncome: Number(profile.targetMonthlyIncome),
        annualRealYield: Number(profile.annualRealYield || 0.06),
      },
    });

    return NextResponse.json({ status: 'saved', profile: updated });
  } catch (error) {
    console.error('Erro ao atualizar perfil no PostgreSQL:', error);
    return NextResponse.json({ error: 'Falha ao salvar perfil.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getOrCreateAdminUser();

    // Suporta adicionar 1 transação ou um lote de transações (importação OFX/CSV)
    if (Array.isArray(body.transactions)) {
      const createdList = [];
      for (const item of body.transactions) {
        const created = await prisma.transaction.create({
          data: {
            userId: user.id,
            description: item.description,
            amount: Number(item.amount),
            type: item.type || 'EXPENSE',
            category: item.category || 'Geral',
            source: item.source || 'OFX_CSV',
            date: item.date ? new Date(item.date) : new Date(),
          },
        });
        createdList.push(created);
      }
      return NextResponse.json({ status: 'batch_saved', count: createdList.length });
    }

    if (body.transaction) {
      const tx = body.transaction;
      const created = await prisma.transaction.create({
        data: {
          userId: user.id,
          description: tx.description,
          amount: Number(tx.amount),
          type: tx.type || 'EXPENSE',
          category: tx.category || 'Geral',
          source: tx.source || 'MANUAL',
          date: tx.date ? new Date(tx.date) : new Date(),
        },
      });

      if (tx.type === 'INVESTMENT') {
        await prisma.user.update({
          where: { id: user.id },
          data: { currentInvested: { increment: Number(tx.amount) } },
        });
      }

      return NextResponse.json({ status: 'transaction_saved', transaction: created });
    }

    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao salvar transação no PostgreSQL:', error);
    return NextResponse.json({ error: 'Falha ao salvar transação.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted', id });
  } catch (error) {
    console.error('Erro ao excluir transação:', error);
    return NextResponse.json({ error: 'Falha ao excluir.' }, { status: 500 });
  }
}
