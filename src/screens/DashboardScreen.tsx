// src/screens/DashboardScreen.tsx
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { OWNER_DP_ID } from '../utils/types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { getProductName, getCustomerName } from '../utils/translations';
import { Card, CardHeader, StatCard, EmptyState, Button, Badge } from '../components/UIComponents';

export default function DashboardScreen() {
  const { state, startNewDay, calculateOrderTotal, getMarketTotals, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {}, [state]));

  // ── Summary stats (normal customers only — DP is not billed) ─
  let totalSales = 0, totalReceived = 0, totalPending = 0, orderCount = 0;
  Object.keys(state.todayOrders).forEach(custId => {
    if (custId === OWNER_DP_ID) return; // exclude owner DP from financial stats
    const customer = state.customers.find(c => c.id === custId);
    if (customer?.isDeliveryPerson) return; // exclude customer DP from financial stats
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

  // ── Market purchase totals: ALL orders combined ───────────
  // This is what the owner needs to buy from the market today.
  // Delivery person + all normal customer orders = total market purchase qty.
  const purchaseTotals = getMarketTotals();

  // ── Delivery person stock status ──────────────────────────
  const dp = getPrimaryDeliveryPerson();
  const dpStock = dp ? getDeliveryPersonStock(dp.id) : {};

  // ── Ordered customers list (real customers only) ──────────
  const orderedCustomers = state.customers.filter(c =>
    !c.isDeliveryPerson &&
    state.todayOrders[c.id]?.items?.some(i => i.qty > 0),
  );

  const handleNewDay = () => {
    Alert.alert(t.startNewDay, t.startNewDayMsg,
      [{ text: t.cancel, style: 'cancel' }, { text: t.yesNewDay, onPress: startNewDay }]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBizName}>{state.business.name}</Text>
          <Text style={styles.topDate}>{formatDate()}</Text>
        </View>
        <Button label={t.newDay} onPress={handleNewDay} size="sm" variant="outline" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Summary cards */}
        <View style={styles.statsGrid}>
          <StatCard value={formatCurrency(totalSales)}    label={t.totalSales}  color={COLORS.green} />
          <StatCard value={formatCurrency(totalReceived)} label={t.collected}   color={COLORS.green} />
          <StatCard value={formatCurrency(totalPending)}  label={t.pending}     color={COLORS.red}   />
          <StatCard value={String(orderCount)}            label={t.ordersToday} color={COLORS.orange} />
        </View>

        {/* TODAY MARKET PURCHASE LIST
            Shows COMBINED quantity from ALL orders (normal customers + delivery person).
            This represents the total market purchase needed today.
            The "DP Remaining" chip shows how much stock the DP still holds after deliveries. */}
        <Card>
          <CardHeader
            title={t.morningPurchasePlan}
            right={<Badge label={t.marketList} variant="orange" />}
          />
          <Text style={styles.planNote}>{t.purchasePlanNote}</Text>
          {Object.keys(purchaseTotals).length === 0 ? (
            <EmptyState icon="🧺" message={t.noOrdersYet} />
          ) : (
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHead, { flex: 2 }]}>{t.product}</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Total Qty</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>{t.estCost}</Text>
              </View>
              {Object.keys(purchaseTotals).map(pid => {
                const p = state.products.find(x => x.id === pid);
                if (!p) return null;
                const displayName = getProductName(p.name, p.nameTa, lang);
                const dpHas = dpStock[pid] ?? 0;
                const totalQty = purchaseTotals[pid];
                return (
                  <View key={pid} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tableCell}>{displayName}</Text>
                      <Text style={styles.tableCellSub}>{p.category || 'General'}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={styles.tableCellBold}>
                        {totalQty} {p.unit}
                      </Text>
                      {dp && (
                        <Text style={[styles.dpStockChip, { color: dpHas > 0 ? COLORS.green : COLORS.gray }]}>
                          🚚 {dpHas} {p.unit} left
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.tableCellGreen, { flex: 1, textAlign: 'right' }]}>
                      {formatCurrency(totalQty * p.price)}
                    </Text>
                  </View>
                );
              })}
              {/* Grand total cost */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Market Cost</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(
                    Object.keys(purchaseTotals).reduce((sum, pid) => {
                      const p = state.products.find(x => x.id === pid);
                      return sum + (p ? purchaseTotals[pid] * p.price : 0);
                    }, 0)
                  )}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Delivery Person Stock Panel */}
        {dp && Object.keys(dpStock).some(k => dpStock[k] > 0) && (
          <Card style={styles.dpCard}>
            <CardHeader
              title={`🚚 ${dp.id === OWNER_DP_ID ? (state.business.owner || state.business.name) : getCustomerName(dp.name, (dp as any).nameTa, lang)} — ${t.deliveryPersonStock}`}
              right={<Badge label="Live" variant="green" />}
            />
            <Text style={styles.planNote}>Stock remaining with delivery person after deductions.</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 2 }]}>{t.product}</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>Remaining</Text>
            </View>
            {Object.entries(dpStock).map(([pid, qty]) => {
              if (qty <= 0) return null;
              const p = state.products.find(x => x.id === pid);
              if (!p) return null;
              return (
                <View key={pid} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {getProductName(p.name, p.nameTa, lang)}
                  </Text>
                  <Text style={[styles.tableCellBold, { flex: 1, textAlign: 'right', color: qty > 0 ? COLORS.green : COLORS.red }]}>
                    {qty} {p.unit}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Customer Orders Today */}
        <Card>
          <CardHeader title={t.customerOrdersToday} />
          {orderedCustomers.length === 0 ? (
            <EmptyState icon="📦" message={t.noOrdersToday} />
          ) : (
            orderedCustomers.map(c => {
              const bill = state.todayBills[c.id];
              const total = calculateOrderTotal(c.id);
              const displayName = getCustomerName(c.name, c.nameTa, lang);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.orderRow}
                  onPress={() => navigation.navigate('BillingDetail', { customerId: c.id })}
                  activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderName}>
                      {displayName}{c.isDeliveryPerson ? ' 🚚' : ''}
                    </Text>
                    <Text style={styles.orderSub}>
                      {formatCurrency(total)} • {state.todayOrders[c.id]?.items?.filter(i => i.qty > 0).length} {t.items}
                    </Text>
                  </View>
                  <Badge label={bill ? t.billed : t.pending2} variant={bill ? 'green' : 'orange'} />
                </TouchableOpacity>
              );
            })
          )}
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.md, justifyContent: 'space-between' },
  planNote: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: 4 },
  tableHead: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableCell: { fontSize: 13, fontFamily: TNR, color: COLORS.dark },
  tableCellSub: { fontSize: 11, fontFamily: TNR, color: COLORS.gray },
  tableCellBold: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  tableCellGreen: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green },
  dpStockChip: { fontSize: 10, fontFamily: TNR_BOLD, color: COLORS.green, fontWeight: '700', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.md, marginTop: SPACING.sm },
  totalLabel: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  totalValue: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  dpCard: { marginTop: 0, borderColor: COLORS.green, borderWidth: 1.5 },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  orderName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  orderSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
});
