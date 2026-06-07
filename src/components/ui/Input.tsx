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
  containerStyle?: ViewStyle;
}

export function Input({ label, icon, containerStyle, style, ...rest }: InputProps) {
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
            borderColor: focused ? colors.primary : colors.border,
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
      </View>
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
