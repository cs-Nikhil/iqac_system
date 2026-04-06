import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import StudentReadOnlyNotice from '../../components/student/StudentReadOnlyNotice';
import { studentPortalAPI } from '../../services/api';
import { getStudentWorkspaceStatus } from './workspaceStatus';

export function useStudentWorkspace() {
  return useOutletContext();
}

export default function StudentWorkspaceLayout() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setWorkspaceError('');

    try {
      const response = await studentPortalAPI.getProfile();
      setProfile(response.data?.data?.student || null);
    } catch (error) {
      setProfile(null);
      setWorkspaceError(
        error.response?.data?.message || 'Unable to load the student workspace right now.'
      );
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(async (payload) => {
    setSavingProfile(true);

    try {
      const response = await studentPortalAPI.updateProfile(payload);
      setProfile(response.data?.data?.student || null);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to update the student profile.',
      };
    } finally {
      setSavingProfile(false);
    }
  }, []);

  const workspaceStatus = useMemo(
    () => getStudentWorkspaceStatus(profile),
    [profile]
  );

  const contextValue = useMemo(
    () => ({
      profile,
      loadingProfile,
      refreshProfile: loadProfile,
      savingProfile,
      updateProfile,
      workspaceError,
      workspaceStatus,
      isReadOnly: workspaceStatus.isReadOnly,
      isGraduated: workspaceStatus.status === 'graduated',
      readOnlyReason: workspaceStatus.readOnlyReason,
    }),
    [loadProfile, loadingProfile, profile, savingProfile, updateProfile, workspaceError, workspaceStatus]
  );

  return (
    <div className="dashboard-container student-workspace flex-1 py-6">
      {workspaceError ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {workspaceError}
        </div>
      ) : null}

      {!workspaceError && workspaceStatus.isReadOnly ? (
        <StudentReadOnlyNotice message={workspaceStatus.bannerMessage} />
      ) : null}

      <Outlet context={contextValue} />
    </div>
  );
}
