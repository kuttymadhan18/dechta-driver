import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  useColorScheme,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthAPI } from '../services/api';

export default function VerifyScreen() {
  const router = useRouter();
  const { mobile, devOtp } = useLocalSearchParams();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (devOtp) {
      console.log(`🔑 [DEV] OTP for ${mobile}: ${devOtp}`);
    }
  }, [devOtp]);

  const handleVerify = async () => {
    if (otp.length < 4) return;
    setLoading(true);

    try {
      const result = await AuthAPI.verifyOtp(mobile as string, otp);

      if (result.success) {
        if (result.isNewDriver) {
          // New driver — go to registration
          router.replace('/register');
        } else {
          // Existing driver — go to main app
          router.replace('/(tabs)');
        }
      } else {
        Alert.alert('Invalid OTP', result.message || 'Incorrect OTP. Please try again.');
        setOtp('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed. Try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* BACK BUTTON */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, themeStyles.subText]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, themeStyles.text]}>Verify Details</Text>
        <Text style={[styles.subtitle, themeStyles.subText]}>
          We sent a 4-digit secure code to +91 {mobile}        </Text>
        
        <View style={styles.formSpace}>
          
          <View style={[
            styles.inputWrapper, 
            themeStyles.inputWrapper,
            isFocused ? styles.inputFocused : styles.inputUnfocused
          ]}>
            <TextInput
              style={[styles.input, themeStyles.text]}
              placeholder="----"
              placeholderTextColor={isDark ? '#94a3b8' : '#94a3b8'}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              editable={!loading}
              autoFocus={true}
              textAlign="center"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, (otp.length < 4 || loading) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={otp.length < 4 || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  backButton: { position: 'absolute', top: 20, left: 24, padding: 10, zIndex: 10 },
  backText: { fontSize: 16, fontWeight: 'bold' },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 8, marginTop: 40 },
  subtitle: { fontSize: 16, marginBottom: 32, lineHeight: 24 },
  formSpace: { gap: 16 },
  inputWrapper: {
    paddingHorizontal: 16,
    height: 70, 
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  inputFocused: { borderColor: '#0284c7' },
  inputUnfocused: { borderColor: 'transparent' },
  input: {
    fontSize: 32, 
    fontWeight: 'black', 
    letterSpacing: 16, 
    width: '100%',
  },
  button: {
    width: '100%',
    paddingVertical: 16, 
    borderRadius: 16, 
    backgroundColor: '#0284c7', 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7', 
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    height: 60,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#ffffff' },
  text: { color: '#0f172a' },
  subText: { color: '#64748b' },
  inputWrapper: { backgroundColor: '#f8fafc' },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  text: { color: '#ffffff' },
  subText: { color: '#94a3b8' },
  inputWrapper: { backgroundColor: '#1e293b' },
});