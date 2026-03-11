import React, { useState, useEffect } from 'react';
import WalletView from '../../components/WalletView';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView,
  Modal, Dimensions, Image, Linking, Alert, Clipboard, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Polyline, Rect, Polygon } from 'react-native-svg';
import { DriverAPI, EarningsAPI, MiscAPI, AuthAPI } from '../../services/api';
import { useRouter } from 'expo-router';

const { height } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// PURE NATIVE SVG ICONS
// ═══════════════════════════════════════════════════════════════════════════
function NativeIcon({ name, size = 24, color = "currentColor" }: { name: string, size?: number, color?: string }) {
  switch (name) {
    case 'award': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="8" r="7" /><Polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></Svg>;
    case 'crown': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Polygon points="2 4 5 15 12 11 19 15 22 4 17 7 12 2 7 7 2 4" /><Path d="M2 17h20v5H2z" fill="currentColor" /></Svg>;
    case 'truck': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Rect x="1" y="3" width="15" height="13" /><Polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><Circle cx="5.5" cy="18.5" r="2.5" /><Circle cx="18.5" cy="18.5" r="2.5" /></Svg>;
    case 'card': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><Line x1="1" y1="10" x2="23" y2="10" /></Svg>;
    default: return <Feather name="help-circle" size={size} color={color} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RANK DEFINITIONS (static — same as backend)
// ═══════════════════════════════════════════════════════════════════════════
const ranks = [
  { id: 1, name: 'Trainee', threshold: 0, icon: 'user', colorBg: '#F1F5F9', colorText: '#475569' },
  { id: 2, name: 'Second Officer', threshold: 16, icon: 'award', colorBg: '#CFFAFE', colorText: '#0369A1' },
  { id: 3, name: 'Junior First Officer', threshold: 18, icon: 'award', colorBg: '#DBEAFE', colorText: '#1D4ED8' },
  { id: 4, name: 'First Officer', threshold: 20, icon: 'star', colorBg: '#E0E7FF', colorText: '#4338CA' },
  { id: 5, name: 'Captain', threshold: 22, icon: 'award', colorBg: '#F3E8FF', colorText: '#7E22CE' },
  { id: 6, name: 'Flight Captain', threshold: 24, icon: 'crown', colorBg: '#FEF3C7', colorText: '#B45309' },
  { id: 7, name: 'Senior Flight Captain', threshold: 26, icon: 'crown', colorBg: '#FFEDD5', colorText: '#C2410C' },
  { id: 8, name: 'Commercial Captain', threshold: 30, icon: 'crown', colorBg: '#FEE2E2', colorText: '#B91C1C' },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROFILE SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isVoiceOn, setIsVoiceOn] = useState(true);
  const [perfPeriod, setPerfPeriod] = useState('daily');
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({
    newOrders: true, earnings: true, promotions: true, updates: true
  });
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Real data state ─────────────────────────────────────────────────
  const [dbData, setDbData] = useState<any>({
    fullName: 'Partner', driverId: '—', avatarUrl: null, referralCode: '—',
    todayOrders: 0, todayEarnings: 0, weeklyOrders: 0, walletBalance: 0,
    vehicleType: '—', vehicleNumber: '—', weightLimit: '—', modelName: '—',
    bankAccount: '—', ifscCode: '—',
    aadharUrl: null, panUrl: null, licenseUrl: null, rcUrl: null,
    rating: 5.0,
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<Record<string, { label: string; value: number }[]>>({
    daily: [], monthly: [], yearly: []
  });

  useEffect(() => { loadProfileData(); }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      // Profile + leaderboard in parallel
      const [profileRes, leaderRes] = await Promise.allSettled([
        DriverAPI.getProfile(),
        MiscAPI.getLeaderboard(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.success) {
        const d = profileRes.value.data;
        const p = d.profile || {};
        const s = d.stats || {};
        const v = d.vehicle || {};
        const b = d.bank || {};
        const docs = d.documents || {};
        const w = d.wallet || {};

        setDbData({
          fullName: p.full_name || 'Partner',
          driverId: p.driver_id || p.id || '—',
          avatarUrl: p.avatar_url || null,
          referralCode: p.referral_code || '—',
          todayOrders: s.total_orders_completed || 0,
          todayEarnings: s.total_earnings || 0,
          weeklyOrders: s.weekly_orders_completed || 0,
          walletBalance: w.balance || 0,
          vehicleType: v.vehicle_type || '—',
          vehicleNumber: v.registration_number || '—',
          weightLimit: v.weight_capacity ? `${v.weight_capacity} kg` : '—',
          modelName: v.model_name || v.vehicle_type || '—',
          bankAccount: b.account_number || '—',
          ifscCode: b.ifsc_code || '—',
          aadharUrl: docs.aadhar_url || null,
          panUrl: docs.pan_url || null,
          licenseUrl: docs.license_url || null,
          rcUrl: docs.rc_url || null,
          rating: parseFloat(s.rating || '5.0'),
        });
      }

      if (leaderRes.status === 'fulfilled' && leaderRes.value.success) {
        const raw = leaderRes.value.data || [];
        setLeaderboard(raw.slice(0, 5).map((r: any) => ({
          name: r.isMe ? 'You' : (r.fullName || 'Driver'),
          earnings: r.weeklyEarnings || 0,
          trips: r.weeklyTrips || 0,
          rank: r.rank,
          isMe: r.isMe,
        })));
      }

      // Fetch graph data for all periods in parallel (non-blocking)
      try {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const [dailyRes, monthlyRes, yearlyRes] = await Promise.allSettled([
          EarningsAPI.get('daily', dateKey as any),
          EarningsAPI.get('monthly', dateKey as any),
          EarningsAPI.get('yearly', dateKey as any),
        ]);

        const toGraph = (res: any, labelFn: (t: any) => string): { label: string; value: number }[] => {
          if (res.status !== 'fulfilled' || !res.value.success) return [];
          return (res.value.data?.trips || []).slice(0, 7).map((t: any) => ({
            label: labelFn(t),
            value: t.amount || 0,
          }));
        };

        setGraphData({
          daily: toGraph(dailyRes, (t) => t.date ? new Date(t.date).toLocaleDateString('en-IN', { weekday: 'short' }) : ''),
          monthly: toGraph(monthlyRes, (t) => t.date ? new Date(t.date).toLocaleDateString('en-IN', { month: 'short' }) : ''),
          yearly: toGraph(yearlyRes, (t) => t.date ? new Date(t.date).toLocaleDateString('en-IN', { month: 'short' }) : ''),
        });
      } catch (_) { }

    } catch (e) {
      console.log('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AuthAPI.logout();
          router.replace('/login');
        },
      },
    ]);
  };

  // ── Derived rank data ─────────────────────────────────────────────────
  const currentWeeklyOrders = dbData.weeklyOrders;
  let currentRankIndex = ranks.findIndex(r => currentWeeklyOrders < r.threshold) - 1;
  if (currentRankIndex < 0) currentRankIndex = ranks.length - 1;
  const currentRank = ranks[currentRankIndex];
  const isPilot = currentWeeklyOrders >= 50;
  const progressPercent = Math.min(100, (currentWeeklyOrders / 50) * 100);
  const ordersNeededForPilot = Math.max(0, 50 - currentWeeklyOrders);

  const toggleNotif = (key: string) => setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const renderModal = () => {
    if (!activeModal) return null;
    let content = null;

    // ── ACHIEVEMENTS ─────────────────────────────────────────────────
    if (activeModal === 'achievements') {
      const nextRank = ranks[currentRankIndex + 1];
      let rankProgress = 100;
      let ordersNeeded = 0;
      if (nextRank) {
        const range = nextRank.threshold - currentRank.threshold;
        const progress = currentWeeklyOrders - currentRank.threshold;
        rankProgress = Math.min(100, Math.max(0, (progress / range) * 100));
        ordersNeeded = nextRank.threshold - currentWeeklyOrders;
      }
      content = (
        <View>
          <View style={styles.modalHeader}>
            <Feather name="award" size={24} color="#0284C7" />
            <Text style={styles.modalTitle}>Weekly Aviation Ranks</Text>
          </View>
          <View style={[styles.rankHeroCard, { backgroundColor: currentRank.colorBg }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.rankSubText, { color: currentRank.colorText }]}>CURRENT RANK</Text>
                <Text style={[styles.rankHeroText, { color: currentRank.colorText }]}>{currentRank.name}</Text>
              </View>
              <View style={styles.rankHeroIconBox}>
                <NativeIcon name={currentRank.icon} size={32} color={currentRank.colorText} />
              </View>
            </View>
            {nextRank ? (
              <View style={{ marginTop: 16 }}>
                <View style={styles.rowBetween}>
                  <Text style={[{ fontSize: 12, fontWeight: 'bold' }, { color: currentRank.colorText }]}>{currentWeeklyOrders} Orders</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(0,0,0,0.5)' }}>{nextRank.threshold} Goal</Text>
                </View>
                <View style={styles.progressBarBgLight}>
                  <View style={[styles.progressBarFillLight, { width: `${rankProgress}%`, backgroundColor: currentRank.colorText }]} />
                </View>
                <Text style={[{ fontSize: 12, marginTop: 8, fontWeight: '600' }, { color: currentRank.colorText }]}>
                  {ordersNeeded} more orders to reach {nextRank.name}
                </Text>
              </View>
            ) : (
              <Text style={[{ fontSize: 14, fontWeight: 'bold', marginTop: 16 }, { color: currentRank.colorText }]}>You are at the top rank! Incredible work!</Text>
            )}
          </View>
          <Text style={styles.sectionTitle}>Progression Path</Text>
          <View style={styles.pathContainer}>
            {ranks.map((rank, index) => {
              const isCompleted = currentWeeklyOrders >= rank.threshold;
              const isCurrent = index === currentRankIndex;
              return (
                <View key={rank.id} style={styles.pathRow}>
                  <View style={[styles.pathLine, index === ranks.length - 1 && { display: 'none' }]} />
                  <View style={[styles.pathDot, (isCompleted || isCurrent) ? { backgroundColor: rank.colorBg } : { backgroundColor: '#F1F5F9' }]}>
                    <NativeIcon name={rank.icon} size={16} color={(isCompleted || isCurrent) ? rank.colorText : '#94A3B8'} />
                  </View>
                  <View style={[styles.pathCard, isCurrent ? { backgroundColor: rank.colorBg, borderColor: rank.colorBg } : isCompleted ? { backgroundColor: '#F8FAFC' } : { backgroundColor: '#FFF', opacity: 0.5 }]}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.pathCardTitle, isCurrent ? { color: rank.colorText } : { color: '#0F172A' }]}>{rank.name}</Text>
                      {isCurrent && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>CURRENT</Text></View>}
                    </View>
                    <Text style={[styles.pathCardSub, isCurrent ? { color: rank.colorText } : { color: '#64748B' }]}>
                      {rank.threshold === 0 ? 'Starting Rank' : `${rank.threshold}+ Orders / Week`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // ── PERFORMANCE ───────────────────────────────────────────────────
    else if (activeModal === 'performance') {
      const currentGraph = graphData[perfPeriod] || [];
      const maxVal = currentGraph.length > 0 ? Math.max(...currentGraph.map(d => d.value), 1) : 1;
      content = (
        <View>
          <View style={styles.modalHeader}>
            <Feather name="trending-up" size={24} color="#0284C7" />
            <Text style={styles.modalTitle}>Performance</Text>
          </View>
          <View style={styles.tabsRow}>
            {['daily', 'monthly', 'yearly'].map(p => (
              <TouchableOpacity key={p} onPress={() => setPerfPeriod(p)} style={[styles.tabBtn, perfPeriod === p ? styles.tabActive : styles.tabInactive]}>
                <Text style={[styles.tabText, perfPeriod === p ? { color: '#FFF' } : { color: '#64748B' }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.statLabel, { color: '#1D4ED8' }]}>Rating</Text>
              <Text style={[styles.statValue, { color: '#1E3A8A' }]}>{dbData.rating.toFixed(1)}⭐</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.statLabel, { color: '#15803D' }]}>Earnings</Text>
              <Text style={[styles.statValue, { color: '#14532D' }]}>₹{dbData.todayEarnings}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }]}>
              <Text style={[styles.statLabel, { color: '#7E22CE' }]}>Trips</Text>
              <Text style={[styles.statValue, { color: '#581C87' }]}>{dbData.todayOrders}</Text>
            </View>
          </View>
          <View style={styles.graphCard}>
            {currentGraph.length > 0 ? (
              <View style={styles.graphContainer}>
                {currentGraph.map((item, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barWrap}>
                      <View style={[styles.barFill, { height: `${(item.value / maxVal) * 100}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>No data for this period</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    // ── LEADERBOARD ───────────────────────────────────────────────────
    else if (activeModal === 'leaderboard') {
      content = (
        <View>
          <View style={styles.modalHeader}>
            <NativeIcon name="award" size={24} color="#D97706" />
            <Text style={styles.modalTitle}>Weekly Leaderboard</Text>
          </View>
          <View style={styles.leaderboardList}>
            {leaderboard.length === 0 ? (
              <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 20 }}>No leaderboard data yet</Text>
            ) : leaderboard.map(driver => (
              <View key={driver.rank} style={[styles.leaderCard, driver.isMe ? styles.leaderCardMe : styles.leaderCardNormal]}>
                <View style={[styles.rankBadge, driver.rank <= 3 ? styles.rankTop : styles.rankNormal]}>
                  {driver.rank <= 3 ? <Feather name="award" size={20} color="#FFF" /> : <Text style={styles.rankNum}>{driver.rank}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderName}>{driver.name}</Text>
                  <Text style={styles.leaderStats}>{driver.trips} trips • ₹{driver.earnings}</Text>
                </View>
                <Text style={styles.rankDisplay}>#{driver.rank}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // ── DOCUMENTS ─────────────────────────────────────────────────────
    else if (activeModal === 'docs') {
      const renderDoc = (name: string, dbUrl: string | null) => (
        <View style={styles.docRow} key={name}>
          <View style={styles.rowCenter}>
            <View style={{ marginRight: 12 }}>
              <Feather name="check-circle" size={18} color={dbUrl ? "#22C55E" : "#CBD5E1"} />
            </View>
            <View>
              <Text style={styles.docName}>{name}</Text>
              <Text style={styles.docSub}>{dbUrl ? 'Uploaded & Active' : 'Pending Upload'}</Text>
            </View>
          </View>
          {dbUrl ?
            <TouchableOpacity style={styles.docBtn}><Text style={styles.docBtnText}>VIEW</Text></TouchableOpacity>
            :
            <View style={styles.docMissing}><Text style={styles.docMissingText}>MISSING</Text></View>
          }
        </View>
      );
      content = (
        <View>
          <Text style={[styles.modalTitle, { marginBottom: 16 }]}>Documents</Text>
          <View style={styles.docList}>
            {renderDoc('Driving License', dbData.licenseUrl)}
            {renderDoc('RC Book', dbData.rcUrl)}
            {renderDoc('PAN Card', dbData.panUrl)}
            {renderDoc('Aadhaar Card', dbData.aadharUrl)}
          </View>
        </View>
      );
    }

    // ── BANK ──────────────────────────────────────────────────────────
    else if (activeModal === 'bank') {
      const rawAcc = dbData.bankAccount || '';
      const formattedAccount = rawAcc !== '—' ? rawAcc.replace(/(\d{4})/g, '$1 ').trim() : '—';
      content = (
        <View>
          <View style={styles.modalHeader}>
            <NativeIcon name="card" size={24} color="#0284C7" />
            <Text style={styles.modalTitle}>Bank Account</Text>
          </View>
          <View style={styles.bankCardBg}>
            <View style={styles.rowBetween}>
              <Text style={styles.bankLabel}>BANK ACCOUNT</Text>
              <NativeIcon name="card" size={28} color="rgba(255,255,255,0.75)" />
            </View>
            <Text style={styles.bankAccNum}>{formattedAccount}</Text>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.bankSubLabel}>ACCOUNT HOLDER</Text>
                <Text style={styles.bankSubValue}>{dbData.fullName.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.bankSubLabel}>IFSC CODE</Text>
                <Text style={styles.bankSubValue}>{dbData.ifscCode.toUpperCase()}</Text>
              </View>
            </View>
          </View>
          <View style={styles.bankDetailsBox}>
            <Text style={styles.bankBoxTitle}>Account Details</Text>
            <View style={styles.bankRow}>
              <View style={[styles.bankIconBox, { backgroundColor: '#EFF6FF' }]}><Feather name="hash" size={16} color="#0284C7" /></View>
              <View>
                <Text style={styles.bankRowLabel}>Account Number</Text>
                <Text style={styles.bankRowValue}>{dbData.bankAccount}</Text>
              </View>
            </View>
            <View style={styles.bankRow}>
              <View style={[styles.bankIconBox, { backgroundColor: '#FAF5FF' }]}><Feather name="code" size={16} color="#9333EA" /></View>
              <View>
                <Text style={styles.bankRowLabel}>IFSC Code</Text>
                <Text style={styles.bankRowValue}>{dbData.ifscCode}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // ── VEHICLE ───────────────────────────────────────────────────────
    else if (activeModal === 'vehicle') {
      content = (
        <View>
          <View style={styles.modalHeader}>
            <NativeIcon name="truck" size={24} color="#0284C7" />
            <Text style={styles.modalTitle}>Vehicle Info</Text>
          </View>
          <View style={styles.vehCardHero}>
            <View style={styles.rowCenter}>
              <View style={styles.vehHeroIcon}><NativeIcon name="truck" size={24} color="#FFF" /></View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.vehHeroLabel}>Vehicle Type</Text>
                <Text style={styles.vehHeroValue}>{dbData.modelName || dbData.vehicleType}</Text>
              </View>
            </View>
          </View>
          <View style={styles.vehGrid}>
            <View style={styles.vehBox}>
              <Text style={styles.vehBoxLabel}>Vehicle Number</Text>
              <Text style={styles.vehBoxValue}>{dbData.vehicleNumber}</Text>
            </View>
            <View style={styles.vehBox}>
              <Text style={styles.vehBoxLabel}>Weight Limit</Text>
              <Text style={styles.vehBoxValue}>{dbData.weightLimit}</Text>
            </View>
          </View>
          <View style={styles.vehStatusBox}>
            <Text style={styles.vehBoxLabel}>Vehicle Status</Text>
            <View style={styles.rowCenter}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusTextGreen}>Active & Ready</Text>
            </View>
          </View>
        </View>
      );
    }

    // ── REFERRAL ──────────────────────────────────────────────────────
    else if (activeModal === 'referral') {
      content = (
        <View>
          <View style={styles.modalHeader}>
            <Feather name="gift" size={24} color="#D97706" />
            <Text style={styles.modalTitle}>Refer & Earn</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>Your Code</Text>
            <View style={styles.refRow}>
              <View style={styles.refCodeBox}><Text style={styles.refCodeText}>{dbData.referralCode}</Text></View>
              <TouchableOpacity onPress={() => { Clipboard.setString(dbData.referralCode); Alert.alert('Copied!', 'Referral code copied to clipboard.'); }} style={styles.refCopyBtn}>
                <Feather name="copy" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.refSub}>Share with your friends to earn!</Text>
          </View>
        </View>
      );
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────────
    else if (activeModal === 'notifications') {
      content = (
        <View>
          <View style={styles.modalHeader}>
            <Feather name="bell" size={24} color="#0284C7" />
            <Text style={styles.modalTitle}>Notifications</Text>
          </View>
          <View style={styles.notifList}>
            {Object.keys(notifSettings).map(key => (
              <View key={key} style={styles.notifRow}>
                <Text style={styles.notifLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <TouchableOpacity onPress={() => toggleNotif(key)} style={[styles.switchBtn, notifSettings[key] ? styles.switchOn : styles.switchOff]}>
                  <View style={[styles.switchKnob, notifSettings[key] ? styles.knobOn : styles.knobOff]} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // ── SUPPORT ───────────────────────────────────────────────────────
    else if (activeModal === 'support') {
      content = (
        <View>
          <View style={styles.modalHeader}>
            <Feather name="help-circle" size={24} color="#16A34A" />
            <Text style={styles.modalTitle}>Support</Text>
          </View>
          <View style={styles.suppList}>
            <TouchableOpacity style={styles.suppBtn}>
              <Text style={styles.suppBtnText}>FAQs</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.suppBtn}>
              <Text style={styles.suppBtnText}>Contact Support</Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <View style={styles.suppCallBox}>
              <Text style={styles.suppCallLabel}>24/7 Support Available</Text>
              <TouchableOpacity onPress={() => Linking.openURL('tel:+911800123456')}>
                <Text style={styles.suppCallNum}>1800-123-456</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // ── EMERGENCY ─────────────────────────────────────────────────────
    else if (activeModal === 'emergency') {
      content = (
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.modalHeader, { justifyContent: 'center' }]}>
            <Feather name="alert-circle" size={24} color="#DC2626" />
            <Text style={[styles.modalTitle, { color: '#DC2626', marginLeft: 8 }]}>Emergency SOS</Text>
          </View>
          <View style={styles.sosCard}>
            <Text style={styles.sosSub}>Pressing this will alert your emergency contacts instantly.</Text>
            <TouchableOpacity onPress={() => { Alert.alert('SOS Triggered!', 'Alerting emergency contacts.'); setActiveModal(null); }} style={styles.sosBtn}>
              <Feather name="phone" size={24} color="#FFF" />
              <Text style={styles.sosBtnText}>TRIGGER SOS</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sosLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('tel:112')} style={styles.sosLinkBtn}><Text style={styles.sosLinkText}>📞 Police (112)</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('tel:102')} style={styles.sosLinkBtn}><Text style={styles.sosLinkText}>🚑 Ambulance (102)</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <Modal transparent visible animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {content}
            </ScrollView>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtnPrimary}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0284C7" />
        <Text style={{ color: '#64748B', marginTop: 12, fontWeight: '600' }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>

        {/* Header Profile Info */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarBox}>
            {dbData.avatarUrl ? (
              <Image source={{ uri: dbData.avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <Feather name="user" size={40} color="#94A3B8" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.rowCenter}>
              <Text style={styles.profileName}>{dbData.fullName}</Text>
              {isPilot && <View style={{ marginLeft: 8 }}><NativeIcon name="crown" size={20} color="#F59E0B" /></View>}
            </View>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{dbData.rating.toFixed(1)} Rating</Text>
            </View>
            <Text style={styles.driverIdText}>Driver ID: #{dbData.driverId}</Text>
          </View>
        </View>

        {/* Top Stats Grid */}
        <View style={styles.topStatsGrid}>
          <View style={[styles.statHero, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={styles.rowCenter}>
              <Feather name="bar-chart-2" size={16} color="#2563EB" />
              <Text style={[styles.statHeroLabel, { color: '#2563EB' }]}>Total Stats</Text>
            </View>
            <Text style={[styles.statHeroValue, { color: '#1D4ED8' }]}>{dbData.todayOrders}</Text>
            <Text style={[styles.statHeroSub, { color: '#2563EB' }]}>Trips</Text>
          </View>
          <View style={[styles.statHero, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <View style={styles.rowCenter}>
              <Feather name="dollar-sign" size={16} color="#16A34A" />
              <Text style={[styles.statHeroLabel, { color: '#16A34A' }]}>Total Earnings</Text>
            </View>
            <Text style={[styles.statHeroValue, { color: '#15803D' }]}>₹{dbData.todayEarnings}</Text>
            <Text style={[styles.statHeroSub, { color: '#16A34A' }]}>Total</Text>
          </View>
        </View>

        {/* PILOT CARD */}
        <LinearGradient
          colors={isPilot ? ['#FEF3C7', '#FDE68A'] : ['#F8FAFC', '#F1F5F9']}
          style={[styles.pilotCard, isPilot ? styles.pilotCardActive : styles.pilotCardNormal]}
        >
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <View style={[styles.pilotIcon, isPilot ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#E2E8F0' }]}>
                <NativeIcon name="crown" size={24} color={isPilot ? "#FFF" : "#64748B"} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.pilotTitle, isPilot ? { color: '#B45309' } : { color: '#334155' }]}>{isPilot ? 'Pilot Partner' : 'Standard Partner'}</Text>
                <Text style={styles.pilotSub}>{currentWeeklyOrders} orders this week</Text>
              </View>
            </View>
            {isPilot ? (
              <View style={styles.pilotBadge}><Text style={styles.pilotBadgeText}>PILOT</Text></View>
            ) : (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pilotProgressLabel}>Progress</Text>
                <Text style={styles.pilotProgressValue}>{Math.round(progressPercent)}%</Text>
              </View>
            )}
          </View>
          <View style={styles.pilotTrack}>
            <View style={[styles.pilotFill, isPilot ? { backgroundColor: '#F59E0B', width: '100%' } : { backgroundColor: '#0284C7', width: `${progressPercent}%` }]} />
          </View>
          {isPilot ? (
            <View style={styles.rowCenter}>
              <Feather name="check-circle" size={16} color="#B45309" />
              <Text style={styles.pilotCongratsText}>Congratulations! You are a Pilot!</Text>
            </View>
          ) : (
            <Text style={styles.pilotNeedText}>{ordersNeededForPilot} more orders to become a Pilot!</Text>
          )}
        </LinearGradient>

        {/* AVIATION RANK */}
        <TouchableOpacity onPress={() => setActiveModal('achievements')} style={styles.rankBtn}>
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <Feather name="award" size={20} color="#9333EA" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.rankBtnTitle}>Aviation Rank</Text>
                <Text style={styles.rankBtnSub}>{currentRank.name} • View progression</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#9333EA" />
          </View>
        </TouchableOpacity>

        {/* VOICE TOGGLE */}
        <TouchableOpacity onPress={() => setIsVoiceOn(!isVoiceOn)} style={[styles.voiceBtn, isVoiceOn ? styles.voiceBtnOn : styles.voiceBtnOff]}>
          <View style={styles.rowCenter}>
            <Feather name={isVoiceOn ? 'volume-2' : 'volume-x'} size={18} color={isVoiceOn ? '#0284C7' : '#64748B'} />
            <Text style={[styles.voiceBtnText, isVoiceOn ? { color: '#0284C7' } : { color: '#64748B' }]}>Voice Narration</Text>
          </View>
          <View style={[styles.switchBtn, isVoiceOn ? styles.switchOn : styles.switchOff]}>
            <View style={[styles.switchKnob, isVoiceOn ? styles.knobOn : styles.knobOff]} />
          </View>
        </TouchableOpacity>

        {/* WALLET */}
        <TouchableOpacity onPress={() => setIsWalletOpen(true)} style={styles.walletBtn}>
          <View style={styles.rowCenter}>
            <View style={styles.walletIcon}><Feather name="credit-card" size={20} color="#FFF" /></View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.walletLabel}>WALLET BALANCE</Text>
              <Text style={styles.walletValue}>₹{dbData.walletBalance}</Text>
            </View>
          </View>
          <View style={styles.walletViewBtn}><Text style={styles.walletViewText}>View</Text></View>
        </TouchableOpacity>

        {/* LIST ACTIONS */}
        <View style={styles.actionList}>
          <TouchableOpacity onPress={() => setActiveModal('performance')} style={styles.actionItem}>
            <Feather name="trending-up" size={18} color="#64748B" /><Text style={styles.actionText}>Performance Graph</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('leaderboard')} style={styles.actionItem}>
            <Feather name="award" size={18} color="#64748B" /><Text style={styles.actionText}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('notifications')} style={styles.actionItem}>
            <Feather name="bell" size={18} color="#64748B" /><Text style={styles.actionText}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('vehicle')} style={styles.actionItem}>
            <NativeIcon name="truck" size={18} color="#64748B" /><Text style={styles.actionText}>Vehicle Info</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('docs')} style={styles.actionItem}>
            <Feather name="file-text" size={18} color="#64748B" /><Text style={styles.actionText}>Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('referral')} style={styles.actionItem}>
            <Feather name="gift" size={18} color="#64748B" /><Text style={styles.actionText}>Refer & Earn</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('bank')} style={styles.actionItem}>
            <NativeIcon name="card" size={18} color="#64748B" /><Text style={styles.actionText}>Bank Details</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('support')} style={[styles.actionItem, { borderColor: '#BBF7D0' }]}>
            <Feather name="help-circle" size={18} color="#16A34A" /><Text style={[styles.actionText, { color: '#16A34A' }]}>Help / Support</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveModal('emergency')} style={[styles.actionItem, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <Feather name="alert-circle" size={18} color="#DC2626" /><Text style={[styles.actionText, { color: '#DC2626' }]}>Emergency SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={[styles.actionItem, { marginTop: 32, borderWidth: 0 }]}>
            <Feather name="log-out" size={18} color="#EF4444" /><Text style={[styles.actionText, { color: '#EF4444' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      {renderModal()}

      {/* WALLET FULL-SCREEN MODAL */}
      <Modal visible={isWalletOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsWalletOpen(false)}>
        <WalletView onClose={() => setIsWalletOpen(false)} />
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — identical to original
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollPad: { padding: 20, paddingBottom: 60 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', elevation: 2 },
  profileInfo: { marginLeft: 16 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  ratingText: { color: '#F59E0B', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },
  driverIdText: { fontSize: 12, color: '#64748B' },
  topStatsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statHero: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  statHeroLabel: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  statHeroValue: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  statHeroSub: { fontSize: 12 },
  pilotCard: { padding: 20, borderRadius: 24, borderWidth: 2, marginBottom: 24, elevation: 1 },
  pilotCardActive: { borderColor: '#FCD34D' },
  pilotCardNormal: { borderColor: '#E2E8F0' },
  pilotIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  pilotTitle: { fontSize: 16, fontWeight: '900' },
  pilotSub: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  pilotBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pilotBadgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  pilotProgressLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  pilotProgressValue: { fontSize: 18, fontWeight: '900', color: '#334155' },
  pilotTrack: { height: 12, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 6, marginVertical: 12 },
  pilotFill: { height: 12, borderRadius: 6 },
  pilotCongratsText: { fontSize: 14, fontWeight: 'bold', color: '#B45309', marginLeft: 8 },
  pilotNeedText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  rankBtn: { backgroundColor: '#FAF5FF', padding: 16, borderRadius: 16, borderWidth: 2, borderColor: '#E9D5FF', marginBottom: 16 },
  rankBtnTitle: { fontWeight: 'bold', color: '#0F172A' },
  rankBtnSub: { fontSize: 12, fontWeight: 'bold', color: '#7E22CE' },
  voiceBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, borderWidth: 2, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voiceBtnOn: { backgroundColor: '#F0F9FF', borderColor: '#0284C7' },
  voiceBtnOff: { borderColor: '#E2E8F0' },
  voiceBtnText: { fontWeight: 'bold', marginLeft: 12 },
  switchBtn: { width: 40, height: 20, borderRadius: 10, justifyContent: 'center' },
  switchOn: { backgroundColor: '#0284C7' },
  switchOff: { backgroundColor: '#CBD5E1' },
  switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF' },
  knobOn: { transform: [{ translateX: 22 }] },
  knobOff: { transform: [{ translateX: 2 }] },
  walletBtn: { backgroundColor: '#0F172A', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, elevation: 4 },
  walletIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  walletLabel: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },
  walletValue: { fontSize: 20, color: '#FFF', fontWeight: '900' },
  walletViewBtn: { backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  walletViewText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  actionList: { gap: 12 },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0' },
  actionText: { fontWeight: 'bold', color: '#475569', marginLeft: 12, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: height * 0.85 },
  modalHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 8 },
  closeBtnPrimary: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  rankHeroCard: { padding: 20, borderRadius: 16, marginBottom: 24 },
  rankSubText: { fontSize: 12, fontWeight: 'bold', opacity: 0.8 },
  rankHeroText: { fontSize: 24, fontWeight: '900' },
  rankHeroIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  progressBarBgLight: { height: 12, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 6, marginVertical: 8 },
  progressBarFillLight: { height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#0F172A' },
  pathContainer: { marginLeft: 16 },
  pathRow: { flexDirection: 'row', marginBottom: 24, position: 'relative' },
  pathLine: { position: 'absolute', left: 15, top: 32, bottom: -24, width: 2, backgroundColor: '#E2E8F0' },
  pathDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFF', zIndex: 10 },
  pathCard: { flex: 1, marginLeft: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  pathCardTitle: { fontSize: 16, fontWeight: 'bold' },
  currentBadge: { backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 10, fontWeight: 'bold' },
  pathCardSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
  tabActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  tabInactive: { borderColor: '#E2E8F0' },
  tabText: { fontWeight: 'bold', textTransform: 'capitalize' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  statLabel: { fontSize: 10, fontWeight: 'bold' },
  statValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  graphCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 20, height: 200 },
  graphContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  barCol: { alignItems: 'center', flex: 1 },
  barWrap: { width: '60%', height: '100%', justifyContent: 'flex-end' },
  barFill: { backgroundColor: '#0284C7', borderTopLeftRadius: 4, borderTopRightRadius: 4, width: '100%' },
  barLabel: { fontSize: 10, color: '#64748B', fontWeight: 'bold', marginTop: 8 },
  leaderboardList: { maxHeight: 400 },
  leaderCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  leaderCardMe: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  leaderCardNormal: { backgroundColor: '#FFF', borderColor: '#E2E8F0' },
  rankBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankTop: { backgroundColor: '#D97706' },
  rankNormal: { backgroundColor: '#F1F5F9' },
  rankNum: { fontWeight: '900', color: '#475569' },
  leaderName: { fontWeight: 'bold', fontSize: 16, color: '#0F172A' },
  leaderStats: { fontSize: 12, color: '#64748B' },
  rankDisplay: { fontSize: 14, fontWeight: 'bold', color: '#94A3B8' },
  docList: { gap: 12 },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  docName: { fontWeight: 'bold', fontSize: 14, color: '#0F172A' },
  docSub: { fontSize: 12, color: '#64748B' },
  docBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  docBtnText: { color: '#0284C7', fontSize: 10, fontWeight: 'bold' },
  docMissing: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  docMissingText: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
  bankCardBg: { backgroundColor: '#0F172A', padding: 24, borderRadius: 16, marginBottom: 16 },
  bankLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' },
  bankAccNum: { fontSize: 24, fontWeight: '900', color: '#FFF', marginVertical: 24, letterSpacing: 2 },
  bankSubLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  bankSubValue: { fontSize: 14, color: '#FFF', fontWeight: 'bold' },
  bankDetailsBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16 },
  bankBoxTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 12, textTransform: 'uppercase' },
  bankRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 },
  bankIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bankRowLabel: { fontSize: 12, color: '#64748B' },
  bankRowValue: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  vehCardHero: { backgroundColor: '#EFF6FF', padding: 20, borderRadius: 16, borderColor: '#BFDBFE', borderWidth: 2, marginBottom: 16 },
  vehHeroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  vehHeroLabel: { fontSize: 12, fontWeight: 'bold', color: '#1D4ED8' },
  vehHeroValue: { fontSize: 18, fontWeight: '900', color: '#1E3A8A', textTransform: 'capitalize' },
  vehGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  vehBox: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16 },
  vehBoxLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 4 },
  vehBoxValue: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  vehStatusBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16 },
  statusDotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 },
  statusTextGreen: { fontSize: 14, fontWeight: 'bold', color: '#16A34A' },
  refCard: { backgroundColor: '#FFFBEB', padding: 24, borderRadius: 16, borderWidth: 2, borderColor: '#FDE68A', marginBottom: 16 },
  refLabel: { fontSize: 14, fontWeight: 'bold', color: '#B45309', marginBottom: 8 },
  refRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  refCodeBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center' },
  refCodeText: { fontSize: 24, fontWeight: '900', color: '#D97706', letterSpacing: 2 },
  refCopyBtn: { backgroundColor: '#D97706', padding: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  refSub: { fontSize: 12, color: '#D97706' },
  notifList: { gap: 12 },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  notifLabel: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', textTransform: 'capitalize' },
  suppList: { gap: 12 },
  suppBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  suppBtnText: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  suppCallBox: { backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  suppCallLabel: { fontSize: 14, fontWeight: 'bold', color: '#15803D', marginBottom: 8 },
  suppCallNum: { fontSize: 24, fontWeight: '900', color: '#16A34A' },
  sosCard: { backgroundColor: '#FEF2F2', padding: 24, borderRadius: 16, borderWidth: 2, borderColor: '#FECACA', marginBottom: 16, alignItems: 'center', width: '100%' },
  sosSub: { fontSize: 14, color: '#B91C1C', textAlign: 'center', marginBottom: 16 },
  sosBtn: { backgroundColor: '#DC2626', width: '100%', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  sosBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  sosLinks: { gap: 8, width: '100%' },
  sosLinkBtn: { padding: 16, backgroundColor: '#F1F5F9', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  sosLinkText: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
});
