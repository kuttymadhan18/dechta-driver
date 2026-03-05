import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface WalletViewProps {
  onClose: () => void;
  initialBalance?: number;
}

// ─── Transaction meta ─────────────────────────────────────────────────────
const TX_META: Record<string, { icon: string; bg: string; fg: string; label: string }> = {
  credit:     { icon: 'download',        bg: '#DCFCE7', fg: '#16A34A', label: 'Earned'     },
  debit:      { icon: 'upload',          bg: '#FEE2E2', fg: '#DC2626', label: 'Paid Out'   },
  commission: { icon: 'percent',         bg: '#FEF3C7', fg: '#D97706', label: 'Commission' },
  withdrawal: { icon: 'credit-card',       bg: '#EDE9FE', fg: '#7C3AED', label: 'Withdrawal' },
};

function getTxMeta(desc: string, type: string) {
  const d = desc.toLowerCase();
  if (d.includes('withdraw') || d.includes('bank')) return TX_META.withdrawal;
  if (d.includes('commission') || d.includes('dues')) return TX_META.commission;
  return type === 'credit' ? TX_META.credit : TX_META.debit;
}

// ─── Animated counting balance ────────────────────────────────────────────
function AnimatedBalance({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: value, duration: 700, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return (
    <Text style={s.heroAmount}>
      ₹{display.toLocaleString('en-IN')}
    </Text>
  );
}

// ─── Dues progress bar ────────────────────────────────────────────────────
function DuesBar({ dues, limit = 300 }: { dues: number; limit?: number }) {
  const pct = Math.min(dues / limit, 1);
  const color = dues > limit ? '#EF4444' : dues > limit * 0.7 ? '#F59E0B' : '#22C55E';
  return (
    <View style={s.duesBarWrap}>
      <View style={s.duesBarTrack}>
        <View style={[s.duesBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={s.duesBarLabels}>
        <Text style={[s.duesBarLeft, { color }]}>₹{dues.toFixed(0)} used</Text>
        <Text style={s.duesBarRight}>Limit ₹{limit}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function WalletView({ onClose, initialBalance = 4500 }: WalletViewProps) {

  const [walletBalance,    setWalletBalance]    = useState(initialBalance);
  const [outstandingDues,  setOutstandingDues]  = useState(450.00);
  const [transactions,     setTransactions]     = useState([
    { id: 1, type: 'credit', amount: 1250, date: 'Today 02:30 PM',  desc: 'Trip Earnings'          },
    { id: 2, type: 'credit', amount: 800,  date: 'Today 11:15 AM',  desc: 'Trip Earnings'          },
    { id: 3, type: 'debit',  amount: 450,  date: 'Yesterday',       desc: 'Commission Dues Payment'},
    { id: 4, type: 'credit', amount: 200,  date: 'Oct 22',          desc: 'Joining Bonus'          },
    { id: 5, type: 'debit',  amount: 1000, date: 'Oct 21',          desc: 'Bank Withdrawal'        },
  ]);

  const [isLoading,      setIsLoading]      = useState(false);
  const [payAmount,      setPayAmount]      = useState(Math.ceil(outstandingDues).toString());
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [topupAmount,    setTopupAmount]    = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState<'upi' | 'card'>('upi');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [isPayDuesOpen,  setIsPayDuesOpen]  = useState(false);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { setWalletBalance(initialBalance); }, [initialBalance]);

  const isLimitReached = outstandingDues > 300;
  const todayEarned    = transactions
    .filter(t => t.type === 'credit' && t.date.startsWith('Today'))
    .reduce((a, b) => a + b.amount, 0);

  const addTx = (type: string, amount: number, desc: string) =>
    setTransactions(p => [{ id: Date.now(), type, amount, date: 'Just now', desc }, ...p]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAddMoney = () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt < 1) return Alert.alert('Invalid Amount', 'Please enter a valid amount.');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setWalletBalance(p => p + amt);
      addTx('credit', amt, `Added via ${paymentMethod === 'upi' ? 'UPI' : 'Card'}`);
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsAddMoneyOpen(false); setTopupAmount(''); }, 2200);
    }, 1500);
  };

  const handlePayDues = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0)       return Alert.alert('Error', 'Enter a valid amount.');
    if (outstandingDues <= 0)   return Alert.alert('Notice', 'No outstanding dues.');
    if (amt > walletBalance)    return Alert.alert('Insufficient Balance', 'Please add money to your wallet first.');
    if (amt > outstandingDues)  return Alert.alert('Error', 'Amount exceeds outstanding dues.');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setWalletBalance(p => p - amt);
      const newDues = outstandingDues - amt;
      setOutstandingDues(newDues);
      addTx('debit', amt, 'Commission Dues Payment');
      setPayAmount(Math.ceil(newDues).toString());
      setIsPayDuesOpen(false);
      Alert.alert('✅ Payment Done', newDues <= 0 ? 'All dues cleared!' : `₹${newDues.toFixed(0)} still remaining.`);
    }, 1000);
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount || '0');
    if (!amt || amt < 500)    return Alert.alert('Minimum ₹500', 'Minimum withdrawal is ₹500.');
    if (amt > walletBalance)  return Alert.alert('Low Balance', 'Insufficient wallet balance.');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setWalletBalance(p => p - amt);
      addTx('debit', amt, 'Bank Withdrawal');
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      Alert.alert('🏦 Withdrawal Initiated', `₹${amt.toLocaleString()} will reach your bank in 1–2 business days.`);
    }, 1500);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>My Wallet</Text>
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>
              Live · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
        </View>
        <View style={s.backBtn} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── HERO BALANCE CARD ─────────────────────────────────────────── */}
        <LinearGradient colors={['#0F172A', '#0C2340']} style={s.heroCard}>
          <View style={s.heroCircle1} />
          <View style={s.heroCircle2} />

          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>WALLET BALANCE</Text>
              <AnimatedBalance value={walletBalance} />
              <Text style={s.heroSub}>Available to use</Text>
            </View>
            <View style={s.heroTodayBox}>
              <Feather name="trending-up" size={15} color="#4ADE80" />
              <Text style={s.heroTodayLabel}>TODAY</Text>
              <Text style={s.heroTodayVal}>+₹{todayEarned.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* 3 Big Action Buttons */}
          <View style={s.heroActions}>
            <TouchableOpacity style={s.heroActionBtn} onPress={() => setIsAddMoneyOpen(true)} activeOpacity={0.75}>
              <View style={[s.heroActionIcon, { backgroundColor: 'rgba(56,189,248,0.2)' }]}>
                <Feather name="plus-circle" size={24} color="#38BDF8" />
              </View>
              <Text style={s.heroActionText}>Add Money</Text>
            </TouchableOpacity>

            <View style={s.heroActionDivider} />

            <TouchableOpacity style={s.heroActionBtn} onPress={() => setIsWithdrawOpen(true)} activeOpacity={0.75}>
              <View style={[s.heroActionIcon, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                <Feather name="send" size={24} color="#FCA5A5" />
              </View>
              <Text style={s.heroActionText}>Withdraw</Text>
            </TouchableOpacity>

            <View style={s.heroActionDivider} />

            <TouchableOpacity style={s.heroActionBtn} onPress={() => setIsPayDuesOpen(true)} activeOpacity={0.75}>
              <View style={[s.heroActionIcon, isLimitReached
                ? { backgroundColor: 'rgba(239,68,68,0.2)' }
                : { backgroundColor: 'rgba(74,222,128,0.2)' }]}>
                <Feather name="check-circle" size={24} color={isLimitReached ? '#FCA5A5' : '#4ADE80'} />
              </View>
              <Text style={s.heroActionText}>Pay Dues</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── DUES ALERT ────────────────────────────────────────────────── */}
        <View style={[s.duesCard, isLimitReached && s.duesCardDanger]}>
          <View style={s.duesRow}>
            <View style={[s.duesIconBox, { backgroundColor: isLimitReached ? '#FEE2E2' : '#FEF3C7' }]}>
              <Feather name={isLimitReached ? 'lock' : 'alert-circle'} size={22} color={isLimitReached ? '#EF4444' : '#D97706'} />
            </View>
            <View style={s.duesInfo}>
              <Text style={s.duesTitle}>{isLimitReached ? '⚠️ Account Suspended' : 'Pending Commission'}</Text>
              <Text style={[s.duesAmount, isLimitReached && { color: '#EF4444' }]}>
                ₹{outstandingDues.toFixed(0)}
              </Text>
              <Text style={s.duesSub}>
                {isLimitReached ? 'Pay now to reactivate your account' : 'Keep dues under ₹300 to stay active'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsPayDuesOpen(true)}
              style={[s.duesPayNowBtn, isLimitReached && { backgroundColor: '#EF4444' }]}
              activeOpacity={0.8}
            >
              <Text style={s.duesPayNowText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
          <DuesBar dues={outstandingDues} />
        </View>

        {/* ── QUICK STATS ───────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          {[
            { label: 'Today Earned', value: `₹${todayEarned.toLocaleString('en-IN')}`, icon: 'zap',          color: '#16A34A', bg: '#DCFCE7' },
            { label: 'Total Trips',  value: '14',                                       icon: 'package',      color: '#0284C7', bg: '#DBEAFE' },
            { label: 'Pending Dues', value: `₹${outstandingDues.toFixed(0)}`,           icon: 'alert-circle', color: '#D97706', bg: '#FEF3C7' },
          ].map((stat, i) => (
            <View key={i} style={s.statBox}>
              <View style={[s.statIconBox, { backgroundColor: stat.bg }]}>
                <Feather name={stat.icon as any} size={17} color={stat.color} />
              </View>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── TRANSACTIONS ─────────────────────────────────────────────── */}
        <View style={s.txHeader}>
          <Text style={s.txTitle}>Recent Transactions</Text>
          <TouchableOpacity style={s.txFilterBtn}>
            <Feather name="filter" size={14} color="#0284C7" />
            <Text style={s.txFilterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={s.emptyBox}>
            <Feather name="clipboard" size={44} color="#CBD5E1" />
            <Text style={s.emptyText}>No transactions yet</Text>
          </View>
        ) : transactions.map((t, idx) => {
          const meta = getTxMeta(t.desc, t.type);
          const isCredit = t.type === 'credit';
          return (
            <View key={t.id} style={[s.txItem, idx === 0 && s.txItemFirst]}>
              <View style={[s.txIconBox, { backgroundColor: meta.bg }]}>
                <Feather name={meta.icon as any} size={18} color={meta.fg} />
              </View>
              <View style={s.txBody}>
                <Text style={s.txDesc} numberOfLines={1}>{t.desc}</Text>
                <Text style={s.txDate}>{t.date}</Text>
              </View>
              <View style={s.txRight}>
                <Text style={[s.txAmount, { color: isCredit ? '#16A34A' : '#EF4444' }]}>
                  {isCredit ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                </Text>
                <View style={[s.txBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[s.txBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: PAY DUES
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal visible={isPayDuesOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => !isLoading && setIsPayDuesOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetTitleRow}>
              <View style={[s.sheetIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="check-circle" size={26} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.sheetTitle}>Pay Commission Dues</Text>
                <Text style={s.sheetSub}>Balance: <Text style={{ color: '#0284C7', fontWeight: '800' }}>₹{walletBalance.toFixed(0)}</Text></Text>
              </View>
            </View>

            <DuesBar dues={outstandingDues} />
            <View style={{ height: 18 }} />

            <Text style={s.inputLabel}>AMOUNT TO PAY</Text>
            <View style={s.bigInputRow}>
              <View style={[s.bigInputBox, { flex: 1 }]}>
                <Text style={s.bigRupee}>₹</Text>
                <TextInput
                  style={s.bigInput}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
              <TouchableOpacity
                onPress={() => setPayAmount(Math.ceil(outstandingDues).toString())}
                style={s.fullBtn}
              >
                <Text style={s.fullBtnText}>Full</Text>
              </TouchableOpacity>
            </View>

            <View style={s.quickRow}>
              {['100', '200', '450'].map(a => (
                <TouchableOpacity key={a} onPress={() => setPayAmount(a)}
                  style={[s.quickChip, payAmount === a && s.quickChipActive]}>
                  <Text style={[s.quickChipText, payAmount === a && s.quickChipTextActive]}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              disabled={isLoading || outstandingDues <= 0}
              onPress={handlePayDues}
              style={[s.primaryBtn, { backgroundColor: '#D97706', shadowColor: '#D97706' },
                      (isLoading || outstandingDues <= 0) && s.btnDisabled]}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <><Feather name="check-circle" size={20} color="#FFF" /><Text style={s.primaryBtnText}>Confirm Payment</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPayDuesOpen(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: WITHDRAW
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal visible={isWithdrawOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => !isLoading && setIsWithdrawOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetTitleRow}>
              <View style={[s.sheetIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Feather name="send" size={26} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.sheetTitle}>Withdraw to Bank</Text>
                <Text style={s.sheetSub}>Available: <Text style={{ color: '#0284C7', fontWeight: '800' }}>₹{walletBalance.toFixed(0)}</Text> · Min ₹500</Text>
              </View>
            </View>

            <Text style={s.inputLabel}>ENTER AMOUNT</Text>
            <View style={s.bigInputBox}>
              <Text style={s.bigRupee}>₹</Text>
              <TextInput
                style={s.bigInput}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor="#CBD5E1"
              />
            </View>

            <View style={[s.quickRow, { marginTop: 14 }]}>
              {['500', '1000', '2000', '5000'].map(a => (
                <TouchableOpacity key={a} onPress={() => setWithdrawAmount(a)}
                  style={[s.quickChip, withdrawAmount === a && s.quickChipActive]}>
                  <Text style={[s.quickChipText, withdrawAmount === a && s.quickChipTextActive]}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.bankRow}>
              <View style={s.bankIconBox}><Feather name="credit-card" size={18} color="#7C3AED" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.bankLabel}>HDFC Bank — ****1234</Text>
                <Text style={s.bankSub}>Reaches in 1–2 business days</Text>
              </View>
              <Feather name="check-circle" size={18} color="#22C55E" />
            </View>

            <TouchableOpacity
              disabled={isLoading}
              onPress={handleWithdraw}
              style={[s.primaryBtn, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }, isLoading && s.btnDisabled]}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <><Feather name="send" size={20} color="#FFF" /><Text style={s.primaryBtnText}>Withdraw ₹{withdrawAmount || '0'}</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsWithdrawOpen(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: ADD MONEY
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal visible={isAddMoneyOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => !isLoading && setIsAddMoneyOpen(false)} />
          <View style={s.sheet}>
            {paymentSuccess ? (
              <View style={s.successView}>
                <LinearGradient colors={['#22C55E', '#16A34A']} style={s.successIcon}>
                  <Feather name="check" size={48} color="#FFF" />
                </LinearGradient>
                <Text style={s.successTitle}>Money Added!</Text>
                <Text style={s.successSub}>₹{topupAmount} added to your wallet</Text>
              </View>
            ) : (
              <>
                <View style={s.sheetHandle} />
                <View style={s.sheetTitleRow}>
                  <View style={[s.sheetIconBox, { backgroundColor: '#DBEAFE' }]}>
                    <Feather name="plus-circle" size={26} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={s.sheetTitle}>Add Money</Text>
                    <Text style={s.sheetSub}>Balance: <Text style={{ color: '#0284C7', fontWeight: '800' }}>₹{walletBalance.toFixed(0)}</Text></Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsAddMoneyOpen(false)} style={s.closeBtn}>
                    <Feather name="x" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.inputLabel}>ENTER AMOUNT</Text>
                <View style={s.bigInputBox}>
                  <Text style={s.bigRupee}>₹</Text>
                  <TextInput
                    style={s.bigInput}
                    value={topupAmount}
                    onChangeText={setTopupAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    autoFocus
                  />
                </View>

                <View style={[s.quickRow, { marginTop: 14 }]}>
                  {['500', '1000', '2000', '5000'].map(a => (
                    <TouchableOpacity key={a} onPress={() => setTopupAmount(a)}
                      style={[s.quickChip, topupAmount === a && s.quickChipActive]}>
                      <Text style={[s.quickChipText, topupAmount === a && s.quickChipTextActive]}>+₹{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.inputLabel, { marginTop: 4 }]}>PAY USING</Text>
                <View style={s.methodRow}>
                  {([
                    { key: 'upi',  icon: 'smartphone',  label: 'UPI',  sub: 'GPay · PhonePe · Paytm' },
                    { key: 'card', icon: 'credit-card', label: 'Card', sub: 'Debit / Credit Card'     },
                  ] as const).map(m => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setPaymentMethod(m.key)}
                      style={[s.methodBox, paymentMethod === m.key && s.methodBoxActive]}
                      activeOpacity={0.8}
                    >
                      <Feather name={m.icon} size={24} color={paymentMethod === m.key ? '#0284C7' : '#94A3B8'} />
                      <Text style={[s.methodLabel, paymentMethod === m.key && { color: '#0284C7' }]}>{m.label}</Text>
                      <Text style={s.methodSub}>{m.sub}</Text>
                      {paymentMethod === m.key && (
                        <View style={s.methodCheck}><Feather name="check" size={11} color="#FFF" /></View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  disabled={isLoading}
                  onPress={handleAddMoney}
                  style={[s.primaryBtn, isLoading && s.btnDisabled]}
                >
                  {isLoading
                    ? <ActivityIndicator color="#FFF" />
                    : <><Feather name="plus" size={20} color="#FFF" /><Text style={s.primaryBtnText}>Add ₹{topupAmount || '0'} to Wallet</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsAddMoneyOpen(false)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#F1F5F9' },
  scroll:{ padding: 16, paddingBottom: 60 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn:     { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerMid:   { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  livePill:    { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 5 },
  liveText:    { fontSize: 11, color: '#64748B', fontWeight: '600' },

  // Hero Card
  heroCard:      { borderRadius: 28, padding: 24, marginBottom: 16, overflow: 'hidden', position: 'relative',
                   shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  heroCircle1:   { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.04)', top: -70, right: -70 },
  heroCircle2:   { position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: 'rgba(255,255,255,0.03)', bottom: -50, left: -30 },
  heroTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  heroLabel:     { fontSize: 10, fontWeight: '800', color: '#475569', letterSpacing: 1.5, marginBottom: 8 },
  heroAmount:    { fontSize: 46, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  heroSub:       { fontSize: 12, color: '#475569', marginTop: 6, fontWeight: '600' },
  heroTodayBox:  { backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 18, padding: 14, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  heroTodayLabel:{ fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1 },
  heroTodayVal:  { fontSize: 17, fontWeight: '900', color: '#4ADE80' },
  heroActions:   { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, padding: 4 },
  heroActionBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 8 },
  heroActionIcon:{ width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  heroActionText:{ fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  heroActionDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },

  // Dues Card
  duesCard:       { backgroundColor: '#FFF', borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 2, borderColor: '#FEF3C7',
                    shadowColor: '#D97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  duesCardDanger: { borderColor: '#FECACA', shadowColor: '#EF4444' },
  duesRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  duesIconBox:    { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  duesInfo:       { flex: 1 },
  duesTitle:      { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  duesAmount:     { fontSize: 24, fontWeight: '900', color: '#D97706' },
  duesSub:        { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  duesPayNowBtn:  { backgroundColor: '#D97706', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  duesPayNowText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  duesBarWrap:    { gap: 6 },
  duesBarTrack:   { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  duesBarFill:    { height: 8, borderRadius: 4 },
  duesBarLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  duesBarLeft:    { fontSize: 12, fontWeight: '800' },
  duesBarRight:   { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // Stats
  statsRow:   { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statBox:    { flex: 1, backgroundColor: '#FFF', borderRadius: 18, padding: 14, alignItems: 'center', gap: 6,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  statIconBox:{ width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statVal:    { fontSize: 16, fontWeight: '900' },
  statLabel:  { fontSize: 10, color: '#94A3B8', fontWeight: '700', textAlign: 'center' },

  // Transactions
  txHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  txTitle:      { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  txFilterBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  txFilterText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  txItem:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 10,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  txItemFirst:  { borderWidth: 2, borderColor: '#DBEAFE' },
  txIconBox:    { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txBody:       { flex: 1 },
  txDesc:       { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  txDate:       { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  txRight:      { alignItems: 'flex-end', gap: 5 },
  txAmount:     { fontSize: 17, fontWeight: '900' },
  txBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  txBadgeText:  { fontSize: 10, fontWeight: '800' },
  emptyBox:     { alignItems: 'center', paddingVertical: 44, gap: 12 },
  emptyText:    { fontSize: 14, color: '#94A3B8', fontWeight: '600' },

  // Sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 44 },
  sheetHandle:  { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 24 },
  sheetTitleRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetIconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sheetTitle:   { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  sheetSub:     { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 3 },
  closeBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  // Input
  inputLabel:   { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 10 },
  bigInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  bigInputBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
                  borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 18, paddingHorizontal: 18, marginBottom: 0 },
  bigRupee:     { fontSize: 28, fontWeight: '900', color: '#94A3B8', marginRight: 6 },
  bigInput:     { flex: 1, height: 72, fontSize: 36, fontWeight: '900', color: '#0F172A' },
  fullBtn:      { backgroundColor: '#EFF6FF', paddingHorizontal: 18, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: '#DBEAFE' },
  fullBtnText:  { fontSize: 14, fontWeight: '800', color: '#0284C7' },

  quickRow:     { flexDirection: 'row', gap: 8, marginBottom: 20, marginTop: 14 },
  quickChip:    { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
  quickChipActive:    { backgroundColor: '#EFF6FF', borderColor: '#0284C7' },
  quickChipText:      { fontSize: 13, fontWeight: '700', color: '#64748B' },
  quickChipTextActive:{ color: '#0284C7' },

  bankRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16,
                padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  bankIconBox:{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  bankLabel:  { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  bankSub:    { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  methodRow:       { flexDirection: 'row', gap: 12, marginBottom: 20 },
  methodBox:       { flex: 1, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFF', alignItems: 'center', gap: 5, position: 'relative' },
  methodBoxActive: { borderColor: '#0284C7', backgroundColor: '#F0F9FF' },
  methodLabel:     { fontSize: 15, fontWeight: '800', color: '#64748B' },
  methodSub:       { fontSize: 10, color: '#94A3B8', fontWeight: '600', textAlign: 'center' },
  methodCheck:     { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center' },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                    backgroundColor: '#0284C7', paddingVertical: 18, borderRadius: 18, marginBottom: 12,
                    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  cancelBtn:      { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:  { color: '#94A3B8', fontWeight: '700', fontSize: 15 },
  btnDisabled:    { opacity: 0.5, shadowOpacity: 0 },

  successView:  { alignItems: 'center', paddingVertical: 50 },
  successIcon:  { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 26,
                  shadowColor: '#22C55E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  successSub:   { fontSize: 16, color: '#64748B', fontWeight: '600' },
});
