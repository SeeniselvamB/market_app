// src/screens/DashboardScreen.tsx
// Shows daily stats, market purchase plan, and order summary.

import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Card, CardHeader, StatCard, EmptyState, Button, Badge } from '../components/UIComponents';

export default function DashboardScreen() {
  const { state, startNewDay, calculateOrderTotal } = useApp();
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {}, [state]));

  // ── Summary stats ──────────────────────────────────────────
  let totalSales = 0, totalReceived = 0, totalPending = 0, orderCount = 0;
  Object.keys(state.todayOrders).forEach(custId => {
    const order = state.todayOrders[custId];
    if (!order?.items?.some(i => i.qty > 0)) return;
    orderCount++;
    const bill = state.todayBills[custId];
    if (bill) {
      totalSales    += bill.todayTotal;
      totalReceived += bill.payment;
      totalPending  += bill.newPending;
    } else {
      totalSales += calculateOrderTotal(custId);
    }
  });

  // ── Purchase plan ──────────────────────────────────────────
  const purchaseTotals: Record<string, number> = {};
  Object.keys(state.todayOrders).forEach(custId => {
    state.todayOrders[custId]?.items?.forEach(item => {
      if (item.qty > 0) purchaseTotals[item.productId] = (purchaseTotals[item.productId] || 0) + item.qty;
    });
  });

  const orderedCustomers = state.customers.filter(c =>
    state.todayOrders[c.id]?.items?.some(i => i.qty > 0),
  );

  const handleNewDay = () => {
    Alert.alert(
      'Start New Day',
      "This will carry over pending balances and clear today's orders.",
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes, New Day', onPress: startNewDay }],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBizName}>{state.business.name}</Text>
          <Text style={styles.topDate}>{formatDate()}</Text>
        </View>
        <Button label="🔄 New Day" onPress={handleNewDay} size="sm" variant="outline" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard value={formatCurrency(totalSales)}    label="Total Sales"   color={COLORS.green} />
          <StatCard value={formatCurrency(totalReceived)} label="Collected"     color={COLORS.green} />
          <StatCard value={formatCurrency(totalPending)}  label="Pending"       color={COLORS.red}   />
          <StatCard value={String(orderCount)}            label="Orders Today"  color={COLORS.orange} />
        </View>

        {/* Purchase Plan */}
        <Card>
          <CardHeader title="🛒 Morning Purchase Plan" right={<Badge label="Market List" variant="orange" />} />
          <Text style={styles.planNote}>Quantities needed from all orders combined.</Text>
          {Object.keys(purchaseTotals).length === 0
            ? <EmptyState icon="🧺" message="No orders placed yet today." />
            : (
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHead, { flex: 2 }]}>Product</Text>
                  <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>Est. Cost</Text>
                </View>
                {Object.keys(purchaseTotals).map(pid => {
                  const p = state.products.find(x => x.id === pid);
                  if (!p) return null;
                  return (
                    <View key={pid} style={styles.tableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.tableCell}>{p.name}</Text>
                        <Text style={styles.tableCellSub}>{p.category || 'General'}</Text>
                      </View>
                      <Text style={[styles.tableCellBold, { flex: 1, textAlign: 'center' }]}>
                        {purchaseTotals[pid]} {p.unit}
                      </Text>
                      <Text style={[styles.tableCellGreen, { flex: 1, textAlign: 'right' }]}>
                        {formatCurrency(purchaseTotals[pid] * p.price)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
        </Card>

        {/* Customer Orders Today */}
        <Card>
          <CardHeader title="📋 Customer Orders Today" />
          {orderedCustomers.length === 0
            ? <EmptyState icon="📦" message="No orders today. Tap the Orders tab to take orders." />
            : orderedCustomers.map(c => {
                const bill = state.todayBills[c.id];
                const total = calculateOrderTotal(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.orderRow}
                    onPress={() => navigation.navigate('BillingDetail', { customerId: c.id })}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderName}>{c.name}</Text>
                      <Text style={styles.orderSub}>
                        {formatCurrency(total)} • {state.todayOrders[c.id]?.items?.filter(i => i.qty > 0).length} items
                      </Text>
                    </View>
                    <Badge label={bill ? '✓ Billed' : 'Pending'} variant={bill ? 'green' : 'orange'} />
                  </TouchableOpacity>
                );
              })
          }
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  topBar: { backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.medium },
  topBizName: { fontSize: 17, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },
  topDate: { fontSize: 12, fontFamily: TNR, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: 30 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.md },
  planNote: { fontSize: 13, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: 4 },
  tableHead: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableCell: { fontSize: 13, fontFamily: TNR, color: COLORS.dark },
  tableCellSub: { fontSize: 11, fontFamily: TNR, color: COLORS.gray },
  tableCellBold: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  tableCellGreen: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  orderName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  orderSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
});
