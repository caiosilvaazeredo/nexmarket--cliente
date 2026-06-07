import React from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useColors } from '../../hooks/useColors';
import { radius, font, fontSize } from '../../lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'default' | 'lg';

interface ButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
}

/**
 * Duolingo-style 3D button. The colored bottom border + press-down animation
 * recreate the loja's tactile feel (active:translate-y-1 active:border-b-0).
 */
export function Button({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled,
  loading,
  icon,
  fullWidth = true,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useColors();

  const palettes: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: { bg: colors.primary, border: colors.primaryDark, text: '#FFFFFF' },
    secondary: { bg: colors.card, border: colors.border, text: colors.textMuted },
    danger: { bg: colors.danger, border: colors.dangerDark, text: '#FFFFFF' },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.textMuted },
  };
  const p = palettes[variant];

  const heights: Record<Size, number> = { sm: 40, default: 52, lg: 58 };
  const textSizes: Record<Size, number> = {
    sm: fontSize.sm,
    default: fontSize.base,
    lg: fontSize.lg,
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderBottomWidth: variant === 'ghost' ? 0 : pressed ? 1 : 4,
          borderWidth: variant === 'secondary' ? 2 : 0,
          height: heights[size],
          borderRadius: radius.lg,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ translateY: pressed && variant !== 'ghost' ? 3 : 0 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? 14 : 20,
        },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          {children ??
            (label ? (
              <Text
                style={[
                  {
                    color: p.text,
                    fontSize: textSizes[size],
                    fontWeight: font.bold,
                    marginLeft: icon ? 8 : 0,
                  },
                  textStyle,
                ]}
              >
                {label}
              </Text>
            ) : null)}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
