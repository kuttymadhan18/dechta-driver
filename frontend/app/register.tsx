import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image,
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { DriverAPI } from '../services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(false);
  
  // 🔥 NEW: State to track which dropdown is currently open
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [regData, setRegData] = useState({
    mobile: '9876543210', 
    fullName: '', dob: '', emergencyContact: '', bloodGroup: '', tshirtSize: '', preferredZone: '',
    vehicleType: '', specificModelId: '', vehicleModelName: '', vehicleWeight: '', vehicleDimensions: '', bodyType: '', vehicleNumber: '',
    accountHolder: '', bankAccount: '', ifscCode: '', referralCode: '',
    avatarFile: null, aadharFile: null, panFile: null, licenseFile: null, rcFile: null
  });

  const updateField = (field: string, value: any) => {
    setRegData(prev => ({ ...prev, [field]: value }));
  };

  // Opens an Action Sheet letting the driver choose camera or gallery
  const handleFileUpload = (field: string) => {
    Alert.alert(
      'Upload Document',
      'Choose how you want to upload',
      [
        {
          text: '📷  Take Photo',
          onPress: () => openCamera(field),
        },
        {
          text: '🖼️  Choose from Gallery',
          onPress: () => openGallery(field),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openCamera = async (field: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please allow camera access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      updateField(field, result.assets[0].uri);
    }
  };

  const openGallery = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery Permission Required', 'Please allow photo library access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      updateField(field, result.assets[0].uri);
    }
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      // 1. Upload avatar if selected
      if (regData.avatarFile) {
        try {
          await DriverAPI.uploadAvatar(regData.avatarFile as string);
        } catch (e) {
          console.warn('Avatar upload failed, continuing registration');
        }
      }

      // 2. Upload KYC documents
      const docUploads = [
        { key: 'aadharFile', type: 'aadhar' },
        { key: 'panFile', type: 'pan' },
        { key: 'licenseFile', type: 'license' },
        { key: 'rcFile', type: 'rc' },
      ];
      for (const doc of docUploads) {
        const uri = (regData as any)[doc.key];
        if (uri) {
          try {
            await DriverAPI.uploadDocument(uri, doc.type);
          } catch (e) {
            console.warn(`${doc.type} upload failed`);
          }
        }
      }

      // 3. Submit registration data
      const result = await DriverAPI.register({
        fullName: regData.fullName,
        dob: regData.dob,
        emergencyContact: regData.emergencyContact,
        bloodGroup: regData.bloodGroup,
        tshirtSize: regData.tshirtSize,
        preferredZone: regData.preferredZone,
        vehicleType: regData.vehicleType,
        specificModelId: regData.specificModelId,
        vehicleModelName: regData.vehicleModelName,
        vehicleWeight: regData.vehicleWeight,
        vehicleDimensions: regData.vehicleDimensions,
        bodyType: regData.bodyType,
        vehicleNumber: regData.vehicleNumber,
        accountHolder: regData.accountHolder,
        bankAccount: regData.bankAccount,
        ifscCode: regData.ifscCode,
        referralCode: regData.referralCode,
      });

      if (result.success) {
        Alert.alert(
          'Registration Submitted! 🎉',
          'Your details are under review. You will be notified once approved.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        Alert.alert('Error', result.message || 'Registration failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(prev => prev === dropdownName ? null : dropdownName);
  };

  const vehicleModelsData: any = {
    '3wheeler': [
      { id: '3w_ape', name: 'Piaggio Ape / Mahindra', weight: '500 kg', length: '5.5 ft' },
      { id: '3w_maxima', name: 'Bajaj Maxima C', weight: '600 kg', length: '5.5 ft' }
    ],
    '4wheeler': [
      { id: '4w_small', name: 'Small LCV (Tata Ace)', weight: '1200 kg', length: '7 ft' },
      { id: '4w_medium', name: 'Medium LCV (Dost)', weight: '1700 kg', length: '8 ft' },
      { id: '4w_large', name: 'Large LCV (Tata 407)', weight: '2500 kg', length: '10 ft' }
    ]
  };

  const activeVehicleModels = vehicleModelsData[regData.vehicleType];
  const themeStyles = isDark ? darkTheme : lightTheme;

  const SelectionGrid = ({ options, selected, onSelect }: any) => (
    <View style={styles.gridContainer}>
      {options.map((opt: string) => (
        <TouchableOpacity 
          key={opt} 
          onPress={() => onSelect(opt)}
          style={[styles.gridItem, themeStyles.inputBox, selected === opt && styles.gridItemActive]}
        >
          <Text style={[styles.gridText, themeStyles.text, selected === opt && styles.gridTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 🔥 NEW: A reusable smart Dropdown component for your grids
  const DropdownGrid = ({ label, placeholder, options, selected, fieldKey }: any) => {
    const isOpen = activeDropdown === fieldKey;
    return (
      <View style={{ marginBottom: 4 }}>
        <Text style={[styles.label, themeStyles.subText]}>{label}</Text>
        <TouchableOpacity 
          style={[styles.input, themeStyles.inputBox, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} 
          onPress={() => toggleDropdown(fieldKey)}
          activeOpacity={0.7}
        >
          <Text style={[themeStyles.text, !selected && { color: '#94a3b8' }]}>
            {selected || placeholder}
          </Text>
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
        </TouchableOpacity>
        
        {isOpen && (
          <View style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: 4 }}>
            <SelectionGrid 
              options={options} 
              selected={selected} 
              onSelect={(v: string) => { 
                updateField(fieldKey, v); 
                setActiveDropdown(null); // Auto-hides grid after user clicks an option
              }} 
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={isDark ? '#fff' : '#0f172a'} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.title, themeStyles.text]}>Complete Profile</Text>
              <Text style={themeStyles.subText}>Fill in your details to start earning</Text>
            </View>
          </View>

          {/* AVATAR UPLOAD */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={[styles.avatarBox, themeStyles.inputBox]} onPress={() => handleFileUpload('avatarFile')}>
              {regData.avatarFile ? (
                <Image source={{ uri: regData.avatarFile as string }} style={styles.avatarPreview} />
              ) : (
                <>
                  <Feather name="camera" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.avatarText, themeStyles.subText]}>UPLOAD PHOTO</Text>
                </>
              )}
            </TouchableOpacity>
            {regData.avatarFile && (
              <TouchableOpacity onPress={() => updateField('avatarFile', null)} style={styles.retakeAvatarBtn}>
                <Feather name="refresh-cw" size={12} color="#0284c7" />
                <Text style={styles.retakeAvatarText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* PERSONAL DETAILS */}
          <View style={[styles.card, themeStyles.card]}>
            <Text style={styles.cardTitle}>PERSONAL DETAILS</Text>
            
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Full Name (as per Bank)" placeholderTextColor="#94a3b8" value={regData.fullName} onChangeText={(v) => updateField('fullName', v)} />
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Date of Birth (YYYY-MM-DD)" placeholderTextColor="#94a3b8" value={regData.dob} onChangeText={(v) => updateField('dob', v)} />
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Emergency Contact" placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={regData.emergencyContact} onChangeText={(v) => updateField('emergencyContact', v)} />

            {/* 🔥 UPDATED: Grids are now smart dropdowns! */}
            <DropdownGrid 
              label="Blood Group" 
              placeholder="Select Blood Group"
              options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']} 
              selected={regData.bloodGroup} 
              fieldKey="bloodGroup" 
            />

            <DropdownGrid 
              label="T-Shirt Size" 
              placeholder="Select T-Shirt Size"
              options={['S', 'M', 'L', 'XL', 'XXL']} 
              selected={regData.tshirtSize} 
              fieldKey="tshirtSize" 
            />

            <DropdownGrid 
              label="Preferred Delivery Zone" 
              placeholder="Select Zone"
              options={['North Chennai', 'South Chennai', 'Central Chennai', 'OMR & ECR']} 
              selected={regData.preferredZone} 
              fieldKey="preferredZone" 
            />
          </View>

          {/* VEHICLE INFO */}
          <View style={[styles.card, themeStyles.card]}>
            <Text style={styles.cardTitle}>VEHICLE INFORMATION</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[
                { id: '2wheeler', label: '2 Wheeler', icon: 'package' },
                { id: '3wheeler', label: '3 Wheeler', icon: 'truck' },
                { id: '4wheeler', label: '4 Wheeler', icon: 'truck' }
              ].map(v => (
                <TouchableOpacity key={v.id} onPress={() => updateField('vehicleType', v.id)} style={[styles.vehicleTypeBtn, themeStyles.inputBox, regData.vehicleType === v.id && styles.gridItemActive]}>
                  <Feather name={v.icon as any} size={24} color={regData.vehicleType === v.id ? '#0284c7' : '#94a3b8'} />
                  <Text style={[styles.vehicleTypeText, regData.vehicleType === v.id ? styles.gridTextActive : themeStyles.subText]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vehicle Models */}
            {activeVehicleModels && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.label, themeStyles.subText]}>Select Vehicle Model</Text>
                {activeVehicleModels.map((model: any) => (
                  <TouchableOpacity key={model.id} onPress={() => updateField('specificModelId', model.id)} style={[styles.modelBtn, themeStyles.inputBox, regData.specificModelId === model.id && styles.gridItemActive]}>
                    <Text style={[styles.modelBtnName, regData.specificModelId === model.id ? styles.gridTextActive : themeStyles.text]}>{model.name}</Text>
                    <Text style={themeStyles.subText}>Max Load: {model.weight} • Box: {model.length}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {regData.specificModelId ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.label, themeStyles.subText]}>Body Type</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['Open', 'Closed'].map(type => (
                    <TouchableOpacity key={type} onPress={() => updateField('bodyType', type)} style={[styles.vehicleTypeBtn, themeStyles.inputBox, regData.bodyType === type && styles.gridItemActive]}>
                      <Text style={[styles.vehicleTypeText, regData.bodyType === type ? styles.gridTextActive : themeStyles.subText]}>{type} Body</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Vehicle Number (TN01AB1234)" placeholderTextColor="#94a3b8" autoCapitalize="characters" value={regData.vehicleNumber} onChangeText={(v) => updateField('vehicleNumber', v.toUpperCase())} />
          </View>

          {/* KYC DOCUMENTS */}
          <View style={[styles.card, themeStyles.card]}>
            <Text style={styles.cardTitle}>KYC DOCUMENTS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { key: 'aadharFile', label: 'Aadhaar' }, { key: 'panFile', label: 'PAN Card' },
                { key: 'licenseFile', label: 'License' }, { key: 'rcFile', label: 'RC Book' }
              ].map(doc => {
                const uploadedUri = (regData as any)[doc.key] as string | null;
                return (
                  <TouchableOpacity
                    key={doc.key}
                    onPress={() => handleFileUpload(doc.key)}
                    style={[styles.docBtn, themeStyles.inputBox, uploadedUri ? styles.docBtnSuccess : styles.docBtnPending]}
                  >
                    {uploadedUri ? (
                      <>
                        <Image source={{ uri: uploadedUri }} style={styles.docThumb} />
                        <View style={styles.docUploadedRow}>
                          <Feather name="check-circle" size={13} color="#10b981" />
                          <Text style={[styles.docBtnText, { color: '#10b981' }]}>Uploaded</Text>
                        </View>
                        <Text style={styles.docRetakeText}>Tap to retake</Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.docIconCircle}>
                          <Feather name="file-text" size={22} color="#0284c7" />
                        </View>
                        <Text style={[styles.docBtnText, themeStyles.subText]}>{doc.label}</Text>
                        <View style={styles.docUploadHint}>
                          <Feather name="camera" size={11} color="#94a3b8" />
                          <Text style={styles.docUploadHintText}>Camera / Gallery</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* BANK DETAILS */}
          <View style={[styles.card, themeStyles.card]}>
            <Text style={styles.cardTitle}>BANKING DETAILS</Text>
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Account Holder Name" placeholderTextColor="#94a3b8" value={regData.accountHolder} onChangeText={(v) => updateField('accountHolder', v)} />
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="Account Number" placeholderTextColor="#94a3b8" keyboardType="number-pad" value={regData.bankAccount} onChangeText={(v) => updateField('bankAccount', v)} />
            <TextInput style={[styles.input, themeStyles.inputBox, themeStyles.text]} placeholder="IFSC Code" placeholderTextColor="#94a3b8" autoCapitalize="characters" value={regData.ifscCode} onChangeText={(v) => updateField('ifscCode', v.toUpperCase())} />
          </View>

          {/* REFERRAL */}
          <View style={[styles.card, { backgroundColor: isDark ? '#1e3a8a' : '#eff6ff', borderColor: '#bfdbfe' }]}>
            <Text style={styles.cardTitle}>REFERRAL CODE</Text>
            <TextInput style={[styles.input, { backgroundColor: isDark ? '#172554' : '#ffffff' }, themeStyles.text]} placeholder="Enter Code (Optional)" placeholderTextColor="#94a3b8" autoCapitalize="characters" value={regData.referralCode} onChangeText={(v) => updateField('referralCode', v.toUpperCase())} />
          </View>

          {/* SUBMIT */}
          <TouchableOpacity style={styles.submitBtn} onPress={submitRegistration} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Registration</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  backButton: { marginRight: 16, padding: 8 },
  title: { fontSize: 26, fontWeight: 'bold' },
  
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarBox: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.1, shadowRadius: 10 },
  avatarText: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  
  card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
  cardTitle: { fontSize: 12, fontWeight: '900', color: '#0284c7', letterSpacing: 1.5, marginBottom: 16 },
  
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  gridItemActive: { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
  gridText: { fontWeight: 'bold', fontSize: 14 },
  gridTextActive: { color: '#0284c7' },
  
  vehicleTypeBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  vehicleTypeText: { fontSize: 11, fontWeight: 'bold', marginTop: 8, textTransform: 'uppercase' },
  
  modelBtn: { padding: 16, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', marginBottom: 8 },
  modelBtnName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  
  docBtn: { width: '48%', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  docBtnPending: { borderColor: '#e2e8f0', borderStyle: 'dashed' },
  docBtnSuccess: { borderColor: '#10b981', borderStyle: 'solid', backgroundColor: '#ecfdf5' },
  docBtnText: { fontSize: 11, fontWeight: 'bold', marginTop: 6, textTransform: 'uppercase' },
  docIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  docUploadHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  docUploadHintText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  docThumb: { width: '100%', height: 70, borderRadius: 10, marginBottom: 6 },
  docUploadedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docRetakeText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  avatarPreview: { width: 110, height: 110, borderRadius: 55 },
  retakeAvatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  retakeAvatarText: { fontSize: 12, color: '#0284c7', fontWeight: '700' },
  
  submitBtn: { backgroundColor: '#0284c7', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#0284c7', shadowOpacity: 0.3, shadowRadius: 8, marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f8fafc' },
  text: { color: '#0f172a' },
  subText: { color: '#64748b' },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  inputBox: { backgroundColor: '#f1f5f9' },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  text: { color: '#ffffff' },
  subText: { color: '#94a3b8' },
  card: { backgroundColor: '#1e293b', borderColor: '#334155' },
  inputBox: { backgroundColor: '#0f172a' },
});