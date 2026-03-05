import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, 
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, Keyboard 
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    driverName?: string;
    vehicleNumber?: string;
    onCallCustomer: () => void;
}

export default function ChatModal({ isOpen, onClose, driverName = "Partner", vehicleNumber = "TN-01-AB-1234", onCallCustomer }: ChatModalProps) {
    const [inputText, setInputText] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    // Mock Messages for UI Testing
    const [messages, setMessages] = useState([
        { id: '1', text: 'Hello, I have reached the location.', sender_type: 'driver', time: '10:30 AM' },
        { id: '2', text: 'Okay, coming down in 2 minutes!', sender_type: 'customer', time: '10:31 AM' }
    ]);

    const quickReplies = [
        'Are you coming?',
        'Waiting at pickup 📍',
        'My location is as per map 🗺️',
        'Message when reached 💬'
    ];

    // Auto-scroll to bottom when messages change or keyboard opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, isOpen]);

    const handleSend = (text: string) => {
        if (!text.trim()) return;
        
        const newMessage = {
            id: Date.now().toString(),
            text: text.trim(),
            sender_type: 'driver',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        Keyboard.dismiss();
    };

    return (
        <Modal visible={isOpen} animationType="slide" transparent>
            <SafeAreaView style={styles.modalContainer}>
                <KeyboardAvoidingView 
                    style={styles.keyboardView} 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                                <Feather name="chevron-down" size={24} color="#64748B" />
                            </TouchableOpacity>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{driverName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View>
                                <Text style={styles.headerName}>{driverName}</Text>
                                <Text style={styles.headerVehicle}>{vehicleNumber}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onCallCustomer} style={styles.callBtn}>
                            <Feather name="phone" size={20} color="#16A34A" />
                        </TouchableOpacity>
                    </View>

                    {/* Warning Banner */}
                    <View style={styles.warningBanner}>
                        <Text style={styles.warningText}>⚠️ Do not share your PIN with the customer before the ride starts</Text>
                    </View>

                    {/* Chat Area */}
                    <ScrollView 
                        ref={scrollViewRef}
                        style={styles.chatArea} 
                        contentContainerStyle={styles.chatPadding}
                    >
                        {messages.map((msg) => {
                            const isDriver = msg.sender_type === 'driver';
                            return (
                                <View key={msg.id} style={[styles.messageRow, isDriver ? styles.messageRowRight : styles.messageRowLeft]}>
                                    <View style={[styles.bubble, isDriver ? styles.bubbleDriver : styles.bubbleCustomer]}>
                                        <Text style={[styles.messageText, isDriver ? styles.textDriver : styles.textCustomer]}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                    <Text style={styles.timeText}>{msg.time}</Text>
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Quick Replies */}
                    <View style={styles.quickRepliesContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {quickReplies.map((reply, i) => (
                                <TouchableOpacity key={i} onPress={() => handleSend(reply)} style={styles.quickReplyBtn}>
                                    <Text style={styles.quickReplyText}>{reply}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Input Area */}
                    <View style={styles.inputArea}>
                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor="#94A3B8"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={() => handleSend(inputText)}
                        />
                        <TouchableOpacity 
                            onPress={() => handleSend(inputText)} 
                            style={[styles.sendBtn, !inputText.trim() && {opacity: 0.5}]}
                            disabled={!inputText.trim()}
                        >
                            <Feather name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    keyboardView: { flex: 1 },
    
    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    headerName: { fontWeight: 'bold', fontSize: 16, color: '#0F172A' },
    headerVehicle: { fontSize: 12, color: '#64748B' },
    callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },

    // Warning Banner
    warningBanner: { backgroundColor: '#FEF9C3', padding: 10, borderBottomWidth: 1, borderBottomColor: '#FEF08A' },
    warningText: { color: '#854D0E', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },

    // Chat Area
    chatArea: { flex: 1 },
    chatPadding: { padding: 16, paddingBottom: 20 },
    messageRow: { marginBottom: 16, maxWidth: '80%' },
    messageRowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    messageRowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: { padding: 14, borderRadius: 20 },
    bubbleDriver: { backgroundColor: '#0284C7', borderBottomRightRadius: 4 },
    bubbleCustomer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 14, lineHeight: 20 },
    textDriver: { color: '#FFF' },
    textCustomer: { color: '#0F172A' },
    timeText: { fontSize: 10, color: '#94A3B8', marginTop: 4, paddingHorizontal: 4 },

    // Quick Replies
    quickRepliesContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    quickReplyBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    quickReplyText: { fontSize: 12, fontWeight: '600', color: '#475569' },

    // Input Area
    inputArea: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, fontSize: 14, color: '#0F172A', marginRight: 12 },
    sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center' }
});