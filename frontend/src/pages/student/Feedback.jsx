import { useCallback, useEffect, useState } from 'react';
import StudentFeedback from '../../components/student/StudentFeedback';
import { studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

export default function Feedback() {
  const { isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadFeedback = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getFeedback();
      setFeedback(response.data?.data || null);
    } catch {
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleCreate = useCallback(async (payload) => {
    if (isReadOnly) {
      return {
        success: false,
        message: readOnlyReason,
      };
    }

    setSubmitting(true);

    try {
      await studentPortalAPI.createFeedback(payload);
      await loadFeedback();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to submit student feedback.',
      };
    } finally {
      setSubmitting(false);
    }
  }, [isReadOnly, loadFeedback, readOnlyReason]);

  return (
    <div className="page-transition">
      <StudentFeedback
        data={feedback}
        loading={loading}
        submitting={submitting}
        onCreate={handleCreate}
        readOnly={isReadOnly}
        readOnlyReason={readOnlyReason}
      />
    </div>
  );
}
