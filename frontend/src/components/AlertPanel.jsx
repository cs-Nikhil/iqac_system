import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { studentsAPI } from '../services/api';

export default function AlertPanel() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsAPI.atRisk()
      .then((response) => {
        setStudents(response.data.students?.slice(0, 8) || []);
        setTotal(response.data.total || 0);
      })
      .catch(() => {
        setStudents([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="section chart-shell gap-4">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning ring-1 ring-warning/20">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 className="section-title">At-Risk Students</h3>
            <p className="section-subtitle">Unified performance score watchlist</p>
          </div>
        </div>
        <span className="badge badge-warning">{total} flagged</span>
      </div>

      <div className="space-y-2">
        {loading ? Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-14" />
        )) : null}

        {!loading && students.length === 0 ? (
          <div className="empty-state min-h-[13rem]">No at-risk students detected.</div>
        ) : null}

        {!loading && students.map((student) => (
          <div
            key={student._id}
            className="surface-inset flex items-center justify-between gap-3 px-4 py-3 transition duration-200 hover:border-warning/30 hover:bg-warning/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-content-primary">{student.name}</p>
              <p className="text-xs text-content-muted">
                {student.rollNumber} · {student.department?.code}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-danger">
                {Number(student.performanceScore ?? 0).toFixed(1)} Score
              </span>
              <ChevronRight size={14} className="text-content-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
