// src/screens/OrderEntryScreen.tsx
// Full-screen order entry for one customer. Enter qty per product.

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Order, OrderItem } from '../utils/types';
import { RootStackParams } from '../navigation/AppNavigator';
import { Button, Divider, EmptyState } from '../components/UIComponents';

type RouteType = RouteProp<RootStackParams, 'OrderEntry'>;

export default function OrderEntryScreen() {
  const { state, saveOrder } = useApp();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { customerId } = route.params;

  const customer = state.customers.find(c => c.id === customerId);
  const existingOrder = state.todayOrders[customerId];

  const [qtys, setQtys] = useState<Record<string, string>>({});

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

  const handleSave = async () => {
    const items: OrderItem[] = state.products
      .map(p => { const qty = parseFloat(qtys[p.id] || '0') || 0; return { productId: p.id, qty, delivered: qty }; })
      .filter(i => i.qty > 0);
    if (items.length === 0) { Alert.alert('Empty Order', 'Please enter quantity for at least one product.'); return; }
    await saveOrder(customerId, { items, confirmed: true, orderedAt: new Date().toISOString() });
    navigation.goBack();
  };

  if (!customer) return null;

  // Group by category
  const grouped: Record<string, typeof state.products> = {};
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
          <Text style={styles.headerTitle}>{customer.name}</Text>
          <Text style={styles.headerSub}>{customer.phone || customer.address || "Enter today's order"}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {state.products.length === 0
            ? <EmptyState icon="📦" message="No products added. Add products in Settings first." />
            : Object.keys(grouped).map(cat => (
                <View key={cat} style={styles.categorySection}>
                  <Text style={styles.categoryLabel}>{cat}</Text>
                  {grouped[cat].map(p => {
                    const qty = parseFloat(qtys[p.id] || '0') || 0;
                    const lineTotal = qty * p.price;
                    return (
                      <View key={p.id} style={styles.productRow}>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName}>{p.name}</Text>
                          <Text style={styles.productPrice}>{formatCurrency(p.price)} / {p.unit}</Text>
                        </View>
                        <TextInput
                          style={styles.qtyInput}
                          value={qtys[p.id] || ''}
                          onChangeText={val => updateQty(p.id, val)}
                          placeholder="0"
                          placeholderTextColor={COLORS.gray}
                          keyboardType="numeric"
                        />
                        <Text style={styles.lineTotal}>{lineTotal > 0 ? formatCurrency(lineTotal) : ''}</Text>
                      </View>
                    );
                  })}
                </View>
              ))
          }

          <Divider />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(runningTotal)}</Text>
          </View>
          <View style={styles.btnRow}>
            <Button label="Cancel" onPress={() => navigation.goBack()} variant="outline" style={{ flex: 1 }} />
            <Button label="✅ Confirm Order" onPress={handleSave} style={{ flex: 2 }} />
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
  categorySection: { marginBottom: SPACING.md },
  categoryLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  productPrice: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  qtyInput: { width: 72, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 16, textAlign: 'center', color: COLORS.dark, backgroundColor: COLORS.white, fontFamily: TNR_BOLD, fontWeight: '700' },
  lineTotal: { width: 80, textAlign: 'right', fontSize: 13, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  totalLabel: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },
  totalValue: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.green },
  btnRow: { flexDirection: 'row', gap: 10 },
});
