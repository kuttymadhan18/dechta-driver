import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, 
  Modal, Dimensions, TextInput, Alert, Linking, Platform 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router'; 
import ChatModal from '../../components/ChatModal'; 

const { width, height } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════
const initialAvailableOrders = [
    { id: '1001', type: 'Package Delivery', vehicle_type: '2 Wheeler', payout: 150, distance: '4.2 km', pickup: 'Anna Nagar West, Chennai', drop: 'T Nagar, Chennai', status: 'Pending' },
    { id: '1002', type: 'Food Delivery', vehicle_type: '2 Wheeler', payout: 80, distance: '1.5 km', pickup: 'Adyar Bakery', drop: 'Besant Nagar', status: 'Pending' },
    { id: '1003', type: 'Document Courier', vehicle_type: '2 Wheeler', payout: 120, distance: '3.8 km', pickup: 'Guindy Industrial Estate', drop: 'Velachery', status: 'Pending' },
];

const mockHistoryOrders = [
    { id: '9001', type: 'Grocery Run', payout: 200, status: 'Completed', date: '10/24/2026', cancel_reason: null },
    { id: '9002', type: 'Bulk Delivery', payout: 450, status: 'Completed', date: '10/23/2026', cancel_reason: null },
];

const cancelReasonsList = [
    "Customer is unreachable",
    "Vehicle breakdown / issue",
    "Heavy traffic / area blocked",
    "Incorrect address provided",
    "Package too large for vehicle",
    "Personal emergency"
];

const pickupLocation = { latitude: 13.0900, longitude: 80.2800 };
const dropLocation   = { latitude: 13.1050, longitude: 80.2600 };

// ═══════════════════════════════════════════════════════════════════════════
// LEAFLET HTML — fetches a real road route from OSRM, draws it on the map
// ═══════════════════════════════════════════════════════════════════════════
// Vehicle profile → OSRM routing mode + visual identity
const VEHICLE_PROFILES: Record<string, { osrm: string; color: string; altColor: string; label: string; emoji: string }> = {
    '2 Wheeler':  { osrm: 'bike',    color: '#7C3AED', altColor: '#A78BFA', label: '2-Wheeler',  emoji: '🛵' },
    '3 Wheeler':  { osrm: 'driving', color: '#0284C7', altColor: '#38BDF8', label: '3-Wheeler',  emoji: '🛺' },
    'Mini Truck': { osrm: 'driving', color: '#0284C7', altColor: '#38BDF8', label: 'Mini Truck', emoji: '🚚' },
};
const DEFAULT_PROFILE = { osrm: 'driving', color: '#0284C7', altColor: '#38BDF8', label: 'Vehicle', emoji: '🚗' };

