// src/screens/DashboardScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { OWNER_DP_ID } from '../utils/types';
import { formatCurrency, formatDate, getTodayStr } from '../utils/helpers';
import { getProductName, getCustomerName } from '../utils/translations';
import { Card, CardHeader, StatCard, EmptyState, Button, Badge } from '../components/UIComponents';

export default function DashboardScreen() {
  const { state, startNewDay, calculateOrderTotal, getMarketTotals, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();
  const [pdfLoading, setPdfLoading] = useState(false);

  useFocusEffect(useCallback(() => {}, [state]));

  // ── Summary stats (normal customers only — DP is not billed) ─
  let totalSales = 0, totalReceived = 0, totalPending = 0, totalPrevPending = 0, orderCount = 0;
  Object.keys(state.todayOrders).forEach(custId => {
    if (custId === OWNER_DP_ID) return;
    const customer = state.customers.find(c => c.id === custId);
    if (customer?.isDeliveryPerson) return;
    const order = state.todayOrders[custId];
    if (!order?.items?.some(i => i.qty > 0)) return;
    orderCount++;
    const bill = state.todayBills[custId];
    if (bill) {
      totalSales       += bill.todayTotal;
      totalReceived    += bill.payment;
      totalPending     += bill.newPending;
      totalPrevPending += bill.prevPending;
    } else {
      totalSales += calculateOrderTotal(custId);
    }
  });

  const purchaseTotals = getMarketTotals();
  const dp = getPrimaryDeliveryPerson();
  const dpStock = dp ? getDeliveryPersonStock(dp.id) : {};
  const dpName = dp
    ? (dp.id === OWNER_DP_ID ? (state.business.owner || state.business.name) : getCustomerName(dp.name, (dp as any).nameTa, lang))
    : '';

  const orderedCustomers = state.customers.filter(c =>
    !c.isDeliveryPerson &&
    state.todayOrders[c.id]?.items?.some(i => i.qty > 0),
  );

  const handleNewDay = () => {
    Alert.alert(t.startNewDay, t.startNewDayMsg,
      [{ text: t.cancel, style: 'cancel' }, { text: t.yesNewDay, onPress: startNewDay }]);
  };

  // ── PDF Report Generation ─────────────────────────────────
  const handleGenerateReport = async () => {
    setPdfLoading(true);
    try {
      const Print   = await import('expo-print').catch(() => null);
      const Sharing = await import('expo-sharing').catch(() => null);
      if (!Print) {
        Alert.alert('Missing Package', 'Run: npx expo install expo-print expo-sharing');
        return;
      }

      const today     = getTodayStr();
      const dateLabel = formatDate();

      // ── Collect customers ──────────────────────────
      const billedCustomers = state.customers.filter(c =>
        !c.isDeliveryPerson && !!state.todayBills[c.id]
      );
      const unbilledCustomers = state.customers.filter(c => {
        if (c.isDeliveryPerson) return false;
        const ord = state.todayOrders[c.id];
        return ord?.items?.some(i => i.qty > 0) && !state.todayBills[c.id];
      });

      // ── Running totals ────────────────────────────────────
      let rptSales = 0, rptReceived = 0, rptPending = 0, rptPrevPending = 0, rptCharge = 0;

      // ── Build customer rows with full Tamil support ──
      // Each customer block: first row has rowspan financial cols,
      // each additional product gets its own sub-row.
      // Tamil rendered via Unicode HTML entities — works in expo-print's WebView engine.
      const customerBlocks = billedCustomers.map((c, idx) => {
        const bill  = state.todayBills[c.id]!;
        const order = state.todayOrders[c.id];

        rptSales       += bill.todayTotal;
        rptReceived    += bill.payment;
        rptPending     += bill.newPending;
        rptPrevPending += bill.prevPending;
        rptCharge      += (bill.charge ?? 0);

        const prevPend  = bill.prevPending;
        const todaySale = bill.todayTotal;
        const chargeAmt = bill.charge ?? 0;
        const grandT    = bill.grandTotal ?? (prevPend + todaySale + chargeAmt);
        const received  = bill.payment;
        const newPend   = bill.newPending;
        const isPend    = newPend > 0;
        const rowBg     = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB';

        // Delivered product lines — include Tamil name if available
        const deliveredItems = (order?.items ?? [])
          .map(i => {
            const p   = state.products.find(x => x.id === i.productId);
            const qty = i.delivered ?? i.qty;
            if (!p || qty <= 0) return null;
            return { nameEn: p.name, nameTa: p.nameTa || '', qty, unit: p.unit };
          })
          .filter(Boolean) as { nameEn: string; nameTa: string; qty: number; unit: string }[];

        if (deliveredItems.length === 0) deliveredItems.push({ nameEn: '—', nameTa: '', qty: 0, unit: '' });

        const rs = deliveredItems.length;

        // Customer name cell — English name + Tamil name below
        const nameCellContent = c.nameTa
          ? `${c.name}<br/><span class="ta">${c.nameTa}</span>`
          : c.name;

        const firstProd = deliveredItems[0];
        const firstProdLabel = firstProd.qty > 0
          ? `${firstProd.nameEn}${firstProd.nameTa ? '<br/><span class="ta">' + firstProd.nameTa + '</span>' : ''} &mdash; <strong>${firstProd.qty}&nbsp;${firstProd.unit}</strong>`
          : '&mdash;';

        const firstRow = `
          <tr style="background:${rowBg}">
            <td class="name-cell" rowspan="${rs}">${nameCellContent}</td>
            <td class="prod-cell">${firstProdLabel}</td>
            <td class="amt-cell${prevPend > 0 ? ' warn' : ''}" rowspan="${rs}">${prevPend > 0 ? '&#8377;' + prevPend.toFixed(2) : '<span class="zero">&#8377;0.00</span>'}</td>
            <td class="amt-cell" rowspan="${rs}">&#8377;${todaySale.toFixed(2)}</td>
            <td class="amt-cell gray" rowspan="${rs}">${chargeAmt > 0 ? '&#8377;' + chargeAmt.toFixed(2) : '<span class=\"zero\">&#8377;0.00</span>'}</td>
            <td class="amt-cell bold" rowspan="${rs}">&#8377;${grandT.toFixed(2)}</td>
            <td class="amt-cell grn" rowspan="${rs}">&#8377;${received.toFixed(2)}</td>
            <td class="amt-cell ${isPend ? 'red bold' : 'grn'}" rowspan="${rs}">${isPend ? '&#8377;' + newPend.toFixed(2) : '<span class="zero">&#8377;0.00</span>'}</td>
          </tr>`;

        const extraRows = deliveredItems.slice(1).map(prod => {
          const prodLabel = `${prod.nameEn}${prod.nameTa ? '<br/><span class="ta">' + prod.nameTa + '</span>' : ''} &mdash; <strong>${prod.qty}&nbsp;${prod.unit}</strong>`;
          return `<tr style="background:${rowBg}"><td class="prod-cell">${prodLabel}</td></tr>`;
        }).join('');

        return firstRow + extraRows;
      }).join('');

      // ── Unbilled rows ─────────────────────────────────────
      const unbilledBlocks = unbilledCustomers.map(c => {
        const order    = state.todayOrders[c.id]!;
        const estTotal = calculateOrderTotal(c.id);
        const items    = (order?.items ?? [])
          .filter(i => i.qty > 0)
          .map(i => {
            const p = state.products.find(x => x.id === i.productId);
            return p ? { nameEn: p.name, nameTa: p.nameTa || '', qty: i.qty, unit: p.unit } : null;
          })
          .filter(Boolean) as { nameEn: string; nameTa: string; qty: number; unit: string }[];
        if (items.length === 0) items.push({ nameEn: '—', nameTa: '', qty: 0, unit: '' });

        const rs = items.length;
        const nameCellContent = c.nameTa
          ? `${c.name}<br/><span class="ta">${c.nameTa}</span><br/><span class="badge-pending">NOT BILLED</span>`
          : `${c.name}<br/><span class="badge-pending">NOT BILLED</span>`;

        const firstProdLabel = items[0].qty > 0
          ? `${items[0].nameEn}${items[0].nameTa ? '<br/><span class="ta">' + items[0].nameTa + '</span>' : ''} &mdash; <strong>${items[0].qty}&nbsp;${items[0].unit}</strong>`
          : '&mdash;';

        const firstRow = `
          <tr class="unbilled-row">
            <td class="name-cell" rowspan="${rs}">${nameCellContent}</td>
            <td class="prod-cell">${firstProdLabel}</td>
            <td class="amt-cell${c.pendingAmount > 0 ? ' warn' : ''}" rowspan="${rs}">&#8377;${c.pendingAmount.toFixed(2)}</td>
            <td class="amt-cell" rowspan="${rs}"><em>&#8377;${estTotal.toFixed(2)}</em>&nbsp;<span class="est">est.</span></td>
            <td class="amt-cell gray" rowspan="${rs}">&mdash;</td>
            <td class="amt-cell gray" rowspan="${rs}">&mdash;</td>
            <td class="amt-cell gray" rowspan="${rs}">&mdash;</td>
            <td class="amt-cell warn" rowspan="${rs}">Pending</td>
          </tr>`;
        const extraRows = items.slice(1).map(p => {
          const lbl = `${p.nameEn}${p.nameTa ? '<br/><span class="ta">' + p.nameTa + '</span>' : ''} &mdash; <strong>${p.qty}&nbsp;${p.unit}</strong>`;
          return `<tr class="unbilled-row"><td class="prod-cell">${lbl}</td></tr>`;
        }).join('');
        return firstRow + extraRows;
      }).join('');

      // ── Market purchase section ───────────────────────────
      const marketRows = Object.keys(purchaseTotals).map(pid => {
        const p      = state.products.find(x => x.id === pid);
        if (!p) return '';
        const qty    = purchaseTotals[pid];
        const dpHas  = dpStock[pid] ?? 0;
        const nameLabel = p.nameTa
          ? `${p.name}<br/><span class="ta">${p.nameTa}</span>`
          : p.name;
        return `<tr>
          <td>${nameLabel}</td>
          <td>${qty}&nbsp;${p.unit}</td>
          <td class="${dpHas > 0 ? 'grn' : 'gray'}">${dpHas}&nbsp;${p.unit}</td>
          <td class="amt-cell">&#8377;${(qty * p.price).toFixed(2)}</td>
        </tr>`;
      }).join('');

      const totalMarketCost = Object.keys(purchaseTotals).reduce((s, pid) => {
        const p = state.products.find(x => x.id === pid);
        return s + (p ? purchaseTotals[pid] * p.price : 0);
      }, 0);

      const grandOverallTotal = rptPrevPending + rptSales + rptCharge;

      // ── HTML ──────────────────────────────────────────────
      // Tamil text is rendered using Unicode HTML entities (&#xxxx;).
      // This approach works correctly with expo-print's WKWebView/WebView PDF engine
      // without requiring external font embedding.
      // Column header Tamil translations:
      //   Customer Name        = வாடிக்கையாளர் பெயர்
      //   Product Delivered    = கொடுக்கப்பட்ட தனிப்பண்டு
      //   Prev. Pending        = முந்தைய நிலுவை
      //   Total Sales          = மொத்த விற்பனை
      //   Grand Total          = மாபெரும் மொத்தது
      //   Received             = பெறப்பட்டது
      //   New Pending          = புதிய நிலுவை
      const html = `<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Noto Sans Tamil','Tamil Sangam MN','Latha','Arial Unicode MS',Arial,sans-serif;
      font-size:11.5px;color:#1B1B1B;padding:18px 20px;background:#fff
    }

    /* ── Header ── */
    .hdr{text-align:center;border-bottom:3px double #2D6A4F;padding-bottom:12px;margin-bottom:16px}
    .biz{font-size:22px;font-weight:bold;color:#2D6A4F;letter-spacing:.5px}
    .biz-sub{font-size:11px;color:#6B7280;margin-top:3px}
    .rpt-title{font-size:14px;font-weight:bold;margin-top:6px;letter-spacing:1px;text-transform:uppercase}
    .rpt-date{font-size:10px;color:#6B7280;margin-top:2px}

    /* ── Section headers ── */
    .sec{font-size:12px;font-weight:bold;color:#fff;background:#2D6A4F;padding:5px 10px;border-radius:3px;margin:14px 0 0}
    .sec-ta{font-size:11px;color:#fff;background:#1a5c3a;padding:3px 10px 5px;border-radius:0 0 3px 3px;margin-bottom:8px;display:block}

    /* ── Tables ── */
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{background:#2D6A4F;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.3px;padding:6px 7px;text-align:left;border:1px solid #1a5c3a}
    th.right{text-align:right}
    td{padding:6px 7px;border:1px solid #D1D5DB;vertical-align:middle;font-size:11px;line-height:1.5}

    /* ── Column classes ── */
    .name-cell{font-weight:bold;min-width:85px;vertical-align:top;padding-top:8px}
    .prod-cell{color:#374151;min-width:130px}
    .amt-cell{text-align:right;white-space:nowrap;min-width:72px}

    /* ── Row accents ── */
    .unbilled-row td{background:#FFFBF5!important}

    /* ── Tamil subtext ── */
    .ta{font-size:10px;color:#6B7280;font-weight:normal;display:block}

    /* ── Utility ── */
    .bold{font-weight:bold}
    .grn{color:#2D6A4F;font-weight:bold}
    .red{color:#DC2626;font-weight:bold}
    .warn{color:#D97706}
    .gray{color:#9CA3AF}
    .zero{color:#9CA3AF}
    .est{font-size:9px;background:#FEF3C7;color:#D97706;border-radius:2px;padding:0 3px}
    .badge-pending{font-size:8px;background:#FEE2E2;color:#DC2626;border-radius:2px;padding:1px 4px;font-weight:bold;letter-spacing:.4px;display:inline-block;margin-top:2px}

    /* ── Totals table ── */
    .tot-table th{background:#1a5c3a;font-size:11px}
    .tot-table td{font-size:13px;font-weight:bold;padding:8px 7px}

    /* ── Summary boxes ── */
    .summary-grid{display:flex;gap:0;border:2px solid #2D6A4F;border-radius:4px;overflow:hidden;margin-bottom:10px}
    .summary-item{flex:1;padding:8px 10px;border-right:1px solid #D1D5DB}
    .summary-item:last-child{border-right:none}
    .s-label{font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px}
    .s-label-ta{font-size:9px;color:#9CA3AF;display:block}
    .s-value{font-size:14px;font-weight:bold;margin-top:3px}

    /* ── Footer ── */
    .ftr{margin-top:20px;border-top:1px solid #E5E7EB;padding-top:8px;text-align:center;font-size:9.5px;color:#9CA3AF}
  </style>
</head>
<body>

<div class="hdr">
  <div class="biz">${state.business.name}</div>
  <div class="rpt-title">Daily Sales Report</div>
  <div class="rpt-date">${dateLabel}</div>
</div>

<!-- Section 1: Customer Summary / வாடிக்கையாளர் சுருக்கம் -->
<div class="sec">Customer Summary</div>
<span class="sec-ta">வாடிக்கையாளர் சுருக்கம்</span>
<table>
  <thead>
    <tr>
      <th style="min-width:90px">
        Customer Name
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  வாடிக்கையாளர் பெயர்
</span>
      </th>
      <th style="min-width:140px">
        Product Delivered
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  வழங்கப்பட்ட பொருட்கள்
</span>
      </th>
      <th class="right" style="min-width:76px">
        Prev. Pending
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  முந்தைய நிலுவை
</span>
      </th>
      <th class="right" style="min-width:76px">
        Total Sales
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  மொத்த விற்பனை
</span>
      </th>
      <th class="right" style="min-width:72px">
        Charge
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  கட்டணம்
</span>
      </th>
      <th class="right" style="min-width:76px">
        Grand Total
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  மொத்த தொகை
</span>
      </th>
      <th class="right" style="min-width:76px">
        Received
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  பெறப்பட்டது
</span>
      </th>
      <th class="right" style="min-width:76px">
        New Pending
        <span class="ta" style="color:rgba(255,255,255,0.75);text-transform:none;letter-spacing:0">
  புதிய நிலுவை
</span>
      </th>
    </tr>
  </thead>
  <tbody>
    ${customerBlocks || '<tr><td colspan="8" style="text-align:center;color:#9CA3AF;padding:16px">No billed customers yet today</td></tr>'}
    ${unbilledBlocks}
  </tbody>
</table>

<!-- Section 2: Day Totals Summary -->
<div class="sec">Day Totals Summary</div>
<span class="sec-ta">நாள் மொத்த சுருக்கம்</span>
<div class="summary-grid">
  <div class="summary-item">
    <div class="s-label">Total Sales <span class="s-label-ta">மொத்த விற்பனை</span></div>
    <div class="s-value grn">&#8377;${rptSales.toFixed(2)}</div>
  </div>
  <div class="summary-item">
    <div class="s-label">Prev. Pending <span class="s-label-ta">முந்தைய நிலுவை</span></div>
    <div class="s-value warn">&#8377;${rptPrevPending.toFixed(2)}</div>
  </div>
  <div class="summary-item">
    <div class="s-label">Total Received <span class="s-label-ta">மொத்த பெறப்பட்டது</span></div>
    <div class="s-value grn">&#8377;${rptReceived.toFixed(2)}</div>
  </div>
  <div class="summary-item">
    <div class="s-label">Charge <span class="s-label-ta">கட்டணம்</span></div>
    <div class="s-value gray">&#8377;${rptCharge.toFixed(2)}</div>
  </div>
  <div class="summary-item">
    <div class="s-label">New Pending <span class="s-label-ta">புதிய நிலுவை</span></div>
    <div class="s-value ${rptPending > 0 ? 'red' : 'grn'}">&#8377;${rptPending.toFixed(2)}</div>
  </div>
</div>

<table class="tot-table">
  <thead>
    <tr>
      <th>Grand Total (Prev. Pending + Sales + Charge)</th>
      <th style="text-align:right">Total Collected</th>
      <th style="text-align:right">Outstanding Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="bold">&#8377;${grandOverallTotal.toFixed(2)}</td>
      <td class="amt-cell grn">&#8377;${rptReceived.toFixed(2)}</td>
      <td class="amt-cell ${rptPending > 0 ? 'red' : 'grn'}">&#8377;${rptPending.toFixed(2)}</td>
    </tr>
  </tbody>
</table>

<!-- Section 3: Market Purchase List -->
<div class="sec">Market Purchase List</div>
<span class="sec-ta">சந்தை கொள்முதல் பட்டியல்</span>
<table>
  <thead>
    <tr>
      <th>Product</th>
      <th>Total Ordered</th>
      <th>DP Remaining</th>
      <th style="text-align:right">Est. Cost</th>
    </tr>
  </thead>
  <tbody>
    ${marketRows || '<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:14px">No orders placed yet</td></tr>'}
    <tr style="background:#F3F4F6;font-weight:bold">
      <td colspan="3">Total Market Cost</td>
      <td class="amt-cell grn">&#8377;${totalMarketCost.toFixed(2)}</td>
    </tr>
  </tbody>
</table>

<div class="ftr">
  Generated on ${dateLabel} &nbsp;&bull;&nbsp; ${state.business.name} &nbsp;&bull;&nbsp; Daily_Report_${today}.pdf
</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      let finalUri = uri;
      try {
        const FS = await import('expo-file-system/legacy');
        if (FS?.documentDirectory) {
          const dest = `${FS.documentDirectory}Daily_Report_${today}.pdf`;
          await FS.moveAsync({ from: uri, to: dest });
          finalUri = dest;
        }
      } catch { /* use original uri */ }

      if (Sharing) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(finalUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Daily Report — ${today}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('✅ Report Saved', `PDF saved to:\n${finalUri}`);
        }
      } else {
        Alert.alert('✅ Report Generated', `PDF saved to:\n${finalUri}`);
      }
    } catch (err: any) {
      Alert.alert('Error', `Could not generate report: ${err?.message || err}`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
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

        {/* ── PDF Report Button ── */}
        <TouchableOpacity
          style={[styles.reportBtn, pdfLoading && styles.reportBtnLoading]}
          onPress={handleGenerateReport}
          activeOpacity={0.8}
          disabled={pdfLoading}>
          {pdfLoading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.reportBtnIcon}>📄</Text>
          )}
          <Text style={styles.reportBtnText}>
            {pdfLoading ? 'Generating Report…' : 'Generate Daily Report'}
          </Text>
        </TouchableOpacity>

        {/* ── TODAY MARKET PURCHASE LIST ── */}
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
              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHead, { flex: 1.5 }]}>{t.product}</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Total Qty</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>{t.estCost}</Text>
              </View>

              {Object.keys(purchaseTotals).map(pid => {
                const p = state.products.find(x => x.id === pid);
                if (!p) return null;
                const displayName = getProductName(p.name, p.nameTa, lang);
                const dpHas       = dpStock[pid] ?? 0;
                const totalQty    = purchaseTotals[pid];
                const hasDP       = !!dp;

                return (
                  <View key={pid} style={styles.tableRow}>
                    {/* Product column */}
                    <View style={styles.colProduct}>
                      <Text style={styles.tableCell} numberOfLines={2} lineBreakMode="tail">
                        {displayName}
                      </Text>
                      <Text style={styles.tableCellSub}>{p.category || 'General'}</Text>
                    </View>

                    {/* Qty + DP chip column */}
                    <View style={styles.colQty}>
                      <Text style={styles.tableCellBold}>{totalQty} {p.unit}</Text>
                      {hasDP && (
                        <View style={styles.dpChipRow}>
                          <Text style={styles.dpChipIcon}>🚚</Text>
                          <Text style={[
                            styles.dpChipText,
                            { color: dpHas > 0 ? COLORS.green : COLORS.gray },
                          ]}>
                            {dpHas} {p.unit} left
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Cost column */}
                    <View style={styles.colCost}>
                      <Text style={styles.tableCellGreen}>
                        {formatCurrency(totalQty * p.price)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Grand total row */}
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

        {/* ── Delivery Person Stock Panel ── */}
        {dp && Object.keys(dpStock).some(k => dpStock[k] > 0) && (
          <Card style={styles.dpCard}>
            {/* Header row: icon + name + badge */}
            <View style={styles.dpCardHeader}>
              <Text style={styles.dpCardIcon}>🚚</Text>
              <Text style={styles.dpCardName} numberOfLines={1}>
                {dpName}
              </Text>
              <Badge label="Live" variant="green" />
            </View>
            <Text style={styles.planNote}>Stock remaining after deliveries.</Text>

            {/* DP stock table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 1.5 }]}>{t.product}</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'right' }]}>Remaining</Text>
            </View>

            {Object.entries(dpStock).map(([pid, qty]) => {
              if (qty <= 0) return null;
              const p = state.products.find(x => x.id === pid);
              if (!p) return null;
              const displayName = getProductName(p.name, p.nameTa, lang);
              return (
                <View key={pid} style={styles.tableRow}>
                  <View style={styles.colProduct}>
                    <Text style={styles.tableCell} numberOfLines={2} lineBreakMode="tail">
                      {displayName}
                    </Text>
                  </View>
                  <View style={styles.colQtyRight}>
                    <Text style={[styles.tableCellBold, { color: COLORS.green }]}>
                      {qty} {p.unit}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* ── Customer Orders Today ── */}
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
                    <Text style={styles.orderName}>{displayName}</Text>
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

  // Top bar
  topBar: {
    backgroundColor: COLORS.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.medium,
  },
  topBarLeft: { flex: 1, marginRight: SPACING.md },
  topBizName: { fontSize: 17, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white, lineHeight: 22 },
  topDate:    { fontSize: 12, fontFamily: TNR, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 16 },

  scroll: { padding: SPACING.lg, paddingBottom: 30 },

  // Stat cards
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: SPACING.md,
    justifyContent: 'space-between',
  },

  // Report button
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: 8,
    ...SHADOW.small,
  },
  reportBtnLoading: { opacity: 0.7 },
  reportBtnIcon: { fontSize: 16, lineHeight: 20 },
  reportBtnText: {
    fontSize: 14,
    fontFamily: TNR_BOLD,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 20,
  },

  // Table shared
  planNote: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md, lineHeight: 18 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginBottom: 4,
  },
  tableHead: {
    fontSize: 11,
    fontFamily: TNR_BOLD,
    fontWeight: '700',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
  },

  // Table row — always row + centered
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // Column containers with consistent flex
  colProduct: {
    flex: 1.5,
    justifyContent: 'center',
    paddingRight: 4,
  },
  colQty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colQtyRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  colCost: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // Cell text
  tableCell:    { fontSize: 13, fontFamily: TNR, color: COLORS.dark, lineHeight: 18 },
  tableCellSub: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, lineHeight: 16, marginTop: 1 },
  tableCellBold: {
    fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700',
    color: COLORS.dark, lineHeight: 18, textAlign: 'center',
  },
  tableCellGreen: {
    fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600',
    color: COLORS.green, lineHeight: 18, textAlign: 'right',
  },

  // DP stock chip (truck + text on one row, centered)
  dpChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    gap: 2,
  },
  dpChipIcon: { fontSize: 11, lineHeight: 14 },
  dpChipText: { fontSize: 10, fontFamily: TNR_BOLD, fontWeight: '700', lineHeight: 14 },

  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  totalValue: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },

  // DP Card
  dpCard: { marginTop: 0, borderColor: COLORS.green, borderWidth: 1.5 },
  dpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  dpCardIcon: { fontSize: 16, lineHeight: 20, marginRight: 6 },
  dpCardName: {
    flex: 1,
    fontSize: 14,
    fontFamily: TNR_BOLD,
    fontWeight: '700',
    color: COLORS.dark,
    lineHeight: 20,
    marginRight: 8,
  },

  // Customer orders
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark, lineHeight: 20 },
  orderSub:  { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2, lineHeight: 16 },
});
