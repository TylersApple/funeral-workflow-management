import React, { useState, useEffect } from 'react';
import { FuneralRecord, supabase, STATUS_CONFIG, RecordStatus, DocumentUpload } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft, Edit2, Save, X, Upload, Download, Trash2, AlertCircle } from 'lucide-react';

interface RecordDetailProps {
  record: FuneralRecord;
  onBack: () => void;
  onUpdate: () => void;
}

export function RecordDetail({ record, onBack, onUpdate }: RecordDetailProps) {
  const { userProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [formData, setFormData] = useState(record);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [record.id]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('fw_documents')
        .select('*')
        .eq('record_id', record.id)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
      } else {
        setDocuments(data || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = async (newStatus: RecordStatus) => {
    // Check if document is required for this status
    const statusConfig = STATUS_CONFIG[newStatus];
    if (statusConfig.requiresDocument) {
      const hasDocument = documents.some(doc => doc.status_when_uploaded === newStatus);
      if (!hasDocument) {
        alert(`Please upload a document before changing to "${statusConfig.label}" status.`);
        return;
      }
    }

    setLoading(true);
    
    try {
      const newPercentage = statusConfig.percentage;
      
      // Update record status
      const { error: updateError } = await supabase
        .from('fw_records')
        .update({
          status: newStatus,
          progress_percentage: newPercentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (updateError) {
        console.error('Error updating status:', updateError);
        return;
      }

      // Add to status history
      const { error: historyError } = await supabase
        .from('fw_status_history')
        .insert([{
          record_id: record.id,
          old_status: record.status,
          new_status: newStatus,
          old_percentage: record.progress_percentage,
          new_percentage: newPercentage,
          changed_by: userProfile?.id,
          notes: `Status changed from ${STATUS_CONFIG[record.status].label} to ${statusConfig.label}`
        }]);

      if (historyError) {
        console.error('Error adding status history:', historyError);
      }

      onUpdate();
      
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      const updateData = {
        ...formData,
        amount_covered: formData.amount_covered ? parseFloat(formData.amount_covered.toString()) : null,
        paid: formData.paid ? parseFloat(formData.paid.toString()) : null,
        updated_at: new Date().toISOString()
      };

      // Remove empty strings
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === '') {
          updateData[key as keyof typeof updateData] = null as any;
        }
      });

      const { error } = await supabase
        .from('fw_records')
        .update(updateData)
        .eq('id', record.id);

      if (error) {
        console.error('Error updating record:', error);
      } else {
        setEditing(false);
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploadingDocument(true);
    
    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${record.record_number}-${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('funeral-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return;
      }

      // Save document record
      const { error: dbError } = await supabase
        .from('fw_documents')
        .insert([{
          record_id: record.id,
          document_name: selectedFile.name,
          document_type: selectedFile.type,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          status_when_uploaded: record.status,
          uploaded_by: userProfile?.id
        }]);

      if (dbError) {
        console.error('Error saving document record:', dbError);
      } else {
        setSelectedFile(null);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDownloadDocument = async (document: DocumentUpload) => {
    try {
      const { data, error } = await supabase.storage
        .from('funeral-documents')
        .download(document.file_path);

      if (error) {
        console.error('Error downloading document:', error);
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('funeral-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('fw_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        console.error('Error deleting document record:', dbError);
      } else {
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const currentStatusConfig = STATUS_CONFIG[record.status];
  const requiredDocumentExists = currentStatusConfig.requiresDocument 
    ? documents.some(doc => doc.status_when_uploaded === record.status)
    : true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{record.full_name}</h1>
                <p className="text-gray-600">{record.record_number}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Record
                </button>
              )}
              
              {editing && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setFormData(record);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status and Progress */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status & Progress</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${currentStatusConfig.color}`}>
                    {currentStatusConfig.label}
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {record.progress_percentage}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${currentStatusConfig.color}`}
                    style={{ width: `${record.progress_percentage}%` }}
                  ></div>
                </div>

                {!requiredDocumentExists && currentStatusConfig.requiresDocument && (
                  <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">Document required for current status</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Change Status
                  </label>
                  <select
                    value={record.status}
                    onChange={(e) => handleStatusChange(e.target.value as RecordStatus)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                      <option key={status} value={status}>
                        {config.label} ({config.percentage}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Record Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Record Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Personal Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    {editing ? (
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.full_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                    {editing ? (
                      <input
                        type="text"
                        name="id_number"
                        value={formData.id_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.id_number || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    {editing ? (
                      <textarea
                        name="address"
                        value={formData.address || ''}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.address || 'Not provided'}</p>
                    )}
                  </div>
                </div>

                {/* Death & Funeral Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Death & Funeral Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Death</label>
                    {editing ? (
                      <input
                        type="date"
                        name="date_of_death"
                        value={formData.date_of_death || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {record.date_of_death ? new Date(record.date_of_death).toLocaleDateString() : 'Not provided'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time of Death</label>
                    {editing ? (
                      <input
                        type="time"
                        name="time_of_death"
                        value={formData.time_of_death || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.time_of_death || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Funeral Date</label>
                    {editing ? (
                      <input
                        type="date"
                        name="funeral_date"
                        value={formData.funeral_date || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {record.funeral_date ? new Date(record.funeral_date).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Funeral Location</label>
                    {editing ? (
                      <input
                        type="text"
                        name="funeral_location"
                        value={formData.funeral_location || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.funeral_location || 'Not specified'}</p>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Contact Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next of Kin</label>
                    {editing ? (
                      <input
                        type="text"
                        name="next_of_kin"
                        value={formData.next_of_kin || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.next_of_kin || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cell Number</label>
                    {editing ? (
                      <input
                        type="tel"
                        name="cell_number"
                        value={formData.cell_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.cell_number || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    {editing ? (
                      <input
                        type="email"
                        name="email_address"
                        value={formData.email_address || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.email_address || 'Not provided'}</p>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Payment Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount Covered</label>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        name="amount_covered"
                        value={formData.amount_covered || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {record.amount_covered ? `R ${record.amount_covered.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : 'Not specified'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        name="paid"
                        value={formData.paid || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {record.paid ? `R ${record.paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : 'Not paid'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                    {editing ? (
                      <input
                        type="text"
                        name="receipt_number"
                        value={formData.receipt_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.receipt_number || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                    {editing ? (
                      <input
                        type="text"
                        name="invoice_number"
                        value={formData.invoice_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">{record.invoice_number || 'Not provided'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Policy Information */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Policy Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div key={num}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Policy {num}</label>
                      {editing ? (
                        <input
                          type="text"
                          name={`policy_${num}`}
                          value={formData[`policy_${num}` as keyof typeof formData] || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{record[`policy_${num}` as keyof typeof record] || 'Not provided'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Document Management */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
              
              {/* Upload Section */}
              <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <div className="space-y-3">
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {selectedFile && (
                      <button
                        onClick={handleFileUpload}
                        disabled={uploadingDocument}
                        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                      >
                        {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No documents uploaded</p>
                ) : (
                  documents.map((document) => (
                    <div key={document.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {document.document_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {STATUS_CONFIG[document.status_when_uploaded].label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(document.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDownloadDocument(document)}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id, document.file_path)}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Record Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Information</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Record Number:</span>
                  <span className="font-medium text-gray-900">{record.record_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-900">{new Date(record.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="text-gray-900">{new Date(record.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}