import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
  ListItemButton,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  QuestionAnswer,
  Description,
  CheckCircle,
  AttachFile,
  Info,
  AccountTree,
  Label,
  Link,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';
import DocumentKnowledgeGraph from './DocumentKnowledgeGraph';
import DocumentKnowledgeGraphViewer from './DocumentKnowledgeGraphViewer';

interface Document {
  document_id: string;
  filename: string;
  upload_date: string;
  file_size: number;
  num_chunks: number;
  status: string;
  can_query: boolean;
  tags?: string[];
  links?: Array<{target: string; type: string; created_at: string}>;
}

interface Source {
  document_name: string;
  chunk_index: number;
  similarity_score: number;
  text_preview: string;
}

interface Answer {
  success: boolean;
  question: string;
  answer: string;
  sources: Source[];
  num_documents_searched: number;
  confidence: number;
  timestamp: string;
}

const RAGDocumentQA: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [pastedText, setPastedText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'text'>('file');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [queryMode, setQueryMode] = useState<'all' | 'documents' | 'cluster'>('all');

  useEffect(() => {
    loadDocuments();
    loadClusters();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/list-documents`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/graph/full`);
      const data = await response.json();
      console.log('📊 Graph API Response:', data);
      if (data.success) {
        const manualClusters = data.clusters?.manual || [];
        const autoClusters = data.clusters?.auto || [];
        const allClusters = [...manualClusters, ...autoClusters];
        console.log('✅ Loaded clusters:', allClusters);
        setClusters(allClusters);
      }
    } catch (err) {
      console.error('❌ Failed to load clusters:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const allowedExtensions = ['.pdf', '.txt', '.md', '.docx', '.text'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExt)) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Please select a PDF, TXT, MD, or DOCX file');
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (uploadMethod === 'file') {
      if (!selectedFile) {
        setError('Please select a file first');
        return;
      }

      setUploading(true);
      setError('');
      setSuccess('');
      setUploadProgress('Uploading document...');

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`${API_BASE_URL}/api/rag/upload-document`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          setSuccess(`Document "${data.metadata.filename}" uploaded and processed successfully!`);
          setSelectedFile(null);
          loadDocuments();
          setActiveTab(1); // Switch to Q&A tab
        } else {
          setError(data.detail || 'Upload failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to upload document');
      } finally {
        setUploading(false);
        setUploadProgress('');
      }
    } else {
      // Text upload
      if (!pastedText.trim()) {
        setError('Please enter some text');
        return;
      }

      if (!textTitle.trim()) {
        setError('Please enter a title for your text');
        return;
      }

      setUploading(true);
      setError('');
      setSuccess('');
      setUploadProgress('Processing text...');

      try {
        const response = await fetch(`${API_BASE_URL}/api/rag/upload-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: pastedText,
            title: textTitle,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setSuccess(`Text "${data.metadata.filename}" uploaded and processed successfully!`);
          setPastedText('');
          setTextTitle('');
          loadDocuments();
          setActiveTab(1); // Switch to Q&A tab
        } else {
          setError(data.detail || 'Upload failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to upload text');
      } finally {
        setUploading(false);
        setUploadProgress('');
      }
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/delete-document/${documentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        loadDocuments();
      } else {
        setError('Failed to delete document');
      }
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (documents.length === 0) {
      setError('Please upload at least one document first');
      return;
    }

    setLoading(true);
    setError('');
    setAnswer(null);

    try {
      const requestBody: any = {
        question: question,
        max_chunks: 5,
      };

      // Add filters based on query mode
      if (queryMode === 'documents' && selectedDocuments.length > 0) {
        requestBody.document_ids = selectedDocuments;
        console.log('🔍 Querying specific documents:', selectedDocuments);
      } else if (queryMode === 'cluster' && selectedCluster) {
        // Get document IDs from selected cluster
        const cluster = clusters.find(c => c.id === selectedCluster);
        if (cluster && cluster.doc_ids.length > 0) {
          requestBody.document_ids = cluster.doc_ids;
          console.log('🔍 Querying cluster documents:', cluster.doc_ids);
        }
      } else {
        console.log('🔍 Querying ALL documents');
      }

      console.log('📤 Request body:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/rag/ask-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setAnswer(data);
      } else {
        setError(data.detail || 'Failed to get answer');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to ask question');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <Card
        elevation={0}
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid #334155',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)',
          },
        }}
      >
        <CardContent sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Description sx={{ fontSize: 40, color: '#a78bfa', mr: 2 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', mb: 0.5 }}>
                RAG Document Q&A
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.disabled' }}>
                Upload PDFs and ask questions using advanced semantic search
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Chip
              icon={<Description />}
              label={`${documents.length} Documents`}
              sx={{
                backgroundColor: '#8b5cf6',
                color: '#ffffff',
                fontWeight: 600,
              }}
            />
            <Chip
              icon={<Info />}
              label="Powered by GPT-4o"
              sx={{
                backgroundColor: '#334155',
                color: '#ffffff',
                fontWeight: 600,
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card elevation={0} sx={{ mb: 3, border: '1px solid #334155', backgroundColor: '#1e293b' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            borderBottom: '1px solid #334155',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'text.disabled',
              '&.Mui-selected': {
                color: '#8b5cf6',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#8b5cf6',
            },
          }}
        >
          <Tab icon={<CloudUpload />} label="Upload Documents" iconPosition="start" />
          <Tab icon={<QuestionAnswer />} label="Ask Questions" iconPosition="start" />
          <Tab icon={<AccountTree />} label="Knowledge Graph" iconPosition="start" />
        </Tabs>
      </Card>

      {/* Upload Tab */}
      {activeTab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
          <Box>
            <Card
              elevation={0}
              sx={{
                border: '1px solid #334155',
                borderRadius: 3,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                  Add Document or Text
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled', mb: 3, lineHeight: 1.6 }}>
                  Upload a file (PDF, TXT, MD, DOCX) or paste text directly. The system will create embeddings and enable semantic search.
                </Typography>

                {/* Upload Method Tabs */}
                <Box sx={{ mb: 3 }}>
                  <Tabs
                    value={uploadMethod}
                    onChange={(_, value) => setUploadMethod(value)}
                    sx={{
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        color: 'text.disabled',
                        '&.Mui-selected': {
                          color: '#8b5cf6',
                        },
                      },
                      '& .MuiTabs-indicator': {
                        backgroundColor: '#8b5cf6',
                      },
                    }}
                  >
                    <Tab value="file" label="Upload File" />
                    <Tab value="text" label="Paste Text" />
                  </Tabs>
                </Box>

                {uploadMethod === 'file' ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      border: '2px dashed #475569',
                      borderRadius: 2,
                      textAlign: 'center',
                      backgroundColor: '#0f172a',
                      mb: 2,
                    }}
                  >
                    {selectedFile ? (
                      <Box>
                        <AttachFile sx={{ fontSize: 48, color: '#8b5cf6', mb: 1 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5, color: '#f8fafc' }}>
                          {selectedFile.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          {formatFileSize(selectedFile.size)}
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <CloudUpload sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body1" sx={{ color: '#cbd5e1' }}>
                          Select a file to upload (PDF, TXT, MD, DOCX)
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                ) : (
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="Document Title"
                      value={textTitle}
                      onChange={(e) => setTextTitle(e.target.value)}
                      placeholder="Enter a title for your text"
                      sx={{
                        mb: 2,
                        '& .MuiInputLabel-root': {
                          color: 'text.disabled',
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#8b5cf6',
                        },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#475569',
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#64748b',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#8b5cf6',
                          borderWidth: '2px',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={12}
                      label="Text Content"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your text here (minimum 100 characters)..."
                      sx={{
                        '& .MuiInputLabel-root': {
                          color: 'text.disabled',
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#8b5cf6',
                        },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: '#0f172a',
                          fontSize: '1rem',
                          lineHeight: 1.7,
                          color: '#f8fafc',
                          fontFamily: 'monospace',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#475569',
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#64748b',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#8b5cf6',
                          borderWidth: '2px',
                        },
                      }}
                    />
                    {pastedText && (
                      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
                        {pastedText.length} characters • {pastedText.split(' ').length} words
                      </Typography>
                    )}
                  </Box>
                )}

                {uploadMethod === 'file' && (
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<AttachFile />}
                    sx={{
                      mb: 2,
                      borderColor: '#475569',
                      color: '#f8fafc',
                      '&:hover': {
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      },
                    }}
                  >
                    Select File
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.docx,.text"
                      hidden
                      onChange={handleFileSelect}
                    />
                  </Button>
                )}

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleUpload}
                  disabled={(uploadMethod === 'file' && !selectedFile) || (uploadMethod === 'text' && (!pastedText.trim() || !textTitle.trim())) || uploading}
                  startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    color: '#ffffff',
                    fontWeight: 600,
                    py: 1.5,
                  }}
                >
                  {uploading ? 'Processing...' : uploadMethod === 'file' ? 'Upload & Process' : 'Process Text'}
                </Button>

                {uploading && uploadProgress && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {uploadProgress}
                    </Typography>
                    <LinearProgress />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Card
              elevation={0}
              sx={{
                border: '1px solid #334155',
                borderRadius: 3,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                  Uploaded Documents ({documents.length})
                </Typography>

                {documents.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                    }}
                  >
                    <Description sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      No documents uploaded yet
                    </Typography>
                  </Paper>
                ) : (
                  <List sx={{ maxHeight: 500, overflow: 'auto' }}>
                    {documents.map((doc) => (
                      <ListItem
                        key={doc.document_id}
                        sx={{
                          border: '1px solid #334155',
                          borderRadius: 2,
                          mb: 2,
                          backgroundColor: '#0f172a',
                          p: 2,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: '#8b5cf6',
                            backgroundColor: '#1e293b',
                          },
                        }}
                      >
                        <Description sx={{ color: '#8b5cf6', mr: 2, fontSize: 28 }} />
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc', mb: 0.5 }}>
                              {doc.filename}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" display="block" sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>
                                {formatFileSize(doc.file_size)} • {doc.num_chunks} chunks
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                Uploaded: {formatDate(doc.upload_date)}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteDocument(doc.document_id)}
                            sx={{
                              color: 'error.main',
                              '&:hover': {
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              },
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Q&A Tab */}
      {activeTab === 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3 }}>
          <Box>
            <Card
              elevation={0}
              sx={{
                border: '1px solid #334155',
                borderRadius: 3,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
                  Ask a Question
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled', mb: 3, lineHeight: 1.6 }}>
                  Ask any question about your uploaded documents. The system will find relevant sections and generate a comprehensive answer.
                </Typography>

                {/* Query Scope Selection */}
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155' }}>
                  <Typography variant="subtitle2" sx={{ color: '#f8fafc', mb: 2, fontWeight: 600 }}>
                    Query Scope
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <Select
                      value={queryMode}
                      onChange={(e) => {
                        setQueryMode(e.target.value as any);
                        setSelectedDocuments([]);
                        setSelectedCluster('');
                      }}
                      sx={{
                        bgcolor: 'text.primary',
                        color: '#f8fafc',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#475569',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#64748b',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#8b5cf6',
                        },
                      }}
                    >
                      <MenuItem value="all">Search All Documents</MenuItem>
                      <MenuItem value="documents">Search Specific Documents</MenuItem>
                      <MenuItem value="cluster">Search a Document Cluster</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Document Selection */}
                  {queryMode === 'documents' && (
                    <FormControl fullWidth>
                      <InputLabel sx={{ color: 'text.disabled' }}>Select Documents</InputLabel>
                      <Select
                        multiple
                        value={selectedDocuments}
                        onChange={(e) => setSelectedDocuments(e.target.value as string[])}
                        input={<OutlinedInput label="Select Documents" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((docId) => {
                              const doc = documents.find(d => d.document_id === docId);
                              return (
                                <Chip
                                  key={docId}
                                  label={doc?.filename || docId}
                                  size="small"
                                  sx={{ bgcolor: '#8b5cf6', color: '#fff' }}
                                />
                              );
                            })}
                          </Box>
                        )}
                        sx={{
                          bgcolor: 'text.primary',
                          color: '#f8fafc',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#475569',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#64748b',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#8b5cf6',
                          },
                        }}
                      >
                        {documents.map((doc) => (
                          <MenuItem key={doc.document_id} value={doc.document_id}>
                            <Checkbox checked={selectedDocuments.includes(doc.document_id)} />
                            <ListItemText
                              primary={doc.filename}
                              secondary={`${doc.num_chunks} chunks · ${formatDate(doc.upload_date)}`}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                      {selectedDocuments.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'success.main', mt: 1 }}>
                          ✓ {selectedDocuments.length} document(s) selected
                        </Typography>
                      )}
                    </FormControl>
                  )}

                  {/* Cluster Selection */}
                  {queryMode === 'cluster' && (
                    <FormControl fullWidth>
                      <InputLabel sx={{ color: 'text.disabled' }}>Select Cluster</InputLabel>
                      <Select
                        value={selectedCluster}
                        onChange={(e) => setSelectedCluster(e.target.value)}
                        label="Select Cluster"
                        sx={{
                          bgcolor: 'text.primary',
                          color: '#f8fafc',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#475569',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#64748b',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#8b5cf6',
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select a cluster</em>
                        </MenuItem>
                        {clusters.map((cluster) => (
                          <MenuItem key={cluster.id} value={cluster.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={cluster.type === 'manual' ? 'Manual' : 'Auto'}
                                size="small"
                                sx={{
                                  bgcolor: cluster.type === 'manual' ? '#3b82f6' : '#10b981',
                                  color: '#fff',
                                  fontSize: '0.7rem',
                                }}
                              />
                              <Typography>{cluster.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                ({cluster.doc_ids.length} docs)
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {selectedCluster && (
                        <Typography variant="caption" sx={{ color: 'success.main', mt: 1 }}>
                          ✓ Cluster selected: {clusters.find(c => c.id === selectedCluster)?.name}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                </Paper>

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Your Question"
                  placeholder="What are the key findings in the report? What does the document say about...?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  sx={{
                    mb: 2,
                    '& .MuiInputLabel-root': {
                      color: 'text.disabled',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#8b5cf6',
                    },
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#0f172a',
                      fontSize: '1rem',
                      lineHeight: 1.7,
                      color: '#f8fafc',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '1px',
                      borderColor: '#475569',
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#64748b',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#8b5cf6',
                      borderWidth: '2px',
                    },
                  }}
                />

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleAskQuestion}
                  disabled={loading || documents.length === 0}
                  startIcon={loading ? <CircularProgress size={20} /> : <QuestionAnswer />}
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    color: '#ffffff',
                    fontWeight: 600,
                    py: 1.5,
                  }}
                >
                  {loading ? 'Analyzing...' : 'Ask Question'}
                </Button>

                {documents.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Please upload at least one document before asking questions.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>

          {answer && (
            <Box>
              <Card
                elevation={0}
                sx={{
                  border: '2px solid #8b5cf6',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <CheckCircle sx={{ color: 'success.main', fontSize: 36, mr: 2 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                      Answer
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Chip
                        label={`Confidence: ${(answer.confidence * 100).toFixed(0)}%`}
                        sx={{
                          backgroundColor: getConfidenceColor(answer.confidence),
                          color: '#ffffff',
                          fontWeight: 600,
                        }}
                      />
                      <Chip
                        label={`${answer.num_documents_searched} documents searched`}
                        variant="outlined"
                      />
                      <Chip
                        label={`${answer.sources.length} sources`}
                        variant="outlined"
                      />
                    </Box>

                    {/* Show query scope info */}
                    {queryMode !== 'all' && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        {queryMode === 'documents' && selectedDocuments.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              📄 Searched specific documents:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selectedDocuments.map(docId => {
                                const doc = documents.find(d => d.document_id === docId);
                                return (
                                  <Chip
                                    key={docId}
                                    label={doc?.filename || docId}
                                    size="small"
                                    sx={{ bgcolor: 'secondary.main', color: '#fff' }}
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                        {queryMode === 'cluster' && selectedCluster && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Searched cluster: {clusters.find(c => c.id === selectedCluster)?.name}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {clusters.find(c => c.id === selectedCluster)?.doc_ids.map((docId: string) => {
                                const doc = documents.find(d => d.document_id === docId);
                                return (
                                  <Chip
                                    key={docId}
                                    label={doc?.filename || docId}
                                    size="small"
                                    sx={{ bgcolor: 'success.main', color: '#fff' }}
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                      </Alert>
                    )}
                  </Box>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 3,
                      mb: 3,
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        lineHeight: 2,
                        whiteSpace: 'pre-wrap',
                        color: '#e2e8f0',
                        fontSize: '1.05rem',
                        fontWeight: 400,
                      }}
                    >
                      {answer.answer}
                    </Typography>
                  </Paper>

                  <Divider sx={{ my: 3, borderColor: '#334155' }} />

                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#f8fafc' }}>
                    Sources
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3 }}>
                    {answer.sources.map((source, idx) => (
                      <Box key={idx}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: 3,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#8b5cf6',
                              backgroundColor: '#1e293b',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                              {source.document_name} - Section {source.chunk_index + 1}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${(source.similarity_score * 100).toFixed(0)}% match`}
                              sx={{
                                backgroundColor: getConfidenceColor(source.similarity_score),
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                px: 1.5,
                              }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.disabled',
                              fontStyle: 'italic',
                              lineHeight: 1.7,
                              fontSize: '0.95rem',
                              pl: 2,
                              borderLeft: '3px solid #475569',
                            }}
                          >
                            "{source.text_preview}"
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      )}

      {/* Knowledge Graph Tab */}
      {activeTab === 2 && (
        <Box sx={{ minHeight: '80vh' }}>
          <DocumentKnowledgeGraphViewer />
        </Box>
      )}

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
    </Box>
  );
};

export default RAGDocumentQA;
