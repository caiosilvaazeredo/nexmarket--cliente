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

/** Web variant of MapPanel. react-native-maps is a native-only module (Metro
 * fails to even bundle it for web), so on this platform the map is always the
 * branded placeholder — same visual used on native when the module is absent. */
export function MapPanel({ region, style, height = 220 }: MapPanelProps) {
  const { colors } = useColors();

  return (
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
        Mapa
      </Text>
      {region ? (
        <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 2 }}>
          {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
        </Text>
      ) : null}
    </View>
  );
}
