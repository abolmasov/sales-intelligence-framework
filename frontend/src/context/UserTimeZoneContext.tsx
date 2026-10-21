import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import tzLookup from 'tz-lookup';
import {
  getSystemTimeZone,
  getStoredUserTimeZone,
  getUserTimeZone,
  getUserTimeZoneSource,
  setStoredUserTimeZone,
  type TimeZoneSource,
} from '../utils/dateTime';

type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

interface UserTimeZoneContextValue {
  timeZone: string;
  locationPermission: PermissionState;
  coords: { lat: number; lng: number } | null;
  source: TimeZoneSource;
  refreshFromLocation: () => void;
}

const defaultTimeZone = getUserTimeZone();

const UserTimeZoneContext = createContext<UserTimeZoneContextValue>({
  timeZone: defaultTimeZone,
  locationPermission: 'unknown',
  coords: null,
  source: getUserTimeZoneSource(),
  refreshFromLocation: () => undefined,
});

const getBrowserSupportsGeo = () => typeof window !== 'undefined' && 'geolocation' in navigator;

export const UserTimeZoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeZone, setTimeZone] = useState(defaultTimeZone);
  const [source, setSource] = useState<TimeZoneSource>(getUserTimeZoneSource());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState>('unknown');
  const requestedOnceRef = useRef(false);

  const applyTimeZone = useCallback((tz: string, tzSource: TimeZoneSource) => {
    setTimeZone(tz);
    setSource(tzSource);
    setStoredUserTimeZone(tz, tzSource);
  }, []);

  const resolveFromLocation = useCallback(() => {
    if (!getBrowserSupportsGeo()) {
      setLocationPermission('denied');
      applyTimeZone(getSystemTimeZone(), 'system');
      return;
    }

    setLocationPermission('prompt');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationPermission('granted');
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        let resolvedTz: string | null = null;
        try {
          resolvedTz = tzLookup(latitude, longitude);
        } catch (error) {
          console.warn('Failed to resolve timezone from coordinates', error);
        }
        const nextTz = resolvedTz || getSystemTimeZone();
        applyTimeZone(nextTz, resolvedTz ? 'location' : 'system');
      },
      (error) => {
        console.warn('Geolocation error', error);
        setLocationPermission(error.code === error.PERMISSION_DENIED ? 'denied' : 'unknown');
        applyTimeZone(getSystemTimeZone(), 'system');
      },
      {
        maximumAge: 5 * 60 * 1000,
        timeout: 10 * 1000,
      }
    );
  }, [applyTimeZone]);

  useEffect(() => {
    if (requestedOnceRef.current) return;
    requestedOnceRef.current = true;

    const stored = getStoredUserTimeZone();
    if (stored) {
      setTimeZone(stored);
      setSource(getUserTimeZoneSource());
      return;
    }

    resolveFromLocation();
  }, [resolveFromLocation]);

  const value = useMemo(
    () => ({
      timeZone,
      locationPermission,
      coords,
      source,
      refreshFromLocation: resolveFromLocation,
    }),
    [coords, locationPermission, resolveFromLocation, source, timeZone]
  );

  return <UserTimeZoneContext.Provider value={value}>{children}</UserTimeZoneContext.Provider>;
};

export const useUserTimeZone = () => useContext(UserTimeZoneContext);
