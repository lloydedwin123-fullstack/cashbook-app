export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Book {
  id: string;
  name: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  bookId: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  attachments: string[]; // Array of Base64 Data URIs
}

export interface SpendingSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export const CATEGORIES = [
  'Office Supplies',
  'Food & Beverages',
  'Transport',
  'Maintenance',
  'Entertainment',
  'Utilities',
  'Miscellaneous',
  'Sales',
  'Refund',
  'Top-up'
];