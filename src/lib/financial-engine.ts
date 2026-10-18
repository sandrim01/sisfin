export interface FinancialProfile {
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  monthlyIncome: number;
  payday: number;
  essentialFixedCosts: number;
  currentInvested: number;
  totalDebt: number;
  monthlyDebtPayment: number;
  targetMonthlyIncome: number;
  annualRealYield: number; // ex: 0.06 (6% a.a. acima da inflação)
}

export interface SmartPot {
  id: string;
  name: string;
  type: 'ESSENTIAL' | 'DEBT_RESCUE' | 'FREEDOM_INVEST' | 'LIFESTYLE' | 'SHORT_GOAL';
  percentage: number;
  targetAmount: number;
  spentAmount: number;
  color: string;
  description: string;
}

export interface TransactionItem {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'INVESTMENT';
  category: string;
  potType: SmartPot['type'];
  source: 'MANUAL' | 'AI_CHAT' | 'OFX_CSV' | 'WHATSAPP';
  date: string;
}

export interface IndependenceDiagnosis {
  maturityLevel: 1 | 2 | 3 | 4 | 5;
  maturityTitle: string;
  maturitySubtitle: string;
  nextMilestone: string;
  emergencyFundTarget: number; // 6 meses do custo essencial
  emergencyFundProgress: number; // % concluído
  fireNumber: number; // Patrimônio necessário para viver de renda
  fireProgress: number; // % do número FIRE já atingido
  recommendedMonthlyInvestment: number;
  yearsToIndependence: number;
  monthsToIndependence: number;
  yearsSavedWithExtra10Percent: number;
  payYourselfFirstAmount: number; // Valor para separar no dia do pagamento
  smartPots: SmartPot[];
}

/**
 * Calcula o diagnóstico completo de Independência Financeira adaptado a QUALQUER salário.
 * Usa a metodologia dos 5 Níveis de Maturidade Financeira.
 */
