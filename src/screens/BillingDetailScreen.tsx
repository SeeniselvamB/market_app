// src/screens/BillingDetailScreen.tsx
//
// BILLING FLOW (Normal Customers Only):
// ─ Delivery Person (including Owner DP) CANNOT be billed. Blocked immediately.
// ─ For a Normal Customer, the stock deduction logic is:
//
//   For each product:
//     originalOrderQty = item.qty (from saved order)
//     deliveredQty     = qty entered at billing time
//     dpStock          = DP's current stock for this product
//
//   Case A — deliveredQty <= originalOrderQty:
//     → No DP stock check. No DP stock deduction. Deliver freely.
//
//   Case B — deliveredQty > originalOrderQty:
//     → extraQty = deliveredQty - originalOrderQty
//     → If extraQty > dpStock: BLOCK ("Stock Not Available")
//     → Else: Deduct ONLY extraQty from DP stock.
//
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency, formatShortDate } from '../utils/helpers';
import { Bill, OWNER_DP_ID } from '../utils/types';
import { RootStackParams } from '../navigation/AppNavigator';
import { Button, Divider, BillRow } from '../components/UIComponents';
import { getProductName, getCustomerName } from '../utils/translations';

type RouteType = RouteProp<RootStackParams, 'BillingDetail'>;

