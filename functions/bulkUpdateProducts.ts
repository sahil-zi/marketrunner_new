import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { products } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return Response.json({ error: 'Invalid products data' }, { status: 400 });
    }

    // Update products in batches to avoid rate limits
    const batchSize = 10;
    let updated = 0;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const updatePromises = batch.map(product => 
        base44.asServiceRole.entities.ProductCatalog.update(product.id, product)
      );
      await Promise.all(updatePromises);
      updated += batch.length;
    }

    return Response.json({ 
      success: true, 
      count: products.length 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});