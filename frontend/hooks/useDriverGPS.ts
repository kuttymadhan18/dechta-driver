import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// Define exactly what the hook returns so TS doesn't complain
interface GPSData {
    location: [number, number];
    gpsError: string | null;
}

export default function useDriverGPS(driverMobile: string | undefined | null, isOnline: boolean): GPSData {
    // Default mock location (Chennai)
    const [location, setLocation] = useState<[number, number]>([13.0827, 80.2707]); 
    const [gpsError, setGpsError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true; 
        let locationSubscription: Location.LocationSubscription | null = null;

        const startLocationTracking = async () => {
            // Do not track if offline or missing mobile number
            if (!isOnline || !driverMobile) return;

            try {
                // Request permissions safely
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (isMounted) setGpsError("Location permission denied. Please enable it in settings.");
                    return;
                }

                // Start watching position
                const sub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced, // High can cause crashes on some web emulators
                        timeInterval: 5000,
                        distanceInterval: 10,
                    },
                    (position) => {
                        if (isMounted && position && position.coords) {
                            const { latitude, longitude } = position.coords;
                            setLocation([latitude, longitude]);
                            
                            // Clear any previous errors if successful
                            setGpsError(null); 

                            // --- SUPABASE BACKEND LOGIC (Uncomment later) ---
                            /*
                            let safeMobile = String(driverMobile).replace(/\D/g, '').slice(-10);
                            const heading = position.coords.heading || 0;
                            supabase.from('driver_profiles').update({
                                current_lat: latitude,
                                current_lng: longitude,
                                heading: heading, 
                                last_active: new Date().toISOString()
                            }).eq('mobile_number', safeMobile).catch(err => console.log(err));
                            */
                        }
                    }
                );

                // Safely assign or remove the subscription depending on component lifecycle
                if (isMounted) {
                    locationSubscription = sub;
                } else {
                    sub.remove();
                }

            } catch (error: any) { 
                if (isMounted) setGpsError(error.message || "Failed to get location");
            }
        };

        startLocationTracking();

        // Cleanup function when the driver goes offline or leaves the page
        return () => {
            isMounted = false;
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [isOnline, driverMobile]);

    return { location, gpsError };
}