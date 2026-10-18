import { NextRequest, NextResponse } from 'next/server';
import { parseNaturalLanguageTransaction } from '@/lib/ai-advisor';

/**
 * Webhook de integração com WhatsApp (Evolution API / Z-API / Twilio / Cloud API)
 * Permite que o usuário mande "Gastei 45 na padaria" direto pelo WhatsApp e receba o saldo do pote!
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string =
      body.message ||
      body.text?.message ||
      body.data?.message?.conversation ||
      body.Body ||
      '';
    const senderPhone: string =
      body.phone || body.from || body.data?.key?.remoteJid || '5511999999999';

    if (!text) {
      return NextResponse.json(
        { status: 'ignored', reason: 'Nenhuma mensagem de texto encontrada no payload.' },
        { status: 200 }
      );
    }

    const parsed = parseNaturalLanguageTransaction(text);

    if (!parsed) {
      return NextResponse.json({
        status: 'reply',
        phone: senderPhone,
        replyMessage:
          '🤖 *Sisfin Consultor:* Para lançar um gasto rápido pelo WhatsApp, envie algo como: *"Gastei 48,90 no mercado"* ou *"Investi 200 no Tesouro Selic"*.',
      });
    }

    return NextResponse.json({
      status: 'registered',
      phone: senderPhone,
      transaction: parsed,
      replyMessage: `✅ *Sisfin Registrou:*\n• *Item:* ${parsed.description}\n• *Valor:* R$ ${parsed.amount.toFixed(2)}\n• *Categoria:* ${parsed.category}\n\nContinue firme rumo à sua Independência Financeira! 🚀`,
    });
  } catch (error) {
    console.error('Erro no Webhook WhatsApp:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Sisfin WhatsApp Webhook',
    status: 'online',
    domain: 'financas-financas.up.railway.app',
    examplePayload: {
      phone: '5511999999999',
      message: 'Gastei 65,90 no mercado no pix',
    },
  });
}
