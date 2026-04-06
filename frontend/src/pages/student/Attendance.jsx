import { useCallback, useEffect, useState } from 'react';
import AttendanceAnalytics from '../../components/student/AttendanceAnalytics';
import { studentPortalAPI } from '../../services/api';

export default function Attendance() {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAttendance = useCallback(async () => {
    setLoading(true);

    try {
      const response = await studentPortalAPI.getAttendance();
      setAttendance(response.data?.data || null);
    } catch {
      setAttendance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  return (
    <div className="page-transition">
      <AttendanceAnalytics data={attendance} loading={loading} />
    </div>
  );
}
