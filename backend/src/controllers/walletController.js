// src/controllers/walletController.js
const { supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────────────────────
// GET /api/wallet
// Returns wallet balance, outstanding dues, transactions
// ──────────────────────────────────────────────────────────────
async function getWallet(request, reply) {
  const driverId = request.driver.id;

  const { data: wallet, error } = await supabaseAdmin
    .from('driver_wallets')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  if (error || !wallet) {
    // Auto-create wallet if missing
    const { data: newWallet } = await supabaseAdmin
      .from('driver_wallets')
      .insert({ driver_id: driverId, balance: 0, outstanding_dues: 0 })
      .select()
      .single();

    return reply.send({
      success: true,
      data: {
        balance: 0,
        outstandingDues: 0,
        transactions: [],
        walletId: newWallet?.id || null,
      },
    });
  }

  // Fetch recent transactions
  const { data: transactions } = await supabaseAdmin
    .from('driver_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(30);

  return reply.send({
    success: true,
    data: {
      balance: parseFloat(wallet.balance || 0),
      outstandingDues: parseFloat(wallet.outstanding_dues || 0),
      lastUpdated: wallet.last_updated,
      transactions: (transactions || []).map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        description: t.description,
        date: t.created_at,
      })),
    },
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/wallet/withdraw
// Body: { amount: 500, upiId?: "xyz@upi" }
// ──────────────────────────────────────────────────────────────
async function requestWithdrawal(request, reply) {
  const driverId = request.driver.id;
  const { amount, upiId } = request.body;

  if (!amount || parseFloat(amount) < 100) {
    return reply.code(400).send({ success: false, message: 'Minimum withdrawal amount is ₹100' });
  }

  const { data: wallet, error } = await supabaseAdmin
    .from('driver_wallets')
    .select('id, balance, outstanding_dues')
    .eq('driver_id', driverId)
    .single();

  if (error || !wallet) {
    return reply.code(404).send({ success: false, message: 'Wallet not found' });
  }

  const balance = parseFloat(wallet.balance || 0);
  const dues = parseFloat(wallet.outstanding_dues || 0);
  const withdrawAmount = parseFloat(amount);

  // Cannot withdraw if dues exceed limit
  if (dues > 300) {
    return reply.code(400).send({
      success: false,
      message: `You have ₹${dues} in outstanding dues. Please clear dues before withdrawing.`,
    });
  }

  if (withdrawAmount > balance) {
    return reply.code(400).send({
      success: false,
      message: `Insufficient balance. Available: ₹${balance}`,
    });
  }

  // Deduct balance
  await supabaseAdmin
    .from('driver_wallets')
    .update({
      balance: balance - withdrawAmount,
      last_updated: new Date().toISOString(),
    })
    .eq('driver_id', driverId);

  // Record transaction
  await supabaseAdmin.from('driver_transactions').insert({
    wallet_id: wallet.id,
    amount: withdrawAmount,
    type: 'debit',
    description: `Bank Withdrawal${upiId ? ` via ${upiId}` : ''}`,
  });

  // In production: trigger bank transfer via payment gateway here

  return reply.send({
    success: true,
    message: `Withdrawal of ₹${withdrawAmount} initiated. Will be processed within 24 hours.`,
    newBalance: balance - withdrawAmount,
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/wallet/pay-dues
// Body: { amount: number }
// ──────────────────────────────────────────────────────────────
async function payDues(request, reply) {
  const driverId = request.driver.id;
  const { amount } = request.body;

  if (!amount || parseFloat(amount) <= 0) {
    return reply.code(400).send({ success: false, message: 'Valid amount required' });
  }

  const { data: wallet, error } = await supabaseAdmin
    .from('driver_wallets')
    .select('id, balance, outstanding_dues')
    .eq('driver_id', driverId)
    .single();

  if (error || !wallet) {
    return reply.code(404).send({ success: false, message: 'Wallet not found' });
  }

  const balance = parseFloat(wallet.balance || 0);
  const dues = parseFloat(wallet.outstanding_dues || 0);
  const payAmount = Math.min(parseFloat(amount), dues); // Can't pay more than owed

  if (balance < payAmount) {
    return reply.code(400).send({
      success: false,
      message: `Insufficient balance. Available: ₹${balance}`,
    });
  }

  await supabaseAdmin
    .from('driver_wallets')
    .update({
      balance: balance - payAmount,
      outstanding_dues: dues - payAmount,
      last_updated: new Date().toISOString(),
    })
    .eq('driver_id', driverId);

  await supabaseAdmin.from('driver_transactions').insert({
    wallet_id: wallet.id,
    amount: payAmount,
    type: 'debit',
    description: 'Commission Dues Payment',
  });

  return reply.send({
    success: true,
    message: `₹${payAmount} dues cleared successfully.`,
    newBalance: balance - payAmount,
    remainingDues: dues - payAmount,
  });
}

module.exports = { getWallet, requestWithdrawal, payDues };
