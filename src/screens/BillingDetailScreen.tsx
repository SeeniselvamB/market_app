// src/screens/BillingDetailScreen.tsx
//
// VIEW / EDIT MODE:
//   - Opens in VIEW mode by default if a bill already exists.
//   - Opens in EDIT mode if no bill exists yet (first time billing).
//   - Edit button in header switches VIEW → EDIT.
//   - In EDIT mode: qty fields + payment field are editable.
//   - In VIEW mode: all values shown as read-only text.
//
// BILLING FLOW (Normal Customers Only):
//   deliveredQty <= originalOrderQty → no DP stock check/deduction
//   deliveredQty >  originalOrderQty → extraQty deducted from DP stock
//   deliveredQty <  originalOrderQty → returnQty returned to DP stock

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency, formatShortDate, getTodayStr } from '../utils/helpers';
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
  const customer = isOwnerDpEntry
    ? { id: OWNER_DP_ID, name: state.business.owner || state.business.name, phone: state.business.phone, address: '', pendingAmount: 0, isDeliveryPerson: true }
    : state.customers.find(c => c.id === customerId);
  const order        = state.todayOrders[customerId];
  const existingBill = state.todayBills[customerId];
  const isDp         = isOwnerDpEntry || (customer?.isDeliveryPerson ?? false);

  // VIEW mode = bill exists; EDIT mode = new bill or user pressed Edit
  const [isEditMode, setIsEditMode] = useState(!existingBill);

  const dp = getPrimaryDeliveryPerson();
  const dpStock = (!isDp && dp) ? getDeliveryPersonStock(dp.id) : {};

  const [deliveredQtys, setDeliveredQtys] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState('');

  // Block DP from billing
  useEffect(() => {
    if (isDp) {
      Alert.alert(
        'Not Allowed',
        'The Delivery Person handles stock only. Invoices are generated for customers only.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }],
      );
    }
  }, [isDp]);

  // Initialise from existing bill or from order
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

  // ── Live calculation ──────────────────────────────────────
  const todayTotal  = order.items.reduce((sum, item) => {
    const p         = state.products.find(x => x.id === item.productId);
    const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    return sum + (p ? delivered * p.price : 0);
  }, 0);

  const prevPending = customer.pendingAmount || 0;
  const grandTotal  = todayTotal + prevPending;
  const paymentNum  = parseFloat(payment) || 0;
  const newPending  = Math.max(0, grandTotal - paymentNum);

  // ── Save bill ─────────────────────────────────────────────
  const handleSave = async () => {
    const deliveredMap: Record<string, number> = {};
    order.items.forEach(item => {
      deliveredMap[item.productId] = parseFloat(deliveredQtys[item.productId] || '0') || 0;
    });
    const bill: Bill = { todayTotal, prevPending, grandTotal, payment: paymentNum, newPending, billedAt: new Date().toISOString() };
    const success = await saveBill(customerId, bill, deliveredMap);
    if (success) {
      setIsEditMode(false);
      Alert.alert('✅ ' + t.productDelivered,
        `Bill saved for ${getCustomerName(customer.name, (customer as any).nameTa, lang)}.`);
    }
  };

  // ── PDF invoice ───────────────────────────────────────────
  const handleShare = async () => {
    if (isDp) { Alert.alert('Not Allowed', 'No invoice for Delivery Person.'); return; }

    const Print   = await import('expo-print').catch(() => null);
    const Sharing = await import('expo-sharing').catch(() => null);
    if (!Print) {
      Alert.alert('Missing Package', 'Run: npx expo install expo-print expo-sharing');
      return;
    }

    const dateLabel          = formatShortDate();
    const customerDisplayName = getCustomerName(customer.name, (customer as any).nameTa, lang);

    const itemRows = order.items.map(item => {
      const p         = state.products.find(x => x.id === item.productId);
      if (!p) return '';
      const delivered = parseFloat(deliveredQtys[item.productId] || '0') || 0;
      if (delivered <= 0) return '';
      const pName     = getProductName(p.name, p.nameTa, lang);
      return `
        <tr>
          <td>${pName}</td>
          <td class="center">${delivered}</td>
          <td class="center">${p.unit}</td>
          <td class="right">${formatCurrency(p.price)}</td>
          <td class="right bold">${formatCurrency(delivered * p.price)}</td>
        </tr>`;
    }).filter(Boolean).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',Times,serif;font-size:13px;color:#1B1B1B;padding:28px 24px}
  .header{text-align:center;border-bottom:3px double #2D6A4F;padding-bottom:14px;margin-bottom:14px}
  .biz-name{font-size:20px;font-weight:bold;color:#2D6A4F}
  .biz-sub{font-size:12px;color:#555;margin-top:3px}
  .invoice-label{font-size:16px;font-weight:bold;letter-spacing:2px;margin-top:8px;text-transform:uppercase}
  .info-grid{display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px}
  .info-block .label{color:#6B7280;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px}
  .info-block .value{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  thead th{background:#2D6A4F;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;padding:7px 8px;text-align:left}
  td{padding:7px 8px;border-bottom:1px solid #E5E7EB;font-size:12px}
  tr:nth-child(even) td{background:#F9FFF9}
  .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}
  .totals{margin-left:auto;width:260px;border-top:2px solid #2D6A4F;padding-top:10px}
  .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
  .grand{font-size:14px;font-weight:bold;border-top:1px solid #ccc;padding-top:6px;margin-top:4px}
  .balance{font-size:15px;font-weight:bold;color:${newPending > 0 ? '#DC2626' : '#2D6A4F'};border-top:2px double #2D6A4F;padding-top:6px;margin-top:6px}
  .footer{margin-top:28px;text-align:center;font-size:11px;color:#9CA3AF;border-top:1px solid #E5E7EB;padding-top:10px}
  .thank-you{font-size:13px;color:#2D6A4F;font-weight:bold;margin-bottom:4px}
</style></head><body>
  <div class="header">
    <div class="biz-name">${state.business.name}</div>
    <div class="biz-sub">${state.business.owner || ''}${state.business.phone ? ' • ' + state.business.phone : ''}</div>
    <div class="invoice-label">Tax Invoice</div>
  </div>
  <div class="info-grid">
    <div class="info-block">
      <div class="label">Bill To</div>
      <div class="value">${customerDisplayName}</div>
      ${(customer as any).phone ? `<div>${(customer as any).phone}</div>` : ''}
      ${(customer as any).address ? `<div>${(customer as any).address}</div>` : ''}
    </div>
    <div class="info-block" style="text-align:right">
      <div class="label">Date</div><div class="value">${dateLabel}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="center">Qty</th><th class="center">Unit</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:12px">No items delivered</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Today\'s Total</span><span class="bold">${formatCurrency(todayTotal)}</span></div>
    <div class="totals-row" style="color:#F4721B"><span>Previous Pending</span><span class="bold">${formatCurrency(prevPending)}</span></div>
    <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(grandTotal)}</span></div>
    <div class="totals-row" style="color:#2D6A4F"><span>Payment Received</span><span class="bold">${formatCurrency(paymentNum)}</span></div>
    <div class="totals-row balance"><span>Balance Pending</span><span>${formatCurrency(newPending)}</span></div>
  </div>
  <div class="footer">
    <div class="thank-you">Thank you for your business!</div>
    <div>${state.business.name} • ${dateLabel}</div>
  </div>
</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      let finalUri = uri;
      try {
        const FS = await import('expo-file-system/legacy');
        if (FS?.documentDirectory) {
          const safe = customerDisplayName.replace(/[^a-zA-Z0-9]/g, '_');
          const dest = `${FS.documentDirectory}Invoice_${safe}_${getTodayStr()}.pdf`;
          await FS.moveAsync({ from: uri, to: dest });
          finalUri = dest;
        }
      } catch { /* use original uri */ }

      if (Sharing) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', dialogTitle: `Invoice — ${customerDisplayName}`, UTI: 'com.adobe.pdf' });
        } else {
          Alert.alert('✅ Invoice Saved', `PDF saved to:\n${finalUri}`);
        }
      }
    } catch (err: any) {
      Alert.alert(t.error, `Could not generate invoice PDF: ${err?.message || err}`);
    }
  };

  // ── RENDER ────────────────────────────────────────────────
  const customerDisplayName = getCustomerName(customer.name, (customer as any).nameTa, lang);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{customerDisplayName}{isDp ? ' 🚚' : ''}</Text>
          <Text style={styles.headerSub}>{customer.phone || (customer as any).address || t.billing}</Text>
        </View>
        {/* Mode badge + Edit button */}
        {existingBill && (
          <TouchableOpacity
            style={[styles.modeBtn, isEditMode ? styles.modeBtnEdit : styles.modeBtnView]}
            onPress={() => setIsEditMode(prev => !prev)}
            activeOpacity={0.8}>
            <Text style={styles.modeBtnText}>{isEditMode ? 'View' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">

          {/* ── Mode Banner ── */}
          {existingBill && (
            <View style={[styles.modeBanner, isEditMode ? styles.modeBannerEdit : styles.modeBannerView]}>
              <Text style={styles.modeBannerText}>
                {isEditMode
                  ? '✏️ Edit Mode — Modify delivered quantities or payment amount'
                  : '👁 View Mode — Tap Edit in header to make changes'}
              </Text>
            </View>
          )}

          {/* ── DP Stock Panel (edit mode only) ── */}
          {isEditMode && !isDp && dp && (
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
                  const projectedStock = diff > 0 ? currentDpStock - diff : currentDpStock + Math.abs(diff);
                  const isOver         = diff > 0 && diff > currentDpStock;
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
                      {diff === 0 && <Text style={[styles.dpStockAfter, { color: COLORS.gray }]}>no change</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Items Table ── */}
          <Text style={styles.sectionLabel}>{t.itemsOrdered}</Text>
          {isEditMode && (
            <Text style={styles.sectionNote}>
              Extra delivery deducts from DP stock. Partial delivery returns unused qty to DP stock.
            </Text>
          )}

          <View style={styles.itemsTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 2 }]}>Item</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>
                {isEditMode ? t.delivered : 'Delivered'}
              </Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>{t.amount}</Text>
            </View>

            {order.items.map(item => {
              const p           = state.products.find(x => x.id === item.productId);
              if (!p) return null;
              const delivered   = parseFloat(deliveredQtys[item.productId] || '0') || 0;
              const originalQty = item.qty;
              const diff        = delivered - originalQty;
              const dpAvail     = !isDp ? (dpStock[item.productId] ?? 0) : Infinity;
              const isOverExtra = !isDp && diff > 0 && diff > dpAvail;
              const displayName = getProductName(p.name, p.nameTa, lang);

              return (
                <View key={item.productId} style={styles.tableRow}>
                  {/* Product info */}
                  <View style={{ flex: 2 }}>
                    <Text style={styles.itemName}>{displayName}</Text>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(p.price)}/{p.unit} • Ordered: {originalQty} {p.unit}
                    </Text>
                    {/* Stock hint — edit mode only */}
                    {isEditMode && !isDp && dp && diff !== 0 && (
                      <Text style={[
                        styles.itemExtra,
                        isOverExtra ? styles.itemExtraWarn : diff > 0 ? styles.itemExtraDeduct : styles.itemExtraReturn,
                      ]}>
                        {diff > 0
                          ? `▲ +${diff} extra — deducts ${diff} from DP`
                          : `▼ ${Math.abs(diff)} unused — returns to DP`}
                      </Text>
                    )}
                    {isEditMode && !isDp && dp && diff === 0 && (
                      <Text style={styles.itemExtra}>Exact — no DP stock change</Text>
                    )}
                  </View>

                  {/* Qty — editable in edit mode, read-only text in view mode */}
                  <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                    {isEditMode ? (
                      <TextInput
                        style={[styles.qtyInput, isOverExtra && styles.qtyInputError]}
                        value={deliveredQtys[item.productId] || ''}
                        onChangeText={val => setDeliveredQtys(prev => ({ ...prev, [item.productId]: val }))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.gray}
                        blurOnSubmit={false}
                        returnKeyType="next"
                      />
                    ) : (
                      <Text style={styles.qtyReadOnly}>{delivered}</Text>
                    )}
                    <Text style={styles.unitTag}>{p.unit}</Text>
                  </View>

                  {/* Amount */}
                  <Text style={[styles.itemAmt, { flex: 1 }]}>
                    {formatCurrency(delivered * p.price)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Divider />

          {/* ── Billing Summary ── */}
          <Text style={styles.sectionLabel}>{t.billingSummary}</Text>
          <View style={styles.summaryBox}>
            <BillRow left={t.todayTotal}      right={formatCurrency(todayTotal)} />
            <BillRow left={t.previousPending} right={formatCurrency(prevPending)} color={COLORS.orange} />
            <BillRow left={t.grandTotal}      right={formatCurrency(grandTotal)}  bold />
          </View>

          {/* ── Payment ── */}
          <View style={styles.paymentBox}>
            <Text style={styles.paymentLabel}>{t.paymentReceived}</Text>
            {isEditMode ? (
              <TextInput
                style={styles.paymentInput}
                value={payment}
                onChangeText={setPayment}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={COLORS.gray}
                blurOnSubmit={false}
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.paymentReadOnly}>{formatCurrency(paymentNum)}</Text>
            )}
          </View>

          {/* ── New Pending ── */}
          <View style={styles.pendingBox}>
            <Text style={styles.pendingLabel}>{t.newPendingBalance}</Text>
            <Text style={styles.pendingValue}>{formatCurrency(newPending)}</Text>
          </View>
          <Text style={styles.formula}>
            {t.formula}: {formatCurrency(prevPending)} + {formatCurrency(todayTotal)} − {formatCurrency(paymentNum)} = {formatCurrency(newPending)}
          </Text>

          <Divider />

          {/* ── Action Buttons ── */}
          {isEditMode ? (
            /* Edit mode: Share Invoice + Save Bill */
            <View style={styles.btnRow}>
              <Button label={t.shareInvoice} onPress={handleShare} variant="outline" style={{ flex: 1 }} />
              <Button label={t.saveBill}     onPress={handleSave}  style={{ flex: 2 }} />
            </View>
          ) : (
            /* View mode: Share Invoice only */
            <View style={styles.btnRow}>
              <Button label="📄 Share Invoice (PDF)" onPress={handleShare} style={{ flex: 1 }} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: {
    backgroundColor: COLORS.green,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    gap: SPACING.md, ...SHADOW.medium,
  },
  backBtn:      { padding: 4 },
  backIcon:     { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },
  headerTitle:  { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white, lineHeight: 22 },
  headerSub:    { fontSize: 12, fontFamily: TNR, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 16 },

  // Mode toggle button in header
  modeBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.white },
  modeBtnView:  { backgroundColor: 'transparent' },
  modeBtnEdit:  { backgroundColor: 'rgba(255,255,255,0.2)' },
  modeBtnText:  { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },

  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  // Mode banner
  modeBanner:     { borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md },
  modeBannerView: { backgroundColor: '#E8F5E9', borderLeftWidth: 3, borderLeftColor: COLORS.green },
  modeBannerEdit: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: COLORS.orange },
  modeBannerText: { fontSize: 12, fontFamily: TNR, color: COLORS.dark, lineHeight: 18 },

  // DP stock panel
  dpStockBox:     { backgroundColor: '#E8F5E9', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.green },
  dpStockTitle:   { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green, marginBottom: 2 },
  dpStockNote:    { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.sm, lineHeight: 16 },
  dpStockGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dpStockItem:    { backgroundColor: COLORS.white, borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, minWidth: 90 },
  dpStockItemWarn:{ borderColor: COLORS.red },
  dpStockProd:    { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  dpStockQty:     { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  dpStockAfter:   { fontSize: 10, fontFamily: TNR, marginTop: 2 },

  // Section labels
  sectionLabel: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  sectionNote:  { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },

  // Items table
  itemsTable:  { backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  tableHead:   { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', lineHeight: 16 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  itemName:    { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark, lineHeight: 18 },
  itemPrice:   { fontSize: 11, fontFamily: TNR, color: COLORS.gray, lineHeight: 16 },
  itemExtra:   { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginTop: 1, lineHeight: 15 },
  itemExtraDeduct: { color: COLORS.orange, fontFamily: TNR_BOLD, fontWeight: '600' },
  itemExtraReturn: { color: COLORS.green,  fontFamily: TNR_BOLD, fontWeight: '600' },
  itemExtraWarn:   { color: COLORS.red,    fontFamily: TNR_BOLD, fontWeight: '700' },
  itemAmt:     { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green, textAlign: 'right', lineHeight: 18 },

  // Qty field — edit vs view
  qtyInput: {
    borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    width: 52, paddingVertical: 6,
    textAlign: 'center', fontSize: 15, color: COLORS.dark,
    fontFamily: TNR_BOLD, fontWeight: '700',
  },
  qtyInputError: { borderColor: COLORS.red },
  qtyReadOnly: {
    fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700',
    color: COLORS.dark, textAlign: 'center', minWidth: 40,
  },
  unitTag: { fontSize: 11, fontFamily: TNR_BOLD, color: COLORS.gray, fontWeight: '600', lineHeight: 16 },

  // Summary
  summaryBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },

  // Payment
  paymentBox:      { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  paymentLabel:    { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  paymentInput:    { borderWidth: 2, borderColor: COLORS.green, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  paymentReadOnly: { fontSize: 26, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green, paddingVertical: 8 },

  // Pending
  pendingBox:   { backgroundColor: COLORS.redLight, borderRadius: RADIUS.md, padding: SPACING.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.red },
  pendingLabel: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.red },
  pendingValue: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.red },
  formula:      { fontSize: 11, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
});
