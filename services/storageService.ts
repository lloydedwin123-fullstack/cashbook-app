import { Transaction, Book } from '../types';
import { supabase } from './supabaseClient';
import { deleteImageFromSupabase } from './supabaseStorageService'; // Import the new service

const STORAGE_KEY_TRANSACTIONS = 'petty_cash_transactions';
const STORAGE_KEY_BOOKS = 'petty_cash_books';
const STORAGE_KEY_CURRENT_BOOK = 'petty_cash_current_book_id';

// Helper to get user ID
const getCurrentUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
};

// --- SYNC LOGIC ---

// Sync Books: Fetch from Supabase, Merge with Local
export const syncBooksWithSupabase = async (): Promise<Book[]> => {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return loadBooks(); // Fallback to local if no user

        const { data: remoteBooks, error } = await supabase
            .from('books')
            .select('*');

        if (error) throw error;
        
        if (remoteBooks && remoteBooks.length > 0) {
            // Transform snake_case from DB if needed
            const mappedBooks: Book[] = remoteBooks.map((b: any) => ({
                id: b.id,
                name: b.name,
                createdAt: b.created_at || b.createdAt
            }));
            
            saveBooks(mappedBooks); // Update local cache
            return mappedBooks;
        } else {
             // Remote is empty (New User). 
             // If we have local books (like the default one), upload them to initialize the account.
             // This prevents Foreign Key errors when saving transactions to a book that doesn't exist on server.
             const localBooks = loadBooks();
             if (localBooks.length > 0) {
                 for (const book of localBooks) {
                     // Ensure the book has a userId before uploading
                     const bookPayload = {
                        id: book.id,
                        user_id: userId, // Attach userId here
                        name: book.name,
                        created_at: book.createdAt
                     };
                     const { error: uploadError } = await supabase.from('books').upsert(bookPayload);
                     if (uploadError) console.error("Failed to upload local book to Supabase:", uploadError);
                 }
                 return localBooks; // Return local books as they are now also on Supabase
             }
             return []; // No local or remote books
        }
    } catch (err) {
        console.error("Sync books failed", err);
        return loadBooks();
    }
};

// Sync Transactions: Fetch from Supabase for a specific book
export const syncTransactionsWithSupabase = async (bookId: string): Promise<Transaction[] | null> => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('book_id', bookId);

        if (error) throw error;

        if (data) {
             const remoteTransactions: Transaction[] = data.map((t: any) => ({
                 id: t.id,
                 bookId: t.book_id,
                 date: t.date,
                 description: t.description,
                 amount: parseFloat(t.amount),
                 type: t.type,
                 category: t.category,
                 attachments: t.attachments || []
             }));

             // Merge strategy: We will overwrite local cache for THIS book with remote data
             const currentLocal = loadTransactions();
             const otherBooksTx = currentLocal.filter(t => t.bookId !== bookId);
             const newAll = [...otherBooksTx, ...remoteTransactions];
             
             saveTransactions(newAll);
             return remoteTransactions;
        }
    } catch (err) {
        console.error("Sync transactions failed", err);
    }
    return null;
};

// --- CRUD WRAPPERS (Hybrid) ---

export const apiSaveTransaction = async (transaction: Transaction) => {
    // 1. Save Local (Optimistic)
    const current = loadTransactions();
    // Check if exists
    const exists = current.find(t => t.id === transaction.id);
    let newTxList;
    if (exists) {
        newTxList = current.map(t => t.id === transaction.id ? transaction : t);
    } else {
        newTxList = [transaction, ...current];
    }
    saveTransactions(newTxList);

    // 2. Save Remote (Background)
    const userId = await getCurrentUserId();
    if(userId) {
        const payload = {
            id: transaction.id,
            book_id: transaction.bookId,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            attachments: transaction.attachments // These should already be URLs if uploaded
        };
        
        const { error } = await supabase.from('transactions').upsert(payload);
        if (error) console.error("Supabase upsert failed", error);
    }
};

export const apiDeleteTransaction = async (id: string, attachments: string[]) => {
    // 1. Delete Local
    const current = loadTransactions();
    const newTxList = current.filter(t => t.id !== id);
    saveTransactions(newTxList);

    // 2. Delete Remote (and associated images)
    const userId = await getCurrentUserId();
    if(userId) {
        // Delete images from storage first
        for (const attachmentUrl of attachments) {
            // Check if it's a Supabase URL before attempting to delete
            if (attachmentUrl.includes('supabase.co/storage')) {
                await deleteImageFromSupabase(attachmentUrl);
            }
        }

        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) console.error("Supabase delete failed", error);
    }
};

export const apiSaveBook = async (book: Book) => {
    // 1. Save Local
    const current = loadBooks();
    const exists = current.find(b => b.id === book.id);
    let newBooks;
    if (exists) {
        newBooks = current.map(b => b.id === book.id ? book : b);
    } else {
        newBooks = [...current, book];
    }
    saveBooks(newBooks);

    // 2. Save Remote
    const userId = await getCurrentUserId();
    if(userId) {
        // Ensure profile exists first (simple check)
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single();
        if(!profile) {
             const { error: profileError } = await supabase.from('profiles').insert({ 
                 id: userId, 
                 email: (await supabase.auth.getUser()).data.user?.email 
             });
             if (profileError) console.error("Failed to create profile", profileError);
        }

        const { error } = await supabase.from('books').upsert({
            id: book.id,
            user_id: userId, // Ensure user_id is passed
            name: book.name,
            created_at: book.createdAt
        });
        if (error) console.error("Supabase book save failed", error);
    }
}

export const apiDeleteBook = async (bookId: string) => {
    // 1. Local
    const current = loadBooks();
    const newBooks = current.filter(b => b.id !== bookId);
    saveBooks(newBooks);
    
    // Clean up transactions locally
    const txs = loadTransactions();
    saveTransactions(txs.filter(t => t.bookId !== bookId));

    // 2. Remote
    const userId = await getCurrentUserId();
    if(userId) {
        const { error } = await supabase.from('books').delete().eq('id', bookId);
        if (error) console.error("Supabase book delete failed", error);
    }
}

// --- PURE LOCAL STORAGE (Legacy Wrappers) ---

export const saveTransactions = (transactions: Transaction[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  } catch (error) {
    console.error('Failed to save transactions', error);
  }
};

export const loadTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    const parsedData = data ? JSON.parse(data) : [];
    return parsedData.map((t: any) => {
      // Attachment migration logic
      if (t.attachment && (!t.attachments || t.attachments.length === 0)) {
        return { ...t, attachments: [t.attachment], attachment: undefined };
      }
      return { ...t, attachments: t.attachments || [] };
    });
  } catch (error) {
    return [];
  }
};

export const saveBooks = (books: Book[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
  } catch (error) {
    console.error('Failed to save books', error);
  }
};

export const loadBooks = (): Book[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_BOOKS);
    const books = data ? JSON.parse(data) : [];
    
    if (books.length === 0) {
      const defaultBook: Book = {
        id: 'default-book',
        name: 'Main Cashbook',
        createdAt: new Date().toISOString()
      };
      saveBooks([defaultBook]);
      return [defaultBook];
    }
    return books;
  } catch (error) {
    return [];
  }
};

export const saveSelectedBookId = (id: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_BOOK, id);
  } catch (error) {
    console.error('Failed to save selected book id', error);
  }
};

export const loadSelectedBookId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_CURRENT_BOOK);
  } catch (error) {
    return null;
  }
};