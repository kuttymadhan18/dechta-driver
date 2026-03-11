// src/controllers/walletController.js
const { query, withTransaction } = require('../config/db');

// ──────────────────────────────────────────────────────────────
// GET /api/wallet
// ──────────────────────────────────────────────────────────────
async function getWallet(request, reply) {
  const driverId = request.driver.id;

  let { rows: walletRows } = await query(
    `SELECT * FROM driver_wallets WHERE driver_id=$1`,
    [driverId]
  );

  if (!walletRows.length) {
    const { rows: created } = await query(
      `INSERT INTO driver_wallets (driver_id, balance, outstanding_dues)
       VALUES ($1,0,0) RETURNING *`,
      [driverId]
    );
    walletRows = created;
  }

  const wallet = walletRows[0];

  const { rows: transactions } = await query(
    `SELECT * FROM driver_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 30`,
    [wallet.id]
  );

  return reply.send({
    success: true,
    data: {
      balance:         parseFloat(wallet.balance || 0),
      outstandingDues: parseFloat(wallet.outstanding_dues || 0),
      lastUpdated:     wallet.last_updated,
      transactions:    transactions.map((t) => ({
        id:          t.id,
        type:        t.type,
        amount:      parseFloat(t.amount),
        description: t.description,
        date:        t.created_at,
      })),
    },
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/wallet/withdraw
// ──────────────────────────────────────────────────────────────
async function requestWithdrawal(request, reply) {
  const driverId = request.driver.id;
  const { amount, upiId } = request.body;

  if (!amount || parseFloat(amount) < 100) {
    return reply.code(400).send({ success: false, message: 'Minimum withdrawal amount is ₹100' });
  }

  const { rows } = await query(
    `SELECT id, balance, outstanding_dues FROM driver_wallets WHERE driver_id=$1`,
    [driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Wallet not found' });

  const wallet         = rows[0];
  const balance        = parseFloat(wallet.balance || 0);
  const dues           = parseFloat(wallet.outstanding_dues || 0);
  const withdrawAmount = parseFloat(amount);

  if (dues > 300) {
    return reply.code(400).send({
      success: false,
      message: `You have ₹${dues} in outstanding dues. Please clear dues before withdrawing.`,
    });
  }

  if (withdrawAmount > balance) {
    return reply.code(400).send({ success: false, message: `Insufficient balance. Available: ₹${balance}` });
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE driver_wallets SET balance=$1, last_updated=NOW() WHERE driver_id=$2`,
      [balance - withdrawAmount, driverId]
    );
    await client.query(
      `INSERT INTO driver_transactions (wallet_id, amount, type, description) VALUES ($1,$2,'debit',$3)`,
      [wallet.id, withdrawAmount, `Bank Withdrawal${upiId ? ` via ${upiId}` : ''}`]
    );
  });

  return reply.send({
    success: true,
    message: `Withdrawal of ₹${withdrawAmount} initiated. Will be processed within 24 hours.`,
    newBalance: balance - withdrawAmount,
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/wallet/pay-dues
// ──────────────────────────────────────────────────────────────
async function payDues(request, reply) {
  const driverId = request.driver.id;
  const { amount } = request.body;

  if (!amount || parseFloat(amount) <= 0) {
    return reply.code(400).send({ success: false, message: 'Valid amount required' });
  }

  const { rows } = await query(
    `SELECT id, balance, outstanding_dues FROM driver_wallets WHERE driver_id=$1`,
    [driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Wallet not found' });

  const wallet    = rows[0];
  const balance   = parseFloat(wallet.balance || 0);
  const dues      = parseFloat(wallet.outstanding_dues || 0);
  const payAmount = Math.min(parseFloat(amount), dues);

  if (balance < payAmount) {
    return reply.code(400).send({ success: false, message: `Insufficient balance. Available: ₹${balance}` });
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE driver_wallets SET balance=$1, outstanding_dues=$2, last_updated=NOW() WHERE driver_id=$3`,
      [balance - payAmount, dues - payAmount, driverId]
    );
    await client.query(
      `INSERT INTO driver_transactions (wallet_id, amount, type, description) VALUES ($1,$2,'debit','Commission Dues Payment')`,
      [wallet.id, payAmount]
    );
  });

  return reply.send({
    success:       true,
    message:       `₹${payAmount} dues cleared successfully.`,
    newBalance:    balance - payAmount,
    remainingDues: dues - payAmount,
  });
}

module.exports = { getWallet, requestWithdrawal, payDues };
