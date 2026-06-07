import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleProp,
  ViewStyle,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { spacing, font, fontSize } from '../../lib/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({
  children,
  scroll = true,
  title,
  subtitle,
  right,
  contentStyle,
  edges = ['top'],
  refreshing,
  onRefresh,
}: ScreenProps) {
  const { colors } = useColors();

  const header = title ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize['3xl'] }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
