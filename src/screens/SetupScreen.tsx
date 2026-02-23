// src/screens/SetupScreen.tsx
// 4-step first-time setup wizard

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Card, CardHeader, Button, Input, EmptyState, ListItem, IconBtn, Divider } from '../components/UIComponents';

export default function SetupScreen() {
  const { state, saveBusiness, finishSetup, addProduct, deleteProduct, addCustomer, deleteCustomer, autoPopulateProducts } = useApp();

  const [step, setStep] = useState(1);

  // Step 1 — Business Info
  const [bizName,         setBizName]         = useState('');
  const [owner,           setOwner]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [ownerIsDp,       setOwnerIsDp]       = useState(false);

  // Step 2 — Market type
  const [marketType, setMarketType] = useState('');

  // Step 3 — add product inline form
  const [showProdForm, setShowProdForm] = useState(false);
  const [prodName,     setProdName]     = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodUnit,     setProdUnit]     = useState('kg');
  const [prodPrice,    setProdPrice]    = useState('');

  // Step 4 — add customer inline form
  const [showCustForm, setShowCustForm] = useState(false);
  const [custName,     setCustName]     = useState('');
  const [custPhone,    setCustPhone]    = useState('');
  const [custAddress,  setCustAddress]  = useState('');
  const [custPending,  setCustPending]  = useState('');

  // ── Step navigation ────────────────────────────────────────
  const goStep = async (next: number) => {
    if (next === 2) {
      if (!bizName.trim()) { Alert.alert('Required', 'Please enter your business name.'); return; }
      await saveBusiness({
        name: bizName.trim(),
        owner: owner.trim(),
        phone: phone.trim(),
        marketType: '',
        ownerIsDeliveryPerson: ownerIsDp,
      });
    }
    if (next === 3) {
      if (!marketType) { Alert.alert('Required', 'Please select a market type.'); return; }
      await saveBusiness({ ...state.business, marketType: marketType as any });
      if (state.products.length === 0) autoPopulateProducts(marketType);
    }
    if (next === 5) {
      if (state.products.length === 0) { Alert.alert('Required', 'Add at least one product.'); return; }
      await finishSetup();
      return;
    }
    setStep(next);
  };

  // ── Save product ───────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!prodName.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    const price = parseFloat(prodPrice);
    if (!price || price <= 0) { Alert.alert('Required', 'Enter a valid price.'); return; }
    await addProduct({ name: prodName.trim(), category: prodCategory, unit: prodUnit, price });
    setProdName(''); setProdCategory(''); setProdUnit('kg'); setProdPrice('');
    setShowProdForm(false);
  };

  // ── Save customer ──────────────────────────────────────────
  const handleAddCustomer = async () => {
    if (!custName.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    await addCustomer({ name: custName.trim(), phone: custPhone.trim(), address: custAddress.trim(), pendingAmount: parseFloat(custPending) || 0 });
    setCustName(''); setCustPhone(''); setCustAddress(''); setCustPending('');
    setShowCustForm(false);
  };

  // ── Step Indicator ─────────────────────────────────────────
  const StepDot = ({ n }: { n: number }) => (
    <View style={[styles.dot, n === step && styles.dotActive, n < step && styles.dotDone]}>
      <Text style={[styles.dotText, (n === step || n < step) && styles.dotTextActive]}>
        {n < step ? '✓' : n}
      </Text>
    </View>
  );
  const StepLine = ({ n }: { n: number }) => (
    <View style={[styles.stepLine, n < step && styles.stepLineDone]} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🛒</Text>
            <Text style={styles.heroTitle}>Market Manager</Text>
            <Text style={styles.heroSub}>Set up your distributor system in 4 quick steps</Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <StepDot n={1} /><StepLine n={1} />
            <StepDot n={2} /><StepLine n={2} />
            <StepDot n={3} /><StepLine n={3} />
            <StepDot n={4} />
          </View>

          {/* ── STEP 1: Business Info ── */}
          {step === 1 && (
            <Card>
              <CardHeader title="📋 Business Info" />
              <Input label="Business Name *" value={bizName} onChangeText={setBizName} placeholder="e.g. Sharma Fresh Market" />
              <Input label="Owner / Contact Name" value={owner} onChangeText={setOwner} placeholder="Your name" />
              <Input label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />

              {/* ── Mark Owner as Delivery Person ── */}
              <TouchableOpacity
                style={[styles.toggleRow, ownerIsDp && styles.toggleRowActive]}
                onPress={() => setOwnerIsDp(prev => !prev)}
                activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>🚚 Owner is Delivery Person</Text>
                  <Text style={styles.toggleSub}>
                    Enable if the business owner delivers stock. No invoice will be generated for the owner.
                  </Text>
                </View>
                <View style={[styles.toggle, ownerIsDp && styles.toggleOn]}>
                  <View style={[styles.toggleDot, ownerIsDp && styles.toggleDotOn]} />
                </View>
              </TouchableOpacity>

              {ownerIsDp && (
                <View style={styles.dpHintBox}>
                  <Text style={styles.dpHintText}>
                    ✅ The owner will appear as the default Delivery Person in the Orders screen for stock assignment.
                    All customer deliveries will deduct extra stock from the owner's assigned quantities.
                    The owner is never billed.
                  </Text>
                </View>
              )}

              <Button label="Continue →" onPress={() => goStep(2)} full />
            </Card>
          )}

          {/* ── STEP 2: Market Type ── */}
          {step === 2 && (
            <Card>
              <CardHeader title="🏪 Market Type" />
              <View style={styles.marketGrid}>
                {[
                  { type: 'fruits',     emoji: '🍎', label: 'Fruits' },
                  { type: 'vegetables', emoji: '🥦', label: 'Vegetables' },
                  { type: 'mixed',      emoji: '🧺', label: 'Fruits & Veg' },
                  { type: 'custom',     emoji: '✏️', label: 'Custom' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.marketOption,
                      marketType === opt.type && styles.marketOptionActive,
                      (opt.type === 'mixed' || opt.type === 'custom') && styles.marketOptionFull,
                    ]}
                    onPress={() => setMarketType(opt.type)}
                    activeOpacity={0.8}>
                    <Text style={styles.marketEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.marketLabel, marketType === opt.type && styles.marketLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.btnRow}>
                <Button label="← Back" onPress={() => setStep(1)} variant="outline" style={{ flex: 1 }} />
                <Button label="Continue →" onPress={() => goStep(3)} style={{ flex: 2 }} />
              </View>
            </Card>
          )}

          {/* ── STEP 3: Products ── */}
          {step === 3 && (
            <Card>
              <CardHeader title="📦 Products" right={
                <Button label="+ Add" onPress={() => setShowProdForm(v => !v)} size="sm" />
              } />
              {showProdForm && (
                <View style={styles.inlineForm}>
                  <Input label="Product Name *" value={prodName} onChangeText={setProdName} placeholder="e.g. Apple" />
                  <Input label="Category" value={prodCategory} onChangeText={setProdCategory} placeholder="Fruits / Vegetables" />
                  <View style={styles.btnRow}>
                    <View style={{ flex: 1 }}>
                      <Input label="Unit" value={prodUnit} onChangeText={setProdUnit} placeholder="kg" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Input label="Price (₹) *" value={prodPrice} onChangeText={setProdPrice} placeholder="0.00" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={styles.btnRow}>
                    <Button label="Cancel" onPress={() => setShowProdForm(false)} variant="ghost" style={{ flex: 1 }} />
                    <Button label="💾 Save" onPress={handleAddProduct} style={{ flex: 2 }} />
                  </View>
                  <Divider />
                </View>
              )}
              {state.products.length === 0
                ? <EmptyState icon="📦" message="No products yet. Add your products." />
                : state.products.map(p => (
                    <ListItem key={p.id} title={p.name}
                      subtitle={`${formatCurrency(p.price)}/${p.unit} • ${p.category || 'General'}`}
                      right={<IconBtn icon="🗑️" onPress={() => deleteProduct(p.id)} color={COLORS.red} />} />
                  ))
              }
              <View style={[styles.btnRow, { marginTop: SPACING.md }]}>
                <Button label="← Back" onPress={() => setStep(2)} variant="outline" style={{ flex: 1 }} />
                <Button label="Continue →" onPress={() => goStep(4)} style={{ flex: 2 }} />
              </View>
            </Card>
          )}

          {/* ── STEP 4: Customers ── */}
          {step === 4 && (
            <Card>
              <CardHeader title="👥 Customers" right={
                <Button label="+ Add" onPress={() => setShowCustForm(v => !v)} size="sm" />
              } />
              {showCustForm && (
                <View style={styles.inlineForm}>
                  <Input label="Customer Name *" value={custName} onChangeText={setCustName} placeholder="Full name" />
                  <Input label="Phone" value={custPhone} onChangeText={setCustPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                  <Input label="Address" value={custAddress} onChangeText={setCustAddress} placeholder="Delivery address" />
                  <Input label="Previous Pending (₹)" value={custPending} onChangeText={setCustPending} placeholder="0" keyboardType="numeric" />
                  <View style={styles.btnRow}>
                    <Button label="Cancel" onPress={() => setShowCustForm(false)} variant="ghost" style={{ flex: 1 }} />
                    <Button label="💾 Save" onPress={handleAddCustomer} style={{ flex: 2 }} />
                  </View>
                  <Divider />
                </View>
              )}
              {state.customers.length === 0
                ? <EmptyState icon="👥" message="No customers yet. Add your regular customers." />
                : state.customers.map(c => (
                    <ListItem key={c.id} title={c.name}
                      subtitle={`${c.phone || 'No phone'} • Pending: ${formatCurrency(c.pendingAmount)}`}
                      right={<IconBtn icon="🗑️" onPress={() => deleteCustomer(c.id)} color={COLORS.red} />} />
                  ))
              }
              <View style={[styles.btnRow, { marginTop: SPACING.md }]}>
                <Button label="← Back" onPress={() => setStep(3)} variant="outline" style={{ flex: 1 }} />
                <Button label="🚀 Get Started!" onPress={() => goStep(5)} style={{ flex: 2 }} />
              </View>
            </Card>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  hero: { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, padding: SPACING.xxl, alignItems: 'center', marginBottom: SPACING.xl },
  heroEmoji: { fontSize: 60, marginBottom: 10 },
  heroTitle: { fontSize: 26, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.white, marginBottom: 6 },
  heroSub: { fontSize: 14, fontFamily: TNR, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: COLORS.green },
  dotDone: { backgroundColor: COLORS.greenPale },
  dotText: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray },
  dotTextActive: { color: COLORS.green },
  stepLine: { flex: 1, maxWidth: 40, height: 2, backgroundColor: COLORS.border },
  stepLineDone: { backgroundColor: COLORS.green },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.lg },
  marketOption: { width: '46%', borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.lg, alignItems: 'center', backgroundColor: COLORS.white },
  marketOptionActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  marketOptionFull: { width: '100%' },
  marketEmoji: { fontSize: 36, marginBottom: 8 },
  marketLabel: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  marketLabelActive: { color: COLORS.green },
  inlineForm: { backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
  btnRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  // Toggle styles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.border, marginBottom: SPACING.sm, backgroundColor: COLORS.white,
  },
  toggleRowActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  toggleLabel: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 3 },
  toggleSub: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, lineHeight: 16 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.green },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
  toggleDotOn: { alignSelf: 'flex-end' },
  dpHintBox: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.green },
  dpHintText: { fontSize: 12, fontFamily: TNR, color: COLORS.green, lineHeight: 18 },
});
