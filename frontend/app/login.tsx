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
  Animated,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { AuthAPI } from '../services/api';

export default function LoginScreen() {
  const router = useRouter();
  <Stack.Screen options={{ headerShown: false }} />
  
  // Gets device theme (light or dark) to replicate your dark: classes
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false); // To replicate focus:border-brand-500
  
  // Replicating your "slide-up" CSS animation
  const slideAnim = useState(new Animated.Value(20))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true })
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (mobile.length < 10) return;
    setLoading(true);
    try {
      const result = await AuthAPI.sendOtp(mobile);
      if (result.success) {
        router.push({ 
          pathname: '/verify', 
          params: { mobile, devOtp: result.otp_for_testing || '' } 
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error. Check your connection.');
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
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Matches: text-3xl font-bold dark:text-white mb-2 */}
          <Text style={[styles.title, themeStyles.text]}>Welcome Back</Text>
          
          {/* Matches: text-slate-500 dark:text-slate-400 mb-8 */}
          <Text style={[styles.subtitle, themeStyles.subText]}>
            Enter your mobile number to continue.
          </Text>
          
          
          {/* Matches your form logic */}
          <View style={styles.formSpace}>
            
            {/* Matches: w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 ... focus:border-brand-500 */}
            <View style={[
              styles.inputWrapper, 
              themeStyles.inputWrapper,
              isFocused ? styles.inputFocused : styles.inputUnfocused
            ]}>
              <Text style={[styles.prefix, themeStyles.text]}>+91</Text>
              <TextInput
                style={[styles.input, themeStyles.text]}
                placeholder="Mobile Number"
                placeholderTextColor={isDark ? '#94a3b8' : '#94a3b8'}
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                editable={!loading}
              />
            </View>

            {/* Matches: w-full py-4 rounded-2xl font-bold text-lg bg-brand-600 text-white shadow-lg */}
            <TouchableOpacity 
              style={[styles.button, (mobile.length < 10 || loading) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={mobile.length < 10 || loading}
              activeOpacity={0.8} // Replicates active:scale-95
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Get OTP</Text>
              )}
            </TouchableOpacity>

          </View>
          
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Base Layout
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  
  // Typography
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  
  // Form Spacing
  formSpace: { gap: 16 }, // Matches space-y-4
  
  // Input UI (Matches your exact web CSS)
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60, // Matches p-4
    borderRadius: 16, // Matches rounded-2xl
    borderWidth: 2,
  },
  inputFocused: {
    borderColor: '#0284c7', // Matches focus:border-brand-500
  },
  inputUnfocused: {
    borderColor: 'transparent', // Matches border-transparent
  },
  prefix: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18, // Matches text-lg
    fontWeight: 'bold', // Matches font-bold
    letterSpacing: 2, // Matches tracking-wider
    height: '100%',
  },
  
  // Button UI (Matches your exact web CSS)
  button: {
    width: '100%',
    paddingVertical: 16, // Matches py-4
    borderRadius: 16, // Matches rounded-2xl
    backgroundColor: '#0284c7', // Matches bg-brand-600
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7', // Matches shadow-lg
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    height: 60,
  },
  buttonDisabled: {
    opacity: 0.5, // Matches disabled:opacity-50
  },
  buttonText: {
    color: '#ffffff', // Matches text-white
    fontSize: 18, // Matches text-lg
    fontWeight: 'bold', // Matches font-bold
  },
});

// Matches your Light Mode Web CSS
const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#ffffff' }, // bg-white
  text: { color: '#0f172a' }, // default text
  subText: { color: '#64748b' }, // text-slate-500
  inputWrapper: { backgroundColor: '#f8fafc' }, // bg-slate-50
});

// Matches your Dark Mode Web CSS
const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#0f172a' }, // dark:bg-dark-bg
  text: { color: '#ffffff' }, // dark:text-white
  subText: { color: '#94a3b8' }, // dark:text-slate-400
  inputWrapper: { backgroundColor: '#1e293b' }, // dark:bg-slate-800
});