const buildLeafletHTML = (
    driver:      { latitude: number; longitude: number },
    pickup:      { latitude: number; longitude: number },
    drop:        { latitude: number; longitude: number },
    step:        number,
    pickupLabel: string,
    dropLabel:   string,
    vehicleType: string
) => {
  const vp = VEHICLE_PROFILES[vehicleType] ?? DEFAULT_PROFILE;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}

    /* ── Markers ── */
    .mk{display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.35)}
    .mk-driver{width:46px;height:46px;animation:driverPulse 2s infinite}
    @keyframes driverPulse{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.45),0 2px 12px rgba(0,0,0,.35)}60%{box-shadow:0 0 0 14px rgba(124,58,237,0),0 2px 12px rgba(0,0,0,.35)}}
    .mk-pickup{width:42px;height:42px;background:#22C55E}
    .mk-drop{width:42px;height:42px;background:#EF4444}
    .lbl{font-size:13px;font-weight:700;color:#0F172A;white-space:nowrap;padding:4px 10px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15)}

    /* ── Top info bar ── */
    #infoBar{position:absolute;top:10px;left:50%;transform:translateX(-50%);
      background:rgba(255,255,255,.96);border-radius:20px;z-index:1000;
      padding:8px 16px;display:flex;gap:18px;align-items:center;
      box-shadow:0 4px 16px rgba(0,0,0,.15);min-width:220px;justify-content:center}
    #infoBar .pill{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#0F172A}
    #infoBar .accent{color:var(--vc)}

    /* ── Route panel ── */
    #routePanel{position:absolute;bottom:10px;left:8px;right:8px;z-index:1000;display:flex;flex-direction:column;gap:6px}
    .routeChip{background:rgba(255,255,255,.96);border-radius:16px;padding:10px 16px;
      display:flex;align-items:center;justify-content:space-between;
      box-shadow:0 3px 12px rgba(0,0,0,.12);cursor:pointer;border:2px solid transparent;transition:border .2s}
    .routeChip.active{border-color:var(--vc)}
    .routeChip .chipLeft{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;color:#0F172A}
    .routeChip .tag{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px}
    .routeChip .best-tag{background:#DCFCE7;color:#16A34A}
    .routeChip .alt-tag{background:#F1F5F9;color:#64748B}
    .routeChip .via-tag{background:#FEF3C7;color:#B45309}
    .routeChip .nums{font-size:12px;font-weight:600;color:#64748B;text-align:right}

    /* ── Map controls ── */
    #mapCtrl{position:absolute;right:10px;top:60px;z-index:1000;display:flex;flex-direction:column;gap:8px}
    .ctrlBtn{width:40px;height:40px;background:#fff;border-radius:12px;border:none;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;font-size:18px}

    /* ── Vehicle badge ── */
    #vBadge{position:absolute;left:10px;top:10px;z-index:1000;
      background:rgba(255,255,255,.96);border-radius:14px;padding:6px 14px;
      font-size:12px;font-weight:800;color:var(--vc);
      box-shadow:0 2px 10px rgba(0,0,0,.12)}

    .leaflet-control-zoom{display:none}
    .leaflet-control-attribution{font-size:8px;opacity:.35}
  </style>
</head>
<body>
<div id="map"></div>
<div id="vBadge">${vp.emoji} ${vp.label}</div>
<div id="infoBar">
  <div class="pill">📍 <span class="accent" id="distVal">…</span> km</div>
  <div style="width:1px;height:20px;background:#E2E8F0"></div>
  <div class="pill">⏱ <span class="accent" id="durVal">…</span> min</div>
  <div style="width:1px;height:20px;background:#E2E8F0"></div>
  <div class="pill" id="etaPill">🕐 <span class="accent" id="etaVal">…</span></div>
</div>
<div id="mapCtrl">
  <button class="ctrlBtn" id="btnFit" title="Fit all">⛶</button>
  <button class="ctrlBtn" id="btnZin" title="Zoom in">+</button>
  <button class="ctrlBtn" id="btnZot" title="Zoom out">−</button>
  <button class="ctrlBtn" id="btnLyr" title="Satellite">🛰</button>
</div>
<div id="routePanel"></div>
<script>
(async()=>{
  const VC='${vp.color}';
  const VA='${vp.altColor}';
  document.documentElement.style.setProperty('--vc', VC);

  const map=L.map('map',{zoomControl:false,attributionControl:true});

  const streetLayer=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {attribution:'© OSM'});
  const satLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {attribution:'© Esri'});
  streetLayer.addTo(map);
  let isSat=false;
  document.getElementById('btnLyr').onclick=()=>{
    isSat=!isSat; isSat?satLayer.addTo(map):map.removeLayer(satLayer);
    document.getElementById('btnLyr').textContent=isSat?'🗺':'🛰';
  };

  const driver=[${driver.latitude},${driver.longitude}];
  const pickup=[${pickup.latitude},${pickup.longitude}];
  const drop  =[${drop.latitude},${drop.longitude}];
  const step  =${step};
  const osrmMode='${vp.osrm}';

  // ── Icons ──
  const navSvg ='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
  const boxSvg ='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
  const pinSvg ='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function mkIcon(bg,svg,anim){
    return L.divIcon({className:'',iconSize:[46,46],iconAnchor:[23,23],
      html:'<div class="mk '+(anim?'mk-driver':'')+'" style="background:'+bg+'">' +svg+'</div>'});
  }

  // ── Place markers ──
  const driverMk=L.marker(driver,{icon:mkIcon(VC,navSvg,true),zIndexOffset:1000}).addTo(map)
    .bindPopup('<div class="lbl">${vp.emoji} You (Driver)</div>');
  const pickupMk=L.marker(pickup,{icon:mkIcon('#22C55E',boxSvg,false)}).addTo(map)
    .bindPopup('<div class="lbl">📦 ${pickupLabel.replace(/'/g, "\\'")}</div>');
  const dropMk  =L.marker(drop,  {icon:mkIcon('#EF4444',pinSvg,false)}).addTo(map)
    .bindPopup('<div class="lbl">🏠 ${dropLabel.replace(/'/g, "\\'")}</div>');

  // ── ETA helper ──
  function calcETA(min){
    const now=new Date(); now.setMinutes(now.getMinutes()+min);
    return now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }

  // ── Drawn layers store ──
  let activePolylines=[];
  function clearRoutes(){activePolylines.forEach(l=>map.removeLayer(l));activePolylines=[];}

  // ── Fetch single OSRM route ──
  async function fetchOSRM(from,to,alt){
    const base='https://router.project-osrm.org/route/v1/'+osrmMode+'/';
    const coords=from[1]+','+from[0]+';'+to[1]+','+to[0];
    const url=base+coords+'?overview=full&geometries=geojson&alternatives='+(alt?'true':'false')+'&steps=false';
    try{
      const res=await fetch(url);
      const d=await res.json();
      if(d.code!=='Ok'||!d.routes.length)throw new Error('no-route');
      return d.routes;
    }catch(e){return null;}
  }

  // ── Draw a route polyline, returns the layer ──
  function drawRoute(coords,color,weight,opacity,dash){
    const shadow=L.polyline(coords,{color:'#000',weight:weight+4,opacity:0.08,lineJoin:'round',lineCap:'round'}).addTo(map);
    const line  =L.polyline(coords,{color,weight,opacity,dashArray:dash,lineJoin:'round',lineCap:'round'}).addTo(map);
    activePolylines.push(shadow,line);
    return line;
  }

  // ── Build the route panel chips ──
  function buildRoutePanel(routes,primaryColor,altColor,onSelect){
    const panel=document.getElementById('routePanel');
    panel.innerHTML='';
    routes.forEach((r,i)=>{
      const km=(r.distance/1000).toFixed(1);
      const min=Math.ceil(r.duration/60);
      const chip=document.createElement('div');
      chip.className='routeChip'+(i===0?' active':'');
      const tagClass=i===0?'best-tag':i===1?'alt-tag':'via-tag';
      const tagText=i===0?'Fastest':i===1?'Alternate':'Via Highway';
      chip.innerHTML=
        '<div class="chipLeft">'+
          '<div class="tag '+tagClass+'">'+tagText+'</div>'+
          '<span>'+km+' km · '+min+' min</span>'+
        '</div>'+
        '<div class="nums">ETA '+calcETA(min)+'</div>';
      chip.onclick=()=>{
        document.querySelectorAll('.routeChip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
        onSelect(i,km,min);
      };
      panel.appendChild(chip);
    });
  }

  // ── Main route orchestration ──
  let allRoutes=[];
  let drawnLines=[];

  async function loadRoutes(){
    clearRoutes();drawnLines=[];
    const from=step===0?driver:pickup;
    const to  =step===0?pickup:drop;
    const mainColor=step===0?VC:'#10B981';
    const altC     =step===0?VA:'#6EE7B7';

    const routes=await fetchOSRM(from,to,true);
    if(!routes){
      // Fallback straight line
      drawRoute([from,to],mainColor,5,0.8,'10 6');
      document.getElementById('distVal').textContent='N/A';
      document.getElementById('durVal').textContent='N/A';
      return;
    }
    allRoutes=routes;

    // Draw all routes dim first, then primary bright
    routes.forEach((r,i)=>{
      const pts=r.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
      const color=i===0?mainColor:altC;
      const w=i===0?6:4;
      const op=i===0?0.92:0.55;
      const dash=i===0?null:'8 5';
      const l=drawRoute(pts,color,w,op,dash);
      drawnLines.push({line:l,pts,r});
    });

    // Info bar — show primary
    const primary=routes[0];
    const km=(primary.distance/1000).toFixed(1);
    const min=Math.ceil(primary.duration/60);
    document.getElementById('distVal').textContent=km;
    document.getElementById('durVal').textContent=min;
    document.getElementById('etaVal').textContent=calcETA(min);

    buildRoutePanel(routes,mainColor,altC,(idx,km,min)=>{
      document.getElementById('distVal').textContent=km;
      document.getElementById('durVal').textContent=min;
      document.getElementById('etaVal').textContent=calcETA(parseInt(min));
      // Highlight selected route
      drawnLines.forEach((dl,i)=>{
        const layers=[activePolylines[i*2],activePolylines[i*2+1]];
        // bring selected to front
      });
      if(drawnLines[idx]){
        const pts=drawnLines[idx].pts;
        map.fitBounds(L.latLngBounds(pts),{padding:[60,60]});
      }
    });

    map.fitBounds(L.latLngBounds([from,to,...(step===0?[drop]:[driver])]),{padding:[60,60]});
  }

  await loadRoutes();

  // ── Map control buttons ──
  const allPts=[driver,pickup,drop];
  document.getElementById('btnFit').onclick=()=>map.fitBounds(L.latLngBounds(allPts),{padding:[55,55]});
  document.getElementById('btnZin').onclick=()=>map.zoomIn();
  document.getElementById('btnZot').onclick=()=>map.zoomOut();

  // ── Animate driver marker along route (step indicator) ──
  // Small bounce every 4s to show it's live
  setInterval(()=>{
    driverMk.setLatLng(driver); // refresh position (in real app feeds from GPS)
  },4000);

})();
</script>
</body>
</html>`;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ORDERS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export default function OrdersScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [tab, setTab]                         = useState<'new' | 'history'>('new');
    const [historyFilter, setHistoryFilter]     = useState('Cancelled');
    const [availableOrders, setAvailableOrders] = useState(initialAvailableOrders);
    const [historyOrders, setHistoryOrders]     = useState(mockHistoryOrders);

    const [activeTrip, setActiveTrip]           = useState<any>(null);
    const [navigatingOrder, setNavigatingOrder] = useState<any>(null);
    const [driverLocation, setDriverLocation]   = useState<{ latitude: number; longitude: number } | null>(null);
    const locationSubscription                  = useRef<Location.LocationSubscription | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isAckModalOpen, setIsAckModalOpen]       = useState(false);
    const [isChatOpen, setIsChatOpen]               = useState(false);

    const [cancelReason, setCancelReason] = useState('');
    const [otpInput, setOtpInput]         = useState('');
    const [packagePhoto, setPackagePhoto] = useState<string | null>(null);

    const activeAvailableOrders = availableOrders.filter(
        o => !['Cancelled', 'Completed', 'Missed', 'Accepted'].includes(o.status)
    );

    // Parse incoming order from Home tab
    useEffect(() => {
        if (params.incomingOrder) {
            try {
                const order = JSON.parse(params.incomingOrder as string);
                setActiveTrip({ ...order, step: 0 });
                router.setParams({ incomingOrder: '' });
            } catch (e) { console.log('Error parsing incoming order:', e); }
        }
    }, [params.incomingOrder]);

    // Live GPS tracking — starts when activeTrip opens, stops when it closes
    useEffect(() => {
        if (activeTrip) {
            (async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    // Fallback: place driver slightly before pickup
                    setDriverLocation({
                        latitude:  pickupLocation.latitude  - 0.006,
                        longitude: pickupLocation.longitude + 0.004,
                    });
                    return;
                }
                const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                setDriverLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
                locationSubscription.current = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 10 },
                    loc => setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
                );
            })();
        } else {
            locationSubscription.current?.remove();
            locationSubscription.current = null;
            setDriverLocation(null);
        }
        return () => { locationSubscription.current?.remove(); };
    }, [!!activeTrip]);

    // ── Actions ──────────────────────────────────────────────────────────
    const handleAccept = (order: any) => {
        setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
        setNavigatingOrder(order);
    };

    const handleIgnore = (order: any) => {
        setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
        setHistoryOrders(prev => [{ ...order, status: 'Missed', date: new Date().toLocaleDateString() }, ...prev]);
    };

    const handleGoToLocation = () => {
        const order = navigatingOrder;
        setNavigatingOrder(null);
        setActiveTrip({ ...order, step: 0 });
    };

    const handleStartVoiceNavigation = () => {
        const lat = activeTrip?.step === 0 ? pickupLocation.latitude  : dropLocation.latitude;
        const lng = activeTrip?.step === 0 ? pickupLocation.longitude : dropLocation.longitude;
        // Choose nav mode based on vehicle type
        const vType = activeTrip?.vehicle_type ?? '';
        const isBike = vType === '2 Wheeler';
        const iosMode   = isBike ? 'bicycling' : 'driving';
        const droidMode = isBike ? 'b' : 'd';
        const url = Platform.select({
            ios:     `comgooglemaps://?daddr=${lat},${lng}&directionsmode=${iosMode}`,
            android: `google.navigation:q=${lat},${lng}&mode=${droidMode}`,
            web:     `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${iosMode}`,
        });
        if (url) Linking.canOpenURL(url).then(ok => {
            if (ok) Linking.openURL(url);
            else Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${iosMode}`);
        });
    };

    // ── Step 0: Camera only ──────────────────────────────────────────────
    const handleArrivePickup = () => setIsAckModalOpen(true);

    const handleOpenCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Camera Permission Required', 'Please allow camera access in device settings to take a package photo.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.85,
        });
        if (!result.canceled && result.assets.length > 0) setPackagePhoto(result.assets[0].uri);
    };

    const handleConfirmAck = () => {
        if (!packagePhoto) {
            Alert.alert('Photo Required', 'Please take a photo of the package before proceeding.');
            return;
        }
        setIsAckModalOpen(false);
        if (activeTrip?.step === 0) {
            setActiveTrip({ ...activeTrip, step: 1 });
            setPackagePhoto(null);
            Alert.alert('Pickup Confirmed', "Navigate to the customer's delivery location.");
        }
    };

    // ── Step 1 ───────────────────────────────────────────────────────────
    const handleArriveDropoff = () => {
        if (activeTrip?.step === 1) {
            setActiveTrip({ ...activeTrip, step: 2 });
            Alert.alert('OTP Sent', 'An SMS with the 4-digit PIN has been sent to the customer.');
        }
    };

    // ── Step 2 ───────────────────────────────────────────────────────────
    const handleVerifyOtp = () => {
        if (otpInput.length === 4) {
            Alert.alert('Delivery Completed! 🎉', `₹${activeTrip?.payout || 0} has been added to your Wallet.`);
            setHistoryOrders(prev => [{ ...(activeTrip || {}), status: 'Completed', date: new Date().toLocaleDateString() }, ...prev]);
            setAvailableOrders(prev => prev.filter(o => o.id !== activeTrip?.id));
            setActiveTrip(null); setOtpInput('');
            setTab('history'); setHistoryFilter('Completed');
        } else {
            Alert.alert('Invalid PIN', 'Please enter the 4-digit OTP provided by the customer.');
        }
    };

    const confirmCancelTrip = () => {
        if (!cancelReason) return;
        setHistoryOrders(prev => [{ ...(activeTrip || {}), status: 'Cancelled', cancel_reason: cancelReason, date: new Date().toLocaleDateString() }, ...prev]);
        setAvailableOrders(prev => prev.filter(o => o.id !== activeTrip?.id));
        setActiveTrip(null); setIsCancelModalOpen(false); setCancelReason(''); setPackagePhoto(null);
        Alert.alert('Cancelled', 'Order has been cancelled.');
        setTab('history'); setHistoryFilter('Cancelled');
    };

    // ── Computed map HTML (re-renders map when GPS or step changes) ──────
    const mapHtml = driverLocation
        ? buildLeafletHTML(
            driverLocation, pickupLocation, dropLocation,
            activeTrip?.step ?? 0,
            activeTrip?.pickup ?? 'Pickup',
            activeTrip?.drop   ?? 'Drop-off',
            activeTrip?.vehicle_type ?? ''
          )
        : null;

    const filteredHistory  = historyOrders.filter(o => o.status === historyFilter);
    const handleTabSwitch  = (newTab: 'new' | 'history') => {
        setTab(newTab);
        if (newTab === 'history' && !isCancelModalOpen) setHistoryFilter('Completed');
    };

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════
    return (
        <SafeAreaView style={styles.container}>
            {/* TABS */}
            <View style={styles.tabContainer}>
                <View style={styles.tabBg}>
                    <TouchableOpacity onPress={() => handleTabSwitch('new')} style={[styles.tabBtn, tab==='new' && styles.tabBtnActive]}>
                        <Text style={[styles.tabText, tab==='new' && styles.tabTextActive]}>Available</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleTabSwitch('history')} style={[styles.tabBtn, tab==='history' && styles.tabBtnActive]}>
                        <Text style={[styles.tabText, tab==='history' && styles.tabTextActive]}>History</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
                {tab === 'new' ? (
                    activeAvailableOrders.length > 0 ? (
                        <>
                            <Text style={styles.sectionHeader}><View style={styles.dotPulse}/> NEW REQUESTS</Text>
                            {activeAvailableOrders.map(order => (
                                <View key={order.id} style={styles.orderCard}>
                                    <View style={styles.rowBetween}>
                                        <View>
                                            <View style={styles.vehicleBadge}><Text style={styles.vehicleBadgeText}>{order.vehicle_type} #{order.id}</Text></View>
                                            <Text style={styles.orderTitle}>{order.type}</Text>
                                        </View>
                                        <View style={{alignItems:'flex-end'}}>
                                            <Text style={styles.orderPayout}>₹{order.payout}</Text>
                                            <Text style={styles.orderDist}>{order.distance}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.addressRow}>
                                        <Feather name="map-pin" size={14} color="#94A3B8" style={{marginRight:6}}/>
                                        <Text style={styles.addressText}>{order.pickup}</Text>
                                    </View>
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity onPress={() => handleIgnore(order)} style={styles.ignoreBtn}><Text style={styles.ignoreText}>Ignore</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleAccept(order)} style={styles.acceptBtn}><Text style={styles.acceptText}>Accept</Text></TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </>
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="package" size={48} color="#CBD5E1"/>
                            <Text style={styles.emptyTitle}>No Orders Available</Text>
                            <Text style={styles.emptySub}>You're all caught up! Waiting for pings...</Text>
                        </View>
                    )
                ) : (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyFiltersRow} contentContainerStyle={{paddingBottom:16}}>
                            {['Completed','Cancelled','Missed'].map(f => (
                                <TouchableOpacity key={f} onPress={() => setHistoryFilter(f)} style={[styles.filterPill, historyFilter===f ? styles.filterPillActive : styles.filterPillInactive]}>
                                    <Text style={[styles.filterText, historyFilter===f ? styles.filterTextActive : styles.filterTextInactive]}>{f}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {filteredHistory.length > 0 ? filteredHistory.map(order => (
                            <View key={order.id} style={styles.orderCard}>
                                <View style={styles.rowBetween}>
                                    <View>
                                        <Text style={styles.orderTitle}>{order.type}</Text>
                                        <Text style={styles.orderDist}>#{order.id}</Text>
                                    </View>
                                    <Text style={styles.orderPayout}>₹{order.payout}</Text>
                                </View>
                                {order.cancel_reason && <View style={styles.reasonBox}><Text style={styles.reasonTextSmall}>Reason: {order.cancel_reason}</Text></View>}
                                <View style={styles.historyFooter}>
                                    <Text style={styles.historyDate}>{order.date}</Text>
                                    <View style={[styles.statusBadge, order.status==='Completed'?styles.statusGreen:order.status==='Cancelled'?styles.statusRed:styles.statusGray]}>
                                        <Text style={[styles.statusText,order.status==='Completed'?{color:'#15803D'}:order.status==='Cancelled'?{color:'#B91C1C'}:{color:'#475569'}]}>{order.status}</Text>
                                    </View>
                                </View>
                            </View>
                        )) : (
                            <View style={styles.emptyState}>
                                <Feather name="clipboard" size={48} color="#CBD5E1"/>
                                <Text style={styles.emptyTitle}>No {historyFilter} Orders</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* NAVIGATION ACCEPT MODAL */}
            <Modal transparent visible={!!navigatingOrder} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.navModalContent}>
                        <View style={styles.successIconBox}><Feather name="check" size={32} color="#FFF"/></View>
                        <Text style={styles.navModalTitle}>Order Accepted!</Text>
                        <Text style={styles.navModalSub}>Navigate to complete delivery</Text>
                        <View style={styles.routeBox}>
                            <View style={styles.routeRow}>
                                <View style={[styles.routeDot,{backgroundColor:'#22C55E'}]}/>
                                <View style={{flex:1,marginLeft:12}}>
                                    <Text style={styles.routeLabel}>FROM:</Text>
                                    <Text style={styles.routeAddress} numberOfLines={2}>{navigatingOrder?.pickup}</Text>
                                </View>
                            </View>
                            <View style={styles.routeDivider}/>
                            <View style={styles.routeRow}>
                                <View style={[styles.routeDot,{backgroundColor:'#0284C7'}]}/>
                                <View style={{flex:1,marginLeft:12}}>
                                    <Text style={styles.routeLabel}>TO:</Text>
                                    <Text style={styles.routeAddress} numberOfLines={2}>{navigatingOrder?.drop}</Text>
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleGoToLocation} style={styles.goBtn}>
                            <Feather name="navigation" size={20} color="#FFF"/>
                            <Text style={styles.goBtnText}>Open Active Trip</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                FULL SCREEN LOCK: ACTIVE TRIP MAP VIEW
            ═══════════════════════════════════════════════════════════ */}
            <Modal visible={!!activeTrip} animationType="slide" transparent={false}>
                <View style={styles.activeTripContainer}>

                    {/* MAP */}
                    <View style={styles.mapContainer}>
                        {mapHtml ? (
                            <WebView
                                style={StyleSheet.absoluteFill}
                                originWhitelist={['*']}
                                source={{ html: mapHtml }}
                                scrollEnabled={false}
                                javaScriptEnabled={true}
                                mixedContentMode="always"
                            />
                        ) : (
                            <>
                                <LinearGradient colors={['#E0F2FE','#BAE6FD','#7DD3FC']} style={StyleSheet.absoluteFill}/>
                                <View style={styles.mapPinContainer}>
                                    <View style={styles.mapPulse}/>
                                    <View style={styles.mapPin}><Feather name="loader" size={20} color="#FFF"/></View>
                                </View>
                            </>
                        )}
                        {/* Top bar stays above the WebView */}
                        <View style={styles.mapTopBar}>
                            <TouchableOpacity style={styles.mapBackBtn} onPress={() => Alert.alert('Trip Active','You cannot leave until the trip is completed or cancelled.')}>
                                <Feather name="shield" size={24} color="#0F172A"/>
                            </TouchableOpacity>
                            <View style={styles.liveGpsBadge}>
                                <View style={styles.liveGpsDot}/>
                                <Text style={styles.liveGpsText}>Live GPS Tracking</Text>
                            </View>
                        </View>
                    </View>

                    {/* BOTTOM SHEET */}
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle}/>

                        {activeTrip?.step === 0 && (
                            <>
                                <View style={styles.sheetTopRow}>
                                    <View style={styles.stepBadge}>
                                        <Text style={styles.stepBadgeText}>STEP 1 OF 3</Text>
                                    </View>
                                    <View style={styles.vTypePill}>
                                        <Text style={styles.vTypeText}>
                                            {activeTrip?.vehicle_type === '2 Wheeler' ? '🛵' : activeTrip?.vehicle_type === '3 Wheeler' ? '🛺' : '🚚'} {activeTrip?.vehicle_type}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.sheetSubtitle}>NAVIGATING TO PICKUP</Text>
                                <Text style={styles.sheetTitle}>On Route <Text style={{color:'#94A3B8'}}>({activeTrip?.distance || ''})</Text></Text>
                                <Text style={styles.sheetAddress} numberOfLines={2}>{activeTrip?.pickup || ''}</Text>

                                {/* Primary action row */}
                                <View style={styles.sheetActionRow}>
                                    <TouchableOpacity onPress={handleStartVoiceNavigation} style={styles.navBtn}>
                                        <Feather name="navigation" size={20} color="#FFF"/>
                                        <Text style={styles.navBtnText}>Navigate ↗</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsChatOpen(true)} style={[styles.circleBtn,{backgroundColor:'#E0F2FE'}]}>
                                        <Feather name="message-circle" size={22} color="#0284C7"/>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => Linking.openURL('tel:+919876543210')} style={[styles.circleBtn,{backgroundColor:'#ECFDF5'}]}>
                                        <Feather name="phone" size={22} color="#16A34A"/>
                                    </TouchableOpacity>
                                </View>

                                {/* Quick-action strip */}
                                <View style={styles.quickStrip}>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Alert.alert('Share ETA','ETA shared with customer via SMS.')}>
                                        <Feather name="clock" size={15} color="#7C3AED"/>
                                        <Text style={styles.quickChipText}>Share ETA</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Alert.alert('Report Issue','Issue reported to support team.')}>
                                        <Feather name="alert-triangle" size={15} color="#EF4444"/>
                                        <Text style={styles.quickChipText}>Report Issue</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Linking.openURL('https://www.google.com/maps/search/parking+near+me')}>
                                        <Feather name="map-pin" size={15} color="#0284C7"/>
                                        <Text style={styles.quickChipText}>Find Parking</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity onPress={handleArrivePickup} style={styles.arriveBtn}>
                                    <Text style={styles.arriveBtnText}>Arrived at Pickup ✓</Text>
                                    <Feather name="check-circle" size={24} color="#0284C7"/>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsCancelModalOpen(true)} style={styles.sheetCancelBtn}>
                                    <Text style={styles.sheetCancelText}>Cancel Order</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {activeTrip?.step === 1 && (
                            <>
                                <View style={styles.sheetTopRow}>
                                    <View style={[styles.stepBadge,{backgroundColor:'#ECFDF5'}]}>
                                        <Text style={[styles.stepBadgeText,{color:'#16A34A'}]}>STEP 2 OF 3</Text>
                                    </View>
                                    <View style={styles.payoutPill}>
                                        <Feather name="dollar-sign" size={12} color="#0284C7"/>
                                        <Text style={styles.payoutPillText}>₹{activeTrip?.payout} on delivery</Text>
                                    </View>
                                </View>
                                <Text style={[styles.sheetSubtitle,{color:'#16A34A'}]}>NAVIGATING TO CUSTOMER</Text>
                                <Text style={styles.sheetTitle}>Out for Delivery</Text>
                                <Text style={styles.sheetAddress} numberOfLines={2}>{activeTrip?.drop || ''}</Text>

                                <View style={styles.sheetActionRow}>
                                    <TouchableOpacity onPress={handleStartVoiceNavigation} style={[styles.navBtn,{backgroundColor:'#16A34A'}]}>
                                        <Feather name="navigation" size={20} color="#FFF"/>
                                        <Text style={styles.navBtnText}>Navigate ↗</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsChatOpen(true)} style={[styles.circleBtn,{backgroundColor:'#E0F2FE'}]}>
                                        <Feather name="message-circle" size={22} color="#0284C7"/>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => Linking.openURL('tel:+919876543210')} style={[styles.circleBtn,{backgroundColor:'#ECFDF5'}]}>
                                        <Feather name="phone" size={22} color="#16A34A"/>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.quickStrip}>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Alert.alert('Delivery Note','Note sent to customer.')}>
                                        <Feather name="edit-2" size={15} color="#7C3AED"/>
                                        <Text style={styles.quickChipText}>Add Note</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Alert.alert('Share ETA','ETA shared with customer via SMS.')}>
                                        <Feather name="clock" size={15} color="#EF4444"/>
                                        <Text style={styles.quickChipText}>Share ETA</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickChip} onPress={() => Alert.alert('Safe Drop','Mark for safe-drop at door.')}>
                                        <Feather name="home" size={15} color="#0284C7"/>
                                        <Text style={styles.quickChipText}>Safe Drop</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity onPress={handleArriveDropoff} style={[styles.arriveBtn,{borderColor:'#10B981',backgroundColor:'#ECFDF5'}]}>
                                    <Text style={[styles.arriveBtnText,{color:'#10B981'}]}>Arrived at Drop-off ✓</Text>
                                    <Feather name="check-circle" size={24} color="#10B981"/>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsCancelModalOpen(true)} style={styles.sheetCancelBtn}>
                                    <Text style={styles.sheetCancelText}>Cancel Order</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {activeTrip?.step === 2 && (
                            <View style={styles.otpSection}>
                                <View style={styles.otpIconBox}><Feather name="key" size={32} color="#0284C7"/></View>
                                <Text style={styles.otpTitle}>Complete Delivery</Text>
                                <Text style={styles.otpSub}>Ask the customer for the 4-digit PIN.</Text>
                                <TextInput style={styles.otpInput} placeholder="0000" keyboardType="number-pad" maxLength={4} value={otpInput} onChangeText={setOtpInput}/>
                                <TouchableOpacity onPress={handleVerifyOtp} style={[styles.verifyBtn, otpInput.length!==4&&{opacity:0.5}]} disabled={otpInput.length!==4}>
                                    <Text style={styles.verifyBtnText}>Verify & Earn ₹{activeTrip?.payout||0}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsCancelModalOpen(true)} style={styles.sheetCancelBtn}>
                                    <Text style={styles.sheetCancelText}>Cancel Order</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ACKNOWLEDGEMENT MODAL */}
                    <Modal transparent visible={isAckModalOpen} animationType="slide">
                        <View style={styles.modalOverlay}>
                            <View style={styles.ackModalContent}>
                                {/* Header */}
                                <View style={styles.ackHeader}>
                                    <View style={styles.ackIconBox}><Feather name="package" size={28} color="#0284C7"/></View>
                                    <View style={{flex:1,marginLeft:12}}>
                                        <Text style={styles.ackModalTitle}>Pickup Acknowledgement</Text>
                                        <Text style={styles.ackModalSub}>Order #{activeTrip?.id}</Text>
                                    </View>
                                </View>

                                {/* Responsibility warning */}
                                <View style={styles.ackWarningBox}>
                                    <Feather name="shield" size={16} color="#B45309" style={{marginRight:8}}/>
                                    <Text style={styles.ackWarningText}>
                                        By confirming, you accept <Text style={{fontWeight:'bold'}}>full responsibility</Text> for this package's safety until delivery.
                                    </Text>
                                </View>

                                {/* Checklist */}
                                <View style={styles.ackChecklist}>
                                    {['Package is sealed & undamaged','Correct item verified','Customer details match order'].map((item,i) => (
                                        <View key={i} style={styles.ackCheckRow}>
                                            <View style={styles.ackCheckDot}><Feather name="check" size={12} color="#16A34A"/></View>
                                            <Text style={styles.ackCheckText}>{item}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Camera-only photo upload */}
                                <TouchableOpacity
                                    style={[styles.photoUploadBox, packagePhoto && styles.photoUploadBoxSuccess]}
                                    onPress={packagePhoto ? undefined : handleOpenCamera}
                                    activeOpacity={packagePhoto ? 1 : 0.75}
                                >
                                    {packagePhoto ? (
                                        <View style={styles.photoPreviewWrapper}>
                                            <Image source={{uri:packagePhoto}} style={styles.photoPreviewImage} resizeMode="cover"/>
                                            <View style={styles.photoPreviewBadge}>
                                                <Feather name="check-circle" size={13} color="#10B981"/>
                                                <Text style={styles.photoPreviewBadgeText}>Photo Captured</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.retakeBtn}
                                                onPress={() => { setPackagePhoto(null); setTimeout(handleOpenCamera, 150); }}
                                            >
                                                <Feather name="camera" size={13} color="#FFF"/>
                                                <Text style={styles.retakeBtnText}>Retake</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.photoUploadInner}>
                                            <View style={styles.cameraIconCircle}>
                                                <Feather name="camera" size={28} color="#0284C7"/>
                                            </View>
                                            <Text style={styles.photoUploadTitle}>Take Package Photo</Text>
                                            <Text style={styles.photoUploadSubtitle}>Required before pickup confirmation</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleConfirmAck}
                                    style={[styles.confirmAckBtn, !packagePhoto && {backgroundColor:'#CBD5E1'}]}
                                    disabled={!packagePhoto}
                                >
                                    <Feather name="check-circle" size={20} color="#FFF"/>
                                    <Text style={styles.confirmAckText}>Confirm Pickup</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsAckModalOpen(false)} style={styles.cancelAckBtn}>
                                    <Text style={styles.cancelAckText}>Not yet — go back</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* CANCEL MODAL */}
                    <Modal transparent visible={isCancelModalOpen} animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.cancelModalContent}>
                                <Text style={styles.cancelModalTitle}><Feather name="alert-circle" size={20}/> Cancel Order</Text>
                                <Text style={styles.cancelModalSub}>Select a valid reason for cancelling this trip.</Text>
                                <ScrollView style={styles.reasonList}>
                                    {cancelReasonsList.map((reason,idx) => (
                                        <TouchableOpacity key={idx} style={[styles.reasonRow, cancelReason===reason&&styles.reasonRowActive]} onPress={() => setCancelReason(reason)}>
                                            <View style={[styles.radioOuter, cancelReason===reason&&styles.radioOuterActive]}>
                                                {cancelReason===reason && <View style={styles.radioInner}/>}
                                            </View>
                                            <Text style={[styles.reasonText, cancelReason===reason&&styles.reasonTextActive]}>{reason}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity onPress={confirmCancelTrip} disabled={!cancelReason} style={[styles.confirmCancelBtn, !cancelReason&&{opacity:0.5}]}>
                                    <Text style={styles.confirmCancelText}>Confirm Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsCancelModalOpen(false)} style={styles.backBtn}>
                                    <Text style={styles.backBtnText}>Go Back</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onCallCustomer={() => Alert.alert('Calling...','+91 9876543210')}/>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container:{flex:1,backgroundColor:'#FFF'},
    scrollPad:{padding:16,paddingBottom:60},
    rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},

    tabContainer:{padding:16,paddingTop:8},
    tabBg:{flexDirection:'row',backgroundColor:'#F1F5F9',borderRadius:16,padding:4},
    tabBtn:{flex:1,paddingVertical:12,borderRadius:12,alignItems:'center'},
    tabBtnActive:{backgroundColor:'#FFF',shadowColor:'#000',shadowOpacity:0.1,shadowRadius:2,elevation:2},
    tabText:{fontSize:14,fontWeight:'bold',color:'#64748B'},
    tabTextActive:{color:'#0284C7'},

    sectionHeader:{fontSize:12,fontWeight:'900',color:'#94A3B8',letterSpacing:1,marginBottom:12,flexDirection:'row',alignItems:'center'},
    dotPulse:{width:8,height:8,borderRadius:4,backgroundColor:'#0284C7',marginRight:8},

    orderCard:{backgroundColor:'#FFF',borderRadius:24,padding:20,borderWidth:1,borderColor:'#F1F5F9',shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.05,shadowRadius:4,elevation:2,marginBottom:16},
    vehicleBadge:{backgroundColor:'#EFF6FF',alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:4,borderRadius:6,marginBottom:8},
    vehicleBadgeText:{color:'#0284C7',fontSize:10,fontWeight:'900',textTransform:'uppercase'},
    orderTitle:{fontSize:18,fontWeight:'bold',color:'#0F172A'},
    orderPayout:{fontSize:24,fontWeight:'900',color:'#0284C7'},
    orderDist:{fontSize:12,fontWeight:'bold',color:'#94A3B8',marginTop:4},
    addressRow:{flexDirection:'row',alignItems:'center',marginTop:16,marginBottom:20},
    addressText:{fontSize:14,color:'#475569',flex:1},
    actionRow:{flexDirection:'row',gap:12},
    ignoreBtn:{flex:1,backgroundColor:'#F8FAFC',paddingVertical:14,borderRadius:12,alignItems:'center'},
    ignoreText:{color:'#64748B',fontWeight:'bold',fontSize:16},
    acceptBtn:{flex:1,backgroundColor:'#0284C7',paddingVertical:14,borderRadius:12,alignItems:'center'},
    acceptText:{color:'#FFF',fontWeight:'bold',fontSize:16},

    historyFiltersRow:{flexDirection:'row',marginBottom:8},
    filterPill:{paddingHorizontal:20,paddingVertical:10,borderRadius:20,marginRight:8,borderWidth:1},
    filterPillActive:{backgroundColor:'#0F172A',borderColor:'#0F172A'},
    filterPillInactive:{backgroundColor:'#FFF',borderColor:'#E2E8F0'},
    filterText:{fontWeight:'bold',fontSize:14},
    filterTextActive:{color:'#FFF'},
    filterTextInactive:{color:'#64748B'},
    reasonBox:{backgroundColor:'#FEF2F2',padding:8,borderRadius:8,marginTop:12},
    reasonTextSmall:{color:'#EF4444',fontSize:12,fontWeight:'600'},
    historyFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:16,paddingTop:16,borderTopWidth:1,borderTopColor:'#F1F5F9'},
    historyDate:{fontSize:12,fontWeight:'bold',color:'#94A3B8'},
    statusBadge:{paddingHorizontal:10,paddingVertical:4,borderRadius:6},
    statusGreen:{backgroundColor:'#DCFCE7'},
    statusRed:{backgroundColor:'#FEE2E2'},
    statusGray:{backgroundColor:'#F1F5F9'},
    statusText:{fontSize:10,fontWeight:'900',textTransform:'uppercase',letterSpacing:0.5},

    emptyState:{alignItems:'center',justifyContent:'center',paddingVertical:60},
    emptyTitle:{fontSize:18,fontWeight:'bold',color:'#475569',marginTop:16},
    emptySub:{fontSize:14,color:'#94A3B8',marginTop:8},

    modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',alignItems:'center'},

    navModalContent:{width:'90%',backgroundColor:'#FFF',borderRadius:32,padding:24,alignItems:'center'},
    successIconBox:{width:64,height:64,borderRadius:32,backgroundColor:'#22C55E',justifyContent:'center',alignItems:'center',marginBottom:16},
    navModalTitle:{fontSize:24,fontWeight:'900',color:'#0F172A'},
    navModalSub:{fontSize:14,color:'#64748B',marginBottom:24},
    routeBox:{width:'100%',backgroundColor:'#F8FAFC',borderRadius:20,padding:16,marginBottom:24,borderWidth:1,borderColor:'#F1F5F9'},
    routeRow:{flexDirection:'row',alignItems:'flex-start'},
    routeDot:{width:32,height:32,borderRadius:16,marginTop:2},
    routeLabel:{fontSize:10,fontWeight:'bold',color:'#94A3B8',marginBottom:4},
    routeAddress:{fontSize:14,fontWeight:'600',color:'#0F172A'},
    routeDivider:{borderLeftWidth:2,borderStyle:'dashed',borderColor:'#CBD5E1',height:20,marginLeft:15,marginVertical:4},
    goBtn:{width:'100%',backgroundColor:'#0284C7',paddingVertical:16,borderRadius:16,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},
    goBtnText:{color:'#FFF',fontSize:16,fontWeight:'bold'},

    activeTripContainer:{flex:1,backgroundColor:'#F8FAFC'},
    mapContainer:{flex:1,position:'relative',overflow:'hidden'},
    mapPinContainer:{position:'absolute',top:'50%',left:'50%',transform:[{translateX:-20},{translateY:-40}],alignItems:'center'},
    mapPulse:{position:'absolute',width:60,height:60,borderRadius:30,backgroundColor:'rgba(2,132,199,0.3)',top:-10,left:-10},
    mapPin:{width:40,height:40,borderRadius:20,backgroundColor:'#0284C7',justifyContent:'center',alignItems:'center'},
    mapTopBar:{position:'absolute',top:50,left:16,right:16,flexDirection:'row',justifyContent:'space-between'},
    mapBackBtn:{width:48,height:48,backgroundColor:'#FFF',borderRadius:24,justifyContent:'center',alignItems:'center',shadowColor:'#000',shadowOpacity:0.1,shadowRadius:5},
    liveGpsBadge:{backgroundColor:'#FFF',paddingHorizontal:16,borderRadius:24,flexDirection:'row',alignItems:'center',shadowColor:'#000',shadowOpacity:0.1,shadowRadius:5},
    liveGpsDot:{width:8,height:8,borderRadius:4,backgroundColor:'#22C55E',marginRight:8},
    liveGpsText:{fontWeight:'bold',fontSize:14,color:'#0F172A'},

    bottomSheet:{backgroundColor:'#FFF',borderTopLeftRadius:32,borderTopRightRadius:32,padding:24,shadowColor:'#000',shadowOffset:{width:0,height:-10},shadowOpacity:0.1,shadowRadius:20,elevation:20},
    sheetHandle:{width:40,height:6,backgroundColor:'#E2E8F0',borderRadius:3,alignSelf:'center',marginBottom:20},
    sheetSubtitle:{fontSize:10,fontWeight:'900',color:'#0284C7',letterSpacing:1,marginBottom:4},
    sheetTitle:{fontSize:24,fontWeight:'bold',color:'#0F172A',marginBottom:4},
    sheetAddress:{fontSize:14,color:'#64748B',marginBottom:20},
    sheetActionRow:{flexDirection:'row',gap:12,marginBottom:16},
    sheetTopRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},
    stepBadge:{backgroundColor:'#EFF6FF',paddingHorizontal:10,paddingVertical:4,borderRadius:20},
    stepBadgeText:{fontSize:10,fontWeight:'900',color:'#0284C7',letterSpacing:.5},
    vTypePill:{flexDirection:'row',alignItems:'center',backgroundColor:'#F5F3FF',paddingHorizontal:10,paddingVertical:4,borderRadius:20},
    vTypeText:{fontSize:11,fontWeight:'800',color:'#7C3AED'},
    payoutPill:{flexDirection:'row',alignItems:'center',backgroundColor:'#EFF6FF',paddingHorizontal:10,paddingVertical:4,borderRadius:20,gap:4},
    payoutPillText:{fontSize:11,fontWeight:'800',color:'#0284C7'},

    circleBtn:{width:52,height:52,borderRadius:16,justifyContent:'center',alignItems:'center'},

    quickStrip:{flexDirection:'row',gap:8,marginBottom:14},
    quickChip:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:'#F8FAFC',borderWidth:1.5,borderColor:'#E2E8F0',paddingVertical:10,borderRadius:14},
    quickChipText:{fontSize:11,fontWeight:'700',color:'#334155'},

    // Ack modal redesign
    ackHeader:{flexDirection:'row',alignItems:'center',marginBottom:16},
    ackModalSub:{fontSize:12,fontWeight:'600',color:'#64748B'},
    ackChecklist:{backgroundColor:'#F8FAFC',borderRadius:16,padding:14,marginBottom:16,gap:10},
    ackCheckRow:{flexDirection:'row',alignItems:'center',gap:10},
    ackCheckDot:{width:22,height:22,borderRadius:11,backgroundColor:'#DCFCE7',justifyContent:'center',alignItems:'center'},
    ackCheckText:{fontSize:13,fontWeight:'600',color:'#334155'},

    navBtn:{flex:1,backgroundColor:'#2563EB',paddingVertical:16,borderRadius:16,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},
    navBtnText:{color:'#FFF',fontWeight:'bold',fontSize:16},
    callBtn:{width:56,height:56,borderRadius:16,justifyContent:'center',alignItems:'center'},
    arriveBtn:{backgroundColor:'#F0F9FF',borderWidth:2,borderColor:'#0284C7',paddingVertical:16,borderRadius:16,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12},
    arriveBtnText:{color:'#0284C7',fontSize:18,fontWeight:'900'},
    sheetCancelBtn:{marginTop:16,alignItems:'center',paddingVertical:12},
    sheetCancelText:{color:'#EF4444',fontWeight:'bold',fontSize:16},

    otpSection:{alignItems:'center'},
    otpIconBox:{width:64,height:64,borderRadius:32,backgroundColor:'#F0F9FF',justifyContent:'center',alignItems:'center',marginBottom:16},
    otpTitle:{fontSize:24,fontWeight:'bold',color:'#0F172A',marginBottom:8},
    otpSub:{fontSize:14,color:'#64748B',marginBottom:24},
    otpInput:{width:200,height:64,backgroundColor:'#F8FAFC',borderWidth:2,borderColor:'#E2E8F0',borderRadius:16,fontSize:32,fontWeight:'bold',letterSpacing:8,textAlign:'center',color:'#0F172A',marginBottom:24},
    verifyBtn:{width:'100%',backgroundColor:'#16A34A',paddingVertical:16,borderRadius:16,alignItems:'center'},
    verifyBtnText:{color:'#FFF',fontSize:18,fontWeight:'900'},

    ackModalContent:{width:'92%',backgroundColor:'#FFF',borderRadius:32,padding:24,alignItems:'stretch'},
    ackIconBox:{width:52,height:52,borderRadius:16,backgroundColor:'#E0F2FE',justifyContent:'center',alignItems:'center'},
    ackModalTitle:{fontSize:18,fontWeight:'900',color:'#0F172A'},
    ackWarningBox:{flexDirection:'row',alignItems:'flex-start',backgroundColor:'#FEF3C7',borderColor:'#FDE68A',borderWidth:1,borderRadius:16,padding:14,marginBottom:14},
    ackWarningText:{fontSize:13,color:'#92400E',lineHeight:20,flex:1},

    photoUploadBox:{width:'100%',borderWidth:2,borderColor:'#CBD5E1',borderStyle:'dashed',borderRadius:16,overflow:'hidden',marginBottom:24,backgroundColor:'#F8FAFC',minHeight:130},
    photoUploadBoxSuccess:{borderColor:'#10B981',borderStyle:'solid',backgroundColor:'#ECFDF5'},
    photoUploadInner:{alignItems:'center',justifyContent:'center',paddingVertical:24,paddingHorizontal:16},
    cameraIconCircle:{width:56,height:56,borderRadius:28,backgroundColor:'#E0F2FE',justifyContent:'center',alignItems:'center',marginBottom:10},
    photoUploadTitle:{fontSize:15,fontWeight:'700',color:'#0F172A',marginBottom:4},
    photoUploadSubtitle:{fontSize:13,color:'#94A3B8'},
    photoPreviewWrapper:{width:'100%',height:180,position:'relative'},
    photoPreviewImage:{width:'100%',height:'100%'},
    photoPreviewBadge:{position:'absolute',top:10,left:10,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',paddingHorizontal:10,paddingVertical:4,borderRadius:20,gap:4,shadowColor:'#000',shadowOpacity:0.1,shadowRadius:4},
    photoPreviewBadgeText:{fontSize:12,fontWeight:'700',color:'#10B981'},
    retakeBtn:{position:'absolute',bottom:10,right:10,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(0,0,0,0.55)',paddingHorizontal:12,paddingVertical:6,borderRadius:20,gap:5},
    retakeBtnText:{color:'#FFF',fontSize:12,fontWeight:'700'},

    confirmAckBtn:{width:'100%',backgroundColor:'#0284C7',paddingVertical:16,borderRadius:16,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,marginBottom:12},
    confirmAckText:{color:'#FFF',fontWeight:'bold',fontSize:16},
    cancelAckBtn:{paddingVertical:12},
    cancelAckText:{color:'#64748B',fontWeight:'bold',fontSize:14},

    cancelModalContent:{width:'90%',backgroundColor:'#FFF',borderRadius:32,padding:24},
    cancelModalTitle:{fontSize:20,fontWeight:'bold',color:'#EF4444',textAlign:'center',marginBottom:8},
    cancelModalSub:{fontSize:14,color:'#64748B',textAlign:'center',marginBottom:24},
    reasonList:{maxHeight:300,marginBottom:24},
    reasonRow:{flexDirection:'row',alignItems:'center',padding:16,borderRadius:16,borderWidth:2,borderColor:'#F1F5F9',marginBottom:8},
    reasonRowActive:{borderColor:'#EF4444',backgroundColor:'#FEF2F2'},
    radioOuter:{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:'#CBD5E1',justifyContent:'center',alignItems:'center',marginRight:12},
    radioOuterActive:{borderColor:'#EF4444'},
    radioInner:{width:12,height:12,borderRadius:6,backgroundColor:'#EF4444'},
    reasonText:{fontSize:14,fontWeight:'600',color:'#475569'},
    reasonTextActive:{color:'#B91C1C'},
    confirmCancelBtn:{backgroundColor:'#EF4444',paddingVertical:16,borderRadius:16,alignItems:'center',marginBottom:12},
    confirmCancelText:{color:'#FFF',fontWeight:'bold',fontSize:16},
    backBtn:{backgroundColor:'#F1F5F9',paddingVertical:16,borderRadius:16,alignItems:'center'},
    backBtnText:{color:'#475569',fontWeight:'bold',fontSize:16},
});
