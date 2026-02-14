import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Loader2, Search, Filter, Tag } from 'lucide-react';
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
import { toast } from 'sonner';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import LabelPrinter from '@/components/admin/LabelPrinter';
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
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 rounded bg-muted animate-pulse" />
        <div className="h-10 w-40 rounded bg-muted animate-pulse" />
      </div>

      {/* Rows skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function PrintLabels() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: stores = [], isLoading: storesLoading } = useStores();

  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isLoading = productsLoading || storesLoading;

  const storeMap = useMemo(
    () => Object.fromEntries(stores.map((s) => [s.id, s])),
    [stores]
  );

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

  const allSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedProducts = filteredProducts.filter((p) => selectedIds.has(p.id));

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
        {selectedProducts.length > 0 && (
          <LabelPrinter
            items={selectedProducts}
            buttonText={`Print ${selectedProducts.length} Label${selectedProducts.length !== 1 ? 's' : ''}`}
          />
        )}
      </PageHeader>

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

      {/* Product list */}
      {filteredProducts.length === 0 ? (
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
              <span className="text-foreground font-medium">
                ({filteredProducts.length})
              </span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <motion.div
            className="space-y-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence>
              {filteredProducts.map((product) => {
                const checked = selectedIds.has(product.id);
                const store = storeMap[product.store_id];
                return (
                  <motion.div
                    key={product.id}
                    variants={rowVariants}
                    layout
                    className={`flex items-center gap-4 rounded-lg border p-4 transition-colors cursor-pointer ${
                      checked
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => toggleOne(product.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(product.id)}
                      aria-label={`Select ${product.style_name || 'product'}`}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {product.style_name || 'Untitled product'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {product.barcode || product.sku || 'No barcode'}
                        {store ? ` \u00B7 ${store.name}` : ''}
                      </p>
                    </div>

                    {product.size && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {product.size}
                      </span>
                    )}

                    <Printer className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </div>
  );
}
