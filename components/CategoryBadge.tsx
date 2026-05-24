import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORY_COLORS, RADIUS, SPACING, FONT } from '@/constants/theme';

interface Props { category: string; small?: boolean }

export default function CategoryBadge({ category, small }: Props) {
  const color = CATEGORY_COLORS[category] ?? '#94A3B8';
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }, small && styles.sm]}>
      <Text style={[styles.text, { color }, small && styles.smText]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: FONT.sizes.xs, fontWeight: '600' },
  smText: { fontSize: 10 },
});