export function calculateFinancialDiagnosis(
  profile: FinancialProfile,
  transactions: TransactionItem[] = []
): IndependenceDiagnosis {
  const income = Math.max(profile.monthlyIncome, 100);
  const essential = Math.min(profile.essentialFixedCosts, income * 0.95);
  const debtRatio = profile.totalDebt > 0 ? profile.monthlyDebtPayment / income : 0;
  const emergencyTarget = Math.max(essential * 6, income * 3);
  const emergencyProgress = Math.min(100, (profile.currentInvested / emergencyTarget) * 100);

  // Cálculo do Número da Independência Financeira (Regra da Retirada Segura anual real, padrão 6% no Brasil com IPCA+)
  const safeAnnualYield = profile.annualRealYield > 0 ? profile.annualRealYield : 0.06;
  const desiredMonthlyPassive = profile.targetMonthlyIncome > 0 ? profile.targetMonthlyIncome : income;
  const fireNumber = (desiredMonthlyPassive * 12) / safeAnnualYield;
  const fireProgress = Math.min(100, (profile.currentInvested / fireNumber) * 100);

  // Determinação Dinâmica dos 5 Níveis de Maturidade
  let maturityLevel: 1 | 2 | 3 | 4 | 5 = 1;
  let maturityTitle = 'Nível 1: Clareza & Hábito Poupador';
  let maturitySubtitle = 'Construindo o hábito de se pagar primeiro no dia do salário, mesmo que com pouco.';
  let nextMilestone = 'Guardar seu primeiro mês de custo essencial e mapear 100% dos gastos.';

  if (profile.totalDebt > 0 && debtRatio > 0.1) {
    maturityLevel = 2;
    maturityTitle = 'Nível 2: Resgate & Estancamento de Dívidas';
    maturitySubtitle = 'Eliminando juros que drenam seu salário enquanto mantém uma mini-reserva de paz.';
    nextMilestone = `Quitar R$ ${profile.totalDebt.toLocaleString('pt-BR')} em dívidas usando o método Bola de Neve.`;
  } else if (profile.currentInvested < essential * 1) {
    maturityLevel = 1;
    maturityTitle = 'Nível 1: Clareza & Hábito Poupador';
    maturitySubtitle = 'O segredo não é quanto você ganha hoje, mas separar o "Pague-se Primeiro" assim que o salário cai.';
    nextMilestone = `Atingir seu 1º colchão de segurança de R$ ${essential.toLocaleString('pt-BR')}.`;
  } else if (profile.currentInvested < emergencyTarget) {
    maturityLevel = 3;
    maturityTitle = 'Nível 3: Construção da Reserva da Paz';
    maturitySubtitle = 'Você já saiu da zona de risco! Agora estamos blindando seus 6 meses de tranquilidade.';
    nextMilestone = `Completar a Reserva da Paz de R$ ${emergencyTarget.toLocaleString('pt-BR')} (${emergencyProgress.toFixed(0)}% concluído).`;
  } else if (fireProgress < 100) {
    maturityLevel = 4;
    maturityTitle = 'Nível 4: Aceleração Rumo à Liberdade (FIRE)';
    maturitySubtitle = 'Reserva blindada! Todo aporte agora compra tempo e antecipa sua aposentadoria.';
    nextMilestone = `Alcançar R$ ${fireNumber.toLocaleString('pt-BR')} de patrimônio gerador de renda.`;
  } else {
    maturityLevel = 5;
    maturityTitle = 'Nível 5: Independência Financeira Conquistada!';
    maturitySubtitle = 'Os rendimentos do seu patrimônio já pagam seu padrão de vida desejado.';
    nextMilestone = 'Multiplicação patrimonial e diversificação global.';
  }

  // Divisão Dinâmica dos Potes (Adaptada ao Salário Real do Usuário!)
  const essentialPct = Math.min(80, Math.round((essential / income) * 100));
  const remainingPct = Math.max(20, 100 - essentialPct);

  let debtPct = 0;
  let freedomPct = 0;
  let lifestylePct = 0;
  let shortGoalPct = 0;

  if (profile.totalDebt > 0) {
    debtPct = Math.min(remainingPct - 5, Math.max(10, Math.round((profile.monthlyDebtPayment / income) * 100)));
    // Mesmo com dívida, separa pelo menos 3% a 5% para criar o hábito sagrado de investir!
    freedomPct = Math.max(3, Math.round((remainingPct - debtPct) * 0.25));
    lifestylePct = Math.max(5, remainingPct - debtPct - freedomPct);
  } else {
    // Sem dívidas: calibra entre Liberdade Financeira, Qualidade de Vida e Metas Curtas
    freedomPct = Math.max(10, Math.round(remainingPct * 0.45));
    shortGoalPct = Math.max(5, Math.round(remainingPct * 0.20));
    lifestylePct = Math.max(5, remainingPct - freedomPct - shortGoalPct);
  }

  // Calcula gastos reais lançados no mês por categoria de pote
  const spentByPot: Record<SmartPot['type'], number> = {
    ESSENTIAL: 0,
    DEBT_RESCUE: 0,
    FREEDOM_INVEST: 0,
    LIFESTYLE: 0,
    SHORT_GOAL: 0,
  };

  for (const tx of transactions) {
    if (tx.type === 'EXPENSE' || tx.type === 'INVESTMENT') {
      spentByPot[tx.potType] = (spentByPot[tx.potType] || 0) + tx.amount;
    }
  }

  const smartPots: SmartPot[] = [
    {
      id: 'pot-freedom',
      name: 'Liberdade Financeira (Pague-se 1º)',
      type: 'FREEDOM_INVEST',
      percentage: freedomPct,
      targetAmount: Math.round((income * freedomPct) / 100),
      spentAmount: spentByPot.FREEDOM_INVEST,
      color: '#10b981', // Emerald
      description: 'Transfira no dia em que o salário cair! Constrói sua Reserva e Independência.',
    },
    {
      id: 'pot-essential',
      name: 'Custo de Vida Essencial',
      type: 'ESSENTIAL',
      percentage: essentialPct,
      targetAmount: Math.round((income * essentialPct) / 100),
      spentAmount: spentByPot.ESSENTIAL,
      color: '#3b82f6', // Blue
      description: 'Moradia, alimentação básica, saúde, transporte e contas fixas.',
    },
  ];

  if (debtPct > 0) {
    smartPots.push({
      id: 'pot-debt',
      name: 'Exterminador de Dívidas',
      type: 'DEBT_RESCUE',
      percentage: debtPct,
      targetAmount: Math.round((income * debtPct) / 100),
      spentAmount: spentByPot.DEBT_RESCUE,
      color: '#f59e0b', // Amber
      description: 'Parcelas renegociadas e amortização acelerada para liberar seu salário.',
    });
  }

  if (shortGoalPct > 0) {
    smartPots.push({
      id: 'pot-short',
      name: 'Metas & Sonhos de Curto Prazo',
      type: 'SHORT_GOAL',
      percentage: shortGoalPct,
      targetAmount: Math.round((income * shortGoalPct) / 100),
      spentAmount: spentByPot.SHORT_GOAL,
      color: '#8b5cf6', // Violet
      description: 'Viagens, trocas de equipamentos, cursos ou compras à vista com desconto.',
    });
  }

  smartPots.push({
    id: 'pot-lifestyle',
    name: 'Qualidade de Vida & Lazer Sem Culpa',
    type: 'LIFESTYLE',
    percentage: lifestylePct,
    targetAmount: Math.round((income * lifestylePct) / 100),
    spentAmount: spentByPot.LIFESTYLE,
    color: '#ec4899', // Pink
    description: 'Restaurantes, lazer, streaming e pequenos prazeres dentro do limite semanal.',
  });

  const recommendedMonthlyInvestment = Math.max(50, Math.round((income * freedomPct) / 100));

  // Projeção de Juros Compostos Reais até atingir o fireNumber
  const monthsToFire = calculateMonthsToTarget(
    profile.currentInvested,
    recommendedMonthlyInvestment,
    fireNumber,
    safeAnnualYield
  );

  // Simulação se poupar +10% do salário
  const extraInvestment = recommendedMonthlyInvestment + income * 0.1;
  const monthsWithExtra = calculateMonthsToTarget(
    profile.currentInvested,
    extraInvestment,
    fireNumber,
    safeAnnualYield
  );

  const yearsToIndependence = Number((monthsToFire / 12).toFixed(1));
  const yearsSavedWithExtra10Percent = Math.max(
    0.5,
    Number(((monthsToFire - monthsWithExtra) / 12).toFixed(1))
  );

  return {
    maturityLevel,
    maturityTitle,
    maturitySubtitle,
    nextMilestone,
    emergencyFundTarget: emergencyTarget,
    emergencyFundProgress: emergencyProgress,
    fireNumber: Math.round(fireNumber),
    fireProgress,
    recommendedMonthlyInvestment,
    yearsToIndependence,
    monthsToIndependence: monthsToFire,
    yearsSavedWithExtra10Percent,
    payYourselfFirstAmount: recommendedMonthlyInvestment,
    smartPots,
  };
}

export function calculateMonthsToTarget(
  currentPatrimony: number,
  monthlyContribution: number,
  targetPatrimony: number,
  annualRealYield: number
): number {
  if (currentPatrimony >= targetPatrimony) return 0;
  const monthlyRate = Math.pow(1 + annualRealYield, 1 / 12) - 1;
  let balance = currentPatrimony;
  let months = 0;
  const maxMonths = 12 * 60; // Teto de 60 anos

  while (balance < targetPatrimony && months < maxMonths) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    months++;
  }
  return months;
}
