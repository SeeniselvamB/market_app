// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer, Product, UNIT_OPTIONS } from '../utils/types';
import { getProductName, getCustomerName } from '../utils/translations';
import { Card, CardHeader, Button, Input, Badge, EmptyState, IconBtn, SectionHeader } from '../components/UIComponents';

type TabType = 'customers' | 'products' | 'business' | 'language';

export default function SettingsScreen() {
  const {
    state, addCustomer, updateCustomer, deleteCustomer,
    addProduct, updateProduct, deleteProduct,
    saveBusiness, clearTodayData, resetAllData,
  } = useApp();
  const { t, lang, setLang } = useLang();

  const [tab, setTab] = useState<TabType>('customers');

  // ── Customer modal ─────────────────────────────────────────
  const [custModal,      setCustModal]      = useState(false);
  const [editingCustId,  setEditingCustId]  = useState<string | null>(null);
  const [custName,       setCustName]       = useState('');
  const [custNameTa,     setCustNameTa]     = useState('');
  const [custPhone,      setCustPhone]      = useState('');
  const [custAddress,    setCustAddress]    = useState('');
  const [custPending,    setCustPending]    = useState('');

  const openAddCust = () => {
    setEditingCustId(null);
    setCustName(''); setCustNameTa(''); setCustPhone(''); setCustAddress('');
    setCustPending('');
    setCustModal(true);
  };
  const openEditCust = (c: Customer) => {
    setEditingCustId(c.id);
    setCustName(c.name); setCustNameTa(c.nameTa || '');
    setCustPhone(c.phone); setCustAddress(c.address);
    setCustPending(String(c.pendingAmount));
    setCustModal(true);
  };
  const handleSaveCust = async () => {
    if (!custName.trim()) { Alert.alert(t.required, t.customerNameRequired); return; }
    const data: Omit<Customer, 'id'> = {
      name: custName.trim(),
      nameTa: custNameTa.trim() || undefined,
      phone: custPhone.trim(),
      address: custAddress.trim(),
      pendingAmount: parseFloat(custPending) || 0,
      isDeliveryPerson: false,
    };
    if (editingCustId) await updateCustomer(editingCustId, data);
    else await addCustomer(data);
    setCustModal(false);
  };

  // ── Product modal ──────────────────────────────────────────
  const [prodModal,     setProdModal]     = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodName,      setProdName]      = useState('');
  const [prodNameTa,    setProdNameTa]    = useState('');
  const [prodCategory,  setProdCategory]  = useState('');
  const [prodUnit,      setProdUnit]      = useState('kg');
  const [prodPrice,     setProdPrice]     = useState('');

  const openAddProd = () => {
    setEditingProdId(null);
    setProdName(''); setProdNameTa(''); setProdCategory(''); setProdUnit('kg'); setProdPrice('');
    setProdModal(true);
  };
  const openEditProd = (p: Product) => {
    setEditingProdId(p.id);
    setProdName(p.name); setProdNameTa(p.nameTa || '');
    setProdCategory(p.category || ''); setProdUnit(p.unit); setProdPrice(String(p.price));
    setProdModal(true);
  };
  const handleSaveProd = async () => {
    if (!prodName.trim()) { Alert.alert(t.required, t.productNameRequired); return; }
    const price = parseFloat(prodPrice);
    if (!price || price <= 0) { Alert.alert(t.required, t.validPriceRequired); return; }
    const data: Omit<Product, 'id'> = {
      name: prodName.trim(),
      nameTa: prodNameTa.trim() || undefined,
      category: prodCategory.trim(),
      unit: prodUnit,
      price,
    };
    if (editingProdId) await updateProduct(editingProdId, data);
    else await addProduct(data);
    setProdModal(false);
  };

  // ── Business ───────────────────────────────────────────────
  const [bizName,  setBizName]  = useState(state.business.name);
  const [bizOwner, setBizOwner] = useState(state.business.owner);
  const [bizPhone,  setBizPhone]  = useState(state.business.phone);
  const [ownerIsDp, setOwnerIsDp] = useState(state.business.ownerIsDeliveryPerson ?? false);

  const handleSaveBiz = async () => {
    if (!bizName.trim()) { Alert.alert(t.required, t.businessNameRequired); return; }
    await saveBusiness({
      ...state.business,
      name: bizName.trim(),
      owner: bizOwner.trim(),
      phone: bizPhone.trim(),
      ownerIsDeliveryPerson: ownerIsDp,
    });
    Alert.alert(t.saved, t.businessSettingsUpdated);
  };

  const handleClearToday = () => {
    Alert.alert(t.clearTodayOrders, t.clearTodayMsg,
      [{ text: t.cancel, style: 'cancel' },
       { text: t.delete, style: 'destructive', onPress: clearTodayData }]);
  };

  const handleReset = () => {
    Alert.alert('⚠️ ' + t.resetAllData, t.resetMsg,
      [{ text: t.cancel, style: 'cancel' },
       { text: 'Continue', style: 'destructive', onPress: () =>
           Alert.alert(t.lastConfirmation, t.areYouSure,
             [{ text: t.no, style: 'cancel' },
              { text: t.yesDeleteEverything, style: 'destructive', onPress: resetAllData }]) }]);
  };

  const grouped: Record<string, Product[]> = {};
  state.products.forEach(p => {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const tabs: { key: TabType; label: string }[] = [
    { key: 'customers', label: t.customers },
    { key: 'products',  label: t.products  },
    { key: 'business',  label: t.business  },
    { key: 'language',  label: t.language  },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionHeader title={t.settings} />
      </View>

      {/* Tab bar — horizontal scroll so Tamil labels fit */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScrollView} contentContainerStyle={styles.tabBar}>
        {tabs.map(({ key, label }) => (
          <TouchableOpacity key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)} activeOpacity={0.8}>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">

          {/* ── CUSTOMERS ── */}
          {tab === 'customers' && (
            <>
              <Button label={t.addCustomer} onPress={openAddCust} full style={{ marginBottom: SPACING.md }} />
              {state.customers.length === 0
                ? <EmptyState icon="👥" message={t.noCustomersYet} />
                : state.customers.map(c => {
                    const displayName = getCustomerName(c.name, c.nameTa, lang);
                    return (
                      <Card key={c.id} style={{ marginBottom: 10 }}>
                        <View style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>
                              {displayName}
                            </Text>
                            {c.nameTa && lang === 'en' && (
                              <Text style={styles.itemSub}>தமிழ்: {c.nameTa}</Text>
                            )}
                            {c.phone   ? <Text style={styles.itemSub}>📞 {c.phone}</Text>   : null}
                            {c.address ? <Text style={styles.itemSub}>📍 {c.address}</Text> : null}
                            <Badge label={`${t.pending2}: ${formatCurrency(c.pendingAmount)}`} variant="orange" />
                          </View>
                          <View style={styles.itemActions}>
                            <IconBtn icon="✏️" onPress={() => openEditCust(c)} />
                            <IconBtn icon="🗑️" color={COLORS.red}
                              onPress={() => Alert.alert(t.delete, `Delete ${c.name}?`,
                                [{ text: t.cancel, style: 'cancel' },
                                 { text: t.delete, style: 'destructive', onPress: () => deleteCustomer(c.id) }])} />
                          </View>
                        </View>
                      </Card>
                    );
                  })
              }
            </>
          )}

          {/* ── PRODUCTS ── */}
          {tab === 'products' && (
            <>
              <Button label={t.addProduct} onPress={openAddProd} full style={{ marginBottom: SPACING.md }} />
              {state.products.length === 0
                ? <EmptyState icon="📦" message={t.noProductsYet} />
                : Object.keys(grouped).map(cat => (
                    <View key={cat}>
                      <Text style={styles.catLabel}>{cat}</Text>
                      {grouped[cat].map(p => {
                        const displayName = getProductName(p.name, p.nameTa, lang);
                        return (
                          <Card key={p.id} style={{ marginBottom: 8 }}>
                            <View style={styles.itemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>{displayName}</Text>
                                {p.nameTa && lang === 'en' && (
                                  <Text style={styles.itemSub}>தமிழ்: {p.nameTa}</Text>
                                )}
                                <Text style={styles.itemSub}>
                                  {formatCurrency(p.price)} {t.perUnit} {p.unit}
                                </Text>
                                <Badge label={p.unit} variant="orange" />
                              </View>
                              <View style={styles.itemActions}>
                                <IconBtn icon="✏️" onPress={() => openEditProd(p)} />
                                <IconBtn icon="🗑️" color={COLORS.red}
                                  onPress={() => Alert.alert(t.delete, `Delete ${p.name}?`,
                                    [{ text: t.cancel, style: 'cancel' },
                                     { text: t.delete, style: 'destructive', onPress: () => deleteProduct(p.id) }])} />
                              </View>
                            </View>
                          </Card>
                        );
                      })}
                    </View>
                  ))
              }
            </>
          )}

          {/* ── BUSINESS ── */}
          {tab === 'business' && (
            <>
              <Card>
                <CardHeader title={t.businessInfo} />
                <Input label={t.businessName} value={bizName}  onChangeText={setBizName}  placeholder="e.g. Sharma Fresh Market" />
                <Input label={t.ownerName}    value={bizOwner} onChangeText={setBizOwner} placeholder="Your name" />
                <Input label={t.phone}        value={bizPhone} onChangeText={setBizPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                {/* Owner as Delivery Person toggle */}
                <TouchableOpacity
                  style={[styles.toggleRow, ownerIsDp && styles.toggleRowActive]}
                  onPress={() => setOwnerIsDp(prev => !prev)}
                  activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>🚚 Owner is Delivery Person</Text>
                    <Text style={styles.toggleSub}>
                      When enabled, the owner handles stock delivery. The owner cannot be billed — no invoices are generated.
                    </Text>
                  </View>
                  <View style={[styles.toggle, ownerIsDp && styles.toggleOn]}>
                    <View style={[styles.toggleDot, ownerIsDp && styles.toggleDotOn]} />
                  </View>
                </TouchableOpacity>
                {ownerIsDp && (
                  <View style={styles.dpHintBox}>
                    <Text style={styles.dpHintText}>
                      ✅ Owner will appear as Delivery Person in the Orders screen. Extra stock requested at delivery will be checked against owner's assigned stock.
                    </Text>
                  </View>
                )}
                <Button label={t.saveSettings} onPress={handleSaveBiz} full />
              </Card>
              <Card style={{ marginTop: SPACING.md }}>
                <CardHeader title={t.dangerZone} />
                <Text style={styles.dangerNote}>{t.dangerNote}</Text>
                <Button label={t.clearTodayOrders} onPress={handleClearToday} variant="outline" full
                  style={{ marginBottom: SPACING.sm, borderColor: COLORS.orange }} />
                <Button label={t.resetAllData} onPress={handleReset} variant="danger" full />
              </Card>
            </>
          )}

          {/* ── LANGUAGE ── */}
          {tab === 'language' && (
            <Card>
              <CardHeader title={t.languageSettings} />
              <Text style={styles.langNote}>{t.selectLanguage}</Text>
              {(['en', 'ta'] as const).map(l => (
                <TouchableOpacity key={l}
                  style={[styles.langOption, lang === l && styles.langOptionActive]}
                  onPress={() => setLang(l)}>
                  <Text style={[styles.langOptionText, lang === l && styles.langOptionTextActive]}>
                    {l === 'en' ? `${t.english}` : `${t.tamil}`}
                  </Text>
                  {lang === l && <Text style={styles.langCheck}></Text>}
                </TouchableOpacity>
              ))}
              <View style={styles.langHint}>
                <Text style={styles.langHintText}>
                  💡 When Tamil is selected, product names and customer names will appear in Tamil if you've set a Tamil name for them.
                </Text>
              </View>
            </Card>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── CUSTOMER MODAL ── */}
      <Modal visible={custModal} animationType="slide" transparent onRequestClose={() => setCustModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCustId ? t.editCustomer : t.addCustomer}</Text>
              <IconBtn icon="✕" onPress={() => setCustModal(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="always">
              <Input label={t.customerName}      value={custName}    onChangeText={setCustName}    placeholder="Full name" />
              <Input label={t.customerNameTa}    value={custNameTa}  onChangeText={setCustNameTa}  placeholder="e.g. ராமன்" />
              <Input label={t.phone}             value={custPhone}   onChangeText={setCustPhone}   placeholder="+91 98765 43210" keyboardType="phone-pad" />
              <Input label={t.address}           value={custAddress} onChangeText={setCustAddress} placeholder="Delivery address" />
              <Input label={t.previousPendingRs} value={custPending} onChangeText={setCustPending} placeholder="0" keyboardType="numeric" />
              <Button label={t.saveCustomer} onPress={handleSaveCust} full />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── PRODUCT MODAL ── */}
      <Modal visible={prodModal} animationType="slide" transparent onRequestClose={() => setProdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProdId ? t.editProduct : t.addProduct}</Text>
              <IconBtn icon="✕" onPress={() => setProdModal(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="always">
              <Input label={t.productName}   value={prodName}     onChangeText={setProdName}     placeholder="e.g. Apple" />
              <Input label={t.productNameTa} value={prodNameTa}   onChangeText={setProdNameTa}   placeholder="e.g. ஆப்பிள்" />
              <Input label={t.category}      value={prodCategory} onChangeText={setProdCategory} placeholder="Fruits / Vegetables" />
              <Text style={styles.unitPickerLabel}>{t.unit}</Text>
              <View style={styles.unitPicker}>
                {UNIT_OPTIONS.map(u => (
                  <TouchableOpacity key={u}
                    style={[styles.unitOption, prodUnit === u && styles.unitOptionActive]}
                    onPress={() => setProdUnit(u)}>
                    <Text style={[styles.unitOptionText, prodUnit === u && styles.unitOptionTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label={t.priceRs} value={prodPrice} onChangeText={setProdPrice} placeholder="0.00" keyboardType="numeric" />
              <Button label={t.saveProduct} onPress={handleSaveProd} full />
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
  tabScrollView: { maxHeight: 52 },
  tabBar: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, gap: 6, flexDirection: 'row' },
  tabBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayLight, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.green, ...SHADOW.small },
  tabLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray },
  tabLabelActive: { color: COLORS.white },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  itemSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginBottom: 2 },
  itemActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  catLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  dangerNote: { fontSize: 13, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md },
  langNote: { fontSize: 14, fontFamily: TNR, color: COLORS.gray, marginBottom: SPACING.md },
  langOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: SPACING.sm, backgroundColor: COLORS.white },
  langOptionActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  langOptionText: { fontSize: 16, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.gray },
  langOptionTextActive: { color: COLORS.green },
  langCheck: { fontSize: 18, color: COLORS.green, fontFamily: TNR_BOLD, fontWeight: '700' },
  langHint: { marginTop: SPACING.md, backgroundColor: COLORS.grayLight, borderRadius: RADIUS.sm, padding: SPACING.md },
  langHintText: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.xl, paddingBottom: 36, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl },
  modalTitle: { fontSize: 20, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  unitPickerLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  unitOption: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.white },
  unitOptionActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  unitOptionText: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.gray },
  unitOptionTextActive: { color: COLORS.green },
  dpHintBox: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: SPACING.sm, backgroundColor: COLORS.white },
  toggleRowActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenPale },
  toggleLabel: { fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  toggleSub: { fontSize: 11, fontFamily: TNR, color: COLORS.gray, lineHeight: 16, flexShrink: 1 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.green },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
  toggleDotOn: { alignSelf: 'flex-end' },
  dpHintText: { fontSize: 12, fontFamily: TNR, color: COLORS.green, lineHeight: 18 },
});
