import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Truck, 
  ArrowLeft, 
  Printer, 
  Package, 
  Store,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import EditPaymentDialog from '@/components/admin/EditPaymentDialog';

export default function RunDetails() {
  const [run, setRun] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('id');

  useEffect(() => {
    if (runId) {
      loadData();
    }
  }, [runId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [runsData, itemsData, confirmationsData] = await Promise.all([
        base44.entities.Run.list(),
        base44.entities.RunItem.filter({ run_id: runId }),
        base44.entities.RunConfirmation.filter({ run_id: runId }),
      ]);
      
      const foundRun = runsData.find(r => r.id === runId);
      setRun(foundRun);
      setRunItems(itemsData);
      setConfirmations(confirmationsData);
    } catch (error) {
      toast.error('Failed to load run details');
    } finally {
      setIsLoading(false);
    }
  }

  // Group items by store
  const itemsByStore = React.useMemo(() => {
    const grouped = {};
    runItems.forEach(item => {
      const storeId = item.store_id || 'unknown';
      if (!grouped[storeId]) {
        grouped[storeId] = {
          storeId,
          storeName: item.store_name || 'Unknown Store',
          items: [],
          totalTarget: 0,
          totalPicked: 0,
        };
      }
      grouped[storeId].items.push(item);
      grouped[storeId].totalTarget += item.target_qty || 0;
      grouped[storeId].totalPicked += item.picked_qty || 0;
    });
    return Object.values(grouped);
  }, [runItems]);

  // Calculate progress
  const progress = React.useMemo(() => {
    const totalTarget = runItems.reduce((sum, item) => sum + (item.target_qty || 0), 0);
    const totalPicked = runItems.reduce((sum, item) => sum + (item.picked_qty || 0), 0);
    return {
      totalTarget,
      totalPicked,
      percentage: totalTarget > 0 ? Math.round((totalPicked / totalTarget) * 100) : 0,
      completedStores: confirmations.length,
      totalStores: itemsByStore.length,
    };
  }, [runItems, confirmations, itemsByStore]);

  // Print labels
  async function printLabels() {
    toast.info('Generating PDF labels...');
    
    // Sort items by store name, then style name
    const sortedItems = [...runItems].sort((a, b) => {
      if (a.store_name !== b.store_name) {
        return (a.store_name || '').localeCompare(b.store_name || '');
      }
      return (a.style_name || '').localeCompare(b.style_name || '');
    });

    // Create a simple text-based label preview (in real app, use jsPDF)
    const labelContent = sortedItems.map(item => `
=================================
BARCODE: ${item.barcode}
Style: ${item.style_name}
Size: ${item.size || 'N/A'}  |  Qty: ${item.target_qty}
Store: ${item.store_name}
Run: #${run.run_number}
=================================
    `).join('\n');

    // Create blob and download
    const blob = new Blob([labelContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Run_${run.run_number}_Labels.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Labels downloaded');
  }

  const statusConfig = {
    draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
    active: { color: 'bg-amber-100 text-amber-700', label: 'Active' },
    completed: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-24">
        <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Run not found</p>
        <Link to={createPageUrl('Runs')}>
          <Button className="mt-4">Back to Runs</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[run.status] || statusConfig.draft;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Runs')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Run #{run.run_number}</h1>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            <p className="text-gray-500 mt-1">{run.date}</p>
          </div>
        </div>
        <Button onClick={printLabels} className="bg-teal-600 hover:bg-teal-700">
          <Printer className="w-4 h-4 mr-2" />
          Print Labels
        </Button>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{progress.totalTarget}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Picked</p>
              <p className="text-2xl font-bold text-teal-600">{progress.totalPicked}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Stores Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {progress.completedStores}/{progress.totalStores}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Runner</p>
              <p className="text-lg font-medium text-gray-900">
                {run.runner_name || 'Unassigned'}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Overall Progress</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-teal-600 h-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stores" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stores">By Store</TabsTrigger>
          <TabsTrigger value="items">All Items</TabsTrigger>
          <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
        </TabsList>

        {/* By Store View */}
        <TabsContent value="stores" className="space-y-4">
          {itemsByStore.map(store => {
            const storeConfirmed = confirmations.some(c => c.store_id === store.storeId);
            const storeProgress = store.totalTarget > 0 
              ? Math.round((store.totalPicked / store.totalTarget) * 100) 
              : 0;

            return (
              <Card key={store.storeId}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Store className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{store.storeName}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {store.items.length} items • {store.totalPicked}/{store.totalTarget} picked
                        </p>
                      </div>
                    </div>
                    {storeConfirmed ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Confirmed
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-teal-600 h-full transition-all duration-300"
                      style={{ width: `${storeProgress}%` }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {store.items.map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl"
                      >
                        {item.image_url ? (
                          <img 
                            src={item.image_url}
                            alt={item.style_name}
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.style_name}</p>
                          <p className="text-sm text-gray-500">
                            Size: {item.size || 'N/A'} • {item.barcode}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            <span className={item.picked_qty >= item.target_qty ? 'text-green-600' : 'text-gray-900'}>
                              {item.picked_qty}
                            </span>
                            <span className="text-gray-400">/{item.target_qty}</span>
                          </p>
                          {item.status === 'not_found' && (
                            <Badge className="bg-red-100 text-red-700 text-xs">Not Found</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* All Items View */}
        <TabsContent value="items">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Picked</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <img 
                            src={item.image_url}
                            alt={item.style_name}
                            className="w-10 h-10 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.style_name}</TableCell>
                      <TableCell>{item.size || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.store_name}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                      <TableCell className="text-right">{item.target_qty}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.picked_qty}
                      </TableCell>
                      <TableCell>
                        {item.status === 'picked' ? (
                          <Badge className="bg-green-100 text-green-700">Picked</Badge>
                        ) : item.status === 'not_found' ? (
                          <Badge className="bg-red-100 text-red-700">Not Found</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confirmations View */}
        <TabsContent value="confirmations">
          <Card>
            <CardContent className="p-6">
              {confirmations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No store confirmations yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {confirmations.map(conf => (
                    <div 
                      key={conf.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                      {conf.receipt_image_url && (
                        <img 
                          src={conf.receipt_image_url}
                          alt="Receipt"
                          className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                          onClick={() => window.open(conf.receipt_image_url, '_blank')}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{conf.store_name}</p>
                        <p className="text-sm text-gray-500">
                          Confirmed: {new Date(conf.confirmed_at).toLocaleString()}
                        </p>
                        {conf.notes && (
                          <p className="text-sm text-gray-600 mt-1">{conf.notes}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="text-lg font-bold text-teal-600">
                            ${conf.total_amount?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingPayment(conf)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        confirmation={editingPayment}
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        onSuccess={loadData}
      />
    </div>
  );
}