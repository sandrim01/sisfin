import { FinancialProfile, SmartPot, TransactionItem, calculateFinancialDiagnosis } from './financial-engine';

export interface ParsedQuickTransaction {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'INVESTMENT';
  category: string;
  potType: SmartPot['type'];
}

export interface KnowledgeRuleItem {
  id: string;
  title: string;
  topicKeywords: string;
  methodologyRule: string;
  formulaHint?: string | null;
  isActive: boolean;
}

/**
 * Classifica um texto natural de gasto ou receita em categoria e pote inteligente.
 * Ex: "Gastei 85,90 no mercado ontem" -> EXPENSE, Alimentação, ESSENTIAL
 */
export function parseNaturalLanguageTransaction(text: string): ParsedQuickTransaction | null {
  const normalized = text.toLowerCase();

  // Se for uma pergunta consultiva ou de planejamento ("preciso me organizar", "como faço", "quero comprar", "posso comprar"), NÃO é lançamento de gasto!
  if (
    /(preciso|organizar|planejar|como faco|como fazer|quero comprar|sonho|meta|posso|devo|vale a pena|sera que|simul|se eu|\?)/i.test(
      normalized
    )
  ) {
    return null;
  }

  // Verifica se há comando ou verbo de transação + número
  const hasActionKeyword =
    /(gastei|paguei|comprei|investi|guardei|aportei|recebi|caiu|pix|mercado|uber|ifood|conta|aluguel|luz|agua|internet|cartao|parcela)/i.test(
      normalized
    );

  // Captura valor monetário (ex: 45, 45.90, 1.250,50, R$ 120)
  const moneyMatch = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);

  if (!hasActionKeyword || !moneyMatch) {
    return null;
  }

  // Converte string numérica BR para float
  const rawNum = moneyMatch[1];
  let amount = 0;
  if (rawNum.includes(',') && rawNum.includes('.')) {
    amount = parseFloat(rawNum.replace(/\./g, '').replace(',', '.'));
  } else if (rawNum.includes(',')) {
    amount = parseFloat(rawNum.replace(',', '.'));
  } else {
    amount = parseFloat(rawNum);
  }

  if (isNaN(amount) || amount <= 0 || amount > 1000000) {
    return null;
  }

  const categoryInfo = categorizeDescription(text);

  return {
    description: cleanDescription(text, moneyMatch[0]),
    amount,
    type: categoryInfo.type,
    category: categoryInfo.category,
    potType: categoryInfo.potType,
  };
}

