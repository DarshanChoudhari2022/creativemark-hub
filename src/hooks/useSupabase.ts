import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

export function useSupabaseTable<T>(tableName: string, query: string = '*') {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: tableData, error: tableError } = await supabase
      .from(tableName)
      .select(query);

    if (tableError) {
      setError(tableError);
    } else {
      setData(tableData as T[]);
    }
    setLoading(false);
  }, [tableName, query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const insert = async (newItem: Partial<T>) => {
    const { data: insertedData, error: insertError } = await supabase
      .from(tableName)
      .insert([newItem])
      .select();
    
    if (!insertError && insertedData) {
      setData(prev => [...prev, ...insertedData as T[]]);
    }
    return { data: insertedData, error: insertError };
  };

  const update = async (id: string | number, updates: Partial<T>) => {
    const { data: updatedData, error: updateError } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select();

    if (!updateError && updatedData) {
      setData(prev => prev.map(item => (item as any).id === id ? updatedData[0] : item));
    }
    return { data: updatedData, error: updateError };
  };

  const remove = async (id: string | number) => {
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (!deleteError) {
      setData(prev => prev.filter(item => (item as any).id !== id));
    }
    return { error: deleteError };
  };

  return { data, loading, error, refresh: fetchData, insert, update, remove };
}
