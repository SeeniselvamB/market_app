// src/screens/OrderEntryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { uid } from '../utils/helpers';
import { Order, OrderItem, Product, UNIT_OPTIONS, OWNER_DP_ID } from '../utils/types';
import { RootStackParams } from '../navigation/AppNavigator';
import { Button, Divider, EmptyState, Input } from '../components/UIComponents';
import { getProductName, getCustomerName } from '../utils/translations';

type RouteType = RouteProp<RootStackParams, 'OrderEntry'>;

export default function OrderEntryScreen() {
  const { state, saveOrder, addProduct, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { customerId } = route.params;

  const isOwnerDpEntry = customerId === OWNER_DP_ID;
  const dp = getPrimaryDeliveryPerson();

  // For OWNER_DP_ID, build a synthetic customer object from business info
  const customer = isOwnerDpEntry
    ? { id: OWNER_DP_ID, name: state.business.owner || state.business.name, phone: state.business.phone, address: '', pendingAmount: 0, isDeliveryPerson: true }
    : state.customers.find(c => c.id === customerId);

  const existingOrder = state.todayOrders[customerId];
  const isDp = isOwnerDpEntry || (customer?.isDeliveryPerson ?? false);

  const [qtys, setQtys] = useState<Record<string, string>>({});

  // Extra product modal state
  const [extraModal, setExtraModal] = useState(false);
  const [extraName, setExtraName]       = useState('');
  const [extraNameTa, setExtraNameTa]   = useState('');
  const [extraCategory, setExtraCategory] = useState('');
  const [extraUnit, setExtraUnit]       = useState('kg');
  const [extraPrice, setExtraPrice]     = useState('');
  const [extraQty, setExtraQty]         = useState('');

  useEffect(() => {
    const initial: Record<string, string> = {};
    if (existingOrder?.items) {
      existingOrder.items.forEach(item => { initial[item.productId] = String(item.qty); });
    }
    setQtys(initial);
  }, [customerId]);

  const runningTotal = state.products.reduce((sum, p) => {
    const qty = parseFloat(qtys[p.id] || '0') || 0;
    return sum + qty * p.price;
  }, 0);

  const updateQty = (productId: string, val: string) => {
    setQtys(prev => ({ ...prev, [productId]: val }));
  };

  // Track newly-added extra product to auto-set its qty when state updates
  const [pendingExtraQty, setPendingExtraQty] = useState<{ name: string; price: number; qty: number } | null>(null);
  useEffect(() => {
    if (!pendingExtraQty) return;
    const added = state.products.find(p => p.name === pendingExtraQty.name && p.price === pendingExtraQty.price);
    if (added) {
      if (pendingExtraQty.qty > 0) setQtys(prev => ({ ...prev, [added.id]: String(pendingExtraQty.qty) }));
      setPendingExtraQty(null);
    }
  }, [state.products, pendingExtraQty]);

  // Add extra product → also adds to master product list
  const handleAddExtraProduct = async () => {
    if (!extraName.trim()) { Alert.alert(t.required, t.productNameRequired); return; }
    const price = parseFloat(extraPrice);
    if (!price || price <= 0) { Alert.alert(t.required, t.validPriceRequired); return; }
    const qty = parseFloat(extraQty) || 0;

    const newProd: Omit<Product, 'id'> = {
      name: extraName.trim(),
      nameTa: extraNameTa.trim() || undefined,
      category: extraCategory.trim() || 'General',
      unit: extraUnit,
      price,
    };
    setPendingExtraQty({ name: newProd.name, price, qty });
    await addProduct(newProd);

    setExtraModal(false);
    setExtraName(''); setExtraNameTa(''); setExtraCategory(''); setExtraUnit('kg'); setExtraPrice(''); setExtraQty('');
    Alert.alert('✅', `"${extraName}" added to product list and order.`);
  };

  const handleSave = async () => {
    const items: OrderItem[] = state.products
      .map(p => {
        const qty = parseFloat(qtys[p.id] || '0') || 0;
        return { productId: p.id, qty, delivered: qty, unit: p.unit };
      })
      .filter(i => i.qty > 0);

    if (items.length === 0) { Alert.alert(t.emptyOrder, t.emptyOrderMsg); return; }

    await saveOrder(customerId, { items, confirmed: true, orderedAt: new Date().toISOString() });
    navigation.goBack();
  };

  if (!customer) return null;

  const grouped: Record<string, Product[]> = {};
  state.products.forEach(p => {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {getCustomerName(customer.name, customer.nameTa, lang)}{isDp ? ' 🚚' : ''}
          </Text>
          <Text style={styles.headerSub}>{customer.phone || customer.address || t.enterOrder}</Text>
        </View>
        <TouchableOpacity style={styles.addExtraBtn} onPress={() => setExtraModal(true)}>
          <Text style={styles.addExtraBtnText}>+ Extra</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Info note for delivery person */}
          {isDp && (
            <View style={styles.dpInfoBox}>
              <Text style={styles.dpInfoTitle}>📦 Stock Assignment Mode</Text>
              <Text style={styles.dpInfoText}>
                Enter the stock quantities to assign to this delivery person. This is NOT a customer order — no invoice will be generated. The quantities entered here will be added to the Dashboard's Today Market Quantity and allocated as delivery person stock.
              </Text>
            </View>
          )}

          {state.products.length === 0 ? (
            <EmptyState icon="📦" message={t.noProducts} />
          ) : (
            Object.keys(grouped).map(cat => (
              <View key={cat} style={styles.categorySection}>
                <Text style={styles.categoryLabel}>{cat}</Text>
                {grouped[cat].map(p => {
                  const qty = parseFloat(qtys[p.id] || '0') || 0;
                  const lineTotal = qty * p.price;
                  const dpHas = isDp ? null : (dp ? (getDeliveryPersonStock(dp.id)[p.id] || 0) : null);
                  const displayName = getProductName(p.name, p.nameTa, lang);

                  return (
                    <View key={p.id} style={styles.productRow}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{displayName}</Text>
                        <Text style={styles.productPrice}>{formatCurrency(p.price)} / {p.unit}</Text>
                        {dpHas !== null && dpHas > 0 && (
                          <Text style={styles.dpAvailText}>🚚 {dpHas} {p.unit} with DP</Text>
                        )}
                      </View>
                      <TextInput
                        style={styles.qtyInput}
                        value={qtys[p.id] || ''}
                        onChangeText={val => updateQty(p.id, val)}
                        placeholder="0"
                        placeholderTextColor={COLORS.gray}
                        keyboardType="numeric"
                      />
                      <Text style={styles.unitLabel}>{p.unit}</Text>
                      <Text style={styles.lineTotal}>{lineTotal > 0 ? formatCurrency(lineTotal) : ''}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          <Divider />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.orderTotal}</Text>
            <Text style={styles.totalValue}>{formatCurrency(runningTotal)}</Text>
          </View>
          <View style={styles.btnRow}>
            <Button label={t.cancel} onPress={() => navigation.goBack()} variant="outline" style={{ flex: 1 }} />
            <Button label={t.confirmOrder} onPress={handleSave} style={{ flex: 2 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Extra product modal */}
      <Modal visible={extraModal} animationType="slide" transparent onRequestClose={() => setExtraModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Extra Product</Text>
              <TouchableOpacity onPress={() => setExtraModal(false)}>
                <Text style={{ fontSize: 20, color: COLORS.gray }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label={t.productName}   value={extraName}     onChangeText={setExtraName}     placeholder="e.g. Apple" />
              <Input label={t.productNameTa} value={extraNameTa}   onChangeText={setExtraNameTa}   placeholder="e.g. ஆப்பிள்" />
              <Input label={t.category}      value={extraCategory} onChangeText={setExtraCategory} placeholder="Fruits / Vegetables" />
              <Text style={styles.unitPickerLabel}>{t.unit}</Text>
              <View style={styles.unitPicker}>
                {UNIT_OPTIONS.map(u => (
                  <TouchableOpacity key={u}
                    style={[styles.unitOption, extraUnit === u && styles.unitOptionActive]}
                    onPress={() => setExtraUnit(u)}>
                    <Text style={[styles.unitOptionText, extraUnit === u && styles.unitOptionTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label={t.priceRs} value={extraPrice} onChangeText={setExtraPrice} placeholder="0.00" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={t.qty} value={extraQty} onChangeText={setExtraQty} placeholder="0" keyboardType="numeric" />
                </View>
              </View>
              <Button label="✅ Add to Order & Products" onPress={handleAddExtraProduct} full />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addExtraBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  addExtraBtnText: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.white },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  dpInfoBox: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.green },
  dpInfoTitle: { fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green, marginBottom: 4 },
  dpInfoText: { fontSize: 12, fontFamily: TNR, color: COLORS.green, lineHeight: 18 },
  categorySection: { marginBottom: SPACING.md },
  categoryLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  productPrice: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  dpAvailText: { fontSize: 11, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green, marginTop: 2 },
  qtyInput: { width: 62, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 16, textAlign: 'center', color: COLORS.dark, backgroundColor: COLORS.white, fontFamily: TNR_BOLD, fontWeight: '700' },
  unitLabel: { fontSize: 11, fontFamily: TNR_BOLD, color: COLORS.gray, fontWeight: '600', minWidth: 32 },
  lineTotal: { width: 72, textAlign: 'right', fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  totalLabel: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  totalValue: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  btnRow: { flexDirection: 'row', gap: 10 },
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
});
