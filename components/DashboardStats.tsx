import React from 'react';
import { SpendingSummary } from '../types';
import { Wallet, TrendingDown, TrendingUp } from 'lucide-react';

interface DashboardStatsProps {
  summary: SpendingSummary;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ${summary.balance.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <Wallet className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Income</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              +${summary.totalIncome.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              -${summary.totalExpense.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <TrendingDown className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;