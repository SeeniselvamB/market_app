// src/screens/SettingsScreen.tsx
// Three tabs: Customers, Products, Business info + danger zone

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer, Product } from '../utils/types';
import { Card, CardHeader, Button, Input, Badge, EmptyState, Divider, IconBtn, ListItem, SectionHeader } from '../components/UIComponents';

type TabType = 'customers' | 'products' | 'business';

export default function SettingsScreen() {
  const { state, addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct, saveBusiness, clearTodayData, resetAllData } = useApp();

  const [tab, setTab] = useState<TabType>('customers');

  // ── Customer modal ─────────────────────────────────────────
  const [custModal,     setCustModal]     = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [custName,      setCustName]      = useState('');
  const [custPhone,     setCustPhone]     = useState('');
  const [custAddress,   setCustAddress]   = useState('');
  const [custPending,   setCustPending]   = useState('');

  const openAddCust = () => {
    setEditingCustId(null);
    setCustName(''); setCustPhone(''); setCustAddress(''); setCustPending('');
    setCustModal(true);
  };
  const openEditCust = (c: Customer) => {
    setEditingCustId(c.id);
    setCustName(c.name); setCustPhone(c.phone); setCustAddress(c.address); setCustPending(String(c.pendingAmount));
    setCustModal(true);
  };
  const handleSaveCust = async () => {
    if (!custName.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    const data = { name: custName.trim(), phone: custPhone.trim(), address: custAddress.trim(), pendingAmount: parseFloat(custPending) || 0 };
    if (editingCustId) await updateCustomer(editingCustId, data);
    else await addCustomer(data);
    setCustModal(false);
  };

  // ── Product modal ──────────────────────────────────────────
  const [prodModal,     setProdModal]     = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodName,      setProdName]      = useState('');
  const [prodCategory,  setProdCategory]  = useState('');
  const [prodUnit,      setProdUnit]      = useState('kg');
  const [prodPrice,     setProdPrice]     = useState('');

  const openAddProd = () => {
    setEditingProdId(null);
    setProdName(''); setProdCategory(''); setProdUnit('kg'); setProdPrice('');
    setProdModal(true);
  };
  const openEditProd = (p: Product) => {
    setEditingProdId(p.id);
    setProdName(p.name); setProdCategory(p.category || ''); setProdUnit(p.unit); setProdPrice(String(p.price));
    setProdModal(true);
  };
  const handleSaveProd = async () => {
    if (!prodName.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    const price = parseFloat(prodPrice);
    if (!price || price <= 0) { Alert.alert('Required', 'Enter a valid price.'); return; }
    const data = { name: prodName.trim(), category: prodCategory, unit: prodUnit, price };
    if (editingProdId) await updateProduct(editingProdId, data);
    else await addProduct(data);
    setProdModal(false);
  };

  // ── Business ───────────────────────────────────────────────
  const [bizName,  setBizName]  = useState(state.business.name);
  const [bizOwner, setBizOwner] = useState(state.business.owner);
  const [bizPhone, setBizPhone] = useState(state.business.phone);

  const handleSaveBiz = async () => {
    if (!bizName.trim()) { Alert.alert('Required', 'Business name is required.'); return; }
    await saveBusiness({ ...state.business, name: bizName.trim(), owner: bizOwner.trim(), phone: bizPhone.trim() });
    Alert.alert('Saved', 'Business settings updated.');
  };

  const handleClearToday = () => {
    Alert.alert("Clear Today's Data", "This will remove all today's orders and bills. Pending amounts will NOT change.",
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearTodayData }]);
  };

  const handleReset = () => {
    Alert.alert('⚠️ Reset All Data', 'This will permanently delete ALL data.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'I Understand, Reset', style: 'destructive', onPress: () =>
          Alert.alert('Last Confirmation', 'Are you absolutely sure?',
            [{ text: 'No', style: 'cancel' }, { text: 'Yes, Delete Everything', style: 'destructive', onPress: resetAllData }]) }]);
  };

  // Group products by category
  const grouped: Record<string, Product[]> = {};
  state.products.forEach(p => {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionHeader title="⚙️ Settings" />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['customers', 'products', 'business'] as TabType[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'customers' ? '👥 Customers' : t === 'products' ? '📦 Products' : '🏪 Business'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── CUSTOMERS ── */}
          {tab === 'customers' && (
            <>
              <Button label="+ Add Customer" onPress={openAddCust} full style={{ marginBottom: SPACING.md }} />
              {state.customers.length === 0
                ? <EmptyState icon="👥" message="No customers yet." />
                : state.customers.map(c => (
                    <Card key={c.id} style={{ marginBottom: 10 }}>
                      <View style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{c.name}</Text>
                          {c.phone   ? <Text style={styles.itemSub}>📞 {c.phone}</Text>   : null}
                          {c.address ? <Text style={styles.itemSub}>📍 {c.address}</Text> : null}
                          <Badge label={`Pending: ${formatCurrency(c.pendingAmount)}`} variant="orange" />
                        </View>
                        <View style={styles.itemActions}>
                          <IconBtn icon="✏️" onPress={() => openEditCust(c)} />
                          <IconBtn icon="🗑️" color={COLORS.red}
                            onPress={() => Alert.alert('Delete', `Delete ${c.name}?`,
                              [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteCustomer(c.id) }])} />
                        </View>
                      </View>
                    </Card>
                  ))
              }
            </>
          )}

          {/* ── PRODUCTS ── */}
          {tab === 'products' && (
            <>
              <Button label="+ Add Product" onPress={openAddProd} full style={{ marginBottom: SPACING.md }} />
              {state.products.length === 0
                ? <EmptyState icon="📦" message="No products yet." />
                : Object.keys(grouped).map(cat => (
                    <View key={cat}>
                      <Text style={styles.catLabel}>{cat}</Text>
                      {grouped[cat].map(p => (
                        <Card key={p.id} style={{ marginBottom: 8 }}>
                          <View style={styles.itemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemName}>{p.name}</Text>
                              <Text style={styles.itemSub}>{formatCurrency(p.price)} per {p.unit}</Text>
                            </View>
                            <View style={styles.itemActions}>
                              <IconBtn icon="✏️" onPress={() => openEditProd(p)} />
                              <IconBtn icon="🗑️" color={COLORS.red}
                                onPress={() => Alert.alert('Delete', `Delete ${p.name}?`,
                                  [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(p.id) }])} />
                            </View>
                          </View>
                        </Card>
                      ))}
                    </View>
                  ))
              }
            </>
          )}

          {/* ── BUSINESS ── */}
          {tab === 'business' && (
            <>
              <Card>
                <CardHeader title="Business Info" />
                <Input label="Business Name *" value={bizName} onChangeText={setBizName} placeholder="e.g. Sharma Fresh Market" />
                <Input label="Owner Name"      value={bizOwner} onChangeText={setBizOwner} placeholder="Your name" />
                <Input label="Phone"           value={bizPhone} onChangeText={setBizPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                <Button label="💾 Save Settings" onPress={handleSaveBiz} full />
              </Card>
              <Card style={{ marginTop: SPACING.md }}>
                <CardHeader title="⚠️ Danger Zone" />
                <Text style={styles.dangerNote}>These actions cannot be undone.</Text>
                <Button label="🗑️ Clear Today's Orders" onPress={handleClearToday} variant="outline" full style={{ marginBottom: SPACING.sm, borderColor: COLORS.orange }} />
                <Button label="💣 Reset All Data" onPress={handleReset} variant="danger" full />
              </Card>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── CUSTOMER MODAL ── */}
      <Modal visible={custModal} animationType="slide" transparent onRequestClose={() => setCustModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCustId ? 'Edit Customer' : 'Add Customer'}</Text>
              <IconBtn icon="✕" onPress={() => setCustModal(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label="Customer Name *" value={custName}    onChangeText={setCustName}    placeholder="Full name" />
              <Input label="Phone"           value={custPhone}   onChangeText={setCustPhone}   placeholder="+91 98765 43210" keyboardType="phone-pad" />
              <Input label="Address"         value={custAddress} onChangeText={setCustAddress} placeholder="Delivery address" />
              <Input label="Previous Pending (₹)" value={custPending} onChangeText={setCustPending} placeholder="0" keyboardType="numeric" />
              <Button label="💾 Save Customer" onPress={handleSaveCust} full />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── PRODUCT MODAL ── */}
      <Modal visible={prodModal} animationType="slide" transparent onRequestClose={() => setProdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProdId ? 'Edit Product' : 'Add Product'}</Text>
              <IconBtn icon="✕" onPress={() => setProdModal(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label="Product Name *" value={prodName}     onChangeText={setProdName}     placeholder="e.g. Apple" />
              <Input label="Category"       value={prodCategory} onChangeText={setProdCategory} placeholder="Fruits / Vegetables" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Input label="Unit"      value={prodUnit}  onChangeText={setProdUnit}  placeholder="kg" /></View>
                <View style={{ flex: 1 }}><Input label="Price (₹)" value={prodPrice} onChangeText={setProdPrice} placeholder="0.00" keyboardType="numeric" /></View>
              </View>
              <Button label="💾 Save Product" onPress={handleSaveProd} full />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: 6, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.white, ...SHADOW.small },
  tabLabel: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray },
  tabLabelActive: { color: COLORS.green },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  itemSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: 2 },
  itemActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  catLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  dangerNote: { fontSize: 13, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.xl, paddingBottom: 36, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl },
  modalTitle: { fontSize: 20, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
});
