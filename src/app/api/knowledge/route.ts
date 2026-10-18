import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_PLAYBOOKS = [
  {
    title: 'Playbook: Compra de Carro ou Moto sem se Endividar',
    topicKeywords: 'carro, moto, veiculo, automovel, financiar carro, consorcio carro, trocar de carro, cnh',
    methodologyRule:
      '1) Regra do Custo Invisível: um veículo custa cerca de 1,5% a 2% do seu valor POR MÊS em combustível, seguro, IPVA, pneus e manutenção. Esse valor deve caber dentro do Pote Essencial sem ultrapassar o limite.\n2) Nunca zere sua Reserva da Paz para dar entrada no carro.\n3) Financiamento tradicional faz você pagar quase 2 carros por causa dos juros compostos. O plano ideal do Sisfin é: acumular de 40% a 100% do valor no Pote de Metas (rendendo 100% do CDI) e usar os juros a seu favor para comprar à vista com desconto de 10% a 15%, ou dar no mínimo 50% de entrada com parcela que não passe de 15% do salário líquido.',
    formulaHint: 'veiculo_2pct_manutencao',
  },
  {
    title: 'Playbook: Compra de Casa Própria / Apartamento / Imóvel',
    topicKeywords: 'casa, apartamento, imovel, moradia, financiar imovel, minha casa minha vida, entrada apartamento, terreno',
    methodologyRule:
      '1) A entrada mínima obrigatória é de 20% do valor do imóvel + 5% para documentação (ITBI, escritura e vistoria).\n2) A parcela do financiamento imobiliário NUNCA deve ultrapassar 25% a 30% da sua renda líquida mensal.\n3) Use o FGTS a cada 2 anos para amortizar o saldo devedor no sistema SAC (reduzindo o prazo e economizando dezenas de milhares de reais em juros).',
    formulaHint: 'imovel_25pct_entrada',
  },
  {
    title: 'Playbook: Viagem, Casamento ou Grande Meta de Curto/Médio Prazo',
    topicKeywords: 'viagem, viajar, ferias, casamento, casar, festa, intercambio, formatura, reforma',
    methodologyRule:
      '1) Sonhos com data marcada jamais devem ser pagos no rotativo do cartão ou empréstimo pessoal.\n2) Divida o custo total pelo número de meses até o evento e aloque no Pote de Metas de Curto Prazo em um CDB de liquidez diária ou Tesouro Selic.\n3) Se o valor mensal necessário superar o Pote de Metas atual, apresente duas alavancas: estender o prazo em alguns meses ou redirecionar temporariamente 30% do Pote de Estilo de Vida.',
    formulaHint: 'meta_programada_cdi',
  },
  {
    title: 'Playbook: Sair das Dívidas e Limpar o Nome (Bola de Neve vs Avalanche)',
    topicKeywords: 'divida, endividado, cartao estourado, cheque especial, emprestimo, nome sujo, serasa, juros altos, quitar',
    methodologyRule:
      '1) Estanque o sangramento: pare de fazer novas parcelas e mantenha uma mini-reserva de R$ 500 a R$ 1.000 para não voltar ao cartão.\n2) Liste todas as dívidas. Ataque primeiro a de maior juros (Avalanche: cartão/cheque especial) ou a menor dívida para ganhar fôlego rápido (Bola de Neve).\n3) Nunca aceite a primeira proposta do banco: aguarde feirões de renegociação com descontos de 70% a 90% nos juros e mantenha pelo menos 3% do salário indo para o Pote da Liberdade para criar o hábito poupador.',
    formulaHint: 'resgate_dividas',
  },
  {
    title: 'Playbook: Como Começar a Investir do Zero com Pouco Dinheiro',
    topicKeywords: 'investir, comecar a investir, onde investir, tesouro selic, cdb, fii, acoes, renda fixa, guardar dinheiro',
    methodologyRule:
      '1) Não existe valor mínimo para mudar de mentalidade: comece no dia do pagamento ("Pague-se Primeiro"), nem que seja com R$ 30 ou R$ 50.\n2) Fase 1 (Reserva da Paz): 100% em liquidez diária segura (Tesouro Selic ou CDB 100% CDI de bancão/banco sólido).\n3) Fase 2 (Multiplicação FIRE): Só após completar de 3 a 6 meses do seu custo essencial na Reserva, diversifique em IPCA+ (proteção contra inflação), Fundos Imobiliários (dividendos mensais isentos) e ETFs/Ações.',
    formulaHint: 'investidor_iniciante',
  },
];

export async function ensureKnowledgeSeeded() {
  const count = await prisma.aiKnowledgeRule.count();
  if (count === 0) {
    await prisma.aiKnowledgeRule.createMany({
      data: DEFAULT_PLAYBOOKS,
    });
  }
  return prisma.aiKnowledgeRule.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

export async function GET() {
  try {
    const rules = await ensureKnowledgeSeeded();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Erro ao buscar base de conhecimento da IA:', error);
    return NextResponse.json({ error: 'Falha ao carregar regras da IA.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, topicKeywords, methodologyRule, formulaHint } = body;

    if (!title || !topicKeywords || !methodologyRule) {
      return NextResponse.json(
        { error: 'Título, palavras-chave e regra metodológica são obrigatórios.' },
        { status: 400 }
      );
    }

    const created = await prisma.aiKnowledgeRule.create({
      data: {
        title: title.trim(),
        topicKeywords: topicKeywords.trim(),
        methodologyRule: methodologyRule.trim(),
        formulaHint: formulaHint || null,
        isActive: true,
      },
    });

    return NextResponse.json({ status: 'created', rule: created });
  } catch (error) {
    console.error('Erro ao criar regra de treinamento da IA:', error);
    return NextResponse.json({ error: 'Falha ao criar regra.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, topicKeywords, methodologyRule, isActive } = body;

    const updated = await prisma.aiKnowledgeRule.update({
      where: { id },
      data: {
        title,
        topicKeywords,
        methodologyRule,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ status: 'updated', rule: updated });
  } catch (error) {
    console.error('Erro ao atualizar regra de IA:', error);
    return NextResponse.json({ error: 'Falha ao atualizar regra.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }
    await prisma.aiKnowledgeRule.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted', id });
  } catch (error) {
    console.error('Erro ao excluir regra de IA:', error);
    return NextResponse.json({ error: 'Falha ao excluir regra.' }, { status: 500 });
  }
}
