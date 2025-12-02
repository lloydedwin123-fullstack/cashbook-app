import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, Loader2, Image as ImageIcon, X, Upload, Save } from 'lucide-react';
import { Transaction, TransactionType, CATEGORIES } from '../types';
import { suggestCategory } from '../services/geminiService';
import { base64ToBlob } from '../services/supabaseStorageService'; // Import base64ToBlob

interface TransactionFormProps {
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void;
  initialData?: Transaction;
  onClose: () => void;
  userId: string | null; // New prop
  onUploadFile: (file: Blob) => Promise<string | null>; // New prop for Supabase upload
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, initialData, onClose, userId, onUploadFile }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with data if editing
  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      setAmount(initialData.amount.toString());
      setType(initialData.type);
      setCategory(initialData.category);
      setAttachments(initialData.attachments || []);
      // Extract YYYY-MM-DD from ISO string
      setDate(initialData.date.split('T')[0]);
    } else {
      // Reset defaults for new entry
      setDescription('');
      setAmount('');
      setType('EXPENSE');
      setCategory(CATEGORIES[0]);
      setAttachments([]);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    // Preserve existing time if editing, otherwise use current time
    let finalDate = new Date().toISOString();
    if (date) {
        // combine selected date with current time (or preserved time) to avoid timezone issues shifting the day
        const now = new Date();
        const selectedDate = new Date(date);
        selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        finalDate = selectedDate.toISOString();
    }

    onSubmit({
      date: finalDate,
      description,
      amount: parseFloat(amount),
      type,
      category,
      attachments: attachments,
      bookId: initialData?.bookId || '', // Passed but overwritten by App logic usually
    });
    onClose();
  };

  const handleAutoCategorize = async () => {
    if (!description) return;
    setIsSuggesting(true);
    const suggestion = await suggestCategory(description);
    if (suggestion && CATEGORIES.includes(suggestion)) {
      setCategory(suggestion);
    }
    setIsSuggesting(false);
  };

  // Process file for client-side compression/resizing (returns a base64 Data URL)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Reduce max size slightly since we allow multiple
          const MAX_SIZE = 800;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Moderate compression
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);

    try {
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Always compress on client side first
        const compressedBase64 = await compressImage(file);
        
        if (userId) {
          // If logged in, upload to Supabase Storage
          const blob = base64ToBlob(compressedBase64, 'image/jpeg');
          const url = await onUploadFile(blob);
          if (url) uploadedImageUrls.push(url);
        } else {
          // If not logged in, store base64 in local storage
          uploadedImageUrls.push(compressedBase64);
        }
      }
      setAttachments(prev => [...prev, ...uploadedImageUrls]);
    } catch (error) {
      console.error("Error processing or uploading images", error);
      alert("Failed to process or upload some images.");
    } finally {
      setIsProcessingImage(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <div className="flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-l-lg focus:z-10 focus:ring-2 ${
              type === 'EXPENSE'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`flex-1 px-4 py-2 text-sm font-medium border border-l-0 border-gray-300 rounded-r-lg focus:z-10 focus:ring-2 ${
              type === 'INCOME'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            placeholder="e.g. Coffee for client meeting"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAutoCategorize}
            disabled={!description || isSuggesting}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            title="Auto-categorize with AI"
          >
            {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <div className="relative rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              className="block w-full rounded-md border-gray-300 pl-7 p-2 border focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input 
                type="date"
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                value={date}
                onChange={(e) => setDate(e.target.value)}
            />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Attachments Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Receipts / Images</label>
        
        <div className="space-y-3">
          {/* Upload Area */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingImage}
            className="flex items-center justify-center w-full px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 hover:bg-gray-50 transition-colors"
          >
            <div className="space-y-1 text-center">
              {isProcessingImage ? (
                <Loader2 className="mx-auto h-8 w-8 text-indigo-400 animate-spin" />
              ) : (
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
              )}
              <div className="flex text-sm text-gray-600 justify-center">
                <span className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  {isProcessingImage ? "Processing..." : "Upload files"}
                </span>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG</p>
            </div>
          </button>

          {/* Thumbnails Grid */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((img, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img 
                    src={img} 
                    alt={`Attachment ${idx + 1}`} 
                    className="w-full h-full object-cover rounded-md border border-gray-200" 
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-white text-red-500 rounded-full p-1 shadow-md border border-gray-100 hover:bg-red-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          multiple
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>

      <div className="pt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessingImage}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
            {initialData ? (
                <>
                    <Save className="w-4 h-4 mr-2" />
                    Update
                </>
            ) : (
                <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                </>
            )}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;