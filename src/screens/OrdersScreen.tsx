// src/screens/OrdersScreen.tsx
// Lists all customers. Tap to enter/edit their order for today.

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer } from '../utils/types';
import { SectionHeader, EmptyState, Badge } from '../components/UIComponents';

export default function OrdersScreen() {
  const { state, calculateOrderTotal } = useApp();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => {}, [state]));

  const filtered = state.customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search),
  );

  const renderCustomer = ({ item: c }: { item: Customer }) => {
    const order = state.todayOrders[c.id];
    const hasOrder = order?.items?.some(i => i.qty > 0);
    const orderTotal = hasOrder ? calculateOrderTotal(c.id) : 0;
    const itemCount = hasOrder ? order.items.filter(i => i.qty > 0).length : 0;

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => navigation.navigate('OrderEntry', { customerId: c.id })}
        activeOpacity={0.8}>
        <View style={styles.custLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{c.name[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.custName}>{c.name}</Text>
            <Text style={styles.custSub}>{c.phone || c.address || 'No contact info'}</Text>
            {hasOrder && (
              <Text style={styles.orderInfo}>{itemCount} items • {formatCurrency(orderTotal)}</Text>
            )}
          </View>
        </View>
        <Badge label={hasOrder ? '✓ Ordered' : '+ Order'} variant={hasOrder ? 'green' : 'gray'} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionHeader title="🛍️ Take Orders" subtitle="Tap a customer to enter today's order" />
      </View>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer..."
          placeholderTextColor={COLORS.gray}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          state.customers.length === 0
            ? <EmptyState icon="👥" message="No customers yet. Add them in Settings." />
            : <EmptyState icon="🔍" message="No customers match your search." />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: TNR, color: COLORS.dark, paddingVertical: 11 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 30 },
  customerCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small },
  custLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.greenPale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green },
  custName: { fontSize: 16, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  custSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  orderInfo: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green, marginTop: 2 },
});
