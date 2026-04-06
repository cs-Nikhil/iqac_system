import { useCallback, useEffect, useState } from 'react';
import PlacementPortal from '../../components/student/PlacementPortal';
import { studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

export default function Placements() {
  const { isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [placements, setPlacements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadPlacements = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getPlacements();
      setPlacements(response.data?.data || null);
    } catch {
      setPlacements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlacements();
  }, [loadPlacements]);

  const handleApply = useCallback(async (payload) => {
    if (isReadOnly) {
      return {
        success: false,
        message: readOnlyReason,
      };
    }

    setSubmitting(true);

    try {
      await studentPortalAPI.applyToPlacement(payload);
      await loadPlacements();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to submit the placement application.',
      };
    } finally {
      setSubmitting(false);
    }
  }, [isReadOnly, loadPlacements, readOnlyReason]);

  return (
    <div className="page-transition">
      <PlacementPortal
        data={placements}
        loading={loading}
        submitting={submitting}
        onApply={handleApply}
        readOnly={isReadOnly}
        readOnlyReason={readOnlyReason}
      />
    </div>
  );
}
