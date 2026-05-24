import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORY_COLORS, RADIUS } from '@/constants/theme';

interface Props {
  merchant: string;
  category: string;
  size?: number;
}

export default function MerchantIcon({ merchant, category, size = 44 }: Props) {
  const color = CATEGORY_COLORS[category] ?? '#94A3B8';
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: RADIUS.sm, backgroundColor: color + '22' }]}>
      <Text style={{ color, fontSize: size * 0.32, fontWeight: '700' }}>
        {merchant.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
});
