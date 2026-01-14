import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
  XCircle
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
import { toast } from 'sonner';
import CSVUploader from '@/components/admin/CSVUploader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [ordersData, orderItemsData, productsData] = await Promise.all([
        base44.entities.Order.list('-created_date'),
        base44.entities.OrderItem.list('-created_date'),
        base44.entities.ProductCatalog.list(),
      ]);
      setOrders(ordersData);
      setOrderItems(orderItemsData);
      setProducts(productsData);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }

  // Get unique platforms
  const platforms = [...new Set(orders.map(o => o.platform_name).filter(Boolean))];

  // Build orders with items
  const ordersWithItems = orders.map(order => {
    const items = orderItems.filter(item => item.order_id === order.id);
    return {
      ...order,
      items,
      totalQty: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    };
  });

  // Filter orders
  const filteredOrders = ordersWithItems.filter(order => {
    const matchesSearch = 
      order.platform_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.platform_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || order.platform_name === filterPlatform;
    
    let matchesStatus = true;
    if (filterStatus !== 'all') {
      const allItemsStatus = order.items.every(item => item.status === filterStatus);
      matchesStatus = filterStatus === 'pending' 
        ? order.items.some(item => item.status === 'pending')
        : allItemsStatus;
    }
    
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  // Validate orders CSV
  async function validateOrders(rows, headers) {
    const errors = [];
    const warnings = [];
    const existingBarcodes = new Set(products.map(p => p.barcode));
    const existingOrderKeys = new Set(
      orders.map(o => `${o.platform_name}|${o.platform_order_id}`)
    );
    const newOrderKeys = new Set();
    let duplicatesFound = 0;
    let missingBarcodes = [];

    rows.forEach((row, idx) => {
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
        warnings.push({ row: row._rowNum, message: `Duplicate order: ${platform} ${orderId}` });
      } else {
        newOrderKeys.add(orderKey);
      }
    });

    if (missingBarcodes.length > 0) {
      const uniqueMissing = [...new Set(missingBarcodes.map(m => m.barcode))];
      errors.push({ 
        row: 0, 
        message: `${uniqueMissing.length} barcodes not found in catalog: ${uniqueMissing.slice(0, 5).join(', ')}${uniqueMissing.length > 5 ? '...' : ''}` 
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
        'Duplicates': duplicatesFound,
      },
    };
  }

  // Import orders from CSV
  async function importOrders(rows, mode) {
    const existingOrderKeys = new Map(
      orders.map(o => [`${o.platform_name}|${o.platform_order_id}`, o.id])
    );

    // Group rows by order
    const orderGroups = {};
    rows.forEach(row => {
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
        const newOrder = await base44.entities.Order.create({
          platform_name: orderData.platform,
          platform_order_id: orderData.orderId,
          order_timestamp: orderData.orderDate ? new Date(orderData.orderDate).toISOString() : new Date().toISOString(),
        });
        orderId = newOrder.id;
        ordersCreated++;
      }

      // Create order items
      const itemsToCreate = orderData.items.map(item => ({
        order_id: orderId,
        barcode: item.barcode,
        quantity: item.quantity,
        status: 'pending',
      }));

      await base44.entities.OrderItem.bulkCreate(itemsToCreate);
      itemsCreated += itemsToCreate.length;
    }

    toast.success(`Imported ${ordersCreated} orders with ${itemsCreated} items`);
    loadData();
  }

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700',
      assigned_to_run: 'bg-blue-100 text-blue-700',
      picked: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
  };

  const getProductName = (barcode) => {
    const product = products.find(p => p.barcode === barcode);
    return product ? `${product.style_name} - ${product.size || ''}` : barcode;
  };

  // Export orders to CSV
  function exportOrders() {
    const headers = ['Platform', 'OrderID', 'OrderDate', 'Barcode', 'ProductName', 'Quantity', 'Status'];
    const rows = ordersWithItems.flatMap(order => 
      order.items.map(item => [
        order.platform_name,
        order.platform_order_id,
        order.order_timestamp ? new Date(order.order_timestamp).toISOString().split('T')[0] : '',
        item.barcode,
        getProductName(item.barcode),
        item.quantity,
        item.status,
      ])
    );
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Orders exported');
  }

  // Cancel order item
  async function cancelOrderItem(orderItemId, reason) {
    try {
      await base44.entities.OrderItem.update(orderItemId, { 
        status: 'cancelled',
        notes: `Cancelled: ${reason}`
      });
      toast.success('Order item cancelled');
      loadData();
    } catch (error) {
      toast.error('Failed to cancel order item');
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1">Manage incoming orders from marketplaces</p>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Orders</TabsTrigger>
          <TabsTrigger value="upload">Import CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {platforms.map(platform => (
                      <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned_to_run">Assigned to Run</SelectItem>
                    <SelectItem value="picked">Picked</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                    </Select>
                    <Button
                    variant="outline"
                    onClick={exportOrders}
                    className="shrink-0"
                    >
                    Export Orders
                    </Button>
                    </div>
                    </CardContent>
                    </Card>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No orders found</p>
                </div>
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
                        <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Badge variant="secondary">{order.platform_name}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{order.platform_order_id}</TableCell>
                          <TableCell>
                            {order.order_timestamp 
                              ? new Date(order.order_timestamp).toLocaleDateString()
                              : '—'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  {getProductName(item.barcode)} × {item.quantity}
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <div className="text-sm text-gray-400">
                                  +{order.items.length - 3} more
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{order.totalQty}</TableCell>
                          <TableCell>
                            {order.items.every(i => i.status === 'picked') ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Complete
                              </Badge>
                            ) : order.items.some(i => i.status === 'pending') ? (
                              <Badge className="bg-amber-100 text-amber-700">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-700">
                                In Progress
                              </Badge>
                            )}
                            </TableCell>
                            <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {order.items.filter(i => i.status === 'pending').length > 0 && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        order.items
                                          .filter(i => i.status === 'pending')
                                          .forEach(item => cancelOrderItem(item.id, 'oos'));
                                      }}
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Cancel (Out of Stock)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        order.items
                                          .filter(i => i.status === 'pending')
                                          .forEach(item => cancelOrderItem(item.id, 'qc_fail'));
                                      }}
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Cancel (QC Fail)
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                            </TableRow>
                            ))}
                            </TableBody>
                            </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <CSVUploader
            title="Import Orders CSV"
            description="Import orders from marketplaces. Columns: Platform, OrderID, OrderDate (YYYY-MM-DD format), Barcode, Quantity"
            expectedColumns={['Platform', 'OrderID', 'OrderDate', 'Barcode', 'Quantity']}
            onValidate={validateOrders}
            onConfirm={importOrders}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}