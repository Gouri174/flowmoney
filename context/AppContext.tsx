import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { Transaction, Budget, AppNotification, ConnectedAccount } from '@/types/index';
import { buildTransaction, MOCK_PROVIDERS } from '@/services/bankAggregator';
import { pickAndParseCSV, type ParsedRow } from '@/services/csvImporter';
import { pickAndParseTakeout } from '@/services/takeoutImporter';
import { pickAndParsePdf, type PdfImportResult } from '@/services/pdfImporter';

interface AppContextValue {
  transactions: Transaction[];
  budgets: Budget[];
  notifications: AppNotification[];
  accounts: ConnectedAccount[];
  syncing: boolean;
  importing: boolean;
  unreadCount: number;
  loadAll: () => Promise<void>;
  syncTransactions: () => Promise<void>;
  markAllRead: () => Promise<void>;
  upsertBudget: (category: string, amount: number, month: number, year: number) => Promise<void>;
  updateTransactionCategory: (id: string, category: string) => Promise<void>;
  importCsvTransactions: (rows: ParsedRow[], source?: 'csv' | 'gpay' | 'pdf') => Promise<{ imported: number; skipped: number }>;
  pickCsvAndPreview: () => Promise<{ rows: ParsedRow[]; errors: string[]; fileName: string } | null>;
  pickTakeoutAndPreview: () => Promise<{ rows: ParsedRow[]; errors: string[]; fileName: string } | null>;
  pickPdfAndPreview: () => Promise<PdfImportResult | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [txRes, budgetRes, notifRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(300),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('connected_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
    ]);
    if (txRes.data) setTransactions(txRes.data as Transaction[]);
    if (budgetRes.data) setBudgets(budgetRes.data as Budget[]);
    if (notifRes.data) setNotifications(notifRes.data as AppNotification[]);
    if (accRes.data) setAccounts(accRes.data as ConnectedAccount[]);
  }, [user]);

  const syncTransactions = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      let currentAccounts = accounts;

      if (currentAccounts.length === 0) {
        const inserts = MOCK_PROVIDERS.map((p) => ({
          user_id: user.id,
          provider: p.providerId,
          account_name: p.accountName,
          account_type: p.accountType,
          masked_number: p.maskedNumber,
          balance: 0,
          currency: 'INR',
        }));
        const { data } = await supabase.from('connected_accounts').insert(inserts).select();
        currentAccounts = (data ?? []) as ConnectedAccount[];
        setAccounts(currentAccounts);
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      let newCount = 0;

      for (const provider of MOCK_PROVIDERS) {
        const account = currentAccounts.find((a) => a.provider === provider.providerId);
        const rawList = await provider.fetchTransactions(startDate, endDate);

        for (const raw of rawList) {
          const normalized = buildTransaction(raw, user.id, account?.id ?? null);
          const { error } = await supabase
            .from('transactions')
            .upsert(normalized, { onConflict: 'user_id,external_id', ignoreDuplicates: true });
          if (!error) newCount++;
        }

        if (account) {
          await supabase
            .from('connected_accounts')
            .update({ last_synced: new Date().toISOString() })
            .eq('id', account.id);
        }
      }

      // Budget alert notifications
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: freshTxns } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_debit', true)
        .gte('date', monthStart.toISOString());

      const { data: currentBudgets } = await supabase.from('budgets').select('*').eq('user_id', user.id);

      if (freshTxns && currentBudgets) {
        const catSpend: Record<string, number> = {};
        (freshTxns as Transaction[]).forEach((t) => {
          catSpend[t.category_name] = (catSpend[t.category_name] ?? 0) + t.amount;
        });
        for (const budget of currentBudgets as Budget[]) {
          const spent = catSpend[budget.category_name] ?? 0;
          const pct = spent / budget.amount;
          if (pct >= 0.8 && pct < 1) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: 'Budget Alert',
              body: `${budget.category_name} is at ${Math.round(pct * 100)}% of your budget.`,
              type: 'warning',
            });
          } else if (pct >= 1) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: 'Budget Exceeded',
              body: `You have exceeded your ${budget.category_name} budget!`,
              type: 'alert',
            });
          }
        }
      }

      if (newCount > 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Sync Complete',
          body: `${newCount} transactions imported from your connected accounts.`,
          type: 'success',
        });
      }

      await loadAll();
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, accounts, loadAll]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user]);

  const upsertBudget = useCallback(async (category: string, amount: number, month: number, year: number) => {
    if (!user) return;
    await supabase.from('budgets').upsert(
      { user_id: user.id, category_name: category, amount, month, year },
      { onConflict: 'user_id,category_name,month,year' }
    );
    await loadAll();
  }, [user, loadAll]);

  const pickCsvAndPreview = useCallback(async () => {
    return await pickAndParseCSV();
  }, []);

  const pickTakeoutAndPreview = useCallback(async () => {
    return await pickAndParseTakeout();
  }, []);

  const pickPdfAndPreview = useCallback(async () => {
    return await pickAndParsePdf();
  }, []);

  const importCsvTransactions = useCallback(async (rows: ParsedRow[], source: 'csv' | 'gpay' | 'pdf' = 'csv') => {
    if (!user || importing) return { imported: 0, skipped: 0 };
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    try {
      const CHUNK = 50;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r, idx) => {
          // Use UPI transaction ID for dedup when available (cross-source: GPay + ICICI both carry the same UPI ID)
          const upiId = (r as any).__upiId as string | undefined;
          const externalId = upiId
            ? `upi_${upiId}`
            : `${source}_${r.date}_${r.amount}_${i + idx}`;
          return {
            user_id: user.id,
            account_id: null,
            external_id: externalId,
            amount: r.amount,
            currency: 'INR',
            merchant: r.merchant,
            description: r.description,
            category_name: r.category,
            payment_method: source === 'pdf' ? 'UPI' : 'Bank',
            date: r.date,
            is_debit: r.isDebit,
            notes: null as string | null,
          };
        });
        const { error, data } = await supabase
          .from('transactions')
          .upsert(chunk, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
          .select('id');
        if (!error && data) imported += data.length;
        else skipped += chunk.length;
      }
      if (imported > 0) {
        const sourceLabel = source === 'pdf' ? 'PDF statement' : source === 'gpay' ? 'Google Pay' : 'bank statement';
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Import Complete',
          body: `${imported} transactions imported from your ${sourceLabel}.`,
          type: 'success',
        });
      }
      await loadAll();
    } finally {
      setImporting(false);
    }
    return { imported, skipped };
  }, [user, importing, loadAll]);

  const updateTransactionCategory = useCallback(async (id: string, category: string) => {
    if (!user) return;
    await supabase.from('transactions').update({ category_name: category }).eq('id', id).eq('user_id', user.id);
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category_name: category } : t)));
  }, [user]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  return (
    <AppContext.Provider value={{
      transactions, budgets, notifications, accounts, syncing, importing, unreadCount,
      loadAll, syncTransactions, markAllRead, upsertBudget, updateTransactionCategory,
      importCsvTransactions, pickCsvAndPreview, pickTakeoutAndPreview, pickPdfAndPreview,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
