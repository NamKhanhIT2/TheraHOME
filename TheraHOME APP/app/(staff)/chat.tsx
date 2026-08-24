import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { AdminThreadsList } from '@/components/chat/AdminThreadsList';

export default function StaffChatTab() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <AdminThreadsList />
    </View>
  );
}
