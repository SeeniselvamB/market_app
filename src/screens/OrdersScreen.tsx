// src/screens/OrdersScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { formatCurrency } from '../utils/helpers';
import { Customer, OWNER_DP_ID } from '../utils/types';
import { getCustomerName } from '../utils/translations';
import { SectionHeader, EmptyState, Badge } from '../components/UIComponents';

export default function OrdersScreen() {
  const { state, calculateOrderTotal, getDeliveryPersonStock, getPrimaryDeliveryPerson } = useApp();
  const { t, lang } = useLang();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => {}, [state]));

  const dp = getPrimaryDeliveryPerson();

  // Build the list:
  //   1. If owner is DP (OWNER_DP_ID), show them as the pinned top entry (not in customers[])
  //   2. If a Customer is marked as DP, they appear pinned to top
  //   3. All other normal customers follow
  const isOwnerDp = state.business.ownerIsDeliveryPerson && dp?.id === OWNER_DP_ID;

  const filteredCustomers = state.customers.filter(c => {
    const displayName = getCustomerName(c.name, c.nameTa, lang).toLowerCase();
    return displayName.includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
  });

  // All customers are normal customers (DP is always owner via OWNER_DP_ID)
  const sortedCustomers: Customer[] = filteredCustomers;

  const renderDpEntry = () => {
    if (!isOwnerDp || !dp) return null;
    if (search.trim() !== '' && !dp.name.toLowerCase().includes(search.toLowerCase())) return null;

    const dpName = dp.name || state.business.name;
    const order = state.todayOrders[OWNER_DP_ID];
    const hasOrder = order?.items?.some(i => i.qty > 0);
    const itemCount = hasOrder ? order.items.filter(i => i.qty > 0).length : 0;
    const dpStockEntries = Object.entries(getDeliveryPersonStock(OWNER_DP_ID)).filter(([, qty]) => qty > 0);

    return (
      <TouchableOpacity
        style={[styles.customerCard, styles.dpCard]}
        onPress={() => navigation.navigate('OrderEntry', { customerId: OWNER_DP_ID })}
        activeOpacity={0.8}>
        <View style={styles.custLeft}>
          <View style={[styles.avatar, styles.dpAvatar]}>
            <Text style={styles.avatarText}>🚚</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.custName}>{dpName}</Text>
              <View style={styles.dpBadge}>
                <Text style={styles.dpBadgeText}>OWNER · DELIVERY PERSON</Text>
              </View>
            </View>
            <Text style={styles.dpSubText}>
              {hasOrder
                ? `Stock assigned: ${itemCount} product(s) • Tap to update`
                : 'Tap to assign today\'s delivery stock'}
            </Text>
            {dpStockEntries.length > 0 && (
              <Text style={styles.dpStockInfo}>
                🚚 {dpStockEntries.map(([pid, qty]) => {
                  const p = state.products.find(x => x.id === pid);
                  return p ? `${qty} ${p.unit} ${p.name}` : '';
                }).filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        </View>
        <Badge
          label={hasOrder ? '✓ Assigned' : '+ Assign'}
          variant={hasOrder ? 'green' : 'orange'}
        />
      </TouchableOpacity>
    );
  };

  const renderCustomer = ({ item: c }: { item: Customer }) => {
    const order    = state.todayOrders[c.id];
    const hasOrder = order?.items?.some(i => i.qty > 0);
    const orderTotal  = hasOrder ? calculateOrderTotal(c.id) : 0;
    const itemCount   = hasOrder ? order.items.filter(i => i.qty > 0).length : 0;
    const displayName = getCustomerName(c.name, c.nameTa, lang);

    const dpStockEntries = c.isDeliveryPerson
      ? Object.entries(getDeliveryPersonStock(c.id)).filter(([, qty]) => qty > 0)
      : [];

    return (
      <TouchableOpacity
        style={[styles.customerCard, c.isDeliveryPerson && styles.dpCard]}
        onPress={() => navigation.navigate('OrderEntry', { customerId: c.id })}
        activeOpacity={0.8}>
        <View style={styles.custLeft}>
          <View style={[styles.avatar, c.isDeliveryPerson && styles.dpAvatar]}>
            <Text style={styles.avatarText}>{c.isDeliveryPerson ? '🚚' : displayName[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.custName}>{displayName}</Text>
              {c.isDeliveryPerson && (
                <View style={styles.dpBadge}>
                  <Text style={styles.dpBadgeText}>DELIVERY PERSON</Text>
                </View>
              )}
            </View>
            {c.isDeliveryPerson ? (
              <Text style={styles.dpSubText}>
                {hasOrder ? `Stock assigned: ${itemCount} product(s)` : "Tap to assign today's stock"}
              </Text>
            ) : (
              <Text style={styles.custSub}>{c.phone || c.address || 'No contact info'}</Text>
            )}
            {hasOrder && !c.isDeliveryPerson && (
              <Text style={styles.orderInfo}>
                {itemCount} {t.items} • {formatCurrency(orderTotal)}
              </Text>
            )}
            {dpStockEntries.length > 0 && (
              <Text style={styles.dpStockInfo}>
                🚚 {dpStockEntries.map(([pid, qty]) => {
                  const p = state.products.find(x => x.id === pid);
                  return p ? `${qty} ${p.unit} ${p.name}` : '';
                }).filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        </View>
        <Badge
          label={c.isDeliveryPerson ? (hasOrder ? '✓ Assigned' : '+ Assign') : (hasOrder ? '✓ Ordered' : '+ Order')}
          variant={hasOrder ? 'green' : (c.isDeliveryPerson ? 'orange' : 'gray')}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SectionHeader title={`${t.orders}`} subtitle="Assign DP stock first, then take customer orders" />
      </View>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchCustomer}
          placeholderTextColor={COLORS.gray}
        />
      </View>

      {/* Owner DP entry rendered separately at top */}
      {renderDpEntry()}

      <FlatList
        data={sortedCustomers}
        keyExtractor={c => c.id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          state.customers.length === 0
            ? <EmptyState icon="👥" message={t.noCustomersYet} />
            : <EmptyState icon="🔍" message="No customers match your search." />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: TNR, color: COLORS.dark, paddingVertical: 11 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 30 },
  customerCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, marginHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small },
  dpCard: { backgroundColor: '#F1F8E9', borderColor: COLORS.green, borderWidth: 1.5 },
  custLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.greenPale, alignItems: 'center', justifyContent: 'center' },
  dpAvatar: { backgroundColor: COLORS.green },
  avatarText: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.green },
  custName: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  custSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  dpSubText: { fontSize: 12, fontFamily: TNR, color: COLORS.green, marginTop: 2 },
  dpBadge: { backgroundColor: COLORS.green, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  dpBadgeText: { fontSize: 9, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  orderInfo: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.green, marginTop: 2 },
  dpStockInfo: { fontSize: 11, fontFamily: TNR, color: COLORS.orange, marginTop: 2, flexShrink: 1 },
});
