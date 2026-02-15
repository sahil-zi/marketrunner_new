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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

      return matchesSearch && matchesPlatform && matchesStatus;
    });
  }, [ordersWithItems, searchQuery, filterPlatform, filterStatus]);

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

  /* ---- Export CSV ------------------------------------------------ */
  function exportOrders() {
    const headers = [
      'Platform',
      'OrderID',
      'OrderDate',
      'Barcode',
      'ProductName',
      'Quantity',
      'Status',
    ];
    const rows = ordersWithItems.flatMap((order) =>
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
    toast.success('Orders exported');
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
      />

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
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background border-border"
                  />
                </div>
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger className="w-full sm:w-48 bg-card border-border text-foreground">
                    <SelectValue placeholder="Filter by platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48 bg-card border-border text-foreground">
                    <SelectValue placeholder="Filter by status" />
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
                <Button
                  variant="outline"
                  onClick={exportOrders}
                  className="shrink-0"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Orders
                </Button>
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
                    searchQuery || filterStatus !== 'all' || filterPlatform !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Import orders from the CSV tab to get started.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
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
                            className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
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
