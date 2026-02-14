import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
import { toast } from 'sonner';
import CSVUploader from '@/components/admin/CSVUploader';
import LabelPrinter from '@/components/admin/LabelPrinter';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

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
      const newStoresCreated = await base44.entities.Store.bulkCreate(
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
        await base44.entities.ProductCatalog.bulkCreate(batch);
      }
    }

    // Update existing products in batches
    if (productsToUpdate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < productsToUpdate.length; i += batchSize) {
        const batch = productsToUpdate.slice(i, i + batchSize);
        await base44.functions.invoke('bulkUpdateProducts', {
          products: batch,
        });
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
      await base44.functions.invoke('bulkDeleteProducts', {
        productIds: selectedProducts,
      });
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
                        <TableRow key={product.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProductSelection(product.id)}
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
                                onClick={() => {
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
                                onClick={() => setDeleteConfirm(product)}
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
