// src/screens/BillingDetailScreen.tsx
// Full billing screen: edit delivered qty, enter payment,
// auto-calculate pending, share plain-text invoice.

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency, formatShortDate } from '../utils/helpers';
import { Bill } from '../utils/types';
import { RootStackParams } from '../navigation/AppNavigator';
import { Button, Divider, BillRow } from '../components/UIComponents';

type RouteType = RouteProp<RootStackParams, 'BillingDetail'>;

export default function BillingDetailScreen() {
  const { state, saveBill } = useApp();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { customerId } = route.params;

  const customer = state.customers.find(c => c.id === customerId);
  const order = state.todayOrders[customerId];
  const existingBill = state.todayBills[customerId];

  const [deliveredQtys, setDeliveredQtys] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState('');

  useEffect(() => {
    if (!order?.items) return;
    const init: Record<string, string> = {};
    order.items.forEach(item => {
      init[item.productId] = String(existingBill ? item.delivered ?? item.qty : item.qty);
    });
    setDeliveredQtys(init);
    if (existingBill) setPayment(String(existingBill.payment));
  }, [customerId]);

  if (!customer || !order) return null;

  // ── Live calculation ───────────────────────────────────────
  const todayTotal = order.items.reduce((sum, item) => {
    const p = state.products.find(x => x.id === item.productId);
    const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    return sum + (p ? delivered * p.price : 0);
  }, 0);

  const prevPending = customer.pendingAmount || 0;
  const grandTotal  = todayTotal + prevPending;
  const paymentNum  = parseFloat(payment) || 0;
  const newPending  = Math.max(0, grandTotal - paymentNum);

  // ── Save bill ──────────────────────────────────────────────
  const handleSave = async () => {
    order.items.forEach(item => {
      item.delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    });
    const bill: Bill = { todayTotal, prevPending, grandTotal, payment: paymentNum, newPending, billedAt: new Date().toISOString() };
    await saveBill(customerId, bill);
    navigation.goBack();
  };

  // ── Share plain-text invoice ───────────────────────────────
  const handleShare = async () => {
    const today = formatShortDate();
    const lines: string[] = [];
    lines.push('='.repeat(42));
    lines.push(`        ${state.business.name}`);
    if (state.business.owner) lines.push(`        ${state.business.owner}`);
    if (state.business.phone) lines.push(`        Ph: ${state.business.phone}`);
    lines.push('='.repeat(42));
    lines.push(`INVOICE DATE : ${today}`);
    lines.push(`CUSTOMER     : ${customer.name}`);
    if (customer.phone)   lines.push(`PHONE        : ${customer.phone}`);
    if (customer.address) lines.push(`ADDRESS      : ${customer.address}`);
    lines.push('-'.repeat(42));
    lines.push(`${'ITEM'.padEnd(16)}${'QTY'.padEnd(12)}${'AMOUNT'.padStart(14)}`);
    lines.push('-'.repeat(42));
    order.items.forEach(item => {
      const p = state.products.find(x => x.id === item.productId);
      if (!p) return;
      const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
      const amt = delivered * p.price;
      lines.push(`${p.name.padEnd(16).slice(0, 16)}${`${delivered} ${p.unit}`.padEnd(12)}${formatCurrency(amt).padStart(14)}`);
    });
    lines.push('-'.repeat(42));
    lines.push(`${"Today's Total".padEnd(28)}${formatCurrency(todayTotal).padStart(14)}`);
    lines.push(`${'Previous Pending'.padEnd(28)}${formatCurrency(prevPending).padStart(14)}`);
    lines.push(`${'Grand Total'.padEnd(28)}${formatCurrency(grandTotal).padStart(14)}`);
    lines.push(`${'Payment Received'.padEnd(28)}${formatCurrency(paymentNum).padStart(14)}`);
    lines.push('='.repeat(42));
    lines.push(`${'BALANCE PENDING'.padEnd(28)}${formatCurrency(newPending).padStart(14)}`);
    lines.push('='.repeat(42));
    lines.push('  Thank you for your business!');
    try {
      await Share.share({ message: lines.join('\n'), title: `Invoice - ${customer.name} - ${today}` });
    } catch {
      Alert.alert('Error', 'Could not share invoice.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{customer.name}</Text>
          <Text style={styles.headerSub}>{customer.phone || customer.address || 'Billing'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Items */}
          <Text style={styles.sectionLabel}>📦 Items Ordered</Text>
          <Text style={styles.sectionNote}>Edit delivered quantities if actual delivery differs.</Text>
          <View style={styles.itemsTable}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 2 }]}>Item</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Delivered</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {order.items.map(item => {
              const p = state.products.find(x => x.id === item.productId);
              if (!p) return null;
              const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
              return (
                <View key={item.productId} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.itemName}>{p.name}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(p.price)}/{p.unit}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <TextInput
                      style={styles.qtyInput}
                      value={deliveredQtys[item.productId] || ''}
                      onChangeText={val => setDeliveredQtys(prev => ({ ...prev, [item.productId]: val }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.gray}
                    />
                  </View>
                  <Text style={[styles.itemAmt, { flex: 1 }]}>{formatCurrency(delivered * p.price)}</Text>
                </View>
              );
            })}
          </View>

          <Divider />

          {/* Billing summary */}
          <Text style={styles.sectionLabel}>💰 Billing Summary</Text>
          <View style={styles.summaryBox}>
            <BillRow left="Today's Total"    right={formatCurrency(todayTotal)} />
            <BillRow left="Previous Pending" right={formatCurrency(prevPending)} color={COLORS.orange} />
            <BillRow left="Grand Total"      right={formatCurrency(grandTotal)}  bold />
          </View>

          {/* Payment */}
          <View style={styles.paymentBox}>
            <Text style={styles.paymentLabel}>Payment Received (₹)</Text>
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
            <Text style={styles.pendingLabel}>New Pending Balance</Text>
            <Text style={styles.pendingValue}>{formatCurrency(newPending)}</Text>
          </View>
          <Text style={styles.formula}>
            Formula: {formatCurrency(prevPending)} + {formatCurrency(todayTotal)} − {formatCurrency(paymentNum)} = {formatCurrency(newPending)}
          </Text>

          <Divider />

          <View style={styles.btnRow}>
            <Button label="📄 Share Invoice" onPress={handleShare} variant="outline" style={{ flex: 1 }} />
            <Button label="✅ Save Bill"     onPress={handleSave}  style={{ flex: 2 }} />
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
  sectionLabel: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  sectionNote: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md },
  itemsTable: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  tableHead: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  itemName: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  itemPrice: { fontSize: 11, fontFamily: TNR, color: COLORS.gray },
  itemAmt: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green, textAlign: 'right' },
  qtyInput: { borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, width: 64, paddingVertical: 6, textAlign: 'center', fontSize: 15, color: COLORS.dark, fontFamily: TNR_BOLD, fontWeight: '700' },
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
