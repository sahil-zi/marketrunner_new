import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Printer, 
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import LabelPrinter from '@/components/admin/LabelPrinter';

export default function PrintLabels() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [productsData, storesData] = await Promise.all([
        base44.entities.ProductCatalog.list(),
        base44.entities.Store.list(),
      ]);
      setProducts(productsData);
      setStores(storesData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Print Labels</h1>
        <p className="text-gray-500 mt-1">Generate labels for products</p>
      </div>

      <LabelPrinter products={products} stores={stores} />
    </div>
  );
}