import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, 
  Modal, Animated, Easing, Dimensions, Alert, Image, Platform, ActivityIndicator
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import PrimePartnerView from '../../components/PrimePartnerView';

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// ORIGINAL REACT UI: NEW ORDER SIDE-DRAWER
// ═══════════════════════════════════════════════════════════════════════════
function NewOrderPopup({ order, isPrime, onAccept, onDecline }: any) {
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(!isPrime ? 10 : 0);
  
  // Animations
  const slideAnim = useRef(new Animated.Value(width)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in from Right
    Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }).start();
    
    // Bouncing Icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 500, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 500, useNativeDriver: true })
      ])
    ).start();

    const timer = setTimeout(() => setIsLoading(false), 800); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isLoading, timeLeft]);

  const displayData = {
    id: order?.id || 'Unknown',
    type: order?.product_name || order?.type || 'New Order',
    distance: order?.distance || 'Calculated at pickup',
    payout: order?.delivery_fee || order?.total_amount || 0,
    pickup: order?.vendor_shop_name || order?.pickup_address || 'Pickup Location',
    drop: order?.delivery_address || order?.client_address || 'Drop Location',
    paymentType: 'CASH',
    reqBody: order?.body_type_requested || 'Any',
  };

  return (
    <Modal transparent visible={!!order} animationType="fade">
      <View style={styles.modalOverlayRight}>
        
        {/* Right Side Drawer */}
        <Animated.View style={[styles.drawerContent, { transform: [{ translateX: slideAnim }] }]}>
          <TouchableOpacity onPress={() => onDecline(order?.id)} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#64748b" />
          </TouchableOpacity>

          {isLoading ? (
            <View style={styles.loadingView}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
              
              {/* Header Icon & Title */}
              <View style={styles.popupHeader}>
                <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
                    <LinearGradient colors={['#60A5FA', '#0284C7']} style={styles.orderIconBox}>
                        <Feather name="package" size={32} color="#fff" />
                    </LinearGradient>
                </Animated.View>
                <Text style={styles.orderPopupTitle}>New Order Available!</Text>
                
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabelText}>Partner Status: </Text>
                    {isPrime ? (
                        <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.primeBadge}>
                            <Feather name="star" size={10} color="#FFF" style={{marginRight: 4}}/>
                            <Text style={styles.primeBadgeText}>PRIME</Text>
                        </LinearGradient>
                    ) : (
                        <View style={styles.normalBadge}>
                            <Text style={styles.normalBadgeText}>NORMAL</Text>
                        </View>
                    )}
                </View>

                {/* Wait Timer Boxes */}
                {!isPrime && timeLeft > 0 && (
                  <View style={styles.waitBoxAmber}>
                    <Text style={styles.waitBoxTitleAmber}>⏳ Please Wait</Text>
                    <Text style={styles.waitBoxTextAmber}>Normal partners must wait <Text style={{fontWeight:'900', fontSize: 16}}>{timeLeft}</Text> seconds</Text>
                  </View>
                )}
                {!isPrime && timeLeft === 0 && (
                  <View style={styles.waitBoxGreen}>
                    <Text style={styles.waitBoxTitleGreen}>✓ You can now respond to this order</Text>
                  </View>
                )}
              </View>

              {/* Order Details Card */}
              <View style={styles.orderDetailsCard}>
                <View style={styles.orderRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.orderType}>{displayData.type}</Text>
                    <Text style={styles.orderDistance}>{displayData.distance} • {displayData.reqBody} Body</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.orderPayout}>₹{displayData.payout}</Text>
                    <Text style={styles.orderPaymentType}>{displayData.paymentType}</Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <View style={styles.pickupDot}><Feather name="map-pin" size={12} color="#475569" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationLabel}>Pickup Location</Text>
                    <Text style={styles.locationText} numberOfLines={2}>{displayData.pickup}</Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <View style={styles.dropDot}><Feather name="map-pin" size={12} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationLabel}>Drop Location</Text>
                    <Text style={styles.locationText} numberOfLines={2}>{displayData.drop}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons (Red / Green) */}
              <View style={[styles.actionRow, timeLeft > 0 && !isPrime && { opacity: 0.5 }]} pointerEvents={timeLeft > 0 && !isPrime ? 'none' : 'auto'}>
                <TouchableOpacity onPress={() => onDecline(order?.id)} style={styles.declineBtn}>
                  <Feather name="x-circle" size={18} color="#DC2626" style={{marginRight: 6}} />
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onAccept(order?.id)} style={{flex: 1}}>
                    <LinearGradient colors={['#22C55E', '#059669']} style={styles.acceptBtn}>
                        <Feather name="check" size={18} color="#fff" style={{marginRight: 6}} />
                        <Text style={styles.acceptText}>Accept</Text>
                    </LinearGradient>
                </TouchableOpacity>
              </View>

            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  const [ringingOrder, setRingingOrder] = useState<any>(null); 
  const [currentSlide, setCurrentSlide] = useState(0);

  // Modals
  const [showLangModal, setShowLangModal] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrimeModal, setShowPrimeModal] = useState(false);
  
  // 🔥 NEW: Custom Offline Confirmation Modal State
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  
  const [todayStats, setTodayStats] = useState({ orders: 4, earnings: 850 });
  const [weeklyOrders, setWeeklyOrders] = useState(12);
  const driverName = "Partner";

  const alerts = [
      { id: '1', type: 'offer', title: 'Welcome to QC Logistics! 🎉', message: 'Complete your first 5 trips today to earn a ₹500 joining bonus.', time: 'Just now', read: false }
  ];

  // Promo Slider Images
  const promoMedia = [
    'https://images.unsplash.com/photo-1611590027211-b954fd027b51?q=80&w=1000',
    'https://th.bing.com/th/id/R.e7d3424217ab8a605c53806b52225001'
  ];

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -2, duration: 400, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 400, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
        Animated.timing(slideAnim, { toValue: -20, duration: 600, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const slideInterval = setInterval(() => setCurrentSlide((prev) => (prev + 1) % promoMedia.length), 4000); 
    return () => clearInterval(slideInterval);
  }, []);

  // 🔥 UPDATED: Toggle Online Action
  const toggleOnline = () => {
    if (isOnline) {
      // Show Interactive UI Modal instead of system alert
      setShowOfflineConfirm(true);
    } else {
      // Go online directly
      setIsOnline(true);
      setTimeout(() => {
          setRingingOrder({ id: '999', type: 'Package Delivery', payout: 250, distance: '5.2 km', pickup: 'Guindy', drop: 'Velachery' });
      }, 3000);
    }
  };

  // 🔥 NEW: Execute Offline Action
  const confirmGoOffline = () => {
      setIsOnline(false);
      setShowOfflineConfirm(false);
  };

  // 🔥 NEW: Instantly routes to Orders tab and passes the accepted order!
  const acceptOrder = (id: string) => {
    const acceptedOrder = ringingOrder;
    setRingingOrder(null);
    
    // Jump to the orders tab and pass the order data invisibly
    router.push({
        pathname: '/orders',
        params: { incomingOrder: JSON.stringify(acceptedOrder) }
    });
  };

  const currentOrders = todayStats.orders;
  const dailyMilestones = [{ t: 0, r: 0 }, { t: 5, r: 50 }, { t: 10, r: 100 }, { t: 15, r: 250 }, { t: 20, r: 500 }];
  const dailyProgress = Math.min(100, (currentOrders / 20) * 100);
  const isPrimePartner = weeklyOrders >= 50; 

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.container, theme.container]}>
      
      {/* HEADER */}
      <View style={[styles.header, theme.header]}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#38BDF8', '#2563EB']} style={styles.logoBox}>
            <Text style={styles.logoText}>QC</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.greetingText, theme.text]}>Hi, {driverName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#94a3b8' }]} />
              <Text style={[styles.statusText, theme.subText]}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleOnline} style={[styles.toggleSwitch, isOnline ? { backgroundColor: '#22c55e' } : { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]}>
            <View style={styles.toggleLabels}>
                <Text style={[styles.toggleLabelText, isOnline ? {opacity: 1} : {opacity: 0}]}>ON</Text>
                <Text style={[styles.toggleLabelText, !isOnline ? {opacity: 1} : {opacity: 0}]}>OFF</Text>
            </View>
            <View style={[styles.toggleKnob, isOnline ? { transform: [{ translateX: 28 }] } : { transform: [{ translateX: 2 }] }]}>
              <Feather name="power" size={12} color={isOnline ? '#22c55e' : '#94a3b8'} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowLangModal(true)} style={[styles.iconBtn, theme.input]}>
            <Feather name="globe" size={18} color={isDark ? '#cbd5e1' : '#475569'} />
            <View style={styles.langBadge}><Text style={styles.langBadgeText}>{currentLang}</Text></View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsDark(!isDark)}>
            <LinearGradient colors={isDark ? ['#4f46e5', '#9333ea'] : ['#fbbf24', '#f97316']} style={styles.themeBtn}>
              <Feather name={isDark ? 'moon' : 'sun'} size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowNotifications(true)} style={[styles.iconBtn, theme.input]}>
             <Feather name="bell" size={18} color={isDark ? '#cbd5e1' : '#475569'} />
             <View style={styles.notifBadge}><Text style={styles.langBadgeText}>1</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HERO TRUCK BANNER */}
        <LinearGradient colors={isDark ? ['#1e293b', '#0f172a'] : ['#38bdf8', '#2563eb']} style={styles.heroCard}>
          <Feather name={isDark ? "moon" : "sun"} size={32} color={isDark ? '#cbd5e1' : '#fde047'} style={styles.celestial} />
          <Feather name="cloud" size={40} color="rgba(255,255,255,0.2)" style={{position: 'absolute', top: 30, right: 80}} />

          <View style={styles.heroStats}>
            <Text style={styles.heroStatsLabel}>Today's Earnings</Text>
            <Text style={styles.heroStatsValue}>₹{todayStats.earnings}</Text>
          </View>

          <View style={styles.heroTripsBadge}>
            <Text style={styles.heroTripsText}>{todayStats.orders} Trips</Text>
          </View>

          <View style={styles.roadContainer}>
              <Animated.View style={[styles.roadLine, { transform: [{ translateX: slideAnim }] }]} />
          </View>

          <Animated.View style={[styles.nativeTruck, { transform: [{ translateY: bounceAnim }] }]}>
            <View style={{flexDirection: 'row', alignItems: 'flex-end'}}>
                <View style={styles.truckTrailer}>
                    <View style={styles.trailerStripe} />
                    <Text style={styles.trailerText}>QC LOGISTICS</Text>
                </View>
                <View style={styles.truckCab}>
                    <View style={styles.truckWindow} />
                </View>
                <View style={[styles.truckWheel, {left: 10}]}><View style={styles.wheelRim}/></View>
                <View style={[styles.truckWheel, {left: 45}]}><View style={styles.wheelRim}/></View>
                <View style={[styles.truckWheel, {right: 5}]}><View style={styles.wheelRim}/></View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* DAILY TARGET CARD */}
        <View style={[styles.card, theme.card]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LinearGradient colors={['#34D399', '#059669']} style={styles.targetIcon}>
                <Feather name="check" size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={[styles.cardTitle, theme.text]}>Daily Target</Text>
                <Text style={theme.subText}>Earn extra cash today!</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.targetCount}>{currentOrders}</Text>
              <Text style={styles.targetLabel}>TRIPS</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBg, theme.input]} />
            <LinearGradient colors={['#34D399', '#10B981']} style={[styles.progressBarFill, { width: `${dailyProgress}%` }]} />
            
            <View style={styles.milestonesRow}>
              {dailyMilestones.map((ms, i) => {
                const reached = currentOrders >= ms.t;
                return (
                  <View key={i} style={styles.milestone}>
                    <View style={[styles.milestoneDot, reached ? styles.milestoneDotReached : theme.card, { borderColor: reached ? '#fff' : (isDark ? '#334155' : '#e2e8f0') }]}>
                      {reached && <Feather name="check" size={8} color="#fff" />}
                    </View>
                    <Text style={[styles.milestoneText, reached ? { color: '#10b981' } : theme.subText]}>{ms.t === 0 ? 'Start' : ms.t}</Text>
                    {ms.r > 0 && <Text style={[styles.milestoneReward, reached ? theme.text : theme.subText]}>₹{ms.r}</Text>}
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        {/* PROMO SLIDER */}
        <View style={styles.promoSlider}>
          <Image source={{ uri: promoMedia[currentSlide] }} style={styles.promoImg} />
          <View style={styles.sliderDots}>
            <View style={[styles.dot, currentSlide === 0 && styles.dotActive]} />
            <View style={[styles.dot, currentSlide === 1 && styles.dotActive]} />
          </View>
        </View>

        {/* WEEKLY BONUS */}
        <TouchableOpacity onPress={() => setShowPrimeModal(true)} activeOpacity={0.9}>
            <LinearGradient colors={['#FBBF24', '#F97316', '#EF4444']} style={styles.weeklyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Feather name="award" size={24} color="#fff" />
                <View>
                <Text style={styles.weeklyTitle}>Prime Partner Status</Text>
                <Text style={styles.weeklySub}>Orders This Week: {weeklyOrders}/50</Text>
                </View>
            </View>
            <View style={styles.weeklyBarBg}>
                <View style={[styles.weeklyBarFill, { width: `${Math.min(100, (weeklyOrders/50)*100)}%` }]} />
            </View>
            <Text style={styles.weeklyText}>Tap to view your Pilot benefits!</Text>
            </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* 🔥 NEW: Custom Interactive Offline Confirmation Modal */}
      <Modal visible={showOfflineConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.offlineModalContent, theme.card]}>
            <View style={styles.offlineIconBox}>
              <Feather name="power" size={32} color="#EF4444" />
            </View>
            
            <Text style={[styles.offlineTitle, theme.text]}>Go Offline?</Text>
            <Text style={styles.offlineSub}>You will stop receiving new delivery requests and miss out on potential earnings today.</Text>
            
            <View style={{ width: '100%', gap: 12, marginTop: 24 }}>
              <TouchableOpacity onPress={() => setShowOfflineConfirm(false)} style={styles.stayOnlineBtn}>
                <Text style={styles.stayOnlineText}>Stay Online</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={confirmGoOffline} style={styles.goOfflineBtn}>
                <Text style={styles.goOfflineText}>Yes, Go Offline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.langModalContent, theme.card]}>
            <Text style={[styles.langModalTitle, theme.text]}>Select Language</Text>
            {['en', 'ta', 'hi'].map(lang => (
              <TouchableOpacity key={lang} onPress={() => { setCurrentLang(lang); setShowLangModal(false); }} style={[styles.langBtn, theme.input]}>
                <Text style={[styles.langBtnText, theme.text]}>{lang === 'en' ? 'English 🇺🇸' : lang === 'ta' ? 'தமிழ் 🇮🇳' : 'हिंदी 🇮🇳'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowLangModal(false)} style={{ marginTop: 16 }}><Text style={theme.subText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} transparent animationType="slide">
         <View style={styles.notifOverlay}>
             <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowNotifications(false)} />
             <View style={[styles.notifPanel, theme.card]}>
                 <View style={[styles.notifHeader, {borderBottomColor: isDark ? '#334155' : '#E2E8F0'}]}>
                     <Text style={[styles.notifTitle, theme.text]}>Alerts & Offers</Text>
                     <TouchableOpacity onPress={() => setShowNotifications(false)}>
                         <Feather name="x" size={24} color="#64748B" />
                     </TouchableOpacity>
                 </View>
                 <ScrollView style={{padding: 16}}>
                     {alerts.map(a => (
                         <View key={a.id} style={[styles.alertBox, theme.input, {borderColor: isDark ? '#334155' : '#E2E8F0'}]}>
                             <View style={styles.alertIcon}><Feather name="gift" size={18} color="#D97706" /></View>
                             <View style={{flex: 1, marginLeft: 12}}>
                                 <Text style={[styles.alertTitle, theme.text]}>{a.title}</Text>
                                 <Text style={styles.alertSub}>{a.message}</Text>
                             </View>
                         </View>
                     ))}
                 </ScrollView>
             </View>
         </View>
      </Modal>

      {/* Original Side-Drawer Order Popup */}
      {ringingOrder && (
        <NewOrderPopup 
            order={ringingOrder} 
            isPrime={isPrimePartner} 
            onAccept={acceptOrder} 
            onDecline={() => setRingingOrder(null)} 
        />
      )}

      {/* Prime Partner View */}
      <PrimePartnerView 
          isOpen={showPrimeModal} 
          onClose={() => setShowPrimeModal(false)} 
          weeklyOrders={weeklyOrders} 
      />

    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PURE HOME DASHBOARD STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  
  // Header
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }] },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  greetingText: { fontSize: 14, fontWeight: 'bold' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  toggleSwitch: { width: 60, height: 34, borderRadius: 17, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 2} },
  toggleLabels: { position: 'absolute', width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  toggleLabelText: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  toggleKnob: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 },
  
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  themeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  langBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#0284c7', paddingHorizontal: 4, borderRadius: 8 },
  langBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  heroCard: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden', marginBottom: 20, elevation: 5, shadowColor: '#0284c7', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width:0, height:5} },
  celestial: { position: 'absolute', right: 16, top: 16 },
  heroStats: { position: 'absolute', top: 16, left: 16 },
  heroStatsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  heroStatsValue: { color: '#fff', fontSize: 36, fontWeight: '900' },
  heroTripsBadge: { position: 'absolute', right: 16, top: 60, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroTripsText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  roadContainer: { position: 'absolute', bottom: 0, width: '100%', height: 50, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', overflow: 'hidden' },
  roadLine: { width: '200%', height: 0, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed' },
  nativeTruck: { position: 'absolute', bottom: 15, left: 25 },
  truckTrailer: { width: 70, height: 45, backgroundColor: '#F8FAFC', borderTopLeftRadius: 8, borderTopRightRadius: 2, borderBottomWidth: 5, borderBottomColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  trailerStripe: { position: 'absolute', top: 15, width: '100%', height: 8, backgroundColor: '#0284C7' },
  trailerText: { fontSize: 7, fontWeight: '900', color: '#FFF', zIndex: 10, marginTop: 4 },
  truckCab: { width: 25, height: 35, backgroundColor: '#CBD5E1', borderTopRightRadius: 8, borderBottomRightRadius: 4 },
  truckWindow: { width: 12, height: 14, backgroundColor: '#334155', marginTop: 4, marginLeft: 10, borderTopRightRadius: 4, borderBottomLeftRadius: 2 },
  truckWheel: { position: 'absolute', bottom: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  wheelRim: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' },

  card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  targetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  targetCount: { fontSize: 24, fontWeight: '900', color: '#10b981' },
  targetLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  progressContainer: { position: 'relative', paddingTop: 10, paddingBottom: 10 },
  progressBarBg: { position: 'absolute', top: 20, left: 10, right: 10, height: 6, borderRadius: 3 },
  progressBarFill: { position: 'absolute', top: 20, left: 10, height: 6, borderRadius: 3 },
  milestonesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  milestone: { alignItems: 'center', zIndex: 10 },
  milestoneDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  milestoneDotReached: { backgroundColor: '#10b981', borderColor: '#fff' },
  milestoneText: { fontSize: 10, fontWeight: 'bold', marginTop: 8 },
  milestoneReward: { fontSize: 10, fontWeight: '900' },

  promoSlider: { width: '100%', height: 180, borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  promoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  sliderDots: { position: 'absolute', bottom: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 24, backgroundColor: '#fff' },

  weeklyCard: { padding: 20, borderRadius: 24, marginBottom: 20 },
  weeklyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  weeklySub: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  weeklyBarBg: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, marginBottom: 12 },
  weeklyBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 5 },
  weeklyText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Base Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  
  // Offline Confirmation Modal Styles
  offlineModalContent: { width: '85%', maxWidth: 360, padding: 24, borderRadius: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 15 },
  offlineIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  offlineTitle: { fontSize: 24, fontWeight: 'black', marginBottom: 8, textAlign: 'center' },
  offlineSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  stayOnlineBtn: { width: '100%', backgroundColor: '#0284C7', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#0284C7', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  stayOnlineText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  goOfflineBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderColor: '#FECACA' },
  goOfflineText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 },

  langModalContent: { width: '85%', padding: 24, borderRadius: 24, alignItems: 'center' },
  langModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  langBtn: { width: '100%', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  langBtnText: { fontSize: 16, fontWeight: 'bold' },

  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  notifPanel: { width: '85%', maxWidth: 360, height: '100%', borderTopLeftRadius: 24, borderBottomLeftRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  notifTitle: { fontSize: 18, fontWeight: 'bold' },
  alertBox: { flexDirection: 'row', padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  alertIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 14, fontWeight: 'bold' },
  alertSub: { fontSize: 12, color: '#64748B', marginTop: 4 },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXACT ORIGINAL NEW ORDER POPUP (SIDE DRAWER) STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  modalOverlayRight: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', justifyContent: 'flex-end' },
  drawerContent: { width: '85%', maxWidth: 400, height: '100%', backgroundColor: '#fff', borderTopLeftRadius: 32, borderBottomLeftRadius: 32, padding: 24, paddingTop: Platform.OS === 'ios' ? 50 : 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
  closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 24, right: 24, zIndex: 10, width: 40, height: 40, backgroundColor: '#F1F5F9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontWeight: 'bold', marginTop: 16 },

  popupHeader: { alignItems: 'center', marginBottom: 20, marginTop: 20 },
  orderIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#0284C7', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  orderPopupTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statusLabelText: { fontSize: 14, color: '#64748B' },
  primeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginLeft: 8, shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 5, elevation: 3 },
  primeBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  normalBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  normalBadgeText: { color: '#475569', fontSize: 12, fontWeight: 'bold' },
  
  waitBoxAmber: { backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#FDE68A' },
  waitBoxTitleAmber: { color: '#B45309', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  waitBoxTextAmber: { color: '#D97706', fontSize: 12 },
  waitBoxGreen: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#BBF7D0' },
  waitBoxTitleGreen: { color: '#16A34A', fontWeight: 'bold', fontSize: 14 },
  
  orderDetailsCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  orderType: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  orderDistance: { fontSize: 14, color: '#64748B' },
  orderPayout: { fontSize: 28, fontWeight: '900', color: '#16A34A' },
  orderPaymentType: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' },
  
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  pickupDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  dropDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  locationLabel: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
  locationText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  declineBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: '#FECACA', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: '#FFF' },
  declineText: { color: '#DC2626', fontWeight: 'bold', fontSize: 16 },
  acceptBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#22C55E', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  acceptText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

// Themes
const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  input: { backgroundColor: '#f1f5f9' },
  text: { color: '#0f172a' },
  subText: { color: '#64748b' },
});
const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  header: { backgroundColor: '#1e293b', borderBottomColor: '#334155' },
  card: { backgroundColor: '#1e293b', borderColor: '#334155' },
  input: { backgroundColor: '#0f172a' },
  text: { color: '#f8fafc' },
  subText: { color: '#94a3b8' },
});