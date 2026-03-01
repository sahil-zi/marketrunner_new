import React, { useState, useMemo } from 'react';
import { createOne, updateOne, filterBy, bulkInsert } from '@/api/supabase/helpers';
import { supabase } from '@/api/supabaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Truck,
  Plus,
  AlertCircle,
  Loader2,
  Package,
  Store,
  Play,
  Eye,
  Printer,
  X,
  CheckSquare,
  Square,
  Download,
  CheckCircle2,
  Search,
  Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import OrderSelector from '@/components/admin/OrderSelector';
import LabelPrinter, { generateZPL, downloadZPLFile } from '@/components/admin/LabelPrinter';

import { useRuns, useAllRunItems, useUpdateRun, useCancelRuns } from '@/hooks/use-runs';
import { usePendingOrderItems } from '@/hooks/use-orders';
import { usePendingReturns } from '@/hooks/use-returns';
import { useProducts } from '@/hooks/use-products';
import { useStores } from '@/hooks/use-stores';
import { useUsers } from '@/hooks/use-users';
import { usePagination } from '@/hooks/use-pagination';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' },
  }),
};

export default function Runs() {
  const queryClient = useQueryClient();

  // ---- React Query data hooks ----
  const { data: runs = [], isLoading } = useRuns('-created_date');
  const { data: allRunItems = [] } = useAllRunItems();
  const { data: pendingOrderItems = [] } = usePendingOrderItems();
  const { data: pendingReturnItems = [] } = usePendingReturns();
  const { data: products = [] } = useProducts();
  const { data: stores = [] } = useStores();
  const { data: users = [] } = useUsers();

  // ---- Mutations ----
  const updateRun = useUpdateRun();
  const cancelRunsMutation = useCancelRuns();

  // ---- Search / filter state ----
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Build a map of run_id → searchable text from run_items (store, barcode, style)
  const runItemsSearchMap = useMemo(() => {
    const map = {};
    allRunItems.forEach((item) => {
      if (!item.run_id) return;
      if (!map[item.run_id]) map[item.run_id] = '';
      map[item.run_id] +=
        ` ${(item.store_name || '').toLowerCase()}` +
        ` ${(item.barcode || '').toLowerCase()}` +
        ` ${(item.style_name || '').toLowerCase()}`;
    });
    return map;
  }, [allRunItems]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesStatus = filterStatus === 'all' || run.status === filterStatus;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(run.run_number).includes(q) ||
        (run.runner_name || '').toLowerCase().includes(q) ||
        (run.date || '').includes(q) ||
        (runItemsSearchMap[run.id] || '').includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [runs, searchQuery, filterStatus, runItemsSearchMap]);

  // ---- Pagination ----
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems: paginatedRuns,
    setPerPage,
    nextPage,
    prevPage,
    hasPrevPage,
    hasNextPage,
  } = usePagination(filteredRuns, 50);

  // ---- UI state only ----
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(null);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [selectedPickupItems, setSelectedPickupItems] = useState([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [selectedRuns, setSelectedRuns] = useState([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [runItemsCache, setRunItemsCache] = useState({});
  const [successDialog, setSuccessDialog] = useState(null); // { runNumber, items }
  const [editRunDialog, setEditRunDialog] = useState(null); // run object
  const [editRunDate, setEditRunDate] = useState('');

  // ---- Derived ----
  const hasPendingItems = pendingOrderItems.length > 0 || pendingReturnItems.length > 0;

  // Calculate pending items summary
  const pendingStats = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.barcode, p]));
    const storeItems = {};
    let totalQty = 0;
    const uniqueStyles = new Set();

    pendingOrderItems.forEach((item) => {
      const product = productMap.get(item.barcode);
      if (product) {
        const storeId = product.store_id || 'unknown';
        if (!storeItems[storeId]) storeItems[storeId] = 0;
        storeItems[storeId] += item.quantity || 1;
        totalQty += item.quantity || 1;
        uniqueStyles.add(product.style_name);
      }
    });

    pendingReturnItems.forEach((item) => {
      const storeId = item.store_id || 'unknown';
      if (!storeItems[storeId]) storeItems[storeId] = 0;
      totalQty += item.quantity || 1;
      uniqueStyles.add(item.style_name);
    });

    return {
      totalItems: totalQty,
      uniqueStyles: uniqueStyles.size,
      storeCount: Object.keys(storeItems).length,
      pickups: pendingOrderItems.length,
      returns: pendingReturnItems.length,
    };
  }, [pendingOrderItems, pendingReturnItems, products]);

  // ---- Load run items (cached) ----
  async function loadRunItems(runId) {
    if (runItemsCache[runId]) return runItemsCache[runId];

    const items = await filterBy('run_items', { run_id: runId });
    setRunItemsCache((prev) => ({ ...prev, [runId]: items }));
    return items;
  }

  const RUN_ITEM_LIMIT = 500;

  // ---- Generate new run(s) — auto-splits into chunks of 500 items ----
  async function generateRun() {
    const pickupItemsToUse = selectedPickupItems.length > 0 ? selectedPickupItems : pendingOrderItems;
    const returnItemsToUse = selectedReturnItems.length > 0 ? selectedReturnItems : pendingReturnItems;

    if (pickupItemsToUse.length === 0 && returnItemsToUse.length === 0) {
      toast.error('No items selected');
      return;
    }

    setIsGenerating(true);
    try {
      const productMap = new Map(products.map((p) => [p.barcode, p]));
      const storeMap = new Map(stores.map((s) => [s.id, s.name]));

      // Aggregate pickup items by barcode and store
      const aggregatedPickups = [];
      const pickupMap = {};
      pickupItemsToUse.forEach((item) => {
        const product = productMap.get(item.barcode);
        const storeId = product?.store_id || 'unknown';
        const key = `${storeId}-${item.barcode}`;
        if (!pickupMap[key]) {
          pickupMap[key] = {
            barcode: item.barcode,
            totalQty: 0,
            orderItemIds: [],
            store_id: storeId,
          };
          aggregatedPickups.push(pickupMap[key]);
        }
        pickupMap[key].totalQty += item.quantity || 1;
        pickupMap[key].orderItemIds.push(item.id);
      });

      // Aggregate return items by barcode and store
      const aggregatedReturns = [];
      const returnMap = {};
      returnItemsToUse.forEach((item) => {
        const key = `${item.store_id}-${item.barcode}`;
        if (!returnMap[key]) {
          returnMap[key] = {
            barcode: item.barcode,
            totalQty: 0,
            returnItemIds: [],
            store_id: item.store_id,
            store_name: item.store_name,
            style_name: item.style_name,
          };
          aggregatedReturns.push(returnMap[key]);
        }
        returnMap[key].totalQty += item.quantity || 1;
        returnMap[key].returnItemIds.push(item.id);
      });

      // Combine all aggregated items into one list with type tag
      const allAggregated = [
        ...aggregatedPickups.map((item) => ({ ...item, _type: 'pickup' })),
        ...aggregatedReturns.map((item) => ({ ...item, _type: 'return' })),
      ];

      // Split into chunks of RUN_ITEM_LIMIT
      const chunks = [];
      for (let i = 0; i < allAggregated.length; i += RUN_ITEM_LIMIT) {
        chunks.push(allAggregated.slice(i, i + RUN_ITEM_LIMIT));
      }

      let baseRunNumber = runs.reduce((max, r) => Math.max(max, r.run_number || 0), 0);
      const createdRuns = [];
      let allRunItems = [];

      for (const chunk of chunks) {
        baseRunNumber += 1;
        const runNumber = baseRunNumber;

        // Calculate stats for this chunk
        const uniqueStyles = new Set();
        const uniqueStores = new Set();
        let chunkPickups = 0;
        let chunkReturns = 0;
        let hasReturns = false;

        chunk.forEach((item) => {
          const product = productMap.get(item.barcode);
          if (product) uniqueStyles.add(product.style_name);
          if (item.style_name) uniqueStyles.add(item.style_name);
          const sid = item.store_id;
          if (sid && sid !== 'unknown') uniqueStores.add(sid);

          if (item._type === 'pickup') chunkPickups += item.totalQty;
          else { chunkReturns += item.totalQty; hasReturns = true; }
        });

        // Create run
        const run = await createOne('runs', {
          run_number: runNumber,
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
          total_styles: uniqueStyles.size,
          total_items: chunkPickups + chunkReturns,
          total_stores: uniqueStores.size,
          has_returns: hasReturns,
        });

        const runItemsToCreate = [];

        for (const item of chunk) {
          const product = productMap.get(item.barcode);

          if (item._type === 'pickup') {
            runItemsToCreate.push({
              run_id: run.id,
              barcode: item.barcode,
              style_name: product?.style_name || '',
              size: product?.size || '',
              color: product?.color || '',
              image_url: product?.image_url || '',
              cost_price: product?.cost_price || 0,
              store_id: item.store_id,
              store_name: item.store_id ? storeMap.get(item.store_id) || '' : '',
              target_qty: item.totalQty,
              picked_qty: 0,
              status: 'pending',
              type: 'pickup',
            });

            for (const orderItemId of item.orderItemIds) {
              await updateOne('order_items', orderItemId, {
                status: 'assigned_to_run',
                run_id: run.id,
              });
            }
          } else {
            runItemsToCreate.push({
              run_id: run.id,
              barcode: item.barcode,
              style_name: item.style_name || product?.style_name || '',
              size: product?.size || '',
              color: product?.color || '',
              image_url: product?.image_url || '',
              cost_price: product?.cost_price || 0,
              store_id: item.store_id,
              store_name: item.store_name || storeMap.get(item.store_id) || '',
              target_qty: item.totalQty,
              picked_qty: 0,
              status: 'pending',
              type: 'return',
              original_return_id: item.returnItemIds[0],
            });

            for (const returnItemId of item.returnItemIds) {
              await updateOne('returns', returnItemId, {
                status: 'assigned_to_run',
                run_id: run.id,
                run_number: runNumber,
              });
            }
          }
        }

        await bulkInsert('run_items', runItemsToCreate);
        createdRuns.push({ runNumber, pickups: chunkPickups, returns: chunkReturns });
        allRunItems = allRunItems.concat(runItemsToCreate);
      }

      if (createdRuns.length === 1) {
        const r = createdRuns[0];
        toast.success(`Run #${r.runNumber} created with ${r.pickups} pickups and ${r.returns} returns`);
      } else {
        toast.success(`${createdRuns.length} runs created (#${createdRuns[0].runNumber}–#${createdRuns[createdRuns.length - 1].runNumber}) with ${allAggregated.length} total items`);
      }

      setShowGenerateDialog(false);
      setSelectedPickupItems([]);
      setSelectedReturnItems([]);
      setSuccessDialog({
        runNumber: createdRuns.length === 1
          ? createdRuns[0].runNumber
          : `${createdRuns[0].runNumber}–${createdRuns[createdRuns.length - 1].runNumber}`,
        items: allRunItems,
        totalPickups: createdRuns.reduce((s, r) => s + r.pickups, 0),
        totalReturns: createdRuns.reduce((s, r) => s + r.returns, 0),
        runCount: createdRuns.length,
      });

      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['runItems'] });
    } catch (error) {
      toast.error('Failed to generate run');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }

  // ---- Assign runner ----
  async function assignRunner(runId) {
    if (!selectedRunner) {
      toast.error('Please select a runner');
      return;
    }

    try {
      const runner = users.find((u) => u.id === selectedRunner);
      await updateRun.mutateAsync({
        id: runId,
        data: {
          runner_id: selectedRunner,
          runner_name: runner?.full_name || runner?.email || '',
        },
      });
      toast.success('Runner assigned');
      setAssignDialog(null);
      setSelectedRunner('');
    } catch (error) {
      toast.error('Failed to assign runner');
    }
  }

  // ---- Activate run ----
  async function activateRun(runId) {
    try {
      await updateRun.mutateAsync({ id: runId, data: { status: 'active' } });
      toast.success('Run activated');
    } catch (error) {
      toast.error('Failed to activate run');
    }
  }

  // ---- Enrich run items with order number ----
  async function enrichWithOrderNumber(items, runId) {
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('barcode, order_id')
        .eq('run_id', runId);
      if (!orderItems || orderItems.length === 0) return items;

      const orderIds = [...new Set(orderItems.map((i) => i.order_id).filter(Boolean))];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, platform_order_id')
        .in('id', orderIds);
      if (!orders) return items;

      const orderMap = Object.fromEntries(orders.map((o) => [o.id, o.platform_order_id]));
      const barcodeToOrderNumber = {};
      orderItems.forEach((oi) => {
        if (oi.order_id && orderMap[oi.order_id]) {
          barcodeToOrderNumber[oi.barcode] = orderMap[oi.order_id];
        }
      });

      return items.map((item) => ({ ...item, order_number: barcodeToOrderNumber[item.barcode] || '' }));
    } catch {
      return items; // non-fatal — print without order number if lookup fails
    }
  }

  // ---- Print labels ----
  async function printRunLabels(runId) {
    const rawItems = await loadRunItems(runId);
    if (rawItems.length === 0) {
      toast.error('No items in this run');
      return;
    }
    const items = await enrichWithOrderNumber(rawItems, runId);
    const { printToZebra, generateZPL } = await import('@/components/admin/LabelPrinter');
    const zpl = generateZPL(items);
    await printToZebra(zpl);
  }

  // ---- Export ZPL ----
  async function exportRunZPL(runId) {
    const rawItems = await loadRunItems(runId);
    if (rawItems.length === 0) {
      toast.error('No items in this run');
      return;
    }
    const items = await enrichWithOrderNumber(rawItems, runId);
    const run = runs.find((r) => r.id === runId);
    const zpl = generateZPL(items);
    downloadZPLFile(zpl, `run_${run?.run_number || runId}_labels.zpl`);
  }

  // ---- Export PDF ----
  async function exportRunPDF(runId) {
    try {
      toast.loading('Generating PDF...');
      const { data } = await supabase.functions.invoke('export-run-pdf', { body: { runId } });
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const run = runs.find((r) => r.id === runId);
      a.download = `run-${run?.run_number || runId}-stores.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.dismiss();
      toast.success('PDF downloaded');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export PDF');
      console.error(error);
    }
  }

  // ---- Export CSV ----
  async function exportRunCSV(runId) {
    const items = await loadRunItems(runId);
    if (items.length === 0) {
      toast.error('No items in this run');
      return;
    }
    const run = runs.find((r) => r.id === runId);
    const headers = ['Barcode', 'Style', 'Size', 'Color', 'Store', 'Type', 'Target Qty', 'Picked Qty', 'Status'];
    const rows = items.map((item) => [
      item.barcode,
      item.style_name,
      item.size,
      item.color,
      item.store_name,
      item.type,
      item.target_qty,
      item.picked_qty,
      item.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run_${run?.run_number || runId}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  // ---- Edit run ----
  function openEditDialog(run) {
    setEditRunDialog(run);
    setEditRunDate(run.date || '');
  }

  async function saveRunEdit() {
    try {
      await updateRun.mutateAsync({ id: editRunDialog.id, data: { date: editRunDate } });
      toast.success('Run updated');
      setEditRunDialog(null);
    } catch {
      toast.error('Failed to update run');
    }
  }

  // ---- Cancel runs ----
  async function cancelRuns() {
    setIsCancelling(true);
    try {
      const result = await cancelRunsMutation.mutateAsync(selectedRuns);

      const completed = result.results.filter((r) => r.status === 'completed').length;
      const cancelled = result.results.filter((r) => r.status === 'cancelled').length;

      if (completed > 0 && cancelled > 0) {
        toast.success(`${completed} run(s) completed with picked items, ${cancelled} fully cancelled`);
      } else if (completed > 0) {
        toast.success(`${completed} run(s) completed with picked items`);
      } else {
        toast.success(`${cancelled} run(s) cancelled`);
      }

      setSelectedRuns([]);
    } catch (error) {
      const msg = error?.message || String(error);
      toast.error(`Failed to cancel runs: ${msg}`);
      console.error('cancelRuns error:', error);
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  }

  // ---- Mark run as complete ----
  async function markRunComplete(runId) {
    try {
      await updateRun.mutateAsync({ id: runId, data: { status: 'completed', completed_at: new Date().toISOString() } });
      toast.success('Run marked as complete');
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    }
  }

  // ---- Toggle run selection ----
  function toggleRunSelection(runId) {
    setSelectedRuns((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  }

  // ---- Render ----
  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title="Runs" subtitle="Consolidate orders & returns for pickup runs">
        {selectedRuns.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel {selectedRuns.length} Run{selectedRuns.length !== 1 ? 's' : ''}
          </Button>
        )}
        <Button onClick={() => setShowGenerateDialog(true)} disabled={!hasPendingItems}>
          <Plus className="w-4 h-4 mr-2" />
          Generate New Run
        </Button>
      </PageHeader>

      {/* Pending Summary */}
      {hasPendingItems && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Pending Items Ready for Consolidation
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pendingStats.totalItems} items &middot; {pendingStats.uniqueStyles} styles
                    &middot; {pendingStats.storeCount} stores
                    {pendingStats.returns > 0 && ` \u00B7 ${pendingStats.returns} returns`}
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowGenerateDialog(true)}>Generate Run</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Filter */}
      {runs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by run #, runner, store, barcode, or style…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="dropped_off">Dropped Off</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Runs Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No runs created yet"
          description="Generate a run to consolidate pending order items and returns for pickup."
          action={
            hasPendingItems ? (
              <Button onClick={() => setShowGenerateDialog(true)}>Generate First Run</Button>
            ) : null
          }
        />
      ) : filteredRuns.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No runs match your search"
          description="Try a different run number, runner name, or status filter."
        />
      ) : (
        <div className="grid gap-4">
          {paginatedRuns.map((run, index) => (
            <motion.div
              key={run.id}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <Card className="bg-card border-border hover:shadow-glow-sm transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleRunSelection(run.id)}
                        className="shrink-0"
                        aria-label={
                          selectedRuns.includes(run.id)
                            ? `Deselect run ${run.run_number}`
                            : `Select run ${run.run_number}`
                        }
                      >
                        {selectedRuns.includes(run.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </Button>
                      <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center">
                        <Truck className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">
                            Run #{run.run_number}
                          </h3>
                          <StatusBadge status={run.status} />
                          {run.has_returns && (
                            <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
                              Has Returns
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{run.date}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {run.total_items || 0} items
                          </span>
                          <span className="flex items-center gap-1">
                            <Store className="w-4 h-4" />
                            {run.total_stores || 0} stores
                          </span>
                          {run.runner_name && (
                            <span className="text-primary font-medium">
                              &rarr; {run.runner_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportRunCSV(run.id)}
                        aria-label={`Export run ${run.run_number} as CSV`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportRunPDF(run.id)}
                        aria-label={`Export run ${run.run_number} as PDF`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printRunLabels(run.id)}
                        aria-label={`Print labels for run ${run.run_number}`}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Labels
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportRunZPL(run.id)}
                        aria-label={`Export ZPL for run ${run.run_number}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export ZPL
                      </Button>
                      {run.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(run)}
                            aria-label={`Edit run ${run.run_number}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignDialog(run)}
                          >
                            {run.runner_id ? 'Reassign' : 'Assign Runner'}
                          </Button>
                          <Button size="sm" onClick={() => activateRun(run.id)}>
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </Button>
                        </>
                      )}
                      {run.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markRunComplete(run.id)}
                          disabled={updateRun.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark Complete
                        </Button>
                      )}
                      <Link to={createPageUrl(`RunDetails?id=${run.id}`)}>
                        <Button variant="outline" size="sm" aria-label={`View run ${run.run_number}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {runs.length > 0 && (
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Runs per page:</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => setPerPage(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={!hasPrevPage}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={!hasNextPage}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Generate Run Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate New Run</DialogTitle>
            <DialogDescription>
              Select items to include in this run. Leave unselected to use all pending items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {pendingOrderItems.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-foreground">
                  Pickup Items ({pendingOrderItems.length})
                </h3>
                <OrderSelector
                  orderItems={pendingOrderItems}
                  products={products}
                  stores={stores}
                  selectedItems={selectedPickupItems}
                  onSelectionChange={setSelectedPickupItems}
                />
              </>
            )}
            {pendingReturnItems.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-foreground mt-6">
                  Return Items ({pendingReturnItems.length})
                </h3>
                <OrderSelector
                  orderItems={pendingReturnItems}
                  products={products}
                  stores={stores}
                  selectedItems={selectedReturnItems}
                  onSelectionChange={setSelectedReturnItems}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateDialog(false);
                setSelectedPickupItems([]);
                setSelectedReturnItems([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={generateRun} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate Run (${
                  (selectedPickupItems.length || pendingOrderItems.length) +
                  (selectedReturnItems.length || pendingReturnItems.length)
                } items)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Runner Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Runner to Run #{assignDialog?.run_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRunner} onValueChange={setSelectedRunner}>
              <SelectTrigger>
                <SelectValue placeholder="Select a runner" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => assignRunner(assignDialog.id)}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Created Success Dialog */}
      <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {successDialog?.runCount > 1
                ? `Runs #${successDialog?.runNumber} Created`
                : `Run #${successDialog?.runNumber} Created`}
            </DialogTitle>
            <DialogDescription>
              {successDialog?.runCount > 1 && `${successDialog.runCount} runs created. `}
              {successDialog?.totalPickups || 0} pickups and {successDialog?.totalReturns || 0} returns.
              Print or export labels for the run items.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (successDialog?.items) {
                  const zpl = generateZPL(successDialog.items);
                  downloadZPLFile(zpl, `run_${successDialog.runNumber}_labels.zpl`);
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export ZPL
            </Button>
            <Button
              onClick={async () => {
                if (successDialog?.items) {
                  const { printToZebra } = await import('@/components/admin/LabelPrinter');
                  const zpl = generateZPL(successDialog.items);
                  await printToZebra(zpl);
                }
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Labels
            </Button>
            <Button variant="ghost" onClick={() => setSuccessDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Run Dialog */}
      <Dialog open={!!editRunDialog} onOpenChange={() => setEditRunDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Run #{editRunDialog?.run_number}</DialogTitle>
            <DialogDescription>Update details for this draft run.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="edit-run-date">
                Date
              </label>
              <Input
                id="edit-run-date"
                type="date"
                value={editRunDate}
                onChange={(e) => setEditRunDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRunDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveRunEdit} disabled={updateRun.isPending}>
              {updateRun.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Runs Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cancel {selectedRuns.length} Run{selectedRuns.length !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription>
              Runs with picked items will be marked as completed. Unpicked items will revert to
              pending status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={cancelRuns} disabled={isCancelling}>
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
