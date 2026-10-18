import { NextRequest, NextResponse } from 'next/server';
import { generateAdvisorResponse } from '@/lib/ai-advisor';
import { FinancialProfile, TransactionItem } from '@/lib/financial-engine';

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

    // Primeiro processa se há registro de transação natural (ex: "Gastei 50 no mercado")
    const localResult = await generateAdvisorResponse(message, profile, transactions || []);

    // Se houver chave OPENAI_API_KEY configurada na Railway e não for apenas um lançamento rápido, enriquece via LLM
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey && !localResult.addedTransaction) {
      try {
        const systemPrompt = `Você é o Consultor Financeiro Pessoal do Sisfin, especialista em levar qualquer pessoa à Independência Financeira (FIRE) independentemente do salário atual.
Dados atuais do usuário (${profile.name}):
- Salário líquido mensal: R$ ${profile.monthlyIncome} (Dia do pagamento: ${profile.payday})
- Custo fixo essencial: R$ ${profile.essentialFixedCosts}
- Patrimônio já investido: R$ ${profile.currentInvested}
- Dívidas totais: R$ ${profile.totalDebt} (Parcela mensal: R$ ${profile.monthlyDebtPayment})
- Renda passiva desejada na aposentadoria: R$ ${profile.targetMonthlyIncome}/mês
Responda de forma acolhedora, prática, direta e com cálculos reais em Reais (R$). Nunca julgue o salário do usuário; mostre sempre o próximo passo prático.`;

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
            return NextResponse.json({
              reply: llmReply,
              addedTransaction: localResult.addedTransaction,
            });
          }
        }
      } catch (err) {
        console.error('Fallback para motor especialista local:', err);
      }
    }

    return NextResponse.json(localResult);
  } catch (error) {
    console.error('Erro na API do Consultor:', error);
    return NextResponse.json({ error: 'Falha ao processar consultoria financeira.' }, { status: 500 });
  }
}
