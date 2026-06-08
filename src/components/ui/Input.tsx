import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useColors } from '../../hooks/useColors';
import { radius, font, fontSize } from '../../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  containerStyle?: ViewStyle;
  error?: string;
}

export function Input({ label, icon, right, containerStyle, style, error, ...rest }: InputProps) {
  const { colors } = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ width: '100%' }, containerStyle]}>
      {label ? (
        <Text
          style={{
            color: colors.textMuted,
            fontWeight: font.bold,
            fontSize: fontSize.xs,
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: focused ? colors.card : colors.cardMuted,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          },
        ]}
      >
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontSize: fontSize.base,
              fontWeight: font.medium,
              paddingVertical: 0,
            },
            style,
          ]}
          {...rest}
        />
        {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
      </View>
      {error ? (
        <Text style={{ color: colors.danger, fontWeight: font.semibold, fontSize: fontSize.xs, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
  },
});
