import { NextRequest, NextResponse } from 'next/server';
import { generateAdvisorResponse } from '@/lib/ai-advisor';
import { FinancialProfile, TransactionItem } from '@/lib/financial-engine';
import { prisma } from '@/lib/prisma';
import { ensureKnowledgeSeeded } from '@/app/api/knowledge/route';

const DEFAULT_ADMIN_EMAIL = 'admin@sisfin.com.br';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      profile,
      transactions,
    }: {
      message: string;
      profile: FinancialProfile;
      transactions: TransactionItem[];
    } = body;

    if (!message || !profile) {
      return NextResponse.json({ error: 'Mensagem e perfil financeiro são obrigatórios.' }, { status: 400 });
    }

    // Carrega os Playbooks / Regras ensinadas pelo Admin no banco PostgreSQL
    const knowledgeRules = await ensureKnowledgeSeeded();

    // Processa no motor especialista Sisfin (gastos naturais + playbooks treinados + cálculos matemáticos)
    const localResult = await generateAdvisorResponse(
      message,
      profile,
      transactions || [],
      knowledgeRules
    );
    let finalReply = localResult.reply;

    // Se houver chave OPENAI_API_KEY configurada na Railway, injeta todos os Playbooks treinados pelo Admin no System Prompt!
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey && !localResult.addedTransaction) {
      try {
        const rulesContext = knowledgeRules
          .filter((r) => r.isActive)
          .map((r) => `- [${r.title}] (Gatilhos: ${r.topicKeywords}): ${r.methodologyRule}`)
          .join('\n');

        const systemPrompt = `Você é o Consultor Financeiro Pessoal do Sisfin, especialista em levar qualquer pessoa à Independência Financeira (FIRE) independentemente do salário atual.
Dados reais atuais do usuário (${profile.name}):
- Salário líquido mensal: R$ ${profile.monthlyIncome} (Dia do pagamento: ${profile.payday})
- Custo fixo essencial: R$ ${profile.essentialFixedCosts}
- Patrimônio já investido: R$ ${profile.currentInvested}
- Dívidas totais: R$ ${profile.totalDebt} (Parcela mensal: R$ ${profile.monthlyDebtPayment})
- Renda passiva desejada na aposentadoria: R$ ${profile.targetMonthlyIncome}/mês

REGRAS E PLAYBOOKS OFICIAIS TREINADOS PELO ADMINISTRADOR DO SISFIN (OBEDEÇA SEMPRE):
${rulesContext}

Responda de forma acolhedora, prática, direta e com cálculos reais em Reais (R$) adaptados ao salário do usuário.`;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message },
            ],
            temperature: 0.5,
          }),
        });

        if (aiRes.ok) {
          const data = await aiRes.json();
          const llmReply = data.choices?.[0]?.message?.content;
          if (llmReply) {
            finalReply = llmReply;
          }
        }
      } catch (err) {
        console.error('Fallback para motor especialista local treinado:', err);
      }
    }

    // Persiste a conversa e eventual transação diretamente no PostgreSQL da Railway
    try {
      const user = await prisma.user.findUnique({
        where: { email: profile.email || DEFAULT_ADMIN_EMAIL },
      });

      if (user) {
        await prisma.advisorMessage.createMany({
          data: [
            { userId: user.id, role: 'user', content: message },
            {
              userId: user.id,
              role: 'assistant',
              content: finalReply,
              actionTag: localResult.addedTransaction
                ? 'TRANSACTION_ADDED'
                : localResult.matchedRuleTitle || null,
            },
          ],
        });

        if (localResult.addedTransaction) {
          const added = localResult.addedTransaction;
          await prisma.transaction.create({
            data: {
              userId: user.id,
              description: added.description,
              amount: added.amount,
              type: added.type,
              category: added.category,
              source: 'AI_CHAT',
            },
          });

          if (added.type === 'INVESTMENT') {
            await prisma.user.update({
              where: { id: user.id },
              data: { currentInvested: { increment: added.amount } },
            });
          }
        }
      }
    } catch (dbErr) {
      console.error('Erro ao persistir mensagem do consultor no PostgreSQL:', dbErr);
    }

    return NextResponse.json({
      reply: finalReply,
      addedTransaction: localResult.addedTransaction,
      matchedRuleTitle: localResult.matchedRuleTitle,
    });
  } catch (error) {
    console.error('Erro na API do Consultor:', error);
    return NextResponse.json({ error: 'Falha ao processar consultoria financeira.' }, { status: 500 });
  }
}
