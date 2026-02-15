import { supabase } from '../supabaseClient';

/**
 * List all rows from a table, with optional sort order.
 * sortOrder: '-created_date' means descending by created_date,
 *            'created_date' means ascending.
 */
export async function listAll(table, sortOrder = '-created_date') {
  const desc = sortOrder.startsWith('-');
  const column = sortOrder.replace(/^-/, '');

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(column, { ascending: !desc });

  if (error) throw error;
  return data;
}

/**
 * Filter rows by exact-match conditions.
 * Supports simple { key: value } filters.
 */
export async function filterBy(table, filters, sortOrder = '-created_date') {
  const desc = sortOrder.startsWith('-');
  const column = sortOrder.replace(/^-/, '');

  let query = supabase.from(table).select('*');

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    query = query.eq(key, value);
  }

  query = query.order(column, { ascending: !desc });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get a single row by ID.
 */
export async function getById(table, id) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a single row and return it.
 */
export async function createOne(table, record) {
  const { data, error } = await supabase
    .from(table)
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a single row by ID.
 */
export async function updateOne(table, id, updates) {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a single row by ID.
 */
export async function deleteOne(table, id) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Bulk insert rows and return them.
 */
export async function bulkInsert(table, records) {
  if (!records || records.length === 0) return [];

  const { data, error } = await supabase
    .from(table)
    .insert(records)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Bulk update rows (each record must have an `id` field).
 */
export async function bulkUpdate(table, records) {
  if (!records || records.length === 0) return [];

  const results = [];
  for (const record of records) {
    const { id, ...updates } = record;
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    results.push(data);
  }
  return results;
}

/**
 * Bulk delete rows by an array of IDs.
 */
export async function bulkDelete(table, ids) {
  if (!ids || ids.length === 0) return;

  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids);

  if (error) throw error;
}

/**
 * Upload a file to Supabase Storage.
 * Returns { file_url } for compatibility.
 */
export async function uploadFile(bucket, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return { file_url: urlData.publicUrl };
}
