import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createOne, updateOne, bulkInsert, deleteOne, bulkDelete } from '@/api/supabase/helpers';
import { supabase } from '@/api/supabaseClient';
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
  Pencil,
  Lock,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  if (activeItems.some((i) => i.status === 'shipped')) return 'partially_shipped';
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

  /* ---- Edit Order dialog state ---------------------------------- */
  const [editTarget, setEditTarget] = useState(null);
  const [editPlatform, setEditPlatform] = useState('');
  const [editOrderId, setEditOrderId] = useState('');
  const [editOrderDate, setEditOrderDate] = useState('');
  // Each item: { id?, barcode, quantity, status, run_id } — id is undefined for new rows
  const [editItems, setEditItems] = useState([]);
  const [editSaving, setEditSaving] = useState(false);

  function openEditDialog(order) {
    setEditPlatform(order.platform_name || '');
    setEditOrderId(order.platform_order_id || '');
    setEditOrderDate(
      order.order_timestamp ? order.order_timestamp.split('T')[0] : new Date().toISOString().split('T')[0]
    );
    setEditItems(
      order.items.map((i) => ({ id: i.id, barcode: i.barcode, quantity: i.quantity, status: i.status, run_id: i.run_id }))
    );
    setEditTarget(order);
  }

  function addEditItemRow() {
    setEditItems((prev) => [...prev, { barcode: '', quantity: 1 }]);
  }

  function removeEditItemRow(idx) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateEditItemRow(idx, field, value) {
    setEditItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  async function handleSaveOrder(e) {
    e.preventDefault();
    const platform = editPlatform.trim();
    const orderId = editOrderId.trim();
    if (!platform) { toast.error('Platform is required'); return; }
    if (!orderId) { toast.error('Order ID is required'); return; }

    // Only editable rows (no run_id) contribute to validation
    const editableItems = editItems.filter((r) => !r.run_id);
    const lockedItems = editItems.filter((r) => r.run_id);
    const newRows = editableItems.filter((r) => r.barcode.trim());
    if (newRows.length === 0 && lockedItems.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    // Validate barcodes on new/changed editable rows
    const knownBarcodes = new Set(products.map((p) => p.barcode));
    const unknownBarcodes = [
      ...new Set(newRows.map((r) => r.barcode.trim()).filter((b) => !knownBarcodes.has(b))),
    ];
    if (unknownBarcodes.length > 0) {
      toast.error(`Unknown barcode(s): ${unknownBarcodes.join(', ')}`);
      return;
    }

    setEditSaving(true);
    try {
      // Update order header
      await updateOne('orders', editTarget.id, {
        platform_name: platform,
        platform_order_id: orderId,
        order_timestamp: new Date(editOrderDate).toISOString(),
      });

      // Determine original editable items (had an id, no run_id in original)
      const originalEditableIds = new Set(
        editTarget.items.filter((i) => !i.run_id).map((i) => i.id)
      );
      const keptIds = new Set(editableItems.filter((r) => r.id).map((r) => r.id));

      // Items to delete: were in original editable set, but not kept
      const toDeleteIds = [...originalEditableIds].filter((id) => !keptIds.has(id));
      if (toDeleteIds.length > 0) await bulkDelete('order_items', toDeleteIds);

      // Items to update: existing items (have id) whose qty changed
      for (const row of editableItems.filter((r) => r.id)) {
        const original = editTarget.items.find((i) => i.id === row.id);
        if (original && original.quantity !== row.quantity) {
          await updateOne('order_items', row.id, { quantity: Math.max(1, parseInt(row.quantity) || 1) });
        }
      }

      // Items to insert: new rows (no id)
      const toInsert = editableItems
        .filter((r) => !r.id && r.barcode.trim())
        .map((r) => ({
          order_id: editTarget.id,
          barcode: r.barcode.trim(),
          quantity: Math.max(1, parseInt(r.quantity) || 1),
          status: 'pending',
        }));
      if (toInsert.length > 0) await bulkInsert('order_items', toInsert);

      toast.success(`Order ${orderId} updated`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      setEditTarget(null);
    } catch (err) {
      console.error('Failed to save order:', err);
      toast.error('Failed to save order');
    } finally {
      setEditSaving(false);
    }
  }

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

  /* ---- Delete state & handlers ---------------------------------- */
  const [deleteTarget, setDeleteTarget] = useState(null); // single order or 'bulk'
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteOrder(order) {
    setIsDeleting(true);
    try {
      const itemIds = order.items.map((i) => i.id);
      if (itemIds.length > 0) await bulkDelete('order_items', itemIds);
      await deleteOne('orders', order.id);
      setSelectedOrderIds((prev) => { const next = new Set(prev); next.delete(order.id); return next; });
      toast.success(`Order ${order.platform_order_id} deleted`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
    } catch (err) {
      console.error('Failed to delete order:', err);
      toast.error('Failed to delete order');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function deleteSelectedOrders() {
    const toDelete = ordersWithItems.filter((o) => selectedOrderIds.has(o.id));
    setIsDeleting(true);
    try {
      const allItemIds = toDelete.flatMap((o) => o.items.map((i) => i.id));
      if (allItemIds.length > 0) await bulkDelete('order_items', allItemIds);
      await bulkDelete('orders', toDelete.map((o) => o.id));
      setSelectedOrderIds(new Set());
      toast.success(`${toDelete.length} order${toDelete.length !== 1 ? 's' : ''} deleted`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
    } catch (err) {
      console.error('Failed to delete orders:', err);
      toast.error('Failed to delete orders');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
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

  /* ---- Cancel entire order (removes from runs too) -------------- */
  async function cancelEntireOrder(order) {
    try {
      // For items assigned to a run, cancel their run_items too
      for (const item of order.items) {
        if (item.run_id) {
          const { data: runItems } = await supabase
            .from('run_items')
            .select('id')
            .eq('run_id', item.run_id)
            .eq('barcode', item.barcode);
          for (const ri of runItems || []) {
            await supabase.from('run_items').update({ status: 'cancelled', picked_qty: 0 }).eq('id', ri.id);
          }
        }
      }

      // Cancel all non-cancelled order items and clear their run_id
      for (const item of order.items.filter((i) => i.status !== 'cancelled')) {
        await supabase
          .from('order_items')
          .update({ status: 'cancelled', run_id: null })
          .eq('id', item.id);
      }

      toast.success(`Order ${order.platform_order_id} cancelled`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['runItems'] });
    } catch (err) {
      console.error('Failed to cancel order:', err);
      toast.error('Failed to cancel order');
    }
  }

  /* ---- Mark as Shipped (updates inventory too) ------------------ */
  // itemsToShip: array of order_items to mark as shipped (non-cancelled subset)
  async function markAsShipped(order, itemsToShip) {
    const toShip = itemsToShip ?? order.items.filter((i) => i.status !== 'cancelled');
    try {
      for (const item of toShip) {
        await updateOrderItem.mutateAsync({ id: item.id, data: { status: 'shipped' } });
      }
      for (const item of toShip) {
        const product = products.find((p) => p.barcode === item.barcode);
        if (product) {
          await updateOne('product_catalog', product.id, {
            inventory: Math.max(0, (product.inventory || 0) - item.quantity),
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

  /* ---- Review & Ship dialog (multi-item orders) ----------------- */
  const [shipTarget, setShipTarget] = useState(null);       // order being reviewed
  const [cancelledInDialog, setCancelledInDialog] = useState(new Set()); // item ids marked for cancel
  const [cancelReason, setCancelReason] = useState('oos');
  const [isShipping, setIsShipping] = useState(false);

  function openShipDialog(order) {
    setCancelledInDialog(new Set());
    setCancelReason('oos');
    setShipTarget(order);
  }

  function toggleCancelInDialog(itemId) {
    setCancelledInDialog((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleConfirmShip() {
    if (!shipTarget) return;
    setIsShipping(true);
    try {
      // Cancel items the user marked
      const toCancel = shipTarget.items.filter(
        (i) => cancelledInDialog.has(i.id) && i.status !== 'cancelled'
      );
      if (toCancel.length > 0) await cancelOrderItems(toCancel, cancelReason);

      // Ship the rest that are picked and not cancelled
      const toShip = shipTarget.items.filter(
        (i) => !cancelledInDialog.has(i.id) && i.status !== 'cancelled' && i.status === 'picked'
      );
      if (toShip.length > 0) await markAsShipped(shipTarget, toShip);

      setShipTarget(null);
    } finally {
      setIsShipping(false);
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
                <Label>Platform</Label>
                <Select value={newOrderPlatform} onValueChange={setNewOrderPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Noon', 'Amazon', 'Namshi', 'Trendyol'].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="partially_shipped">Partially Shipped</SelectItem>
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
                  {selectedOrderIds.size > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setDeleteTarget('bulk')}
                      className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected ({selectedOrderIds.size})
                    </Button>
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
                                  <DropdownMenuItem onClick={() => openEditDialog(order)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit Order
                                  </DropdownMenuItem>
                                  {(() => {
                                    const nonCancelled = order.items.filter((i) => i.status !== 'cancelled');
                                    const allPicked = nonCancelled.length > 0 && nonCancelled.every((i) => i.status === 'picked');
                                    const isSingle = order.items.length === 1;
                                    const singleItem = order.items[0];
                                    const cancellable = order.items.filter((i) => i.status === 'pending' || i.status === 'picked');

                                    if (isSingle) {
                                      return (
                                        <>
                                          {singleItem?.status === 'picked' && (
                                            <DropdownMenuItem onClick={() => markAsShipped(order)}>
                                              <CheckCircle2 className="mr-2 h-4 w-4" />
                                              Mark as Shipped
                                            </DropdownMenuItem>
                                          )}
                                          {cancellable.length > 0 && (
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => cancelOrderItems(cancellable, 'oos')}
                                            >
                                              <XCircle className="mr-2 h-4 w-4" />
                                              Cancel (Out of Stock)
                                            </DropdownMenuItem>
                                          )}
                                        </>
                                      );
                                    }

                                    return (
                                      <>
                                        {(allPicked || cancellable.length > 0) && (
                                          <DropdownMenuItem onClick={() => openShipDialog(order)}>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Review &amp; Ship
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {order.items.some((i) => i.status !== 'cancelled') && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => cancelEntireOrder(order)}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancel Order
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(order)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Order
                                  </DropdownMenuItem>
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

      {/* ---- Review & Ship Dialog (multi-item) ------------------ */}
      <Dialog open={!!shipTarget} onOpenChange={(open) => { if (!open) setShipTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review &amp; Ship — {shipTarget?.platform_order_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Toggle off any items you don't want to ship. They will be cancelled.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {shipTarget?.items.map((item) => {
                const alreadyCancelled = item.status === 'cancelled';
                const markedForCancel = cancelledInDialog.has(item.id);
                const cancellable = item.status === 'pending' || item.status === 'picked';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      alreadyCancelled || markedForCancel
                        ? 'border-destructive/20 bg-destructive/5 opacity-60'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${markedForCancel ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {getProductName(item.barcode)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.barcode} · qty {item.quantity}
                      </p>
                    </div>
                    {alreadyCancelled ? (
                      <Badge variant="secondary" className="text-xs shrink-0">Already cancelled</Badge>
                    ) : markedForCancel ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => toggleCancelInDialog(item.id)}
                      >
                        Undo
                      </Button>
                    ) : cancellable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs text-destructive hover:text-destructive"
                        onClick={() => toggleCancelInDialog(item.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {cancelledInDialog.size > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">Cancellation reason</Label>
                <Select value={cancelReason} onValueChange={setCancelReason}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oos">Out of Stock</SelectItem>
                    <SelectItem value="qc_fail">QC Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(() => {
              const toShipCount = (shipTarget?.items ?? []).filter(
                (i) => !cancelledInDialog.has(i.id) && i.status !== 'cancelled' && i.status === 'picked'
              ).length;
              const toCancelCount = cancelledInDialog.size;
              return (
                <p className="text-sm text-muted-foreground">
                  {toShipCount > 0
                    ? `${toShipCount} item${toShipCount !== 1 ? 's' : ''} will be shipped`
                    : 'No items will be shipped'}
                  {toCancelCount > 0 && `, ${toCancelCount} will be cancelled`}
                </p>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipTarget(null)} disabled={isShipping}>
              Close
            </Button>
            <Button
              onClick={handleConfirmShip}
              disabled={isShipping || (shipTarget?.items ?? []).filter(
                (i) => !cancelledInDialog.has(i.id) && i.status !== 'cancelled' && i.status === 'picked'
              ).length === 0}
            >
              {isShipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm &amp; Ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit Order Dialog ---------------------------------- */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveOrder} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Platform</Label>
                <Select value={editPlatform} onValueChange={setEditPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Noon', 'Amazon', 'Namshi', 'Trendyol'].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-order-id">Order ID</Label>
                <Input
                  id="edit-order-id"
                  value={editOrderId}
                  onChange={(e) => setEditOrderId(e.target.value)}
                  placeholder="e.g. AMZ-12345"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-order-date">Order Date</Label>
              <Input
                id="edit-order-date"
                type="date"
                value={editOrderDate}
                onChange={(e) => setEditOrderDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              {editItems.map((row, idx) => {
                const isLocked = !!row.run_id;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Barcode"
                      value={row.barcode}
                      onChange={(e) => updateEditItemRow(idx, 'barcode', e.target.value)}
                      className="flex-1"
                      disabled={isLocked}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => updateEditItemRow(idx, 'quantity', e.target.value)}
                      className="w-20"
                      disabled={isLocked}
                    />
                    {isLocked ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground px-1" title="Assigned to a run — cannot edit">
                        <Lock className="h-3.5 w-3.5" />
                        <span>In Run</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEditItemRow(idx)}
                        disabled={editItems.filter((r) => !r.run_id).length === 1 && !row.id}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addEditItemRow} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Delete single order confirmation ------------------- */}
      <AlertDialog open={!!deleteTarget && deleteTarget !== 'bulk'} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete order <strong>{deleteTarget?.platform_order_id}</strong> and all its items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => deleteOrder(deleteTarget)}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Delete selected orders confirmation ---------------- */}
      <AlertDialog open={deleteTarget === 'bulk'} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOrderIds.size} Order{selectedOrderIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected orders and all their items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={deleteSelectedOrders}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