function cleanDescription(text: string, matchedNumber: string): string {
  const cleaned = text
    .replace(new RegExp(matchedNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
    .replace(/(gastei|paguei|comprei|investi|guardei|aportei|recebi|no pix|reais|r\$|\bde\b|\bno\b|\bna\b)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2) return 'Lançamento via Chat IA';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function categorizeDescription(desc: string): {
  type: 'INCOME' | 'EXPENSE' | 'INVESTMENT';
  category: string;
  potType: SmartPot['type'];
} {
  const d = desc.toLowerCase();

  if (/(salario|pagamento|freela|recebi|dividendo|rendimento|pix recebido|reembolso)/i.test(d)) {
    return { type: 'INCOME', category: 'Renda / Salário', potType: 'FREEDOM_INVEST' };
  }

  if (/(investi|tesouro|cdb|selic|reserva|aporte|guardei|fii|acoes|caixinha)/i.test(d)) {
    return { type: 'INVESTMENT', category: 'Investimento & Reserva', potType: 'FREEDOM_INVEST' };
  }

  if (/(divida|emprestimo|renegocia|fatura atrasada|juros|acordo|serasa)/i.test(d)) {
    return { type: 'EXPENSE', category: 'Quitação de Dívidas', potType: 'DEBT_RESCUE' };
  }

  if (
    /(mercado|supermercado|atacadao|aluguel|condominio|luz|energia|agua|sabesp|internet|vivo|claro|tim|gas|farmacia|remedio|medico|onibus|metro|combustivel|gasolina|feira|açougue|padaria)/i.test(
      d
    )
  ) {
    return { type: 'EXPENSE', category: 'Custo Essencial', potType: 'ESSENTIAL' };
  }

  if (/(curso|livro|faculdade|meta|viagem|notebook|conserto|carro|moto)/i.test(d)) {
    return { type: 'EXPENSE', category: 'Metas & Educação', potType: 'SHORT_GOAL' };
  }

  return { type: 'EXPENSE', category: 'Estilo de Vida & Lazer', potType: 'LIFESTYLE' };
}

/**
 * Importador universal de extratos CSV e OFX (Nubank, Inter, Itaú, BB, C6, Bradesco)
 */
export function parseBankStatementFile(content: string, filename: string): TransactionItem[] {
  const isOfx = filename.toLowerCase().endsWith('.ofx') || content.includes('<STMTTRN>');
  const results: TransactionItem[] = [];

  if (isOfx) {
    const blocks = content.split('<STMTTRN>');
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const amountMatch = block.match(/<TRNAMT>([-0-9.,]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i) || block.match(/<NAME>([^<\r\n]+)/i);
      const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);

      if (amountMatch) {
        const rawVal = parseFloat(amountMatch[1].replace(',', '.'));
        if (!isNaN(rawVal) && rawVal !== 0) {
          const desc = memoMatch ? memoMatch[1].trim() : 'Transação OFX';
          const cat = categorizeDescription(desc);
          const formattedDate = dateMatch
            ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
            : new Date().toISOString().slice(0, 10);

          results.push({
            id: `ofx-${Date.now()}-${i}`,
            description: desc,
            amount: Math.abs(rawVal),
            type: rawVal > 0 ? 'INCOME' : cat.type,
            category: rawVal > 0 ? 'Entrada / Crédito' : cat.category,
            potType: cat.potType,
            source: 'OFX_CSV',
            date: formattedDate,
          });
        }
      }
    }
    return results;
  }

  // Parser CSV (Suporta separador ',' ou ';')
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = 1; i < lines.length; i++) {
    const sep = lines[i].includes(';') ? ';' : ',';
    const cols = lines[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    if (cols.length >= 2) {
      let amountVal = NaN;
      let descText = '';
      let dateStr = new Date().toISOString().slice(0, 10);

      for (const col of cols) {
        if (/^\d{4}-\d{2}-\d{2}/.test(col)) {
          dateStr = col.slice(0, 10);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(col)) {
          const [d, m, y] = col.split('/');
          dateStr = `${y}-${m}-${d}`;
        } else if (/^[-+]?\d+(?:[.,]\d{1,2})?$/.test(col)) {
          amountVal = parseFloat(col.replace(',', '.'));
        } else if (col.length > 2 && isNaN(Number(col))) {
          descText = descText ? `${descText} - ${col}` : col;
        }
      }

      if (!isNaN(amountVal) && amountVal !== 0) {
        const cat = categorizeDescription(descText || 'Item Extrato CSV');
        results.push({
          id: `csv-${Date.now()}-${i}`,
          description: descText || 'Transação CSV',
          amount: Math.abs(amountVal),
          type: amountVal > 0 && /receb|sal|pix|cred/i.test(descText) ? 'INCOME' : cat.type,
          category: cat.category,
          potType: cat.potType,
          source: 'OFX_CSV',
          date: dateStr,
        });
      }
    }
  }

  return results;
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Encontra Playbooks treinados pelo Admin que batem com a dúvida do usuário
 */
export function findMatchingPlaybooks(
  userMessage: string,
  rules: KnowledgeRuleItem[]
): KnowledgeRuleItem[] {
  const normMsg = normalizeStr(userMessage);
  const matched: { rule: KnowledgeRuleItem; score: number }[] = [];

  for (const rule of rules) {
    if (!rule.isActive) continue;
    const keywords = rule.topicKeywords
      .split(',')
      .map((k) => normalizeStr(k.trim()))
      .filter(Boolean);

    let score = 0;
    for (const kw of keywords) {
      if (normMsg.includes(kw)) {
        score += kw.includes(' ') ? 3 : 2;
      }
    }
    if (score > 0) {
      matched.push({ rule, score });
    }
  }

  return matched.sort((a, b) => b.score - a.score).map((m) => m.rule);
}

/**
 * Gera a resposta consultiva do Assistente Financeiro aplicando:
 * 1) Lançamento natural de gastos
 * 2) Playbooks treinados pelo Admin no banco PostgreSQL + Cálculos reais para o salário do usuário
 * 3) Simulador de compra e diagnóstico FIRE
 */
export async function generateAdvisorResponse(
  userMessage: string,
  profile: FinancialProfile,
  transactions: TransactionItem[],
  knowledgeRules: KnowledgeRuleItem[] = []
): Promise<{ reply: string; addedTransaction?: ParsedQuickTransaction; matchedRuleTitle?: string }> {
  // 1. Verifica se o usuário está lançando um gasto/receita/aporte por conversa natural
  const parsedTx = parseNaturalLanguageTransaction(userMessage);
  const diagnosis = calculateFinancialDiagnosis(profile, transactions);

  if (parsedTx) {
    const pot = diagnosis.smartPots.find((p) => p.type === parsedTx.potType);
    const newSpent = (pot ? pot.spentAmount : 0) + parsedTx.amount;
    const target = pot ? pot.targetAmount : 0;
    const pctUsed = target > 0 ? Math.round((newSpent / target) * 100) : 0;

    if (parsedTx.type === 'INVESTMENT') {
      return {
        addedTransaction: parsedTx,
        reply: `🎉 **Excelente atitude! Aporte registrado com sucesso:**\n\n- **Descrição:** ${parsedTx.description}\n- **Valor Investido:** R$ ${parsedTx.amount.toFixed(2)}\n- **Pote:** Liberdade Financeira (Pague-se Primeiro)\n\nCom esse aporte, você está mais perto da sua meta de **R$ ${diagnosis.fireNumber.toLocaleString('pt-BR')}**! Continue assim que o juros composto trabalha a seu favor.`,
      };
    }

    if (parsedTx.type === 'INCOME') {
      return {
        addedTransaction: parsedTx,
        reply: `💰 **Entrada registrada no caixa!**\n\n- **Origem:** ${parsedTx.description}\n- **Valor:** R$ ${parsedTx.amount.toFixed(2)}\n\n💡 **Regra de Ouro do Consultor:** Antes de pagar qualquer conta ou gastar, separe pelo menos **${diagnosis.smartPots[0].percentage}% (R$ ${((parsedTx.amount * diagnosis.smartPots[0].percentage) / 100).toFixed(2)})** para o seu pote da **Liberdade Financeira**!`,
      };
    }

    return {
      addedTransaction: parsedTx,
      reply: `✅ **Lançamento registrado automaticamente!**\n\n- **Item:** ${parsedTx.description}\n- **Valor:** R$ ${parsedTx.amount.toFixed(2)}\n- **Pote Alocado:** ${pot?.name || parsedTx.category}\n- **Status do Pote no Mês:** R$ ${newSpent.toFixed(2)} de R$ ${target.toFixed(2)} (**${pctUsed}% utilizado**)\n\n${
        pctUsed > 90
          ? '⚠️ **Atenção do Consultor:** Este pote já passou de 90% do limite mensal para o seu salário atual. Segure novos gastos nessa categoria esta semana para proteger o seu aporte de independência financeira!'
          : '👏 Você ainda tem folga saudável neste pote para o restante do mês.'
      }`,
    };
  }

  // 2. Verifica se a pergunta aciona algum Playbook treinado pelo Admin (ex: Carro, Casa, Viagem, Dívidas, Investir, ou qualquer regra nova que você ensinar!)
  const matchedRules = findMatchingPlaybooks(userMessage, knowledgeRules);
  const numberInQuestion = userMessage.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{4,}(?:,\d{1,2})?)/i);
  const extractedGoalValue = numberInQuestion
    ? parseFloat(numberInQuestion[1].replace(/\./g, '').replace(',', '.'))
    : null;

  if (matchedRules.length > 0) {
    const topRule = matchedRules[0];
    const shortGoalPot = diagnosis.smartPots.find((p) => p.type === 'SHORT_GOAL');
    const lifestylePot = diagnosis.smartPots.find((p) => p.type === 'LIFESTYLE');
    const monthlyGoalBudget =
      (shortGoalPot?.targetAmount || Math.round(profile.monthlyIncome * 0.1)) +
      Math.round((lifestylePot?.targetAmount || profile.monthlyIncome * 0.1) * 0.35);

    // Cálculo personalizado caso seja Playbook de Carro/Moto
    if (topRule.formulaHint === 'veiculo_2pct_manutencao') {
      const carValue = extractedGoalValue || Math.round(profile.monthlyIncome * 8);
      const hiddenMonthlyCost = Math.round(carValue * 0.018); // ~1.8% ao mês de IPVA, seguro, combustível e revisão
      const idealDownPayment = Math.round(carValue * 0.5); // 50% de entrada estratégica
      const monthsForDownPayment = Math.max(1, Math.ceil(idealDownPayment / Math.max(100, monthlyGoalBudget)));
      const monthsForFullCash = Math.max(1, Math.ceil((carValue * 0.88) / Math.max(100, monthlyGoalBudget))); // 12% desconto à vista
      const maxSafeInstallment = Math.round(profile.monthlyIncome * 0.15);

      return {
        matchedRuleTitle: topRule.title,
        reply: `🚗 **Plano Estratégico Sisfin: ${topRule.title}**\n*(Personalizado para seu salário de R$ ${profile.monthlyIncome.toLocaleString('pt-BR')}/mês)*\n\n📚 **Diretriz da Metodologia Sisfin:**\n${topRule.methodologyRule}\n\n---\n### 🔢 Simulação Matemática para um Veículo de **R$ ${carValue.toLocaleString('pt-BR')}**:\n\n1. **Alerta do Custo Invisível Mensal:**\n   Um veículo de R$ ${carValue.toLocaleString('pt-BR')} gera cerca de **R$ ${hiddenMonthlyCost.toLocaleString('pt-BR')}/mês** extras (combustível, seguro, IPVA rateado e manutenção). Hoje seu Custo Essencial é R$ ${profile.essentialFixedCosts.toLocaleString('pt-BR')} — com o veículo passará para **R$ ${(profile.essentialFixedCosts + hiddenMonthlyCost).toLocaleString('pt-BR')}/mês**.\n\n2. **Caminho A — Compra Inteligente à Vista (Com ~12% de Desconto):**\n   - Separando **R$ ${monthlyGoalBudget.toLocaleString('pt-BR')}/mês** (seu Pote de Metas + 35% do Lazer) rendendo 100% do CDI, você acumula o valor em cerca de **${monthsForFullCash} meses** sem pagar 1 centavo de juros ao banco.\n\n3. **Caminho B — Entrada Forte de 50% (R$ ${idealDownPayment.toLocaleString('pt-BR')}) + Parcela Segura:**\n   - Junte os R$ ${idealDownPayment.toLocaleString('pt-BR')} em **${monthsForDownPayment} meses**.\n   - A parcela restante jamais deve passar de 15% da sua renda (**máximo de R$ ${maxSafeInstallment.toLocaleString('pt-BR')}/mês**), mantendo seu aporte sagrado de **R$ ${diagnosis.payYourselfFirstAmount}/mês** da Independência Financeira intocado!`,
      };
    }

    // Cálculo personalizado caso seja Playbook de Imóvel / Casa / Apartamento
    if (topRule.formulaHint === 'imovel_25pct_entrada') {
      const propertyValue = extractedGoalValue || Math.round(profile.monthlyIncome * 45);
      const downPayment25 = Math.round(propertyValue * 0.25); // 20% entrada + 5% ITBI/cartório
      const maxSafeMortgage = Math.round(profile.monthlyIncome * 0.28);
      const monthsToSaveEntry = Math.max(1, Math.ceil(downPayment25 / Math.max(150, monthlyGoalBudget)));

      return {
        matchedRuleTitle: topRule.title,
        reply: `🏠 **Plano Estratégico Sisfin: ${topRule.title}**\n*(Personalizado para seu salário de R$ ${profile.monthlyIncome.toLocaleString('pt-BR')}/mês)*\n\n📚 **Diretriz da Metodologia Sisfin:**\n${topRule.methodologyRule}\n\n---\n### 🔢 Simulação para Imóvel de **R$ ${propertyValue.toLocaleString('pt-BR')}**:\n- **Meta da Entrada + Documentação (25%):** R$ ${downPayment25.toLocaleString('pt-BR')}\n- **Quanto guardar por mês:** R$ ${monthlyGoalBudget.toLocaleString('pt-BR')}/mês (Prazo estimado para a entrada: **${monthsToSaveEntry} meses** acelerado pelos juros do CDI).\n- **Teto Seguro de Parcela para seu Salário:** Máximo de **R$ ${maxSafeMortgage.toLocaleString('pt-BR')}/mês** (28% da renda líquida).`,
      };
    }

    // Qualquer outro Playbook (Viagem, Casamento, Dívidas, Investimentos ou Novas Regras criadas por você no Admin!)
    const targetAmount = extractedGoalValue || Math.round(profile.monthlyIncome * 3);
    const monthsRequired = Math.max(1, Math.ceil(targetAmount / Math.max(100, monthlyGoalBudget)));

    return {
      matchedRuleTitle: topRule.title,
      reply: `🎯 **Consultoria Treinada Sisfin: ${topRule.title}**\n*(Calculado para sua renda de R$ ${profile.monthlyIncome.toLocaleString('pt-BR')}/mês)*\n\n📚 **Nossa Metodologia:**\n${topRule.methodologyRule}\n\n---\n### 🛠️ Passo a Passo Prático nos seus Potes:\n- **Capacidade Mensal para Metas Hoje:** **R$ ${monthlyGoalBudget.toLocaleString('pt-BR')}/mês** (sem prejudicar seu Pote da Liberdade Financeira de R$ ${diagnosis.payYourselfFirstAmount}/mês).\n- **Simulação de Meta (R$ ${targetAmount.toLocaleString('pt-BR')}):** Guardando esse valor todo dia ${profile.payday} em um CDB 100% CDI / Tesouro Selic, você conquista essa meta à vista em **${monthsRequired} meses**!`,
    };
  }

  // 3. Perguntas de decisão rápida de compra ("Posso comprar...?", "Vale a pena parcelar...?")
  const buyMatch = userMessage.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  if (/(posso comprar|vale a pena|parcelar|comprar um|cabe no orcamento)/i.test(userMessage) && buyMatch) {
    const itemPrice = parseFloat(buyMatch[1].replace(/\./g, '').replace(',', '.'));
    const lifestylePot = diagnosis.smartPots.find((p) => p.type === 'LIFESTYLE');
    const availableLifestyle = lifestylePot ? Math.max(0, lifestylePot.targetAmount - lifestylePot.spentAmount) : 0;

    return {
      reply: `🧐 **Análise Sincera do seu Consultor Financeiro:**\n\nVocê perguntou sobre uma compra de **R$ ${itemPrice.toLocaleString('pt-BR')}** ganhando atualmente **R$ ${profile.monthlyIncome.toLocaleString('pt-BR')}/mês**.\n\n1. **Impacto no Pote de Qualidade de Vida:** Hoje você tem **R$ ${availableLifestyle.toFixed(2)}** livres neste mês sem tocar no seu pote sagrado de Independência Financeira.\n2. **Custo em Meses de Liberdade:** R$ ${itemPrice.toLocaleString('pt-BR')} equivalem a **${(itemPrice / diagnosis.recommendedMonthlyInvestment).toFixed(1)} meses** de aportes do seu plano de liberdade.\n3. **Veredito Prático:** ${
        itemPrice <= availableLifestyle
          ? '✅ **Cabe no orçamento à vista!** Se tiver desconto no PIX, aproveite sem culpa.'
          : `⏳ **Recomendação Estratégica:** Não comprometa seu limite agora. Crie uma meta de **${Math.ceil(itemPrice / Math.max(50, availableLifestyle * 0.6))} meses** no pote de *Metas de Curto Prazo* guardando R$ ${Math.round(itemPrice / 4)}/mês. Assim você compra à vista com desconto e não atrasa sua Independência Financeira!`
      }`,
    };
  }

  // 4. Resposta de diagnóstico completo personalizado aos números reais da cobaia/usuário
  return {
    reply: `📊 **Diagnóstico Personalizado para seu Salário de R$ ${profile.monthlyIncome.toLocaleString('pt-BR')}:**\n\nVocê está no **${diagnosis.maturityTitle}**.\n\n- **Regra #1 (Dia ${profile.payday} — Dia do Pagamento):** Transfira imediatamente **R$ ${diagnosis.payYourselfFirstAmount.toLocaleString('pt-BR')}** para sua Reserva/Liberdade antes de pagar boletos.\n- **Reserva da Paz (6 meses):** Meta de R$ ${diagnosis.emergencyFundTarget.toLocaleString('pt-BR')} (**${diagnosis.emergencyFundProgress.toFixed(1)}% concluída**).\n- **Número da Independência (FIRE):** R$ ${diagnosis.fireNumber.toLocaleString('pt-BR')} (gera R$ ${profile.targetMonthlyIncome.toLocaleString('pt-BR')}/mês livres de inflação para sempre).\n- **Tempo Estimado no Ritmo Atual:** **${diagnosis.yearsToIndependence} anos** (e se você redirecionar +10% do salário, antecipa em **${diagnosis.yearsSavedWithExtra10Percent} anos**!).\n\n💬 *Dica rápida: Você pode me perguntar coisas como "Preciso me organizar para comprar um carro de 45.000, como faço?" ou registrar gastos dizendo "Gastei 65 no mercado"!*`,
  };
}
