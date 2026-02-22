import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer } from '../utils/types';
import { getCustomerName, getProductName } from '../utils/translations';
import { SectionHeader, EmptyState, Badge, Button } from '../components/UIComponents';

export default function BillingScreen() {
  const { state, calculateOrderTotal, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {}, [state]));

  // Delivery Person (including owner DP via OWNER_DP_ID) is excluded from billing — stock-only
  const orderedCustomers = state.customers.filter(c =>
    !c.isDeliveryPerson &&
    state.todayOrders[c.id]?.items?.some(i => i.qty > 0),
  );

  // Show DP's current remaining stock as a reference panel
  const dp = getPrimaryDeliveryPerson();
  const dpId = dp?.id ?? null;
  const dpStock = dpId ? getDeliveryPersonStock(dpId) : {};
  const dpStockItems = Object.entries(dpStock).filter(([, qty]) => qty > 0);

  const renderItem = ({ item: c }: { item: Customer }) => {
    const bill = state.todayBills[c.id];
    const todayTotal  = calculateOrderTotal(c.id);
    const isBilled    = !!bill;
    const displayName = getCustomerName(c.name, c.nameTa, lang);

    // DP: show remaining stock
    const dpStockItems = c.isDeliveryPerson
      ? Object.entries(getDeliveryPersonStock(c.id)).filter(([, q]) => q > 0)
      : [];

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.custName}>{displayName}{c.isDeliveryPerson ? ' 🚚' : ''}</Text>
            {c.phone ? <Text style={styles.custSub}>{c.phone}</Text> : null}
            {dpStockItems.length > 0 && (
              <Text style={styles.dpStockSub}>
                🚚 {dpStockItems.length} product(s) remaining in stock
              </Text>
            )}
          </View>
          <Badge label={isBilled ? t.billed : t.pending2} variant={isBilled ? 'green' : 'orange'} />
        </View>
        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={[styles.miniValue, { color: COLORS.green }]}>{formatCurrency(todayTotal)}</Text>
            <Text style={styles.miniLabel}>{t.todayTotal}</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={[styles.miniValue, { color: COLORS.orange }]}>{formatCurrency(c.pendingAmount)}</Text>
            <Text style={styles.miniLabel}>{t.previousPending}</Text>
          </View>
          {isBilled && (
            <View style={styles.miniStat}>
              <Text style={[styles.miniValue, { color: COLORS.red }]}>{formatCurrency(bill.newPending)}</Text>
              <Text style={styles.miniLabel}>{t.newPendingBalance}</Text>
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
        <SectionHeader title={`💰 ${t.billing}`} subtitle="Confirm deliveries & process payments" />
      </View>

      {/* Delivery Person Stock Reference Panel */}
      {dp && dpStockItems.length > 0 && (
        <View style={styles.dpStockPanel}>
          <Text style={styles.dpStockTitle}>
            🚚 {getCustomerName(dp.name, dp.nameTa, lang)} — Available Stock
          </Text>
          <View style={styles.dpStockRow}>
            {dpStockItems.map(([pid, qty]) => {
              const p = state.products.find(x => x.id === pid);
              if (!p) return null;
              return (
                <View key={pid} style={styles.dpStockChip}>
                  <Text style={styles.dpStockChipName}>{getProductName(p.name, p.nameTa, lang)}</Text>
                  <Text style={styles.dpStockChipQty}>{qty} {p.unit}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.dpStockNote}>Stock reduces as you confirm customer deliveries.</Text>
        </View>
      )}
      <FlatList
        data={orderedCustomers}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="💳" message="Take orders first. Ordered customers appear here for billing." />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  dpStockPanel: { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, backgroundColor: '#E8F5E9', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.green },
  dpStockTitle: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green, marginBottom: SPACING.sm },
  dpStockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  dpStockChip: { backgroundColor: COLORS.white, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  dpStockChipName: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  dpStockChipQty: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  dpStockNote: { fontSize: 11, fontFamily: TNR, color: COLORS.gray },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 30 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  custName: { fontSize: 16, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  custSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  dpStockSub: { fontSize: 11, fontFamily: TNR_BOLD, color: COLORS.green, marginTop: 2 },
  miniStats: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  miniStat: { flex: 1, backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center' },
  miniValue: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700' },
  miniLabel: { fontSize: 10, fontFamily: TNR, color: COLORS.gray, marginTop: 2, textAlign: 'center' },
});
