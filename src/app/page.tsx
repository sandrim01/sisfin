'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Wallet,
  Bot,
  Send,
  Upload,
  PlusCircle,
  Settings,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  PiggyBank,
  Sliders,
  Lock,
  Crown,
  Smartphone,
  FileSpreadsheet,
  RefreshCw,
  DollarSign,
  Calendar,
  Database,
  Trash2,
  Save,
} from 'lucide-react';
import {
  FinancialProfile,
  TransactionItem,
  calculateFinancialDiagnosis,
  calculateMonthsToTarget,
} from '@/lib/financial-engine';
import { parseBankStatementFile, categorizeDescription } from '@/lib/ai-advisor';

const INITIAL_PROFILE: FinancialProfile = {
  name: 'Sandrim (Admin & Cobaia #01)',
  email: 'admin@sisfin.com.br',
  role: 'ADMIN',
  subscriptionStatus: 'ACTIVE',
  monthlyIncome: 4200,
  payday: 5,
  essentialFixedCosts: 2350,
  currentInvested: 3800,
  totalDebt: 0,
  monthlyDebtPayment: 0,
  targetMonthlyIncome: 4200,
  annualRealYield: 0.06,
};

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function SisfinApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'advisor' | 'transactions' | 'calibration' | 'saas_admin'>(
    'dashboard'
  );
  const [profile, setProfile] = useState<FinancialProfile>(INITIAL_PROFILE);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [extraSavingsSim, setExtraSavingsSim] = useState<number>(200);
  const [dbSynced, setDbSynced] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Estado do Consultor IA
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Estado para Lançamento Manual Rápido
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega dados reais do PostgreSQL na Railway ao iniciar
  useEffect(() => {
    async function loadFromPostgres() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) setProfile(data.profile);
          if (data.transactions) setTransactions(data.transactions);
          if (data.messages && data.messages.length > 0) setChatMessages(data.messages);
          setDbSynced(true);
        }
      } catch (err) {
        console.error('Erro ao sincronizar com PostgreSQL:', err);
      }
    }
    loadFromPostgres();
  }, []);

  // Salva alterações do Perfil/Salário no PostgreSQL
  async function handleSaveProfileToDb(customProfile?: FinancialProfile) {
    const target = customProfile || profile;
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: target }),
      });
      if (res.ok) {
        setSaveBanner('✅ Dados salvos com sucesso no PostgreSQL da Railway!');
        setTimeout(() => setSaveBanner(null), 4000);
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Diagnóstico calculado em tempo real
  const diagnosis = useMemo(
    () => calculateFinancialDiagnosis(profile, transactions),
    [profile, transactions]
  );

  // Simulador "E se eu guardar +R$ X por mês?"
  const simulatedYearsWithExtra = useMemo(() => {
    const months = calculateMonthsToTarget(
      profile.currentInvested,
      diagnosis.recommendedMonthlyInvestment + extraSavingsSim,
      diagnosis.fireNumber,
      profile.annualRealYield
    );
    return Number((months / 12).toFixed(1));
  }, [profile, diagnosis, extraSavingsSim]);

  // Enviar mensagem no Chat do Consultor (Persiste no PostgreSQL via /api/advisor)
  async function handleSendAdvisorMessage(e?: React.FormEvent, customText?: string) {
    if (e) e.preventDefault();
    const textToSend = (customText ?? chatInput).trim();
    if (!textToSend || isSendingChat) return;

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          profile,
          transactions,
        }),
      });
      const data = await res.json();

      if (data.addedTransaction) {
        const added = data.addedTransaction;
        const newTx: TransactionItem = {
          id: `ai-${Date.now()}`,
          description: added.description,
          amount: added.amount,
          type: added.type,
          category: added.category,
          potType: added.potType,
          source: 'AI_CHAT',
          date: new Date().toISOString().slice(0, 10),
        };
        setTransactions((prev) => [newTx, ...prev]);

        if (added.type === 'INVESTMENT') {
          setProfile((prev) => ({
            ...prev,
            currentInvested: prev.currentInvested + added.amount,
          }));
        }
      }

      const botMsg: ChatMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Não consegui processar sua solicitação agora.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Ocorreu um erro de conexão com o Consultor.',
          timestamp: 'Agora',
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  }

  // Adicionar transação manual e gravar no PostgreSQL
  async function handleManualAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(newTxAmount.replace(',', '.'));
    if (!newTxDesc.trim() || isNaN(val) || val <= 0) return;

    const cat = categorizeDescription(newTxDesc);
    const item: TransactionItem = {
      id: `manual-${Date.now()}`,
      description: newTxDesc.trim(),
      amount: val,
      type: cat.type,
      category: cat.category,
      potType: cat.potType,
      source: 'MANUAL',
      date: new Date().toISOString().slice(0, 10),
    };

    setTransactions((prev) => [item, ...prev]);
    if (cat.type === 'INVESTMENT') {
      setProfile((prev) => ({ ...prev, currentInvested: prev.currentInvested + val }));
    }
    setNewTxDesc('');
    setNewTxAmount('');

    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: item }),
    });
  }

  // Excluir transação do PostgreSQL
  async function handleDeleteTransaction(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/state?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // Importar arquivo OFX / CSV e persistir lote no PostgreSQL
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const imported = parseBankStatementFile(content, file.name);
    if (imported.length > 0) {
      setTransactions((prev) => [...imported, ...prev]);
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: imported }),
      });
      setImportFeedback(`✅ ${imported.length} lançamentos importados e salvos no PostgreSQL da Railway!`);
    } else {
      setImportFeedback('⚠️ Nenhum lançamento válido encontrado neste arquivo. Use OFX ou CSV padrão.');
    }
    setTimeout(() => setImportFeedback(null), 6000);
  }

  const totalExpensesMonth = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalInvestedMonth = transactions
    .filter((t) => t.type === 'INVESTMENT')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar SaaS */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">SISFIN</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Consultor IA • SaaS
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {dbSynced ? 'PostgreSQL Railway Online' : 'Sincronizando...'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Independência Financeira para Qualquer Salário
              </p>
            </div>
          </div>

          {/* Navegação Principal */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Painel & Potes</span>
            </button>
            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'advisor'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Consultor IA</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Extrato & OFX</span>
            </button>
            <button
              onClick={() => setActiveTab('calibration')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'calibration'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Meu Salário</span>
            </button>
            <button
              onClick={() => setActiveTab('saas_admin')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'saas_admin'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Admin & SaaS</span>
            </button>
          </nav>

          {/* Badge Usuário Cobaia/Admin */}
          <div className="hidden lg:flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-200">{profile.name}</p>
              <p className="text-[10px] text-emerald-400">
                Salário Base: R$ {profile.monthlyIncome.toLocaleString('pt-BR')} • Dia {profile.payday}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner de Maturidade Financeira */}
        <section className="rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Diagnóstico em Tempo Real • Metodologia 5 Níveis</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {diagnosis.maturityTitle}
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                {diagnosis.maturitySubtitle}
              </p>
              <p className="text-xs text-emerald-400 font-medium pt-1">
                🎯 Próximo Marco: {diagnosis.nextMilestone}
              </p>
            </div>

            {/* Card Pague-se Primeiro */}
            <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-4 min-w-[270px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Regra do Dia {profile.payday} (Salário)
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  PAGUE-SE 1º
                </span>
              </div>
              <div className="my-2">
                <p className="text-2xl font-extrabold text-white">
                  R$ {diagnosis.payYourselfFirstAmount.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-400">
                  Separe esse valor assim que o salário cair
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab('advisor');
                  handleSendAdvisorMessage(
                    undefined,
                    `Investi ${diagnosis.payYourselfFirstAmount} no Tesouro Selic hoje`
                  );
                }}
                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Já separei meu aporte deste mês!</span>
              </button>
            </div>
          </div>
        </section>

        {/* ABA 1: DASHBOARD & POTES INTELIGENTES */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPIs Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Salário Líquido Atual</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                  R$ {profile.monthlyIncome.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Gasto no mês: R$ {totalExpensesMonth.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Reserva da Paz (6 Meses)</span>
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {diagnosis.emergencyFundProgress.toFixed(0)}%
                </p>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${diagnosis.emergencyFundProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  R$ {profile.currentInvested.toLocaleString('pt-BR')} de R${' '}
                  {diagnosis.emergencyFundTarget.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Meta Independência (FIRE)</span>
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                  R$ {diagnosis.fireNumber.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-amber-400 mt-1">
                  Gera R$ {profile.targetMonthlyIncome.toLocaleString('pt-BR')}/mês de renda passiva
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Tempo p/ Liberdade Financeira</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  {diagnosis.yearsToIndependence} anos
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Investindo R$ {diagnosis.recommendedMonthlyInvestment}/mês
                </p>
              </div>
            </div>

            {/* Grid: Potes Inteligentes + Simulador de Antecipação FIRE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Potes Inteligentes Adaptados ao Salário */}
              <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Potes Inteligentes do Seu Salário
                    </h2>
                    <p className="text-xs text-slate-400">
                      Divisão automática calculada pela IA para você viver bem hoje e construir liberdade amanhã
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('calibration')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" /> Ajustar Renda
                  </button>
                </div>

                <div className="space-y-4">
                  {diagnosis.smartPots.map((pot) => {
                    const usagePct =
                      pot.targetAmount > 0
                        ? Math.min(100, Math.round((pot.spentAmount / pot.targetAmount) * 100))
                        : 0;
                    const isOver = pot.spentAmount > pot.targetAmount && pot.type !== 'FREEDOM_INVEST';

                    return (
                      <div
                        key={pot.id}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: pot.color }}
                            />
                            <span className="font-semibold text-sm text-white">{pot.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {pot.percentage}% do salário
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-white">
                              R$ {pot.spentAmount.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-xs text-slate-400">
                              {' '}
                              / R$ {pot.targetAmount.toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${usagePct}%`,
                              backgroundColor: isOver ? '#ef4444' : pot.color,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{pot.description}</span>
                          {isOver ? (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Acima do limite!
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Restam R$ {Math.max(0, pot.targetAmount - pot.spentAmount).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Simulador Interativo " Máquina do Tempo Financeira " */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulador Máquina do Tempo</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Quanto tempo de vida você compra poupando um pouco a mais?
                  </h3>
                  <p className="text-xs text-slate-400">
                    Deslize para ver quantos anos antes você conquista sua Independência Financeira:
                  </p>
                </div>

                <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Esforço Extra Mensal:</span>
                    <span className="text-lg font-bold text-emerald-400">
                      + R$ {extraSavingsSim.toLocaleString('pt-BR')}/mês
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={Math.max(1000, Math.round(profile.monthlyIncome * 0.4))}
                    step={25}
                    value={extraSavingsSim}
                    onChange={(e) => setExtraSavingsSim(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">No ritmo atual (R$ {diagnosis.recommendedMonthlyInvestment}/mês):</span>
                      <span className="text-slate-200 font-semibold">{diagnosis.yearsToIndependence} anos</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        Novo ritmo (R$ {diagnosis.recommendedMonthlyInvestment + extraSavingsSim}/mês):
                      </span>
                      <span className="text-emerald-400 font-bold">{simulatedYearsWithExtra} anos</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <p className="text-xs text-emerald-300 font-semibold">
                        🚀 Você antecipa sua aposentadoria em{' '}
                        <span className="text-sm font-extrabold text-white">
                          {Math.max(0.1, Number((diagnosis.yearsToIndependence - simulatedYearsWithExtra).toFixed(1)))}{' '}
                          anos!
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Atalho para pedir plano de corte ao Consultor IA */}
                <button
                  onClick={() => {
                    setActiveTab('advisor');
                    handleSendAdvisorMessage(
                      undefined,
                      `Como posso economizar R$ ${extraSavingsSim} extras por mês com meu salário de R$ ${profile.monthlyIncome} para antecipar minha independência financeira?`
                    );
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Bot className="w-4 h-4" />
                  <span>Pedir plano à IA para achar esses +R$ {extraSavingsSim}/mês</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CONSULTOR VIRTUAL IA 24/7 */}
        {activeTab === 'advisor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col h-[560px]">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Consultor Financeiro IA Sisfin</h2>
                    <p className="text-[11px] text-emerald-400">
                      Sincronizado com PostgreSQL na Railway • Registra gastos por conversa
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-emerald-500 text-slate-950 font-medium'
                          : 'bg-slate-950 border border-slate-800 text-slate-200'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <span
                        className={`block text-[10px] mt-1.5 ${
                          msg.role === 'user' ? 'text-slate-900/70' : 'text-slate-500'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                {isSendingChat && (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    Consultor analisando e gravando no banco...
                  </div>
                )}
              </div>

              {/* Input de Conversa */}
              <form
                onSubmit={(e) => handleSendAdvisorMessage(e)}
                className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder='Ex: "Gastei 78,90 no mercado" ou "Posso comprar uma TV de R$ 1800?"'
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isSendingChat}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>

            {/* Painel Lateral de Perguntas Rápidas do Consultor */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Comandos Rápidos (Teste como Cobaia)
              </h3>
              <p className="text-xs text-slate-400">
                Clique em qualquer exemplo abaixo para testar e salvar no banco da Railway:
              </p>
              <div className="space-y-2.5">
                {[
                  'Gastei 84,50 no supermercado hoje no pix',
                  'Investi 250 no Tesouro Selic para minha reserva',
                  'Posso comprar um celular de R$ 2.100 esse mês?',
                  'Me dê meu diagnóstico completo de Independência Financeira',
                  'Paguei 110 de conta de luz',
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendAdvisorMessage(undefined, sample)}
                    className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition flex items-center justify-between group cursor-pointer"
                  >
                    <span>&ldquo;{sample}&rdquo;</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: EXTRATO, LANÇAMENTO MANUAL E IMPORTADOR OFX/CSV */}
        {activeTab === 'transactions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna de Adição + Importação OFX/CSV */}
            <div className="space-y-6">
              <form
                onSubmit={handleManualAddTransaction}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4"
              >
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Novo Lançamento Rápido
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Descrição</label>
                    <input
                      type="text"
                      value={newTxDesc}
                      onChange={(e) => setNewTxDesc(e.target.value)}
                      placeholder="Ex: Mercado, Uber, Aporte Selic..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valor (R$)</label>
                    <input
                      type="text"
                      value={newTxAmount}
                      onChange={(e) => setNewTxAmount(e.target.value)}
                      placeholder="Ex: 89,90"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
                  >
                    Classificar com IA & Salvar no Banco
                  </button>
                </div>
              </form>

              {/* Importador de Extratos Bancários OFX e CSV */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  Importar Extrato (OFX / CSV)
                </h3>
                <p className="text-xs text-slate-400">
                  Envie o extrato do Nubank, Itaú, Inter, BB ou C6. A IA classifica e salva no PostgreSQL.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 text-xs text-slate-300 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Selecionar Arquivo .OFX ou .CSV</span>
                </button>
                {importFeedback && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                    {importFeedback}
                  </p>
                )}
              </div>
            </div>

            {/* Lista de Transações */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">
                  Histórico no Banco ({transactions.length} lançamentos)
                </h3>
                <span className="text-xs text-emerald-400">
                  Total Investido no Mês: R$ {totalInvestedMonth.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          tx.type === 'INCOME'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : tx.type === 'INVESTMENT'
                            ? 'bg-teal-500/15 text-teal-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {tx.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : tx.type === 'INVESTMENT' ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{tx.description}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{tx.category}</span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            Via {tx.source}
                          </span>
                          <span>•</span>
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-400'
                            : tx.type === 'INVESTMENT'
                            ? 'text-teal-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {tx.type === 'EXPENSE' ? '-' : '+'} R${' '}
                        {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        title="Excluir lançamento"
                        className="text-slate-600 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: CALIBRAGEM DE SALÁRIO & METAS (QUALQUER RENDA) */}
        {activeTab === 'calibration' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Calibrar Realidade Financeira (Qualquer Salário)
                </h2>
                <p className="text-xs text-slate-400">
                  Altere seu salário, custo fixo ou dívidas abaixo e salve direto no PostgreSQL da Railway.
                </p>
              </div>
              <button
                type="button"
                disabled={isSavingProfile}
                onClick={() => handleSaveProfileToDb()}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingProfile ? 'Salvando...' : 'Salvar no Banco Railway'}</span>
              </button>
            </div>

            {saveBanner && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
                {saveBanner}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Salário / Renda Líquida Mensal (R$)
                </label>
                <input
                  type="number"
                  value={profile.monthlyIncome}
                  onChange={(e) =>
                    setProfile({ ...profile, monthlyIncome: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Dia do Recebimento do Salário
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={profile.payday}
                  onChange={(e) =>
                    setProfile({ ...profile, payday: Math.min(31, Math.max(1, Number(e.target.value))) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Custos Fixos Essenciais Mensais (R$)
                </label>
                <input
                  type="number"
                  value={profile.essentialFixedCosts}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      essentialFixedCosts: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Patrimônio / Reserva Já Guardada (R$)
                </label>
                <input
                  type="number"
                  value={profile.currentInvested}
                  onChange={(e) =>
                    setProfile({ ...profile, currentInvested: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Total de Dívidas Atuais (R$ - 0 se não tiver)
                </label>
                <input
                  type="number"
                  value={profile.totalDebt}
                  onChange={(e) =>
                    setProfile({ ...profile, totalDebt: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Renda Passiva Mensal Desejada na Liberdade (R$)
                </label>
                <input
                  type="number"
                  value={profile.targetMonthlyIncome}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      targetMonthlyIncome: Math.max(500, Number(e.target.value)),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-300">
                  Teste perfis diferentes como Cobaia:
                </p>
                <p className="text-xs text-slate-400">
                  Simule um assinante ganhando 1 salário mínimo ou alguém endividado para ver a IA recalibrar tudo.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = {
                      ...profile,
                      monthlyIncome: 1518,
                      essentialFixedCosts: 1100,
                      currentInvested: 150,
                      totalDebt: 0,
                      monthlyDebtPayment: 0,
                      targetMonthlyIncome: 1518,
                    };
                    setProfile(next);
                    handleSaveProfileToDb(next);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white cursor-pointer"
                >
                  Simular 1 Salário Mínimo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = {
                      ...profile,
                      monthlyIncome: 3500,
                      essentialFixedCosts: 2000,
                      currentInvested: 200,
                      totalDebt: 4800,
                      monthlyDebtPayment: 450,
                      targetMonthlyIncome: 3500,
                    };
                    setProfile(next);
                    handleSaveProfileToDb(next);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-300 border border-amber-500/30 cursor-pointer"
                >
                  Simular Com Dívidas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: PAINEL ADMIN & MOTOR SAAS (VENDA DE ASSINATURAS + WHATSAPP + RAILWAY) */}
        {activeTab === 'saas_admin' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status Railway & GitHub */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    Infraestrutura SaaS & Deploy
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    PostgreSQL Conectado
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <p>
                    <strong className="text-slate-400">Repositório GitHub:</strong>{' '}
                    <span className="text-emerald-400">github.com/sandrim01/sisfin</span>
                  </p>
                  <p>
                    <strong className="text-slate-400">Domínio Railway:</strong>{' '}
                    <span className="text-emerald-400">financas-financas.up.railway.app</span>
                  </p>
                  <p>
                    <strong className="text-slate-400">Host Banco Railway:</strong>{' '}
                    <code className="text-blue-400">caboose.proxy.rlwy.net:40032</code>
                  </p>
                </div>
              </div>

              {/* Webhook WhatsApp */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Integração WhatsApp Ativa
                </h3>
                <p className="text-xs text-slate-400">
                  Endpoint pronto para receber mensagens dos assinantes via Evolution API / Z-API / Cloud API:
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 break-all">
                  POST https://financas-financas.up.railway.app/api/whatsapp
                </div>
              </div>

              {/* Controle de Mensalidade (Paywall SaaS) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  Planos de Assinatura (Acesso Pós-Pagamento)
                </h3>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plano Sisfin Pro (Mensal):</span>
                    <span className="font-bold text-white">R$ 29,90 / mês</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plano Anual Liberdade:</span>
                    <span className="font-bold text-emerald-400">12x R$ 19,90</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Seu Status Atual:</span>
                    <span className="text-amber-400 font-semibold">ADMIN / COBAIA VITALÍCIO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