export default function BillingDetailScreen() {
  const { state, saveBill, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { customerId } = route.params;

  const isOwnerDpEntry = customerId === OWNER_DP_ID;
  const customer    = isOwnerDpEntry
    ? { id: OWNER_DP_ID, name: state.business.owner || state.business.name, phone: state.business.phone, address: '', pendingAmount: 0, isDeliveryPerson: true }
    : state.customers.find(c => c.id === customerId);
  const order       = state.todayOrders[customerId];
  const existingBill = state.todayBills[customerId];
  const isDp        = isOwnerDpEntry || (customer?.isDeliveryPerson ?? false);

  // Delivery Person cannot be billed — block immediately
  useEffect(() => {
    if (isDp) {
      Alert.alert(
        'Not Allowed',
        'The Delivery Person handles stock only. Invoices are generated for customers only.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }],
      );
    }
  }, [isDp]);

  // DP stock for display (for normal customers, show the DP's current stock)
  const dp = getPrimaryDeliveryPerson();
  const dpStock = (!isDp && dp) ? getDeliveryPersonStock(dp.id) : {};

  const [deliveredQtys, setDeliveredQtys] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState('');

  useEffect(() => {
    if (!order?.items) return;
    const init: Record<string, string> = {};
    order.items.forEach(item => {
      init[item.productId] = String(existingBill ? (item.delivered ?? item.qty) : item.qty);
    });
    setDeliveredQtys(init);
    if (existingBill) setPayment(String(existingBill.payment));
  }, [customerId]);

  if (!customer || !order) return null;

  // ── Live billing calculation ─────────────────────────────
  const todayTotal = order.items.reduce((sum, item) => {
    const p = state.products.find(x => x.id === item.productId);
    const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    return sum + (p ? delivered * p.price : 0);
  }, 0);

  const prevPending = customer.pendingAmount || 0;
  const grandTotal  = todayTotal + prevPending;
  const paymentNum  = parseFloat(payment) || 0;
  const newPending  = Math.max(0, grandTotal - paymentNum);

  // ── Confirm delivery & save bill ─────────────────────────
  const handleSave = async () => {
    const deliveredMap: Record<string, number> = {};
    order.items.forEach(item => {
      deliveredMap[item.productId] = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    });

    const bill: Bill = {
      todayTotal,
      prevPending,
      grandTotal,
      payment: paymentNum,
      newPending,
      billedAt: new Date().toISOString(),
    };

    const success = await saveBill(customerId, bill, deliveredMap);
    if (success) {
      Alert.alert('✅ ' + t.productDelivered,
        `Bill saved for ${getCustomerName(customer.name, (customer as any).nameTa, lang)}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  };

  // ── Share invoice text ───────────────────────────────────
  const handleShare = async () => {
    if (isDp) { Alert.alert('Not Allowed', 'No invoice for Delivery Person.'); return; }
    const today = formatShortDate();
    const customerDisplayName = getCustomerName(customer.name, (customer as any).nameTa, lang);
    const lines: string[] = [];
    lines.push('='.repeat(44));
    lines.push(`        ${state.business.name}`);
    if (state.business.owner) lines.push(`        ${state.business.owner}`);
    if (state.business.phone) lines.push(`        Ph: ${state.business.phone}`);
    lines.push('='.repeat(44));
    lines.push(`DATE     : ${today}`);
    lines.push(`CUSTOMER : ${customerDisplayName}`);
    if (customer.phone)            lines.push(`PHONE    : ${customer.phone}`);
    if ((customer as any).address) lines.push(`ADDRESS  : ${(customer as any).address}`);
    lines.push('-'.repeat(44));
    lines.push(`${'ITEM'.padEnd(16)}${'QTY'.padEnd(8)}${'UNIT'.padEnd(8)}AMOUNT`);
    lines.push('-'.repeat(44));
    order.items.forEach(item => {
      const p = state.products.find(x => x.id === item.productId);
      if (!p) return;
      const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
      const amt = delivered * p.price;
      const pName = getProductName(p.name, p.nameTa, lang);
      lines.push(`${pName.padEnd(16).slice(0,16)}${String(delivered).padEnd(8)}${p.unit.padEnd(8)}${formatCurrency(amt)}`);
    });
    lines.push('-'.repeat(44));
    lines.push(`${"Today's Total".padEnd(36)}${formatCurrency(todayTotal)}`);
    lines.push(`${'Previous Pending'.padEnd(36)}${formatCurrency(prevPending)}`);
    lines.push(`${'Grand Total'.padEnd(36)}${formatCurrency(grandTotal)}`);
    lines.push(`${'Payment Received'.padEnd(36)}${formatCurrency(paymentNum)}`);
    lines.push('='.repeat(44));
    lines.push(`${'BALANCE PENDING'.padEnd(36)}${formatCurrency(newPending)}`);
    lines.push('='.repeat(44));
    lines.push('  Thank you for your business!');
    try {
      await Share.share({ message: lines.join('\n'), title: `Invoice - ${customerDisplayName} - ${today}` });
    } catch {
      Alert.alert(t.error, 'Could not share invoice.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {getCustomerName(customer.name, (customer as any).nameTa, lang)}{isDp ? ' 🚚' : ''}
          </Text>
          <Text style={styles.headerSub}>{customer.phone || (customer as any).address || t.billing}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* DP Stock Panel — live preview of all stock adjustments */}
          {!isDp && dp && (
            <View style={styles.dpStockBox}>
              <Text style={styles.dpStockTitle}>
                🚚 {getCustomerName(dp.name, (dp as any).nameTa, lang)} — Stock Adjustments Preview
              </Text>
              <Text style={styles.dpStockNote}>
                {'Extra delivery → deducts from DP stock  •  Partial delivery → returns unused stock to DP'}
              </Text>
              <View style={styles.dpStockGrid}>
                {order.items.map(item => {
                  const p = state.products.find(x => x.id === item.productId);
                  if (!p) return null;
                  const currentDpStock = dpStock[item.productId] || 0;
                  const orderedQty     = item.qty;
                  const deliveredNow   = parseFloat(deliveredQtys[item.productId] || '0') || 0;
                  const diff           = deliveredNow - orderedQty;
                  // Projected DP stock after this bill
                  const projectedStock = diff > 0
                    ? currentDpStock - diff          // extra: deduct
                    : currentDpStock + Math.abs(diff); // return: add back
                  const isOver = diff > 0 && diff > currentDpStock;
                  return (
                    <View key={item.productId} style={[styles.dpStockItem, isOver && styles.dpStockItemWarn]}>
                      <Text style={styles.dpStockProd}>{getProductName(p.name, p.nameTa, lang)}</Text>
                      <Text style={[styles.dpStockQty, { color: isOver ? COLORS.red : COLORS.green }]}>
                        {currentDpStock} {p.unit}
                      </Text>
                      {diff > 0 && (
                        <Text style={[styles.dpStockAfter, { color: isOver ? COLORS.red : COLORS.orange }]}>
                          −{diff} extra → {Math.max(0, projectedStock)} {p.unit}
                        </Text>
                      )}
                      {diff < 0 && (
                        <Text style={[styles.dpStockAfter, { color: COLORS.green }]}>
                          +{Math.abs(diff)} return → {projectedStock} {p.unit}
                        </Text>
                      )}
                      {diff === 0 && (
                        <Text style={[styles.dpStockAfter, { color: COLORS.gray }]}>no change</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Items table */}
          <Text style={styles.sectionLabel}>{t.itemsOrdered}</Text>
          <Text style={styles.sectionNote}>
            {'Extra delivery deducts from DP stock. Partial delivery returns unused qty to DP stock.'}
          </Text>
          <View style={styles.itemsTable}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 2 }]}>Item</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>{t.delivered}</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>{t.amount}</Text>
            </View>
            {order.items.map(item => {
              const p = state.products.find(x => x.id === item.productId);
              if (!p) return null;
              const delivered      = parseFloat(deliveredQtys[item.productId] || '0') || 0;
              const originalQty    = item.qty;
              const diff           = delivered - originalQty;
              const dpAvail        = !isDp ? (dpStock[item.productId] ?? 0) : Infinity;
              // Error state: trying to deliver more extra than DP has
              const isOverExtra    = !isDp && diff > 0 && diff > dpAvail;
              const displayName    = getProductName(p.name, p.nameTa, lang);

              return (
                <View key={item.productId} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.itemName}>{displayName}</Text>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(p.price)}/{p.unit} • Ordered: {originalQty} {p.unit}
                    </Text>
                    {!isDp && dp && diff !== 0 && (
                      <Text style={[
                        styles.itemExtra,
                        isOverExtra ? styles.itemExtraWarn
                          : diff > 0  ? styles.itemExtraDeduct
                          : styles.itemExtraReturn,
                      ]}>
                        {diff > 0
                          ? `▲ +${diff} extra — deducts ${diff} from DP stock`
                          : `▼ ${Math.abs(diff)} unused — returns to DP stock`}
                      </Text>
                    )}
                    {!isDp && dp && diff === 0 && (
                      <Text style={styles.itemExtra}>Exact — no DP stock change</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                    <TextInput
                      style={[styles.qtyInput, isOverExtra && styles.qtyInputError]}
                      value={deliveredQtys[item.productId] || ''}
                      onChangeText={val => setDeliveredQtys(prev => ({ ...prev, [item.productId]: val }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.gray}
                    />
                    <Text style={styles.unitTag}>{p.unit}</Text>
                  </View>
                  <Text style={[styles.itemAmt, { flex: 1 }]}>
                    {formatCurrency(delivered * p.price)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Divider />

          {/* Billing summary */}
          <Text style={styles.sectionLabel}>{t.billingSummary}</Text>
          <View style={styles.summaryBox}>
            <BillRow left={t.todayTotal}      right={formatCurrency(todayTotal)} />
            <BillRow left={t.previousPending} right={formatCurrency(prevPending)} color={COLORS.orange} />
            <BillRow left={t.grandTotal}      right={formatCurrency(grandTotal)}  bold />
          </View>

          {/* Payment input */}
          <View style={styles.paymentBox}>
            <Text style={styles.paymentLabel}>{t.paymentReceived}</Text>
            <TextInput
              style={styles.paymentInput}
              value={payment}
              onChangeText={setPayment}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.gray}
            />
          </View>

          {/* New pending */}
          <View style={styles.pendingBox}>
            <Text style={styles.pendingLabel}>{t.newPendingBalance}</Text>
            <Text style={styles.pendingValue}>{formatCurrency(newPending)}</Text>
          </View>
          <Text style={styles.formula}>
            {t.formula}: {formatCurrency(prevPending)} + {formatCurrency(todayTotal)} − {formatCurrency(paymentNum)} = {formatCurrency(newPending)}
          </Text>

          <Divider />

          <View style={styles.btnRow}>
            <Button label={t.shareInvoice} onPress={handleShare} variant="outline" style={{ flex: 1 }} />
            <Button label={t.saveBill}     onPress={handleSave}  style={{ flex: 2 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md, ...SHADOW.medium },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },
  headerTitle: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },
  headerSub: { fontSize: 12, fontFamily: TNR, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  dpStockBox: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.green },
  dpStockTitle: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green, marginBottom: 2 },
  dpStockNote: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.sm, lineHeight: 16 },
  dpStockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dpStockItem: { backgroundColor: COLORS.white, borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, minWidth: 90 },
  dpStockProd: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  dpStockQty: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  dpStockAfter: { fontSize: 10, fontFamily: TNR, marginTop: 2 },
  sectionLabel: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  sectionNote: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },
  itemsTable: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  tableHead: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  itemName: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  itemPrice: { fontSize: 11, fontFamily: TNR, color: COLORS.gray },
  itemExtra: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginTop: 1 },
  itemExtraDeduct: { color: COLORS.orange, fontFamily: TNR_BOLD, fontWeight: '600' },
  itemExtraReturn: { color: COLORS.green, fontFamily: TNR_BOLD, fontWeight: '600' },
  itemExtraWarn: { color: COLORS.red, fontFamily: TNR_BOLD, fontWeight: '700' },
  dpStockItemWarn: { borderColor: COLORS.red },
  itemAmt: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green, textAlign: 'right' },
  qtyInput: { borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, width: 52, paddingVertical: 6, textAlign: 'center', fontSize: 15, color: COLORS.dark, fontFamily: TNR_BOLD, fontWeight: '700' },
  qtyInputError: { borderColor: COLORS.red },
  unitTag: { fontSize: 11, fontFamily: TNR_BOLD, color: COLORS.gray, fontWeight: '600' },
  summaryBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  paymentBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  paymentLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  paymentInput: { borderWidth: 2, borderColor: COLORS.green, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  pendingBox: { backgroundColor: COLORS.redLight, borderRadius: RADIUS.md, padding: SPACING.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.red },
  pendingLabel: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.red },
  pendingValue: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.red },
  formula: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
});
