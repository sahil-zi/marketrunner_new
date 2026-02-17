import React, { useState, useMemo, useCallback } from 'react';
import { Printer, Search, Filter, Tag, QrCode, Barcode, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import LabelPrinter from '@/components/admin/LabelPrinter';
import CSVUploader from '@/components/admin/CSVUploader';
import { useProducts } from '@/hooks/use-products';
import { useStores } from '@/hooks/use-stores';

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 animate-pulse">
      <div className="h-5 w-5 rounded bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 rounded bg-muted" />
        <div className="h-3 w-1/4 rounded bg-muted" />
      </div>
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="h-4 w-12 rounded bg-muted" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 flex-1 rounded bg-muted animate-pulse" />
        <div className="h-10 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

// Group items by style_name, returning an array of { styleName, items }
function groupByStyle(items) {
  const map = {};
  items.forEach((item) => {
    const key = item.style_name || 'Untitled';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([styleName, groupItems]) => ({ styleName, items: groupItems }));
}

// Unique key for an item — products have `.id`, CSV items use index-based key
function itemKey(item) {
  return item.id ?? item._csvKey;
}

// Shared grouped list with accordion + checkboxes
function GroupedItemList({ groups, selectedIds, toggleOne, toggleStyle, storeMap, allSelected, toggleAll, totalCount, selectedCount, labelCounts, setLabelCount }) {
  return (
    <>
      {/* Select all bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <label className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all products"
          />
          {allSelected ? 'Deselect all' : 'Select all'}{' '}
          <span className="text-foreground font-medium">({totalCount})</span>
        </label>
        {selectedCount > 0 && (
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
        )}
      </div>

      <Accordion type="multiple" className="space-y-2">
        {groups.map((group) => {
          const groupKeys = group.items.map(itemKey);
          const allGroupSelected = groupKeys.every((k) => selectedIds.has(k));
          const someGroupSelected = groupKeys.some((k) => selectedIds.has(k));

          return (
            <AccordionItem
              key={group.styleName}
              value={group.styleName}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4">
                <Checkbox
                  checked={allGroupSelected}
                  indeterminate={someGroupSelected && !allGroupSelected}
                  onCheckedChange={() => toggleStyle(group)}
                  aria-label={`Select all ${group.styleName}`}
                  onClick={(e) => e.stopPropagation()}
                />
                <AccordionTrigger className="hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{group.styleName}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {group.items.length} variant{group.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="px-4 pb-3 pt-0">
                <div className="space-y-1 ml-8">
                  {group.items.map((item) => {
                    const key = itemKey(item);
                    const checked = selectedIds.has(key);
                    const store = storeMap?.[item.store_id];
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 rounded-md p-2 transition-colors cursor-pointer ${
                          checked ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleOne(key)}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(key)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground">
                            {item.barcode || item.sku || 'No barcode'}
                          </span>
                          {store && (
                            <span className="text-xs text-muted-foreground ml-2">
                              · {store.name}
                            </span>
                          )}
                        </div>
                        {item.size && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {item.size}
                          </span>
                        )}
                        {checked && labelCounts && setLabelCount ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input
                              type="number"
                              min={1}
                              max={999}
                              value={labelCounts[key] ?? 1}
                              onChange={(e) => setLabelCount(key, Math.max(1, parseInt(e.target.value) || 1))}
                              className="h-7 w-16 text-xs text-center px-1"
                            />
                          </div>
                        ) : (item.quantity || item.target_qty) ? (
                          <span className="text-xs text-muted-foreground">
                            ×{item.target_qty || item.quantity}
                          </span>
                        ) : null}
                        <Printer className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}

export default function PrintLabels() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: stores = [], isLoading: storesLoading } = useStores();

  const [activeTab, setActiveTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [labelMode, setLabelMode] = useState('QR');

  // Label copy counts (item key -> number of copies)
  const [labelCounts, setLabelCounts] = useState({});

  // CSV upload state
  const [csvItems, setCsvItems] = useState([]);
  const [csvSelectedIds, setCsvSelectedIds] = useState(new Set());

  const isLoading = productsLoading || storesLoading;

  const storeMap = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s])),
    [stores]
  );

  // --- Inventory tab logic ---
  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.style_name || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      );
    }
    if (storeFilter !== 'all') {
      list = list.filter((p) => String(p.store_id) === storeFilter);
    }
    return list;
  }, [products, search, storeFilter]);

  // Enrich products with store_name for ZPL generation
  const enrichedProducts = useMemo(
    () =>
      filteredProducts.map((p) => ({
        ...p,
        store_name: storeMap[p.store_id]?.name || '',
      })),
    [filteredProducts, storeMap]
  );

  const inventoryGroups = useMemo(() => groupByStyle(enrichedProducts), [enrichedProducts]);

  const allInventorySelected =
    enrichedProducts.length > 0 && enrichedProducts.every((p) => selectedIds.has(p.id));

  function toggleAllInventory() {
    if (allInventorySelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(enrichedProducts.map((p) => p.id)));
    }
  }

  function toggleOneInventory(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStyleInventory(group) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const keys = group.items.map((i) => i.id);
      const allSelected = keys.every((k) => next.has(k));
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  const selectedProducts = enrichedProducts.filter((p) => selectedIds.has(p.id));

  // --- CSV tab logic ---
  const csvGroups = useMemo(() => groupByStyle(csvItems), [csvItems]);

  const allCsvSelected =
    csvItems.length > 0 && csvItems.every((item) => csvSelectedIds.has(item._csvKey));

  function toggleAllCsv() {
    if (allCsvSelected) {
      setCsvSelectedIds(new Set());
    } else {
      setCsvSelectedIds(new Set(csvItems.map((item) => item._csvKey)));
    }
  }

  function toggleOneCsv(key) {
    setCsvSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleStyleCsv(group) {
    setCsvSelectedIds((prev) => {
      const next = new Set(prev);
      const keys = group.items.map((i) => i._csvKey);
      const allSelected = keys.every((k) => next.has(k));
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  const selectedCsvItems = csvItems.filter((item) => csvSelectedIds.has(item._csvKey));

  // CSV upload handlers
  const handleCsvValidate = useCallback((rows, headers) => {
    const errors = [];
    const warnings = [];

    if (!headers.includes('barcode')) {
      errors.push({ row: 0, message: 'Missing required column: barcode' });
      return { isValid: false, errors, warnings, stats: {} };
    }

    rows.forEach((row) => {
      if (!row.barcode || !row.barcode.trim()) {
        errors.push({ row: row._rowNum, message: 'Empty barcode' });
      }
    });

    const validRows = rows.filter((r) => r.barcode && r.barcode.trim());
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        'Total rows': rows.length,
        'Valid barcodes': validRows.length,
      },
    };
  }, []);

  const handleCsvConfirm = useCallback((rows) => {
    const items = rows
      .filter((r) => r.barcode && r.barcode.trim())
      .map((r, idx) => ({
        _csvKey: `csv-${idx}`,
        barcode: r.barcode.trim(),
        style_name: (r.style_name || '').trim(),
        size: (r.size || '').trim(),
        quantity: parseInt(r.quantity, 10) || 1,
      }));

    setCsvItems(items);
    setCsvSelectedIds(new Set(items.map((i) => i._csvKey)));
    toast.success(`${items.length} label${items.length !== 1 ? 's' : ''} loaded from CSV`);
  }, []);

  const handleSetLabelCount = useCallback((key, count) => {
    setLabelCounts((prev) => ({ ...prev, [key]: count }));
  }, []);

  // Active selection based on tab, with label counts applied
  const activeItems = useMemo(() => {
    const items = activeTab === 'inventory' ? selectedProducts : selectedCsvItems;
    return items.map((item) => {
      const key = itemKey(item);
      const count = labelCounts[key];
      if (count && count > 0) {
        return { ...item, quantity: count, target_qty: undefined };
      }
      return { ...item, quantity: 1, target_qty: undefined };
    });
  }, [activeTab, selectedProducts, selectedCsvItems, labelCounts]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Print Labels" subtitle="Generate and print barcode labels for products">
        {activeItems.length > 0 && (
          <LabelPrinter
            items={activeItems}
            mode={labelMode}
            buttonText={(() => {
              const totalLabels = activeItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
              return `Print ${totalLabels} Label${totalLabels !== 1 ? 's' : ''}`;
            })()}
          />
        )}
      </PageHeader>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={labelMode === 'QR' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLabelMode('QR')}
        >
          <QrCode className="w-4 h-4 mr-2" />
          QR Code
        </Button>
        <Button
          variant={labelMode === 'BARCODE' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLabelMode('BARCODE')}
        >
          <Barcode className="w-4 h-4 mr-2" />
          Barcode
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory">From Inventory</TabsTrigger>
          <TabsTrigger value="csv">
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </TabsTrigger>
        </TabsList>

        {/* ========== INVENTORY TAB ========== */}
        <TabsContent value="inventory" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, barcode, or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {stores.length > 0 && (
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-full sm:w-[200px] bg-card border-border text-foreground">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {enrichedProducts.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No products found"
              description={
                search || storeFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Add products to start generating labels.'
              }
            />
          ) : (
            <GroupedItemList
              groups={inventoryGroups}
              selectedIds={selectedIds}
              toggleOne={toggleOneInventory}
              toggleStyle={toggleStyleInventory}
              storeMap={storeMap}
              allSelected={allInventorySelected}
              toggleAll={toggleAllInventory}
              totalCount={enrichedProducts.length}
              selectedCount={selectedIds.size}
              labelCounts={labelCounts}
              setLabelCount={handleSetLabelCount}
            />
          )}
        </TabsContent>

        {/* ========== CSV TAB ========== */}
        <TabsContent value="csv" className="space-y-4 mt-4">
          {csvItems.length === 0 ? (
            <CSVUploader
              title="Upload Barcodes"
              description="Upload a CSV file with barcodes for ad-hoc label printing. No database persistence."
              expectedColumns={['barcode', 'style_name', 'size', 'quantity']}
              onValidate={handleCsvValidate}
              onConfirm={handleCsvConfirm}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {csvItems.length} item{csvItems.length !== 1 ? 's' : ''} loaded from CSV
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsvItems([]);
                    setCsvSelectedIds(new Set());
                  }}
                >
                  Clear & Re-upload
                </Button>
              </div>

              <GroupedItemList
                groups={csvGroups}
                selectedIds={csvSelectedIds}
                toggleOne={toggleOneCsv}
                toggleStyle={toggleStyleCsv}
                storeMap={{}}
                allSelected={allCsvSelected}
                toggleAll={toggleAllCsv}
                totalCount={csvItems.length}
                selectedCount={csvSelectedIds.size}
                labelCounts={labelCounts}
                setLabelCount={handleSetLabelCount}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
