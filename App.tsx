import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, SpendingSummary, Book, TransactionType } from './types';
import { 
  loadTransactions, 
  loadBooks, 
  saveSelectedBookId, 
  loadSelectedBookId,
  syncBooksWithSupabase,
  syncTransactionsWithSupabase,
  apiSaveTransaction,
  apiDeleteTransaction,
  apiSaveBook,
  apiDeleteBook,
  saveTransactions, // Added for logout cleanup
  saveBooks // Added for logout cleanup
} from './services/storageService';
import { supabase } from './services/supabaseClient';
import { uploadImageToSupabase } from './services/supabaseStorageService'; // Import the new service
import { Auth } from './components/Auth';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import DashboardStats from './components/DashboardStats';
import SpendingChart from './components/SpendingChart';
import { generateSpendingReport } from './services/geminiService';
import { generateBookPDF } from './services/pdfService';
import { Plus, Bot, X, FileText, ChevronDown, Book as BookIcon, Trash2, ChevronLeft, ChevronRight, Pencil, Download, Database, LogOut, Smartphone } from 'lucide-react';

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} aria-hidden="true"></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">{title}</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const userId = useMemo(() => session?.user?.id || null, [session]); // Extracted userId

  // Global State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string>('');

  // UI State
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [bookFormName, setBookFormName] = useState('');
  const [editingBook, setEditingBook] = useState<Book | undefined>(undefined);
  
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const bookMenuRef = useRef<HTMLDivElement>(null);

  // AUTH CHECK
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // PWA INSTALL LISTENER
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // INITIAL LOAD & SYNC
  useEffect(() => {
    // 1. Immediate Local Load (always try this first for speed)
    const localBooks = loadBooks();
    setBooks(localBooks);
    setAllTransactions(loadTransactions());
    
    const savedBookId = loadSelectedBookId();
    const validBookId = savedBookId && localBooks.find(b => b.id === savedBookId) 
      ? savedBookId 
      : localBooks[0]?.id;
    setCurrentBookId(validBookId || '');

    if (!session) return; // Only sync with Supabase if authenticated

    // 2. Background Sync with Supabase
    const syncData = async () => {
        const syncedBooks = await syncBooksWithSupabase();
        setBooks(syncedBooks);
        
        // After syncing books, validate ID again
        if(syncedBooks.length > 0) {
            const currentStillExists = syncedBooks.find(b => b.id === validBookId);
            if(!currentStillExists) {
                setCurrentBookId(syncedBooks[0].id);
            }
        } else {
          // If remote books are empty, but we had local, currentBookId might be invalid.
          // Reset to an empty string to allow default book creation or selection.
          setCurrentBookId('');
        }
    };
    syncData();
  }, [session]);

  // SYNC TRANSACTIONS WHEN BOOK CHANGES
  useEffect(() => {
    if (!currentBookId || !session) return; // Only sync with Supabase if authenticated
    saveSelectedBookId(currentBookId);

    const syncTxs = async () => {
        const freshTxs = await syncTransactionsWithSupabase(currentBookId);
        if (freshTxs) {
            setAllTransactions(prev => {
                 const otherBooks = prev.filter(t => t.bookId !== currentBookId);
                 return [...otherBooks, ...freshTxs];
            });
        }
    };
    syncTxs();
  }, [currentBookId, session]);

  // Click outside listener for book menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bookMenuRef.current && !bookMenuRef.current.contains(event.target as Node)) {
        setIsBookMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewingImages) return;
      if (e.key === 'ArrowLeft') navigateGallery('prev');
      if (e.key === 'ArrowRight') navigateGallery('next');
      if (e.key === 'Escape') closeGallery();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImages, activeImageIndex]);

  const currentTransactions = useMemo(() => {
    return allTransactions.filter(t => t.bookId === currentBookId);
  }, [allTransactions, currentBookId]);

  const currentBookName = useMemo(() => {
    return books.find(b => b.id === currentBookId)?.name || 'Loading...';
  }, [books, currentBookId]);

  const summary: SpendingSummary = useMemo(() => {
    const income = currentTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + t.amount, 0);
    const expense = currentTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => acc + t.amount, 0);
    
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
    };
  }, [currentTransactions]);

  // --- Handlers ---

  const handleOpenAddTransaction = () => {
    setEditingTransaction(undefined);
    setIsTransactionFormOpen(true);
  };

  const handleOpenEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsTransactionFormOpen(true);
  };

  const handleUploadAttachment = async (file: Blob): Promise<string | null> => {
    if (!userId) {
      console.error("Attempted to upload to Supabase Storage without a user ID.");
      alert("Please log in to upload images to the cloud.");
      return null;
    }
    try {
      const url = await uploadImageToSupabase(file, userId);
      return url;
    } catch (error) {
      console.error("Failed to upload image to Supabase:", error);
      alert("Failed to upload image to the cloud.");
      return null;
    }
  };

  const handleSaveTransaction = async (data: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = editingTransaction 
        ? { ...data, id: editingTransaction.id, bookId: editingTransaction.bookId }
        : { ...data, id: generateId(), bookId: currentBookId };

    // Update UI immediately (optimistic update)
    if (editingTransaction) {
      setAllTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));
    } else {
      setAllTransactions(prev => [newTx, ...prev]);
    }

    // Call API/Storage to persist
    await apiSaveTransaction(newTx);
  };

  const handleDeleteTransaction = async (id: string, attachments: string[]) => {
    if(window.confirm("Delete this transaction?")) {
        setAllTransactions(prev => prev.filter(t => t.id !== id));
        await apiDeleteTransaction(id, attachments); // Pass attachments for Supabase Storage cleanup
    }
  };

  const handleOpenCreateBook = () => {
    setEditingBook(undefined);
    setBookFormName('');
    setIsBookModalOpen(true);
    setIsBookMenuOpen(false);
  };

  const handleOpenEditBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    setEditingBook(book);
    setBookFormName(book.name);
    setIsBookModalOpen(true);
    setIsBookMenuOpen(false);
  }

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookFormName.trim()) return;

    let bookToSave: Book;

    if (editingBook) {
        bookToSave = { ...editingBook, name: bookFormName };
        setBooks(prev => prev.map(b => b.id === bookToSave.id ? bookToSave : b));
    } else {
        bookToSave = {
            id: generateId(),
            name: bookFormName,
            createdAt: new Date().toISOString()
        };
        setBooks(prev => [...prev, bookToSave]);
        setCurrentBookId(bookToSave.id);
    }

    setBookFormName('');
    setIsBookModalOpen(false);
    await apiSaveBook(bookToSave);
  };

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (books.length <= 1) {
      alert("You cannot delete the last book.");
      return;
    }
    
    if (window.confirm("Are you sure? This will delete all transactions in this book.")) {
      if (currentBookId === bookId) {
        const otherBook = books.find(b => b.id !== bookId);
        if (otherBook) setCurrentBookId(otherBook.id);
      }
      
      setBooks(prev => prev.filter(b => b.id !== bookId));
      setAllTransactions(prev => prev.filter(t => t.bookId !== bookId));
      await apiDeleteBook(bookId);
    }
  };

  const handleGenerateReport = async () => {
    setIsReportOpen(true);
    setIsGeneratingReport(true);
    setReportContent('');
    const report = await generateSpendingReport(currentTransactions);
    setReportContent(report);
    setIsGeneratingReport(false);
  };

  const handleExportPDF = () => {
    generateBookPDF(currentBookName, currentTransactions, summary);
  };

  const handleGenerateDemoData = async () => {
    if (!currentBookId) {
        alert("Please select a book first.");
        return;
    }

    try {
      const demoTransactions: Transaction[] = [];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);

      for (let i = 0; i < 20; i++) { // Reduced to 20 for Supabase limits/perf
        const randomDays = Math.floor(Math.random() * 90);
        const date = new Date(startDate);
        date.setDate(date.getDate() + randomDays);
        date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        const isExpense = Math.random() > 0.3;
        const type: TransactionType = isExpense ? 'EXPENSE' : 'INCOME';
        
        let category = 'Miscellaneous';
        let description = 'Demo Transaction';
        let amount = 0;

        if (type === 'EXPENSE') {
          const expenseCats = ['Office Supplies', 'Food & Beverages', 'Transport', 'Utilities', 'Maintenance'];
          category = expenseCats[Math.floor(Math.random() * expenseCats.length)];
          amount = Math.floor(Math.random() * 200) + 10;
          description = `Demo ${category}`;
        } else {
          const incomeCats = ['Sales', 'Top-up', 'Refund'];
          category = incomeCats[Math.floor(Math.random() * incomeCats.length)];
          amount = Math.floor(Math.random() * 1000) + 500;
          description = `${category} received`;
        }

        demoTransactions.push({
          id: generateId(),
          bookId: currentBookId,
          date: date.toISOString(),
          description: `${description} #${i+1}`,
          amount: parseFloat(amount.toFixed(2)),
          type,
          category,
          attachments: []
        });
      }
      
      setAllTransactions(prev => [...prev, ...demoTransactions]);
      
      // Bulk insert for demo data
      for (const t of demoTransactions) {
          await apiSaveTransaction(t);
      }
      
      setTimeout(() => alert("Added 20 demo transactions"), 50);

    } catch (error) {
      console.error("Error generating demo data:", error);
    }
  };

  const openGallery = (images: string[]) => {
    if (images.length > 0) {
      setViewingImages(images);
      setActiveImageIndex(0);
    }
  };

  const closeGallery = () => {
    setViewingImages(null);
    setActiveImageIndex(0);
  };

  const navigateGallery = (direction: 'next' | 'prev') => {
    if (!viewingImages) return;
    if (direction === 'next') {
      setActiveImageIndex(prev => (prev + 1) % viewingImages.length);
    } else {
      setActiveImageIndex(prev => (prev - 1 + viewingImages.length) % viewingImages.length);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear local storage and state on logout
    localStorage.clear(); 
    saveTransactions([]);
    saveBooks([]);
    setAllTransactions([]);
    setBooks([]);
    setCurrentBookId('');
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          
          <div className="flex items-center space-x-2 relative" ref={bookMenuRef}>
            <div className="bg-indigo-600 p-2 rounded-lg flex-shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsBookMenuOpen(!isBookMenuOpen)}
                className="flex items-center space-x-2 hover:bg-gray-50 px-2 py-1 rounded-md transition-colors group"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs text-gray-500 font-medium">Cashbook</span>
                  <h1 className="text-xl font-bold text-gray-900 flex items-center">
                    {currentBookName}
                    <ChevronDown className={`w-4 h-4 ml-2 text-gray-400 group-hover:text-gray-600 transition-transform ${isBookMenuOpen ? 'rotate-180' : ''}`} />
                  </h1>
                </div>
              </button>

              {isBookMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    My Books
                  </div>
                  {books.map((book) => (
                    <div 
                      key={book.id}
                      onClick={() => {
                        setCurrentBookId(book.id);
                        setIsBookMenuOpen(false);
                      }}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center overflow-hidden mr-2">
                        <BookIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span className={`truncate ${book.id === currentBookId ? 'font-semibold text-indigo-600' : ''}`}>
                          {book.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => handleOpenEditBook(e, book)}
                            className="p-1 text-gray-300 hover:text-blue-500"
                            title="Rename Book"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                        {book.id !== currentBookId && (
                            <button 
                                onClick={(e) => handleDeleteBook(e, book.id)}
                                className="p-1 text-gray-300 hover:text-red-500"
                                title="Delete Book"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={handleOpenCreateBook}
                      className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Book
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3 w-full sm:w-auto justify-end items-center">
             {showInstallBtn && (
               <button
                 onClick={handleInstallClick}
                 className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-600"
               >
                 <Smartphone className="w-4 h-4 mr-2" />
                 Install App
               </button>
             )}
             
             <button
              onClick={handleGenerateDemoData}
              className="hidden md:inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Generate Demo Data"
            >
              <Database className="w-4 h-4 text-gray-500 mr-2" />
              Demo
            </button>
             <button
              onClick={handleExportPDF}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Export PDF Report"
            >
              <Download className="w-4 h-4 text-gray-500" />
            </button>
             <button
              onClick={handleGenerateReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Bot className="w-4 h-4 mr-2 text-indigo-500" />
              <span className="hidden sm:inline">AI Insights</span>
              <span className="sm:hidden">AI</span>
            </button>
            <button
              onClick={handleOpenAddTransaction}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Entry
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardStats summary={summary} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Transactions: <span className="text-gray-500 font-normal">{currentBookName}</span>
              </h2>
            </div>
            <TransactionList 
              transactions={currentTransactions} 
              onDelete={handleDeleteTransaction}
              onEdit={handleOpenEditTransaction}
              onViewAttachment={openGallery}
            />
          </div>
          <div className="space-y-6">
            <SpendingChart transactions={currentTransactions} />
            <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
                <Bot className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-2">Smart Management</h3>
                <p className="text-indigo-200 text-sm mb-4">
                  AI insights now analyze your live data securely.
                </p>
                <button 
                  onClick={handleGenerateReport}
                  className="w-full bg-indigo-800 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Analyze My Spending
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isTransactionFormOpen} 
        onClose={() => setIsTransactionFormOpen(false)}
        title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
      >
        <TransactionForm 
          onSubmit={handleSaveTransaction} 
          initialData={editingTransaction}
          onClose={() => setIsTransactionFormOpen(false)} 
          userId={userId} // Pass userId
          onUploadFile={handleUploadAttachment} // Pass upload handler
        />
      </Modal>

      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={editingBook ? "Rename Cashbook" : "Create New Cashbook"}
      >
        <form onSubmit={handleSaveBook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book Name</label>
            <input
              type="text"
              required
              autoFocus
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              placeholder="e.g. Marketing Fund"
              value={bookFormName}
              onChange={(e) => setBookFormName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsBookModalOpen(false)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">{editingBook ? "Save" : "Create"}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} title={`Analysis: ${currentBookName}`}>
        <div className="min-h-[200px]">
          {isGeneratingReport ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 text-sm">Analyzing transactions...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg">
               <div className="whitespace-pre-wrap font-sans">{reportContent}</div>
            </div>
          )}
        </div>
      </Modal>

      {viewingImages && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black bg-opacity-95" onClick={closeGallery}></div>
            <div className="relative z-10 w-full max-w-7xl px-4 flex justify-between items-center pointer-events-none">
                <button onClick={closeGallery} className="absolute top-6 right-6 text-white bg-black/50 rounded-full p-2 pointer-events-auto"><X className="w-8 h-8" /></button>
                <button onClick={() => navigateGallery('prev')} className={`pointer-events-auto p-3 rounded-full bg-black/50 text-white ${viewingImages.length <= 1 ? 'opacity-0' : ''}`}><ChevronLeft className="w-8 h-8" /></button>
                <img src={viewingImages[activeImageIndex]} className="max-w-full max-h-[80vh] object-contain rounded-md shadow-2xl pointer-events-auto mx-4" alt="gallery" />
                <button onClick={() => navigateGallery('next')} className={`pointer-events-auto p-3 rounded-full bg-black/50 text-white ${viewingImages.length <= 1 ? 'opacity-0' : ''}`}><ChevronRight className="w-8 h-8" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;