import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useRunById, useRunItems } from '@/hooks/use-runs';
import { useRunConfirmations } from '@/hooks/use-run-confirmations';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Truck,
  ArrowLeft,
  Printer,
  Download,
  Package,
  Store,
  CheckCircle2,
  Clock,
  Loader2,
  Image as ImageIcon,
  Edit,
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
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import EditPaymentDialog from '@/components/admin/EditPaymentDialog';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function RunDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('id');

  const queryClient = useQueryClient();
  const { data: run, isLoading: runLoading } = useRunById(runId);
  const { data: runItems = [], isLoading: itemsLoading } = useRunItems(runId);
  const { data: confirmations = [] } = useRunConfirmations(runId);

  const [editingPayment, setEditingPayment] = useState(null);

  const isLoading = runLoading || itemsLoading;

  // Group items by store
  const itemsByStore = useMemo(() => {
    const grouped = {};
    runItems.forEach((item) => {
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
  const progress = useMemo(() => {
    const totalTarget = runItems.reduce((sum, item) => sum + (item.target_qty || 0), 0);
    const totalPicked = runItems.reduce((sum, item) => sum + (item.picked_qty || 0), 0);
    return {
      totalTarget,
      totalPicked,
      percentage: totalTarget > 0 ? Math.round((totalPicked / totalTarget) * 100) : 0,
      completedStores: new Set(confirmations.map(c => c.store_id)).size,
      totalStores: itemsByStore.length,
    };
  }, [runItems, confirmations, itemsByStore]);

  // Print labels via ZPL
  async function printLabels() {
    if (runItems.length === 0) {
      toast.error('No items to print');
      return;
    }
    const { printToZebra, generateZPL } = await import('@/components/admin/LabelPrinter');
    const zpl = generateZPL(runItems);
    await printToZebra(zpl);
  }

  // Export ZPL file
  async function exportZPL() {
    if (runItems.length === 0) {
      toast.error('No items to export');
      return;
    }
    const { generateZPL, downloadZPLFile } = await import('@/components/admin/LabelPrinter');
    const zpl = generateZPL(runItems);
    downloadZPLFile(zpl, `run_${run?.run_number || runId}_labels.zpl`);
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // --- Not found state ---
  if (!run) {
    return (
      <EmptyState
        icon={Truck}
        title="Run not found"
        description="The run you're looking for doesn't exist or may have been removed."
        action={
          <Link to={createPageUrl('Runs')}>
            <Button className="mt-2">Back to Runs</Button>
          </Link>
        }
      />
    );
  }

  const pickupItems = runItems.filter((item) => item.type === 'pickup');
  const returnItems = runItems.filter((item) => item.type === 'return');

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Runs')}>
            <Button variant="ghost" size="icon" aria-label="Back to runs">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Run #{run.run_number}
              </h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground mt-1">{run.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={printLabels}>
            <Printer className="w-4 h-4 mr-2" />
            Print Labels
          </Button>
          <Button variant="outline" onClick={exportZPL}>
            <Download className="w-4 h-4 mr-2" />
            Export ZPL
          </Button>
        </div>
      </div>

      {/* ---- Progress Card ---- */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold text-foreground">{progress.totalTarget}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Picked</p>
              <p className="text-2xl font-bold text-primary">{progress.totalPicked}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stores Completed</p>
              <p className="text-2xl font-bold text-foreground">
                {progress.completedStores}/{progress.totalStores}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Runner</p>
              <p className="text-lg font-medium text-foreground">
                {run.runner_name || 'Unassigned'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium text-foreground">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-primary h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Tabs ---- */}
      <Tabs defaultValue="stores" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stores">By Store</TabsTrigger>
          <TabsTrigger value="pickup_items">Pickup Items ({pickupItems.length})</TabsTrigger>
          <TabsTrigger value="return_items">Return Items ({returnItems.length})</TabsTrigger>
          <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
        </TabsList>

        {/* ---- By Store ---- */}
        <TabsContent value="stores" className="space-y-4">
          {itemsByStore.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No store items"
              description="This run has no items assigned to any stores yet."
            />
          ) : (
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {itemsByStore.map((store) => {
                const storeConfirmed = confirmations.some(
                  (c) => c.store_id === store.storeId
                );
                const storeProgress =
                  store.totalTarget > 0
                    ? Math.round((store.totalPicked / store.totalTarget) * 100)
                    : 0;

                return (
                  <motion.div key={store.storeId} variants={cardVariants}>
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                              <Store className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{store.storeName}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {store.items.length} items &bull;{' '}
                                {store.totalPicked}/{store.totalTarget} picked
                              </p>
                            </div>
                          </div>
                          {storeConfirmed ? (
                            <StatusBadge status="completed" />
                          ) : (
                            <StatusBadge status="pending" />
                          )}
                        </div>

                        <div className="w-full bg-muted rounded-full h-1.5 mt-4 overflow-hidden">
                          <motion.div
                            className="bg-primary h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${storeProgress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {store.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl"
                            >
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.style_name}
                                  className="w-12 h-12 object-cover rounded-lg"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground truncate">
                                    {item.style_name}
                                  </p>
                                  {item.type === 'return' && (
                                    <Badge className="bg-purple-500/15 text-purple-400 border-transparent text-xs shrink-0">
                                      Return
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Size: {item.size || 'N/A'} &bull; {item.barcode}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-bold">
                                  <span
                                    className={
                                      item.picked_qty >= item.target_qty
                                        ? 'text-success'
                                        : 'text-foreground'
                                    }
                                  >
                                    {item.picked_qty}
                                  </span>
                                  <span className="text-muted-foreground">
                                    /{item.target_qty}
                                  </span>
                                </p>
                                {item.status === 'not_found' && (
                                  <StatusBadge status="not_found" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>

        {/* ---- Pickup Items ---- */}
        <TabsContent value="pickup_items">
          <Card>
            <CardContent className="p-0">
              {pickupItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No pickup items"
                  description="There are no pickup items in this run."
                />
              ) : (
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
                    {pickupItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.style_name}
                              className="w-10 h-10 object-cover rounded-lg"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.style_name}</TableCell>
                        <TableCell>{item.size || '\u2014'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.store_name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                        <TableCell className="text-right">{item.target_qty}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.picked_qty}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status || 'pending'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Return Items ---- */}
        <TabsContent value="return_items">
          <Card>
            <CardContent className="p-0">
              {returnItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No return items"
                  description="There are no return items in this run."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.style_name}
                              className="w-10 h-10 object-cover rounded-lg"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.style_name}</TableCell>
                        <TableCell>{item.size || '\u2014'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.store_name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                        <TableCell className="text-right">{item.target_qty}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.status || 'pending'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Confirmations ---- */}
        <TabsContent value="confirmations">
          <Card>
            <CardContent className="p-6">
              {confirmations.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No confirmations yet"
                  description="Store confirmations will appear here once runners complete their pickups."
                />
              ) : (
                <div className="space-y-4">
                  {confirmations.map((conf) => (
                    <div
                      key={conf.id}
                      className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl"
                    >
                      {conf.receipt_image_url && (
                        <img
                          src={conf.receipt_image_url}
                          alt="Receipt"
                          className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                          onClick={() => window.open(conf.receipt_image_url, '_blank')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{conf.store_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Confirmed: {new Date(conf.confirmed_at).toLocaleString()}
                        </p>
                        {conf.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{conf.notes}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-2 shrink-0">
                        <p className="text-lg font-bold text-primary">
                          AED {conf.total_amount?.toFixed(2) || '0.00'}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit payment"
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

      {/* ---- Edit Payment Dialog ---- */}
      <EditPaymentDialog
        confirmation={editingPayment}
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['runConfirmations'] });
        }}
      />
    </div>
  );
}
