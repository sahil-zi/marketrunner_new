import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createOne, updateOne, bulkInsert } from '@/api/supabase/helpers';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  Loader2,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Download,
  MoreHorizontal,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import PaginationBar from '@/components/admin/PaginationBar';
import CSVUploader from '@/components/admin/CSVUploader';

import { useOrders, useOrderItems, useUpdateOrderItem } from '@/hooks/use-orders';
import { useProducts } from '@/hooks/use-products';
import { usePagination } from '@/hooks/use-pagination';

/* ------------------------------------------------------------------ */
/*  Framer Motion variants                                            */
/* ------------------------------------------------------------------ */

const tableContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function deriveOrderStatus(items) {
  if (items.length === 0) return 'pending';
  const activeItems = items.filter((i) => i.status !== 'cancelled');
  if (activeItems.length === 0) return 'cancelled';
  if (activeItems.every((i) => i.status === 'shipped')) return 'shipped';
  if (activeItems.every((i) => i.status === 'picked')) return 'picked';
  if (activeItems.some((i) => i.status === 'pending')) return 'pending';
  return 'assigned_to_run';
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Orders() {
  const queryClient = useQueryClient();

  /* ---- React Query data ----------------------------------------- */
  const { data: orders = [], isLoading: ordersLoading } = useOrders('-created_date');
  const { data: orderItems = [], isLoading: itemsLoading } = useOrderItems('-created_date');
  const { data: products = [], isLoading: productsLoading } = useProducts();

  const updateOrderItem = useUpdateOrderItem();

  const isLoading = ordersLoading || itemsLoading || productsLoading;

  /* ---- UI state ------------------------------------------------- */
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

  /* ---- New Order dialog state ----------------------------------- */
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderPlatform, setNewOrderPlatform] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [newOrderItems, setNewOrderItems] = useState([{ barcode: '', quantity: 1 }]);
  const [newOrderSaving, setNewOrderSaving] = useState(false);

  function openNewOrderDialog() {
    setNewOrderPlatform('');
    setNewOrderId('');
    setNewOrderDate(new Date().toISOString().split('T')[0]);
    setNewOrderItems([{ barcode: '', quantity: 1 }]);
    setNewOrderOpen(true);
  }

  function addItemRow() {
    setNewOrderItems((prev) => [...prev, { barcode: '', quantity: 1 }]);
  }

  function removeItemRow(idx) {
    setNewOrderItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItemRow(idx, field, value) {
    setNewOrderItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    const platform = newOrderPlatform.trim();
    const orderId = newOrderId.trim();
    if (!platform) { toast.error('Platform name is required'); return; }
    if (!orderId) { toast.error('Order ID is required'); return; }

    const validItems = newOrderItems.filter((r) => r.barcode.trim());
    if (validItems.length === 0) { toast.error('Add at least one item with a barcode'); return; }

    // Validate barcodes
    const knownBarcodes = new Set(products.map((p) => p.barcode));
    const unknownBarcodes = [...new Set(validItems.map((r) => r.barcode.trim()).filter((b) => !knownBarcodes.has(b)))];
    if (unknownBarcodes.length > 0) {
      toast.error(`Unknown barcode(s): ${unknownBarcodes.join(', ')}`);
      return;
    }

    // Check for duplicate order
    const existingOrder = orders.find(
      (o) => o.platform_name === platform && o.platform_order_id === orderId
    );
    if (existingOrder) {
      const items = orderItems.filter((i) => i.order_id === existingOrder.id);
      if (items.length > 0 && !items.every((i) => i.status === 'cancelled')) {
        toast.error(`Order ${orderId} already exists for ${platform}`);
        return;
      }
    }

    setNewOrderSaving(true);
    try {
      const newOrder = await createOne('orders', {
        platform_name: platform,
        platform_order_id: orderId,
        order_timestamp: new Date(newOrderDate).toISOString(),
      });

      await bulkInsert('order_items', validItems.map((r) => ({
        order_id: newOrder.id,
        barcode: r.barcode.trim(),
        quantity: Math.max(1, parseInt(r.quantity) || 1),
        status: 'pending',
      })));

      toast.success(`Order ${orderId} created with ${validItems.length} item${validItems.length !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      setNewOrderOpen(false);
    } catch (err) {
      console.error('Failed to create order:', err);
      toast.error('Failed to create order');
    } finally {
      setNewOrderSaving(false);
    }
  }

  /* ---- Derived data --------------------------------------------- */
  const platforms = useMemo(
    () => [...new Set(orders.map((o) => o.platform_name).filter(Boolean))],
    [orders]
  );

  const ordersWithItems = useMemo(
    () =>
      orders.map((order) => {
        const items = orderItems.filter((item) => item.order_id === order.id);
        return {
          ...order,
          items,
          totalQty: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        };
      }),
    [orders, orderItems]
  );

  const filteredOrders = useMemo(() => {
    return ordersWithItems.filter((order) => {
      const matchesSearch =
        order.platform_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.platform_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPlatform =
        filterPlatform === 'all' || order.platform_name === filterPlatform;

      let matchesStatus = true;
      if (filterStatus !== 'all') {
        const derivedStatus = deriveOrderStatus(order.items);
        matchesStatus = derivedStatus === filterStatus;
      }

      let matchesDate = true;
      if (filterDateFrom || filterDateTo) {
        const orderDate = order.order_timestamp
          ? new Date(order.order_timestamp).toISOString().split('T')[0]
          : null;
        if (!orderDate) {
          matchesDate = false;
        } else {
          if (filterDateFrom && orderDate < filterDateFrom) matchesDate = false;
          if (filterDateTo && orderDate > filterDateTo) matchesDate = false;
        }
      }

      return matchesSearch && matchesPlatform && matchesStatus && matchesDate;
    });
  }, [ordersWithItems, searchQuery, filterPlatform, filterStatus, filterDateFrom, filterDateTo]);

  /* ---- Pagination ----------------------------------------------- */
  const {
    currentPage,
    totalPages,
    paginatedItems: currentOrders,
    totalItems,
    itemsPerPage,
    setPerPage,
    goToPage,
  } = usePagination(filteredOrders);

  /* ---- Product lookup ------------------------------------------- */
  const getProductName = (barcode) => {
    const product = products.find((p) => p.barcode === barcode);
    return product ? `${product.style_name} - ${product.size || ''}` : barcode;
  };

  /* ---- CSV validation ------------------------------------------- */
  async function validateOrders(rows) {
    const errors = [];
    const warnings = [];
    const existingBarcodes = new Set(products.map((p) => p.barcode));
    // Exclude fully-cancelled orders so they can be re-imported
    const existingOrderKeys = new Set(
      orders
        .filter((o) => {
          const items = orderItems.filter((item) => item.order_id === o.id);
          return items.length > 0 && !items.every((i) => i.status === 'cancelled');
        })
        .map((o) => `${o.platform_name}|${o.platform_order_id}`)
    );
    const newOrderKeys = new Set();
    let duplicatesFound = 0;
    const missingBarcodes = [];

    rows.forEach((row) => {
      const platform = row.Platform?.trim();
      const orderId = row.OrderID?.trim();
      const barcode = row.Barcode?.trim();
      const quantity = parseInt(row.Quantity);
      const orderKey = `${platform}|${orderId}`;

      if (!platform) {
        errors.push({ row: row._rowNum, message: 'Missing platform name' });
      }

      if (!orderId) {
        errors.push({ row: row._rowNum, message: 'Missing order ID' });
      }

      if (!barcode) {
        errors.push({ row: row._rowNum, message: 'Missing barcode' });
      } else if (!existingBarcodes.has(barcode)) {
        missingBarcodes.push({ row: row._rowNum, barcode });
      }

      if (!quantity || isNaN(quantity) || quantity <= 0) {
        errors.push({ row: row._rowNum, message: 'Invalid quantity' });
      }

      if (existingOrderKeys.has(orderKey)) {
        duplicatesFound++;
        warnings.push({
          row: row._rowNum,
          message: `Duplicate order: ${platform} ${orderId}`,
        });
      } else {
        newOrderKeys.add(orderKey);
      }
    });

    if (missingBarcodes.length > 0) {
      const uniqueMissing = [...new Set(missingBarcodes.map((m) => m.barcode))];
      errors.push({
        row: 0,
        message: `${uniqueMissing.length} barcodes not found in catalog: ${uniqueMissing
          .slice(0, 5)
          .join(', ')}${uniqueMissing.length > 5 ? '...' : ''}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasDuplicates: duplicatesFound > 0,
      stats: {
        'Total Rows': rows.length,
        'New Orders': newOrderKeys.size,
        Duplicates: duplicatesFound,
      },
    };
  }

  /* ---- CSV import ----------------------------------------------- */
  async function importOrders(rows, mode) {
    // Exclude fully-cancelled orders so they can be re-imported as fresh orders
    const existingOrderKeys = new Map(
      orders
        .filter((o) => {
          const items = orderItems.filter((item) => item.order_id === o.id);
          return items.length > 0 && !items.every((i) => i.status === 'cancelled');
        })
        .map((o) => [`${o.platform_name}|${o.platform_order_id}`, o.id])
    );

    // Group rows by order
    const orderGroups = {};
    rows.forEach((row) => {
      const platform = row.Platform?.trim();
      const orderId = row.OrderID?.trim();
      const orderKey = `${platform}|${orderId}`;

      if (!orderGroups[orderKey]) {
        orderGroups[orderKey] = {
          platform,
          orderId,
          orderDate: row.OrderDate?.trim(),
          items: [],
        };
      }

      orderGroups[orderKey].items.push({
        barcode: row.Barcode?.trim(),
        quantity: parseInt(row.Quantity) || 1,
      });
    });

    let ordersCreated = 0;
    let itemsCreated = 0;

    for (const orderKey of Object.keys(orderGroups)) {
      if (existingOrderKeys.has(orderKey) && mode === 'skip') {
        continue;
      }

      const orderData = orderGroups[orderKey];

      // Create or get order
      let orderId;
      if (existingOrderKeys.has(orderKey)) {
        orderId = existingOrderKeys.get(orderKey);
      } else {
        const newOrder = await createOne('orders', {
          platform_name: orderData.platform,
          platform_order_id: orderData.orderId,
          order_timestamp: orderData.orderDate
            ? new Date(orderData.orderDate).toISOString()
            : new Date().toISOString(),
        });
        orderId = newOrder.id;
        ordersCreated++;
      }

      // Create order items
      const itemsToCreate = orderData.items.map((item) => ({
        order_id: orderId,
        barcode: item.barcode,
        quantity: item.quantity,
        status: 'pending',
      }));

      await bulkInsert('order_items', itemsToCreate);
      itemsCreated += itemsToCreate.length;
    }

    toast.success(`Imported ${ordersCreated} orders with ${itemsCreated} items`);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orderItems'] });
  }

  /* ---- Selection helpers ---------------------------------------- */
  const allFilteredIds = useMemo(() => filteredOrders.map((o) => o.id), [filteredOrders]);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedOrderIds.has(id));
  const someSelected = allFilteredIds.some((id) => selectedOrderIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(allFilteredIds));
    }
  }

  function toggleSelectOrder(id) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---- Export CSV ------------------------------------------------ */
  function exportOrders() {
    const toExport =
      selectedOrderIds.size > 0
        ? filteredOrders.filter((o) => selectedOrderIds.has(o.id))
        : filteredOrders;

    const headers = [
      'Platform',
      'OrderID',
      'OrderDate',
      'Barcode',
      'ProductName',
      'Quantity',
      'Status',
    ];
    const rows = toExport.flatMap((order) =>
      order.items.map((item) => [
        order.platform_name,
        order.platform_order_id,
        order.order_timestamp
          ? new Date(order.order_timestamp).toISOString().split('T')[0]
          : '',
        item.barcode,
        getProductName(item.barcode),
        item.quantity,
        item.status,
      ])
    );

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      selectedOrderIds.size > 0
        ? `Exported ${selectedOrderIds.size} selected order${selectedOrderIds.size !== 1 ? 's' : ''}`
        : `Exported ${toExport.length} order${toExport.length !== 1 ? 's' : ''}`
    );
  }

  /* ---- Cancel order items --------------------------------------- */
  async function cancelOrderItems(items, reason) {
    try {
      for (const item of items) {
        await updateOrderItem.mutateAsync({
          id: item.id,
          data: { status: 'cancelled' },
        });
      }
      toast.success(`${items.length} item${items.length !== 1 ? 's' : ''} cancelled`);
    } catch (error) {
      console.error('cancelOrderItems failed:', error);
      toast.error('Failed to cancel order items');
    }
  }

  /* ---- Mark as Shipped (updates inventory too) ------------------ */
  async function markAsShipped(order) {
    try {
      // Update order items to shipped via mutation for cache consistency
      for (const item of order.items) {
        await updateOrderItem.mutateAsync({
          id: item.id,
          data: { status: 'shipped' },
        });
      }

      // Update inventory for each item
      for (const item of order.items) {
        const product = products.find((p) => p.barcode === item.barcode);
        if (product) {
          const newInventory = (product.inventory || 0) - item.quantity;
          await updateOne('product_catalog', product.id, {
            inventory: Math.max(0, newInventory),
          });
        }
      }

      toast.success('Order marked as shipped, inventory updated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error) {
      console.error('markAsShipped failed:', error);
      toast.error('Failed to mark as shipped');
    }
  }

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="space-y-8">
      <PageHeader
        title="Orders"
        subtitle="Manage incoming orders from marketplaces"
      >
        <Button onClick={openNewOrderDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </PageHeader>

      {/* ---- New Order Dialog ------------------------------------ */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-order-platform">Platform</Label>
                <Input
                  id="new-order-platform"
                  list="platform-suggestions"
                  value={newOrderPlatform}
                  onChange={(e) => setNewOrderPlatform(e.target.value)}
                  placeholder="e.g. Amazon"
                  required
                />
                <datalist id="platform-suggestions">
                  {platforms.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-order-id">Order ID</Label>
                <Input
                  id="new-order-id"
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  placeholder="e.g. AMZ-12345"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="new-order-date">Order Date</Label>
              <Input
                id="new-order-date"
                type="date"
                value={newOrderDate}
                onChange={(e) => setNewOrderDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              {newOrderItems.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Barcode"
                    value={row.barcode}
                    onChange={(e) => updateItemRow(idx, 'barcode', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItemRow(idx)}
                    disabled={newOrderItems.length === 1}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOrderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={newOrderSaving}>
                {newOrderSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Orders</TabsTrigger>
          <TabsTrigger value="upload">Import CSV</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------- */}
        {/*  Browse Tab                                               */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              {/* Row 1: search + marketplace + status */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by order ID or marketplace..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background border-border"
                  />
                </div>
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger className="w-full sm:w-48 bg-card border-border text-foreground">
                    <SelectValue placeholder="Marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Marketplaces</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48 bg-card border-border text-foreground">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned_to_run">Assigned to Run</SelectItem>
                    <SelectItem value="picked">Picked</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Row 2: date range + export */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="bg-background border-border text-foreground"
                    title="Order date from"
                  />
                  <span className="text-muted-foreground text-sm shrink-0">to</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="bg-background border-border text-foreground"
                    title="Order date to"
                  />
                  {(filterDateFrom || filterDateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                      className="text-muted-foreground shrink-0"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  {selectedOrderIds.size > 0 && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {selectedOrderIds.size} selected
                    </span>
                  )}
                  <Button
                    variant="outline"
                    onClick={exportOrders}
                    className="shrink-0"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {selectedOrderIds.size > 0
                      ? `Export Selected (${selectedOrderIds.size})`
                      : 'Export All'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="No orders found"
                  description={
                    searchQuery || filterStatus !== 'all' || filterPlatform !== 'all' || filterDateFrom || filterDateTo
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Import orders from the CSV tab to get started.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all orders"
                          />
                        </TableHead>
                        <TableHead>Marketplace</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>

                    <motion.tbody
                      variants={tableContainerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {currentOrders.map((order) => {
                        const aggregatedStatus = deriveOrderStatus(order.items);

                        return (
                          <motion.tr
                            key={order.id}
                            variants={tableRowVariants}
                            className={`border-b border-border transition-colors hover:bg-muted/50 ${selectedOrderIds.has(order.id) ? 'bg-muted/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <TableCell>
                              <Checkbox
                                checked={selectedOrderIds.has(order.id)}
                                onCheckedChange={() => toggleSelectOrder(order.id)}
                                aria-label={`Select order ${order.platform_order_id}`}
                              />
                            </TableCell>

                            {/* Platform */}
                            <TableCell>
                              <Badge variant="secondary">{order.platform_name}</Badge>
                            </TableCell>

                            {/* Order ID */}
                            <TableCell className="font-mono text-sm text-foreground">
                              {order.platform_order_id}
                            </TableCell>

                            {/* Date */}
                            <TableCell className="text-muted-foreground">
                              {order.order_timestamp
                                ? new Date(order.order_timestamp).toLocaleDateString()
                                : '\u2014'}
                            </TableCell>

                            {/* Items */}
                            <TableCell>
                              <div className="space-y-1">
                                {order.items.slice(0, 3).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="text-sm text-foreground"
                                  >
                                    {getProductName(item.barcode)} &times;{' '}
                                    {item.quantity}
                                  </div>
                                ))}
                                {order.items.length > 3 && (
                                  <div className="text-sm text-muted-foreground">
                                    +{order.items.length - 3} more
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Total Qty */}
                            <TableCell className="font-medium text-foreground">
                              {order.totalQty}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <StatusBadge status={aggregatedStatus} />
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Order actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {order.items.every(
                                    (i) => i.status === 'picked'
                                  ) && (
                                    <DropdownMenuItem
                                      onClick={() => markAsShipped(order)}
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                      Mark as Shipped
                                    </DropdownMenuItem>
                                  )}
                                  {order.items.some(
                                    (i) => i.status === 'pending'
                                  ) && (
                                    <>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                          cancelOrderItems(
                                            order.items.filter((i) => i.status === 'pending'),
                                            'oos'
                                          )
                                        }
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancel (Out of Stock)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                          cancelOrderItems(
                                            order.items.filter((i) => i.status === 'pending'),
                                            'qc_fail'
                                          )
                                        }
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancel (QC Fail)
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </motion.tbody>
                  </Table>

                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={goToPage}
                    onPerPageChange={setPerPage}
                    itemLabel="orders"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/*  Upload Tab                                               */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="upload">
          <CSVUploader
            title="Import Orders CSV"
            description="Import orders from marketplaces. Columns: Platform, OrderID, OrderDate (YYYY-MM-DD format), Barcode, Quantity"
            expectedColumns={[
              'Platform',
              'OrderID',
              'OrderDate',
              'Barcode',
              'Quantity',
            ]}
            onValidate={validateOrders}
            onConfirm={importOrders}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
