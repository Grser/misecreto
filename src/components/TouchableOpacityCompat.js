import React from 'react';
import { Pressable } from 'react-native';

/**
 * Compat wrapper for `TouchableOpacity` behavior using Pressable.
 * This avoids deprecated `pointerEvents` prop usage on react-native-web.
 */
export default function TouchableOpacityCompat({
  activeOpacity = 0.2,
  style,
  children,
  disabled,
  ...props
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        typeof style === 'function' ? style({ pressed }) : style,
        pressed && !disabled ? { opacity: activeOpacity } : null,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
