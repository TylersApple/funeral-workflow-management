import React, { useState, useEffect } from 'react';
import { supabase, FuneralRecord, STATUS_CONFIG } from '../../lib/supabase';
import { RecordsList } from './RecordsList';
import { RecordDetail } from './RecordDetail';
import { CreateRecordModal } from './CreateRecordModal';
import { Header } from '../layout/Header';
import { Search, Filter, Download } from 'lucide-react';

export function Dashboard() {
  const [records, setRecords] = useState<FuneralRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<FuneralRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRecords();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('fw_records_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fw_records'
      }, () => {
        fetchRecords();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('fw_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching records:', error);
      } else {
        setRecords(data || []);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCreated = () => {
    setShowCreateModal(false);
    fetchRecords();
  };

  const handleRecordUpdated = () => {
    fetchRecords();
    if (selectedRecord) {
      // Refresh the selected record
      fetchRecords();
    }
  };

  const handleExportRecords = async () => {
    try {
      // Create CSV content
      const headers = [
        'Record Number', 'Full Name', 'Status', 'Progress %', 'Date of Death',
        'Funeral Date', 'Next of Kin', 'Cell Number', 'Email', 'Amount Covered',
        'Paid', 'Created At'
      ];
      
      const csvContent = [
        headers.join(','),
        ...records.map(record => [
          record.record_number,
          `"${record.full_name}"`,
          STATUS_CONFIG[record.status].label,
          record.progress_percentage,
          record.date_of_death || '',
          record.funeral_date || '',
          `"${record.next_of_kin || ''}"`,
          record.cell_number || '',
          record.email_address || '',
          record.amount_covered || '',
          record.paid || '',
          new Date(record.created_at).toLocaleDateString()
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `funeral_records_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting records:', error);
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.record_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.next_of_kin && record.next_of_kin.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (selectedRecord) {
    return (
      <RecordDetail
        record={selectedRecord}
        onBack={() => setSelectedRecord(null)}
        onUpdate={handleRecordUpdated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCreateRecord={() => setShowCreateModal(true)} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Records</h3>
              <p className="text-3xl font-bold text-blue-600">{records.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">In Progress</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {records.filter(r => r.status !== 'funeral_completed' && r.status !== 'agreement_breached').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Completed</h3>
              <p className="text-3xl font-bold text-green-600">
                {records.filter(r => r.status === 'funeral_completed').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Issues</h3>
              <p className="text-3xl font-bold text-red-600">
                {records.filter(r => r.status === 'agreement_breached' || r.status.includes('reminder')).length}
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <option key={status} value={status}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <button
              onClick={handleExportRecords}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Records List */}
        <RecordsList
          records={filteredRecords}
          loading={loading}
          onSelectRecord={setSelectedRecord}
        />

        {/* Create Record Modal */}
        {showCreateModal && (
          <CreateRecordModal
            onClose={() => setShowCreateModal(false)}
            onRecordCreated={handleRecordCreated}
          />
        )}
      </main>
    </div>
  );
}