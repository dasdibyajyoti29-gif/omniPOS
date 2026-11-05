import React, { useEffect, useState, useRef } from 'react';
import { DashboardStats, Medicine } from '../types/pos';
import { posApi } from '../services/api';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  ArrowRight,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string, state?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const lowStockRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const expiryRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await posApi.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const profitMargin =
    stats && stats.todaySales > 0
      ? ((stats.todayGrossProfit / stats.todaySales) * 100).toFixed(1)
      : '0.0';

  const handleLowStockRowKeyDown = (e: React.KeyboardEvent, index: number, med: Medicine) => {
    const count = stats?.lowStockItems.length || 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(count - 1, index + 1);
      lowStockRowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      lowStockRowRefs.current[prev]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onNavigate('purchases', { medicine: med });
    }
  };

  const handleExpiryRowKeyDown = (e: React.KeyboardEvent, index: number) => {
    const count = stats?.upcomingExpiries.length || 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(count - 1, index + 1);
      expiryRowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      expiryRowRefs.current[prev]?.focus();
    }
  };

  return (
    <div className="page-content" id="dashboard-page">
      {/* Quick Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Daily Overview</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Real-time sales, gross profit, and stock health metrics.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchStats}
          disabled={isLoading}
          id="btn-refresh-dashboard"
          style={{ fontSize: '0.8rem' }}
          aria-label="Refresh dashboard data"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Today Sales */}
        <div className="kpi-card emerald" id="kpi-today-sales" tabIndex={0} aria-label={`Today's sales: ${stats ? stats.todaySales.toFixed(2) : '0.00'}`}>
          <div className="kpi-info">
            <h4>Today's Sales</h4>
            <div className="kpi-value font-mono">₹{stats ? stats.todaySales.toFixed(2) : '0.00'}</div>
            <div className="kpi-subtext">
              {stats ? stats.todayInvoicesCount : 0} invoice(s) completed today
            </div>
          </div>
          <div className="kpi-icon-wrap" style={{ color: '#026289' }}>
            <DollarSign size={24} />
          </div>
        </div>

        {/* Today Gross Profit */}
        <div className="kpi-card cyan" id="kpi-today-profit" tabIndex={0} aria-label={`Today's gross profit: ${stats ? stats.todayGrossProfit.toFixed(2) : '0.00'}`}>
          <div className="kpi-info">
            <h4>Today's Gross Profit</h4>
            <div className="kpi-value font-mono">
              ₹{stats ? stats.todayGrossProfit.toFixed(2) : '0.00'}
            </div>
            <div className="kpi-subtext" style={{ color: '#026289' }}>
              {profitMargin}% margin on cost
            </div>
          </div>
          <div className="kpi-icon-wrap" style={{ color: '#4C8EBB' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Total Stock in Inventory */}
        <div className="kpi-card blue" id="kpi-total-inventory" tabIndex={0} aria-label={`Medicines in stock: ${stats ? stats.totalStockUnits.toLocaleString() : 0}`}>
          <div className="kpi-info">
            <h4>Medicines In Stock</h4>
            <div className="kpi-value font-mono">
              {stats ? stats.totalStockUnits.toLocaleString() : 0}
            </div>
            <div className="kpi-subtext">
              Across {stats ? stats.totalMedicinesCount : 0} unique medicine items
            </div>
          </div>
          <div className="kpi-icon-wrap" style={{ color: '#026289' }}>
            <Package size={24} />
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="kpi-card amber" id="kpi-low-stock" tabIndex={0} aria-label={`Low stock alerts: ${stats ? stats.lowStockItems.length : 0} items`}>
          <div className="kpi-info">
            <h4>Low-Stock Alerts</h4>
            <div className="kpi-value font-mono" style={{ color: '#f59e0b' }}>
              {stats ? stats.lowStockItems.length : 0}
            </div>
            <div className="kpi-subtext">Items with ≤ 10 units remaining</div>
          </div>
          <div className="kpi-icon-wrap" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Two Column Layout for Actionable Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Low Stock Watchlist */}
        <div className="table-container" id="low-stock-panel">
          <div className="table-header-bar">
            <div className="table-title">
              <AlertTriangle size={18} color="#f59e0b" />
              <span>Low-Stock Watchlist</span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => onNavigate('inventory')}
              id="btn-view-all-inventory"
            >
              All Inventory <ArrowRight size={13} />
            </button>
          </div>

          <table className="pos-table" role="table" aria-label="Low Stock Watchlist">
            <thead>
              <tr>
                <th scope="col">Medicine Name</th>
                <th scope="col">Batch</th>
                <th scope="col">Stock</th>
                <th scope="col" style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!stats || stats.lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    All medicines have healthy stock levels.
                  </td>
                </tr>
              ) : (
                stats.lowStockItems.map((med, idx) => (
                  <tr
                    key={med.id}
                    ref={(el) => (lowStockRowRefs.current[idx] = el)}
                    tabIndex={0}
                    onKeyDown={(e) => handleLowStockRowKeyDown(e, idx, med)}
                    aria-label={`${med.name}, ${med.stock_quantity} units remaining. Press Enter to restock.`}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{med.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        MRP: ₹{med.mrp.toFixed(2)} | SP: ₹{med.selling_price.toFixed(2)}
                      </div>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                      {med.batch_number}
                    </td>
                    <td>
                      <span className="pill pill-danger font-mono">
                        {med.stock_quantity} left
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => onNavigate('purchases', { medicine: med })}
                        id={`btn-restock-${med.id}`}
                        aria-label={`Restock ${med.name}`}
                      >
                        <PlusCircle size={13} />
                        Restock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Upcoming Expiries Watchlist */}
        <div className="table-container" id="expiry-watchlist-panel">
          <div className="table-header-bar">
            <div className="table-title">
              <Calendar size={18} color="#f43f5e" />
              <span>Upcoming Expiries (≤ 60 Days)</span>
            </div>
            <span className="pill pill-warning font-mono" style={{ fontSize: '0.75rem' }}>
              {stats ? stats.upcomingExpiries.length : 0} items
            </span>
          </div>

          <table className="pos-table" role="table" aria-label="Upcoming Expiries">
            <thead>
              <tr>
                <th scope="col">Medicine Name</th>
                <th scope="col">Expiry Date</th>
                <th scope="col">Days Left</th>
                <th scope="col">Stock</th>
              </tr>
            </thead>
            <tbody>
              {!stats || stats.upcomingExpiries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No medicines expiring in the next 60 days.
                  </td>
                </tr>
              ) : (
                stats.upcomingExpiries.map((med, idx) => {
                  const daysLeft = getDaysUntilExpiry(med.expiry_date);
                  const isCritical = daysLeft <= 30;
                  return (
                    <tr
                      key={med.id}
                      ref={(el) => (expiryRowRefs.current[idx] = el)}
                      tabIndex={0}
                      onKeyDown={(e) => handleExpiryRowKeyDown(e, idx)}
                      aria-label={`${med.name}, expires ${med.expiry_date}, ${daysLeft} days left`}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{med.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                          Batch: {med.batch_number}
                        </div>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.82rem' }}>
                        {med.expiry_date}
                      </td>
                      <td>
                        <span className={`pill ${isCritical ? 'pill-danger' : 'pill-warning'} font-mono`}>
                          {daysLeft < 0 ? 'EXPIRED' : `${daysLeft} days`}
                        </span>
                      </td>
                      <td className="font-mono">{med.stock_quantity} units</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
