import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { bulkInsert, bulkUpdate, bulkDelete } from '@/api/supabase/helpers';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/use-products';
import { useStores } from '@/hooks/use-stores';
import { usePagination } from '@/hooks/use-pagination';
import { useSortable } from '@/hooks/use-sortable';
import {
  Package,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Download,
  Printer,
  CheckSquare,
  Square,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import CSVUploader from '@/components/admin/CSVUploader';
import LabelPrinter from '@/components/admin/LabelPrinter';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

async function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const processGoogleDriveLink = (url) => {
  if (!url) return url;

  let fileId = null;

  // Extract ID from 'file/d/FILE_ID/view' format
  const fileDMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else {
    // Extract ID from 'uc?export=view&id=FILE_ID' or 'open?id=FILE_ID' format
    const ucIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (ucIdMatch && ucIdMatch[1]) {
      fileId = ucIdMatch[1];
    }
  }

  if (fileId) {
    // Use Google Drive thumbnail API for reliable image rendering
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
  }
  return url;
};

export default function Inventory() {
  const queryClient = useQueryClient();

  // React Query hooks
  const { data: products = [], isLoading } = useProducts();
  const { data: stores = [] } = useStores();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Get unique categories from products
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.style_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStore = filterStore === 'all' || product.store_id === filterStore;
      const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
      return matchesSearch && matchesStore && matchesCategory;
    });
  }, [products, searchQuery, filterStore, filterCategory]);

  // Sort
  const { sortBy, sortOrder, handleSort, sortedItems, getSortIndicator } = useSortable(
    filteredProducts,
    'created_date',
    'desc'
  );

  // Pagination
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems,
    setPerPage,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    totalItems,
  } = usePagination(sortedItems);

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [searchQuery, filterStore, filterCategory]);

  // Selection handlers
  const toggleProductSelection = (productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    const currentPageIds = paginatedItems.map((p) => p.id);
    const allCurrentSelected = currentPageIds.every((id) => selectedProducts.includes(id));

    if (allCurrentSelected) {
      setSelectedProducts((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedProducts((prev) => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const selectAllFiltered = () => {
    setSelectedProducts(sortedItems.map((p) => p.id));
  };

  const isAllCurrentPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((p) => selectedProducts.includes(p.id));

  // Validate products CSV
  async function validateProducts(rows, headers) {
    const errors = [];
    const warnings = [];
    const barcodes = new Set();
    const existingBarcodes = new Set(products.map((p) => p.barcode));
    const existingStoreNames = new Map(stores.map((s) => [s.name.toLowerCase(), s.id]));
    const newStores = new Set();
    let duplicatesInFile = 0;
    let duplicatesInDb = 0;
    let newProducts = 0;

    rows.forEach((row, idx) => {
      const barcode = row.Barcode?.trim();
      const storeName = row.StoreName?.trim();
      const isNewProduct = !existingBarcodes.has(barcode);

      if (!barcode) {
        errors.push({ row: row._rowNum, message: 'Missing barcode' });
        return;
      }

      if (barcodes.has(barcode)) {
        duplicatesInFile++;
        warnings.push({ row: row._rowNum, message: `Duplicate barcode in file: ${barcode}` });
      } else {
        barcodes.add(barcode);
        if (existingBarcodes.has(barcode)) {
          duplicatesInDb++;
        } else {
          newProducts++;
        }
      }

      // For new products, require Style
      if (isNewProduct && !row.Style?.trim()) {
        errors.push({ row: row._rowNum, message: 'Missing style name (required for new products)' });
      }

      if (storeName && !existingStoreNames.has(storeName.toLowerCase())) {
        newStores.add(storeName);
      }

      if (row.Cost && isNaN(parseFloat(row.Cost))) {
        errors.push({ row: row._rowNum, message: 'Invalid cost price' });
      }

      if (row.RRP && isNaN(parseFloat(row.RRP))) {
        errors.push({ row: row._rowNum, message: 'Invalid RRP' });
      }
    });

    if (newStores.size > 0) {
      warnings.push({
        message: `${newStores.size} new stores will be created: ${[...newStores].join(', ')}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasDuplicates: duplicatesInDb > 0,
      stats: {
        'Total Rows': rows.length,
        'New Products': newProducts,
        Updates: duplicatesInDb,
        'New Stores': newStores.size,
      },
      newStores: [...newStores],
    };
  }

  // Import products from CSV
  async function importProducts(rows, mode) {
    // First, create any new stores
    const existingStoreNames = new Map(stores.map((s) => [s.name.toLowerCase(), s.id]));
    const newStoreNames = [
      ...new Set(
        rows
          .map((r) => r.StoreName?.trim())
          .filter((name) => name && !existingStoreNames.has(name.toLowerCase()))
      ),
    ];

    if (newStoreNames.length > 0) {
      const newStoresCreated = await bulkInsert('stores',
        newStoreNames.map((name) => ({ name }))
      );
      newStoresCreated.forEach((store) => {
        existingStoreNames.set(store.name.toLowerCase(), store.id);
      });
    }

    // Prepare products for import
    const productsToCreate = [];
    const productsToUpdate = [];
    const existingBarcodes = new Map(products.map((p) => [p.barcode, p]));

    rows.forEach((row) => {
      const barcode = row.Barcode?.trim();
      if (!barcode) return;

      const existingProduct = existingBarcodes.get(barcode);
      const storeId = row.StoreName?.trim()
        ? existingStoreNames.get(row.StoreName.trim().toLowerCase())
        : undefined;

      // Build product data - only include fields that are present in CSV
      const productData = { barcode };

      if (row.Style !== undefined) productData.style_name = row.Style?.trim() || '';
      if (row.Size !== undefined) productData.size = row.Size?.trim() || '';
      if (row.Color !== undefined) productData.color = row.Color?.trim() || '';
      if (row.ImageURL !== undefined) productData.image_url = row.ImageURL?.trim() || '';
      if (row.Cost !== undefined) productData.cost_price = row.Cost ? parseFloat(row.Cost) : null;
      if (row.RRP !== undefined) productData.rrp = row.RRP ? parseFloat(row.RRP) : null;
      if (row.Family !== undefined) productData.family = row.Family?.trim() || '';
      if (row.Category !== undefined) productData.category = row.Category?.trim() || '';
      if (row.SubCat !== undefined) productData.sub_category = row.SubCat?.trim() || '';
      if (row.Occasion !== undefined) productData.occasion = row.Occasion?.trim() || '';
      if (storeId !== undefined) productData.store_id = storeId || null;

      if (existingProduct) {
        if (mode === 'overwrite') {
          productsToUpdate.push({ id: existingProduct.id, ...productData });
        }
      } else {
        productsToCreate.push(productData);
      }
    });

    // Create new products in batches
    if (productsToCreate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < productsToCreate.length; i += batchSize) {
        const batch = productsToCreate.slice(i, i + batchSize);
        await bulkInsert('product_catalog', batch);
      }
    }

    // Update existing products in batches
    if (productsToUpdate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < productsToUpdate.length; i += batchSize) {
        const batch = productsToUpdate.slice(i, i + batchSize);
        await bulkUpdate('product_catalog', batch);
      }
    }

    toast.success(
      `Imported ${productsToCreate.length} new products, updated ${productsToUpdate.length}`
    );
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['stores'] });
  }

  // Save product (create or update)
  async function saveProduct(productData) {
    // Validate store exists
    if (productData.store_id && !stores.find((s) => s.id === productData.store_id)) {
      toast.error('Selected store does not exist');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct?.id) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data: productData });
        toast.success('Product updated');
      } else {
        await createProduct.mutateAsync(productData);
        toast.success('Product created');
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  }

  // Save product from detail sheet (always an update)
  async function saveProductFromSheet(productData) {
    if (productData.store_id && !stores.find((s) => s.id === productData.store_id)) {
      toast.error('Selected store does not exist');
      return;
    }
    setIsSaving(true);
    try {
      await updateProduct.mutateAsync({ id: selectedProduct.id, data: productData });
      toast.success('Product updated');
      setIsEditing(false);
      setSelectedProduct((prev) => ({ ...prev, ...productData }));
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  }

  // Delete product
  async function handleDeleteProduct(id) {
    try {
      await deleteProductMutation.mutateAsync(id);
      toast.success('Product deleted');
      setDeleteConfirm(null);
    } catch (error) {
      toast.error('Failed to delete product');
    }
  }

  // Bulk delete products
  async function bulkDeleteProducts() {
    try {
      await bulkDelete('product_catalog', selectedProducts);
      toast.success(`Deleted ${selectedProducts.length} products`);
      setSelectedProducts([]);
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error) {
      toast.error('Failed to delete products');
    }
  }

  const getStoreName = (storeId) => {
    const store = stores.find((s) => s.id === storeId);
    return store?.name || '\u2014';
  };

  // Export products to CSV
  function exportProducts() {
    const headers = [
      'Barcode',
      'Style',
      'Size',
      'Color',
      'ImageURL',
      'Cost',
      'RRP',
      'Family',
      'Category',
      'SubCat',
      'Occasion',
      'StoreName',
      'Inventory',
    ];
    const rows = products.map((p) => [
      p.barcode,
      p.style_name,
      p.size || '',
      p.color || '',
      p.image_url || '',
      p.cost_price || '',
      p.rrp || '',
      p.family || '',
      p.category || '',
      p.sub_category || '',
      p.occasion || '',
      getStoreName(p.store_id),
      p.inventory || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Products exported');
  }

  async function generateStorePDF() {
    const { jsPDF } = await import('jspdf');

    // Layout constants (A4, mm)
    const margin = 15;
    const contentW = 180;
    const cols = 3;
    const colW = contentW / cols; // 60mm
    const imgSize = 45;
    const cardH = imgSize + 20; // 65mm
    const gutter = 6;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageH = doc.internal.pageSize.getHeight();

    // Deduplicate by style_name within each store group
    const storeMap = new Map();
    for (const product of products) {
      const storeId = product.store_id || '__none__';
      if (!storeMap.has(storeId)) storeMap.set(storeId, new Map());
      const styleMap = storeMap.get(storeId);
      if (!styleMap.has(product.style_name)) {
        styleMap.set(product.style_name, product);
      }
    }

    let isFirstStore = true;
    for (const [storeId, styleMap] of storeMap) {
      const storeName =
        storeId === '__none__'
          ? 'No Store'
          : stores.find((s) => s.id === storeId)?.name || storeId;
      const storeProducts = Array.from(styleMap.values());

      if (!isFirstStore) doc.addPage();
      isFirstStore = false;

      // Store header
      let y = margin;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(storeName, margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${storeProducts.length} SKU${storeProducts.length !== 1 ? 's' : ''}`, margin, y);
      y += 8;

      let col = 0;
      for (const product of storeProducts) {
        // Check if we need a new page
        if (y + cardH > pageH - margin) {
          doc.addPage();
          y = margin;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`${storeName} (continued)`, margin, y);
          y += 10;
          col = 0;
        }

        const x = margin + col * (colW + gutter);

        // Image
        const rawUrl = product.image_url ? processGoogleDriveLink(product.image_url) : null;
        const imgUrl = rawUrl
          ? rawUrl.replace('sz=w200', 'sz=w400')
          : null;

        let imgLoaded = false;
        if (imgUrl) {
          const dataUrl = await loadImageAsDataUrl(imgUrl);
          if (dataUrl) {
            try {
              doc.addImage(dataUrl, 'JPEG', x, y, imgSize, imgSize);
              imgLoaded = true;
            } catch {
              // fall through to placeholder
            }
          }
        }
        if (!imgLoaded) {
          // Gray placeholder
          doc.setFillColor(220, 220, 220);
          doc.rect(x, y, imgSize, imgSize, 'F');
        }

        // Barcode text (bold, 7pt)
        const textY = y + imgSize + 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        const barcodeText = product.barcode || '';
        doc.text(barcodeText, x, textY, { maxWidth: colW - 2 });

        // Style name (normal, 7pt)
        doc.setFont('helvetica', 'normal');
        const styleText = product.style_name || '';
        doc.text(styleText, x, textY + 5, { maxWidth: colW - 2 });

        col++;
        if (col >= cols) {
          col = 0;
          y += cardH + 4;
        }
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`inventory_by_store_${dateStr}.pdf`);
  }

  async function handleGeneratePdf() {
    setIsPdfGenerating(true);
    const toastId = toast.loading('Generating store PDF…');
    try {
      await generateStorePDF();
      toast.success('PDF downloaded', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsPdfGenerating(false);
    }
  }

  const selectedProductsData = products.filter((p) => selectedProducts.includes(p.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title="Inventory" subtitle="Manage your product catalog">
        {selectedProducts.length > 0 && (
          <>
            <LabelPrinter
              items={selectedProductsData}
              buttonText={`Print ${selectedProducts.length} Labels`}
              variant="outline"
            />
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ bulk: true, count: selectedProducts.length })}
              className="text-destructive border-destructive/30"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedProducts.length}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={handleGeneratePdf}
          disabled={isPdfGenerating}
          className="shrink-0"
        >
          {isPdfGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Store PDF
        </Button>
        <Button
          variant="outline"
          onClick={exportProducts}
          className="shrink-0"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button
          onClick={() => {
            setEditingProduct({});
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </PageHeader>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Products</TabsTrigger>
          <TabsTrigger value="upload">Upload CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by barcode or style..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : paginatedItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No products found"
                  description="Try adjusting your search or filters, or add a new product."
                />
              ) : (
                <div className="overflow-x-auto">
                  {selectedProducts.length > 0 &&
                    selectedProducts.length < sortedItems.length && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mx-4 mt-4 flex items-center justify-between">
                        <p className="text-sm text-foreground">
                          {selectedProducts.length} product
                          {selectedProducts.length !== 1 ? 's' : ''} selected on this page
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={selectAllFiltered}
                          className="text-primary"
                        >
                          Select all {sortedItems.length} products
                        </Button>
                      </div>
                    )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSelectAll}
                            aria-label={
                              isAllCurrentPageSelected
                                ? 'Deselect all on this page'
                                : 'Select all on this page'
                            }
                          >
                            {isAllCurrentPageSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-16">Image</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('barcode')}
                        >
                          Barcode {getSortIndicator('barcode')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('style_name')}
                        >
                          Style {getSortIndicator('style_name')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('size')}
                        >
                          Size {getSortIndicator('size')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('color')}
                        >
                          Color {getSortIndicator('color')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('store_id')}
                        >
                          Store {getSortIndicator('store_id')}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('inventory')}
                        >
                          Inventory {getSortIndicator('inventory')}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('cost_price')}
                        >
                          Cost {getSortIndicator('cost_price')}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('rrp')}
                        >
                          RRP {getSortIndicator('rrp')}
                        </TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((product) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer"
                          onClick={() => { setSelectedProduct(product); setIsEditing(false); }}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); toggleProductSelection(product.id); }}
                              aria-label={
                                selectedProducts.includes(product.id)
                                  ? `Deselect ${product.style_name}`
                                  : `Select ${product.style_name}`
                              }
                            >
                              {selectedProducts.includes(product.id) ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {product.image_url ? (
                              <img
                                src={processGoogleDriveLink(product.image_url)}
                                alt={product.style_name}
                                className="w-10 h-10 object-cover rounded-lg"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {product.barcode}
                          </TableCell>
                          <TableCell className="text-foreground font-medium">
                            {product.style_name}
                          </TableCell>
                          <TableCell>{product.size || '\u2014'}</TableCell>
                          <TableCell>{product.color || '\u2014'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{getStoreName(product.store_id)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={
                                product.inventory <= 10
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              }
                            >
                              {product.inventory || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {product.cost_price
                              ? `AED ${product.cost_price.toFixed(2)}`
                              : '\u2014'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {product.rrp ? `AED ${product.rrp.toFixed(2)}` : '\u2014'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProduct(product);
                                  setIsDialogOpen(true);
                                }}
                                aria-label={`Edit ${product.style_name}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(product); }}
                                className="text-destructive"
                                aria-label={`Delete ${product.style_name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Items per page:</span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prevPage}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <CSVUploader
            title="Upload Products CSV"
            description="Import products from a CSV file. Columns: Barcode, Style, Size, Color, ImageURL, Cost, RRP, Family, Category, SubCat, Occasion, StoreName"
            expectedColumns={[
              'Barcode',
              'Style',
              'Size',
              'Color',
              'ImageURL',
              'Cost',
              'RRP',
              'StoreName',
            ]}
            onValidate={validateProducts}
            onConfirm={importProducts}
          />
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog */}
      <ProductDialog
        product={editingProduct}
        stores={stores}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingProduct(null);
        }}
        onSave={saveProduct}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteConfirm?.bulk ? 'Delete Multiple Products' : 'Delete Product'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {deleteConfirm?.bulk ? (
              <>
                Are you sure you want to delete{' '}
                <strong className="text-foreground">
                  {deleteConfirm.count} selected products
                </strong>
                ? This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete{' '}
                <strong className="text-foreground">{deleteConfirm?.style_name}</strong> (
                {deleteConfirm?.barcode})?
              </>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirm?.bulk
                  ? bulkDeleteProducts()
                  : handleDeleteProduct(deleteConfirm.id)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={selectedProduct}
        stores={stores}
        isOpen={!!selectedProduct}
        onClose={() => { setSelectedProduct(null); setIsEditing(false); }}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onCancelEdit={() => setIsEditing(false)}
        onSave={saveProductFromSheet}
        isSaving={isSaving}
        getStoreName={getStoreName}
      />
    </div>
  );
}

function ProductDialog({ product, stores, isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        barcode: product.barcode || '',
        style_name: product.style_name || '',
        size: product.size || '',
        color: product.color || '',
        image_url: product.image_url || '',
        cost_price: product.cost_price || '',
        rrp: product.rrp || '',
        family: product.family || '',
        category: product.category || '',
        sub_category: product.sub_category || '',
        occasion: product.occasion || '',
        store_id: product.store_id || '',
        inventory: product.inventory !== undefined ? product.inventory : 100,
      });
    }
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      rrp: formData.rrp ? parseFloat(formData.rrp) : null,
      inventory: formData.inventory ? parseInt(formData.inventory) : 100,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barcode" className="text-foreground">
                Barcode *
              </Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="style_name" className="text-foreground">
                Style Name *
              </Label>
              <Input
                id="style_name"
                value={formData.style_name}
                onChange={(e) => setFormData({ ...formData, style_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="size" className="text-foreground">
                Size
              </Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="color" className="text-foreground">
                Color
              </Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="image_url" className="text-foreground">
                Image URL
              </Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cost_price" className="text-foreground">
                Cost Price
              </Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rrp" className="text-foreground">
                RRP
              </Label>
              <Input
                id="rrp"
                type="number"
                step="0.01"
                value={formData.rrp}
                onChange={(e) => setFormData({ ...formData, rrp: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="store" className="text-foreground">
                Store *
              </Label>
              <Select
                value={formData.store_id}
                onValueChange={(v) => setFormData({ ...formData, store_id: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category" className="text-foreground">
                Category
              </Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="inventory" className="text-foreground">
                Inventory
              </Label>
              <Input
                id="inventory"
                type="number"
                value={formData.inventory}
                onChange={(e) => setFormData({ ...formData, inventory: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {product?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '\u2014'}</p>
    </div>
  );
}

function ProductDetailSheet({
  product,
  stores,
  isOpen,
  onClose,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  isSaving,
  getStoreName,
}) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (product && isEditing) {
      setFormData({
        barcode: product.barcode || '',
        style_name: product.style_name || '',
        size: product.size || '',
        color: product.color || '',
        image_url: product.image_url || '',
        cost_price: product.cost_price || '',
        rrp: product.rrp || '',
        family: product.family || '',
        category: product.category || '',
        sub_category: product.sub_category || '',
        occasion: product.occasion || '',
        store_id: product.store_id || '',
        inventory: product.inventory !== undefined ? product.inventory : 0,
      });
    }
  }, [product, isEditing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      rrp: formData.rrp ? parseFloat(formData.rrp) : null,
      inventory: formData.inventory ? parseInt(formData.inventory) : 0,
    });
  };

  if (!product) return null;

  const largeImageUrl = product.image_url
    ? processGoogleDriveLink(product.image_url)?.replace('sz=w200', 'sz=w800')
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.style_name || 'Product Details'}</SheetTitle>
          <SheetDescription>{product.barcode}</SheetDescription>
        </SheetHeader>

        {!isEditing ? (
          <div className="space-y-6 py-6">
            {/* Product Image */}
            <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={largeImageUrl}
                  alt={product.style_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <ImageIcon className="w-16 h-16 text-muted-foreground" />
              )}
            </div>

            {/* Detail Fields */}
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Barcode" value={product.barcode} />
              <DetailField label="Style" value={product.style_name} />
              <DetailField label="Size" value={product.size} />
              <DetailField label="Color" value={product.color} />
              <DetailField label="Store" value={getStoreName(product.store_id)} />
              <DetailField label="Category" value={product.category} />
              <DetailField label="Family" value={product.family} />
              <DetailField label="Sub-Category" value={product.sub_category} />
              <DetailField label="Occasion" value={product.occasion} />
              <DetailField
                label="Cost"
                value={product.cost_price ? `AED ${product.cost_price.toFixed(2)}` : null}
              />
              <DetailField
                label="RRP"
                value={product.rrp ? `AED ${product.rrp.toFixed(2)}` : null}
              />
              <DetailField label="Inventory" value={product.inventory ?? 0} />
            </div>

            <SheetFooter>
              <Button onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sheet-barcode" className="text-foreground">Barcode *</Label>
                <Input
                  id="sheet-barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sheet-style_name" className="text-foreground">Style Name *</Label>
                <Input
                  id="sheet-style_name"
                  value={formData.style_name}
                  onChange={(e) => setFormData({ ...formData, style_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sheet-size" className="text-foreground">Size</Label>
                <Input
                  id="sheet-size"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-color" className="text-foreground">Color</Label>
                <Input
                  id="sheet-color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="sheet-image_url" className="text-foreground">Image URL</Label>
                <Input
                  id="sheet-image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-cost_price" className="text-foreground">Cost Price</Label>
                <Input
                  id="sheet-cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-rrp" className="text-foreground">RRP</Label>
                <Input
                  id="sheet-rrp"
                  type="number"
                  step="0.01"
                  value={formData.rrp}
                  onChange={(e) => setFormData({ ...formData, rrp: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-store" className="text-foreground">Store *</Label>
                <Select
                  value={formData.store_id}
                  onValueChange={(v) => setFormData({ ...formData, store_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sheet-category" className="text-foreground">Category</Label>
                <Input
                  id="sheet-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-family" className="text-foreground">Family</Label>
                <Input
                  id="sheet-family"
                  value={formData.family}
                  onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-sub_category" className="text-foreground">Sub-Category</Label>
                <Input
                  id="sheet-sub_category"
                  value={formData.sub_category}
                  onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-occasion" className="text-foreground">Occasion</Label>
                <Input
                  id="sheet-occasion"
                  value={formData.occasion}
                  onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sheet-inventory" className="text-foreground">Inventory</Label>
                <Input
                  id="sheet-inventory"
                  type="number"
                  value={formData.inventory}
                  onChange={(e) => setFormData({ ...formData, inventory: e.target.value })}
                />
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
