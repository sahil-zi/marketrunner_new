import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
  Square
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

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [productsData, storesData] = await Promise.all([
        base44.entities.ProductCatalog.list('-created_date'),
        base44.entities.Store.list(),
      ]);
      setProducts(productsData);
      setStores(storesData);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }

  // Get unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.style_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStore = filterStore === 'all' || product.store_id === filterStore;
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesStore && matchesCategory;
  });

  // Selection handlers
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  // Validate products CSV
  async function validateProducts(rows, headers) {
    const errors = [];
    const warnings = [];
    const barcodes = new Set();
    const existingBarcodes = new Set(products.map(p => p.barcode));
    const existingStoreNames = new Map(stores.map(s => [s.name.toLowerCase(), s.id]));
    const newStores = new Set();
    let duplicatesInFile = 0;
    let duplicatesInDb = 0;

    rows.forEach((row, idx) => {
      const barcode = row.Barcode?.trim();
      const storeName = row.StoreName?.trim();
      
      if (!barcode) {
        errors.push({ row: row._rowNum, message: 'Missing barcode' });
      } else if (barcodes.has(barcode)) {
        duplicatesInFile++;
        warnings.push({ row: row._rowNum, message: `Duplicate barcode in file: ${barcode}` });
      } else {
        barcodes.add(barcode);
        if (existingBarcodes.has(barcode)) {
          duplicatesInDb++;
        }
      }

      if (!row.Style?.trim()) {
        errors.push({ row: row._rowNum, message: 'Missing style name' });
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
        message: `${newStores.size} new stores will be created: ${[...newStores].join(', ')}` 
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasDuplicates: duplicatesInDb > 0,
      stats: {
        'Total Rows': rows.length,
        'New Products': rows.length - duplicatesInDb,
        'Updates': duplicatesInDb,
        'New Stores': newStores.size,
      },
      newStores: [...newStores],
    };
  }

  // Import products from CSV
  async function importProducts(rows, mode) {
    // First, create any new stores
    const existingStoreNames = new Map(stores.map(s => [s.name.toLowerCase(), s.id]));
    const newStoreNames = [...new Set(
      rows
        .map(r => r.StoreName?.trim())
        .filter(name => name && !existingStoreNames.has(name.toLowerCase()))
    )];

    if (newStoreNames.length > 0) {
      const newStores = await base44.entities.Store.bulkCreate(
        newStoreNames.map(name => ({ name }))
      );
      newStores.forEach(store => {
        existingStoreNames.set(store.name.toLowerCase(), store.id);
      });
    }

    // Prepare products for import
    const productsToCreate = [];
    const productsToUpdate = [];
    const existingBarcodes = new Map(products.map(p => [p.barcode, p.id]));

    rows.forEach(row => {
      const barcode = row.Barcode?.trim();
      if (!barcode) return;

      const storeId = existingStoreNames.get(row.StoreName?.trim()?.toLowerCase()) || null;
      
      const productData = {
        barcode,
        style_name: row.Style?.trim(),
        size: row.Size?.trim(),
        color: row.Color?.trim(),
        image_url: row.ImageURL?.trim(),
        cost_price: row.Cost ? parseFloat(row.Cost) : null,
        rrp: row.RRP ? parseFloat(row.RRP) : null,
        family: row.Family?.trim(),
        category: row.Category?.trim(),
        sub_category: row.SubCat?.trim(),
        occasion: row.Occasion?.trim(),
        store_id: storeId,
      };

      if (existingBarcodes.has(barcode)) {
        if (mode === 'overwrite') {
          productsToUpdate.push({ id: existingBarcodes.get(barcode), ...productData });
        }
      } else {
        productsToCreate.push(productData);
      }
    });

    // Create new products
    if (productsToCreate.length > 0) {
      await base44.entities.ProductCatalog.bulkCreate(productsToCreate);
    }

    // Update existing products
    for (const product of productsToUpdate) {
      await base44.entities.ProductCatalog.update(product.id, product);
    }

    toast.success(`Imported ${productsToCreate.length} new products, updated ${productsToUpdate.length}`);
    loadData();
  }

  // Save product (create or update)
  async function saveProduct(productData) {
    // Validate store exists
    if (productData.store_id && !stores.find(s => s.id === productData.store_id)) {
      toast.error('Selected store does not exist');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct?.id) {
        await base44.entities.ProductCatalog.update(editingProduct.id, productData);
        toast.success('Product updated');
      } else {
        await base44.entities.ProductCatalog.create(productData);
        toast.success('Product created');
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
      loadData();
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  }

  // Delete product
  async function deleteProduct(id) {
    try {
      await base44.entities.ProductCatalog.delete(id);
      toast.success('Product deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  }

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || '—';
  };

  // Export products to CSV
  function exportProducts() {
    const headers = ['Barcode', 'Style', 'Size', 'Color', 'ImageURL', 'Cost', 'RRP', 'Family', 'Category', 'SubCat', 'Occasion', 'StoreName', 'Inventory'];
    const rows = products.map(p => [
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
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Products exported');
  }

  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          {selectedProducts.length > 0 && (
            <LabelPrinter 
              items={selectedProductsData} 
              buttonText={`Print ${selectedProducts.length} Labels`}
              variant="outline"
            />
          )}
          <Button 
            onClick={() => { setEditingProduct({}); setIsDialogOpen(true); }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                   <SelectTrigger className="w-full sm:w-48">
                     <SelectValue placeholder="Filter by category" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Categories</SelectItem>
                     {categories.map(cat => (
                       <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <Button
                   variant="outline"
                   onClick={exportProducts}
                   className="shrink-0"
                 >
                   <Download className="w-4 h-4 mr-2" />
                   Export
                 </Button>
                </div>
                </CardContent>
                </Card>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No products found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSelectAll}
                          >
                            {selectedProducts.length === filteredProducts.length ? (
                              <CheckSquare className="w-4 h-4 text-teal-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-16">Image</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">Inventory</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">RRP</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map(product => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleProductSelection(product.id)}
                            >
                              {selectedProducts.includes(product.id) ? (
                                <CheckSquare className="w-4 h-4 text-teal-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.style_name}
                                className="w-10 h-10 object-cover rounded-lg"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.barcode}</TableCell>
                          <TableCell className="font-medium">{product.style_name}</TableCell>
                          <TableCell>{product.size || '—'}</TableCell>
                          <TableCell>{product.color || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{getStoreName(product.store_id)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={product.inventory <= 10 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}>
                              {product.inventory || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {product.cost_price ? `AED ${product.cost_price.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.rrp ? `AED ${product.rrp.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => { setEditingProduct(product); setIsDialogOpen(true); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setDeleteConfirm(product)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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
            title="Upload Products CSV"
            description="Import products from a CSV file. Columns: Barcode, Style, Size, Color, ImageURL, Cost, RRP, Family, Category, SubCat, Occasion, StoreName"
            expectedColumns={['Barcode', 'Style', 'Size', 'Color', 'ImageURL', 'Cost', 'RRP', 'StoreName']}
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
        onClose={() => { setIsDialogOpen(false); setEditingProduct(null); }}
        onSave={saveProduct}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.style_name}</strong> ({deleteConfirm?.barcode})?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteProduct(deleteConfirm.id)}
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
              <Label htmlFor="barcode">Barcode *</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="style_name">Style Name *</Label>
              <Input
                id="style_name"
                value={formData.style_name}
                onChange={(e) => setFormData({ ...formData, style_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cost_price">Cost Price</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rrp">RRP</Label>
              <Input
                id="rrp"
                type="number"
                step="0.01"
                value={formData.rrp}
                onChange={(e) => setFormData({ ...formData, rrp: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="store">Store *</Label>
              <Select 
                value={formData.store_id} 
                onValueChange={(v) => setFormData({ ...formData, store_id: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="inventory">Inventory</Label>
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
            <Button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {product?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}