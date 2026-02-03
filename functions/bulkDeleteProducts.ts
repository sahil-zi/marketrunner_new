import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { productIds } = await req.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return Response.json({ error: 'Invalid product IDs' }, { status: 400 });
    }

    // Delete products using service role for better performance
    const deletePromises = productIds.map(id => 
      base44.asServiceRole.entities.ProductCatalog.delete(id)
    );

    await Promise.all(deletePromises);

    return Response.json({ 
      success: true, 
      count: productIds.length 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});