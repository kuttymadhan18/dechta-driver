import React from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, SafeAreaView, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

interface PrimePartnerProps {
    isOpen: boolean;
    onClose: () => void;
    weeklyOrders: number;
}

export default function PrimePartnerView({ isOpen, onClose, weeklyOrders }: PrimePartnerProps) {
    // PILOT TARGET LOGIC
    const targetOrders = 50; 
    const isPilot = weeklyOrders >= targetOrders;
    const progressPercent = Math.min(100, (weeklyOrders / targetOrders) * 100);
    const remaining = Math.max(0, targetOrders - weeklyOrders);

    const benefits = [
        { id: 1, title: 'Higher Earnings', desc: 'Earn up to 15% more on every delivery.', icon: 'bar-chart-2', unlocked: isPilot },
        { id: 2, title: 'Priority Support', desc: 'Skip the queue with a dedicated helpline.', icon: 'phone-call', unlocked: isPilot },
        { id: 3, title: 'Health Insurance', desc: 'Free medical cover up to ₹2 Lakhs.', icon: 'activity', unlocked: isPilot },
        { id: 4, title: 'Zero Cancellation Penalty', desc: 'Cancel up to 2 orders/week penalty-free.', icon: 'shield', unlocked: isPilot },
    ];

    return (
        <Modal visible={isOpen} animationType="slide" transparent={false}>
            <View style={styles.container}>
                
                {/* ═══════════════════════════════════════════════════════════════════════════
                    GOLDEN HEADER
                ═══════════════════════════════════════════════════════════════════════════ */}
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.headerGradient}>
                    <SafeAreaView>
                        <View style={styles.headerTopRow}>
                            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                                <Feather name="arrow-left" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <View style={styles.brandBadge}>
                                <Text style={styles.brandBadgeText}>QC LOGISTICS</Text>
                            </View>
                            <View style={{ width: 40 }} /> {/* Spacer for alignment */}
                        </View>

                        <View style={styles.headerCenter}>
                            <View style={styles.crownBox}>
                                <Feather name="award" size={40} color="#FDE047" />
                            </View>
                            <Text style={styles.headerTitle}>Pilot Partner</Text>
                            <Text style={styles.headerSub}>Unlock exclusive benefits and maximum earnings.</Text>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                    
                    {/* ═══════════════════════════════════════════════════════════════════════════
                        PROGRESS CARD (Overlaps the header)
                    ═══════════════════════════════════════════════════════════════════════════ */}
                    <View style={styles.progressCard}>
                        <View style={styles.progressTopRow}>
                            <View>
                                <Text style={styles.statusLabel}>CURRENT STATUS</Text>
                                <Text style={[styles.statusValue, isPilot ? {color: '#F59E0B'} : {color: '#0F172A'}]}>
                                    {isPilot ? 'Active Pilot' : 'Standard Partner'}
                                </Text>
                            </View>
                            <View style={{alignItems: 'flex-end'}}>
                                <Text style={styles.ordersCount}>{weeklyOrders}</Text>
                                <Text style={styles.ordersTotal}>/{targetOrders} trips</Text>
                            </View>
                        </View>

                        <View style={styles.progressBarBg}>
                            <LinearGradient 
                                colors={isPilot ? ['#FBBF24', '#D97706'] : ['#38BDF8', '#2563EB']} 
                                style={[styles.progressBarFill, { width: `${progressPercent}%` }]} 
                            />
                        </View>

                        <Text style={styles.progressFooterText}>
                            {isPilot 
                                ? "🎉 You've unlocked Pilot benefits for this week!" 
                                : `Complete ${remaining} more trips before Sunday to unlock Pilot benefits.`}
                        </Text>
                    </View>

                    {/* ═══════════════════════════════════════════════════════════════════════════
                        BENEFITS LIST
                    ═══════════════════════════════════════════════════════════════════════════ */}
                    <Text style={styles.sectionTitle}>Pilot Benefits</Text>
                    
                    <View style={styles.benefitsList}>
                        {benefits.map(benefit => (
                            <View key={benefit.id} style={[styles.benefitCard, benefit.unlocked ? styles.benefitUnlocked : styles.benefitLocked]}>
                                <View style={styles.rowCenter}>
                                    {/* Icon Box */}
                                    <View style={[styles.iconBox, benefit.unlocked ? styles.iconBoxUnlocked : styles.iconBoxLocked]}>
                                        {benefit.unlocked ? (
                                            <LinearGradient colors={['#FBBF24', '#F97316']} style={styles.iconGradient}>
                                                <Feather name={benefit.icon as any} size={20} color="#FFF" />
                                            </LinearGradient>
                                        ) : (
                                            <Feather name={benefit.icon as any} size={20} color="#94A3B8" />
                                        )}
                                    </View>
                                    
                                    {/* Text Content */}
                                    <View style={styles.benefitTextCont}>
                                        <View style={styles.rowBetween}>
                                            <Text style={[styles.benefitTitle, benefit.unlocked ? {color: '#78350F'} : {color: '#0F172A'}]}>
                                                {benefit.title}
                                            </Text>
                                            {benefit.unlocked && (
                                                <View style={styles.activeBadge}>
                                                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    rowCenter: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    // Header
    headerGradient: { borderBottomLeftRadius: 48, borderBottomRightRadius: 48, paddingBottom: 40, paddingTop: Platform.OS === 'android' ? 40 : 0 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    brandBadge: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    brandBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    headerCenter: { alignItems: 'center', marginTop: 20 },
    crownBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    headerTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', marginBottom: 4 },
    headerSub: { fontSize: 14, color: '#FEF3C7', fontWeight: '500' },

    scrollArea: { flex: 1, paddingHorizontal: 20 },

    // Progress Card (Overlapping)
    progressCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginTop: -30, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 24 },
    progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    statusLabel: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
    statusValue: { fontSize: 20, fontWeight: '900' },
    ordersCount: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    ordersTotal: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8' },
    
    progressBarBg: { height: 16, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
    progressBarFill: { height: '100%', borderRadius: 8 },
    progressFooterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

    // Benefits
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 16, marginLeft: 4 },
    benefitsList: { gap: 12, paddingBottom: 40 },
    benefitCard: { padding: 16, borderRadius: 20, borderWidth: 2 },
    benefitUnlocked: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    benefitLocked: { backgroundColor: '#FFF', borderColor: '#F1F5F9', opacity: 0.8 },
    
    iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    iconBoxUnlocked: { backgroundColor: 'transparent' }, // Handled by gradient child
    iconBoxLocked: { backgroundColor: '#F1F5F9' },
    iconGradient: { width: '100%', height: '100%', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    
    benefitTextCont: { flex: 1 },
    benefitTitle: { fontSize: 15, fontWeight: 'bold' },
    benefitDesc: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },
    
    activeBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    activeBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});