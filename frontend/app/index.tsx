import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router'; 

export default function WelcomeScreen() {
  const router = useRouter(); 
  
  const [isDark, setIsDark] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");

  const changeLanguage = (lang: string) => {
    setCurrentLang(lang);
    setShowLangModal(false);
  };

  const themeStyles = isDark ? darkStyles : lightStyles;

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      
      {/* TOP RIGHT CONTROLS */}
      <View style={styles.topControls}>
        <TouchableOpacity 
          style={[styles.iconButton, themeStyles.iconButton]} 
          onPress={() => setShowLangModal(true)}
        >
          <Text style={themeStyles.iconText}>🌐</Text>
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>{currentLang}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.iconButton, themeStyles.iconButton]} 
          onPress={() => setIsDark(!isDark)}
        >
          <Text style={themeStyles.iconText}>{isDark ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>QC</Text>
        </View>
        
        <Text style={[styles.title, themeStyles.text]}>QC Logistics</Text>
        <Text style={[styles.subtitle, themeStyles.subText]}>
          Partner with us and start earning today.
        </Text>
        
        {/* LOGIN BUTTON */}
        <TouchableOpacity 
          style={styles.mainButton}
          onPress={() => router.push('/login')} 
        >
          <Text style={styles.mainButtonText}>Login to Account</Text>
        </TouchableOpacity>

        {/* REGISTRATION LINK */}
        <View style={styles.registerContainer}>
          <Text style={[styles.registerText, themeStyles.subText]}>New Driver? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}> 
            <Text style={styles.registerLink}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LANGUAGE SELECTION MODAL */}
      <Modal visible={showLangModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.text]}>Select Language</Text>
            
            <TouchableOpacity style={[styles.langOption, themeStyles.langOption]} onPress={() => changeLanguage('en')}>
              <Text style={[styles.langText, themeStyles.text]}>English</Text>
              <Text>🇺🇸</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.langOption, themeStyles.langOption]} onPress={() => changeLanguage('ta')}>
              <Text style={[styles.langText, themeStyles.text]}>தமிழ்</Text>
              <Text>🇮🇳</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.langOption, themeStyles.langOption]} onPress={() => changeLanguage('hi')}>
              <Text style={[styles.langText, themeStyles.text]}>हिंदी</Text>
              <Text>🇮🇳</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeButton} onPress={() => setShowLangModal(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  topControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingHorizontal: 20 },
  iconButton: { width: 45, height: 45, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.1, shadowRadius: 5 },
  langBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#0284c7', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2 },
  langBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  logoBox: { width: 100, height: 100, backgroundColor: '#0284c7', borderRadius: 25, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }], marginBottom: 40, shadowColor: '#0284c7', shadowOpacity: 0.4, shadowRadius: 10 },
  logoText: { color: 'white', fontSize: 40, fontWeight: '900' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 },
  mainButton: { width: '100%', backgroundColor: '#0284c7', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#0284c7', shadowOpacity: 0.3, shadowRadius: 8, marginBottom: 20 },
  mainButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  registerContainer: { flexDirection: 'row', alignItems: 'center' },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: 'bold', color: '#0284c7' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 24, padding: 24, shadowOpacity: 0.25, shadowRadius: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  langOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  langText: { fontSize: 16, fontWeight: 'bold' },
  closeButton: { marginTop: 20, padding: 12, alignItems: 'center' },
  closeButtonText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 }
});

const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#ffffff' },
  text: { color: '#0f172a' },
  subText: { color: '#64748b' },
  iconButton: { backgroundColor: '#f1f5f9' },
  iconText: { fontSize: 20 },
  modalContent: { backgroundColor: '#ffffff' },
  langOption: { borderColor: '#f1f5f9', backgroundColor: '#ffffff' }
});

const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  text: { color: '#ffffff' },
  subText: { color: '#94a3b8' },
  iconButton: { backgroundColor: '#1e293b' },
  iconText: { fontSize: 20 },
  modalContent: { backgroundColor: '#1e293b' },
  langOption: { borderColor: '#334155', backgroundColor: '#1e293b' }
});