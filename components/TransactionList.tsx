import React from 'react';
import { Transaction } from '../types';
import { ArrowDownRight, ArrowUpRight, Trash2, Paperclip, Pencil } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  // Fix: Update onDelete to include attachments for proper cleanup
  onDelete: (id: string, attachments: string[]) => void;
  onEdit: (transaction: Transaction) => void;
  onViewAttachment: (images: string[]) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onEdit, onViewAttachment }) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
        <p className="text-gray-500">No transactions yet. Add one to get started!</p>
      </div>
    );
  }

  // Sort by date descending
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-100 overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {sortedTransactions.map((transaction) => (
          <li key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              {/* Left side: Icon + Text. flex-1 and min-w-0 ensure it fills space but allows truncation. */}
              <div className="flex items-center space-x-4 flex-1 min-w-0 mr-4">
                <div className={`flex-shrink-0 rounded-full p-2 ${
                  transaction.type === 'INCOME' ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {transaction.type === 'INCOME' ? (
                    <ArrowDownRight className={`w-5 h-5 text-emerald-600`} />
                  ) : (
                    <ArrowUpRight className={`w-5 h-5 text-red-600`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate" title={transaction.description}>
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-2 truncate">
                    {new Date(transaction.date).toLocaleDateString()} • {transaction.category}
                  </p>
                </div>
              </div>
              
              {/* Right side: Actions. flex-shrink-0 ensures buttons never get squashed. */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {transaction.attachments && transaction.attachments.length > 0 && (
                  <button
                    onClick={() => onViewAttachment(transaction.attachments)}
                    className="p-1.5 flex items-center gap-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                    title={`${transaction.attachments.length} attachment(s)`}
                  >
                    <Paperclip className="w-4 h-4" />
                    {transaction.attachments.length > 1 && (
                      <span className="text-xs font-semibold">{transaction.attachments.length}</span>
                    )}
                  </button>
                )}
                <span className={`text-sm font-semibold whitespace-nowrap mr-2 ${
                  transaction.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'INCOME' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </span>
                
                <button
                  onClick={() => onEdit(transaction)}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                  title="Edit transaction"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  // Fix: Pass transaction.attachments to onDelete
                  onClick={() => onDelete(transaction.id, transaction.attachments || [])}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Delete transaction"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TransactionList;