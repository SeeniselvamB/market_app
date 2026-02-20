// src/screens/BillingScreen.tsx
// Shows all customers who have orders today.

import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer } from '../utils/types';
import { SectionHeader, EmptyState, Badge, Button } from '../components/UIComponents';

export default function BillingScreen() {
  const { state, calculateOrderTotal } = useApp();
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {}, [state]));

  const orderedCustomers = state.customers.filter(c =>
    state.todayOrders[c.id]?.items?.some(i => i.qty > 0),
  );

  const renderItem = ({ item: c }: { item: Customer }) => {
    const bill = state.todayBills[c.id];
    const todayTotal = calculateOrderTotal(c.id);
    const isBilled = !!bill;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.custName}>{c.name}</Text>
            {c.phone ? <Text style={styles.custSub}>{c.phone}</Text> : null}
          </View>
          <Badge label={isBilled ? '✓ Billed' : 'Pending'} variant={isBilled ? 'green' : 'orange'} />
        </View>
        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={[styles.miniValue, { color: COLORS.green }]}>{formatCurrency(todayTotal)}</Text>
            <Text style={styles.miniLabel}>Today</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={[styles.miniValue, { color: COLORS.orange }]}>{formatCurrency(c.pendingAmount)}</Text>
            <Text style={styles.miniLabel}>Prev Pending</Text>
          </View>
          {isBilled && (
            <View style={styles.miniStat}>
              <Text style={[styles.miniValue, { color: COLORS.red }]}>{formatCurrency(bill.newPending)}</Text>
              <Text style={styles.miniLabel}>New Pending</Text>
            </View>
          )}
        </View>
        <Button
          label={isBilled ? '✏️ Edit Bill' : '💰 Bill Now'}
          onPress={() => navigation.navigate('BillingDetail', { customerId: c.id })}
          variant={isBilled ? 'outline' : 'primary'}
          size="sm"
          full
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionHeader title="💰 Billing" subtitle="Process payments & generate invoices" />
      </View>
      <FlatList
        data={orderedCustomers}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="💳" message="Take orders first. Ordered customers will appear here for billing." />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 30 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  custName: { fontSize: 16, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  custSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  miniStats: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  miniStat: { flex: 1, backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center' },
  miniValue: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700' },
  miniLabel: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
});
