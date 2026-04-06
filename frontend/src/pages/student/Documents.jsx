import { useCallback, useEffect, useState } from 'react';
import StudentDocuments from '../../components/student/StudentDocuments';
import { API_ORIGIN, studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

export default function Documents() {
  const { isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getDocuments();
      setDocuments(response.data?.data || null);
    } catch {
      setDocuments(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleCreate = useCallback(async (payload) => {
    if (isReadOnly) {
      return {
        success: false,
        message: readOnlyReason,
      };
    }

    setSubmitting(true);

    try {
      await studentPortalAPI.createDocument(payload);
      await loadDocuments();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to upload the document.',
      };
    } finally {
      setSubmitting(false);
    }
  }, [isReadOnly, loadDocuments, readOnlyReason]);

  return (
    <div className="page-transition">
      <StudentDocuments
        data={documents}
        loading={loading}
        submitting={submitting}
        onCreate={handleCreate}
        assetOrigin={API_ORIGIN}
        readOnly={isReadOnly}
        readOnlyReason={readOnlyReason}
      />
    </div>
  );
}
