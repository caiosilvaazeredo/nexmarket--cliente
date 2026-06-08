import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { radius, font } from '../lib/theme';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
}

interface MapPanelProps {
  region?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  markers?: MapMarker[];
  showsUser?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

/**
 * Lazy + guarded load of react-native-maps so the app still runs (with a
 * branded placeholder) on clients where the native map module is absent
 * (e.g. Expo Go without a dev build / missing API key). Used to show the
 * driver moving toward the customer in real time (RF21).
 */
let Maps: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Maps = require('react-native-maps');
} catch {
  Maps = null;
}

class MapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function MapPanel({
  region,
  markers = [],
  showsUser = false,
  style,
  height = 220,
}: MapPanelProps) {
  const { colors, dark } = useColors();

  const Placeholder = (
    <View
      style={[
        {
          height,
          borderRadius: radius['2xl'],
          backgroundColor: colors.cardMuted,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <MapPin color={colors.primary} size={32} />
      <Text style={{ color: colors.textMuted, fontWeight: font.bold, marginTop: 8 }}>
        Mapa de acompanhamento
      </Text>
      {markers.length ? (
        <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 2 }}>
          {markers.map((m) => m.title).filter(Boolean).join(' → ')}
        </Text>
      ) : null}
    </View>
  );

  if (!Maps || !Maps.default || !region) return Placeholder;

  const MapView = Maps.default;
  const Marker = Maps.Marker;

  return (
    <MapErrorBoundary fallback={Placeholder}>
      <View
        style={[
          { height, borderRadius: radius['2xl'], overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
          style,
        ]}
      >
        <MapView
          style={{ flex: 1 }}
          initialRegion={region}
          region={region}
          showsUserLocation={showsUser}
          showsMyLocationButton={false}
          userInterfaceStyle={dark ? 'dark' : 'light'}
          toolbarEnabled={false}
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={m.title}
              pinColor={m.color || colors.primary}
            />
          ))}
        </MapView>
      </View>
    </MapErrorBoundary>
  );
}
