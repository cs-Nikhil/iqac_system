import { useMemo } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

const formatNumber = (value) => Number(value || 0).toFixed(2);

export const ATTENDANCE_PREVIEW_DATA = [
  {
    semester: 'Semester 1',
    academicYear: '2023-24',
    subjects: [
      { name: 'Mathematics', code: 'MTH101', attendance: 85 },
      { name: 'Physics', code: 'PHY101', attendance: 78 },
      { name: 'Programming Fundamentals', code: 'CSE101', attendance: 91 },
    ],
  },
  {
    semester: 'Semester 2',
    academicYear: '2023-24',
    subjects: [
      { name: 'Data Structures', code: 'CSE201', attendance: 74 },
      { name: 'Digital Logic', code: 'ECE202', attendance: 67 },
      { name: 'Environmental Studies', code: 'ENV200', attendance: 58 },
    ],
  },
];

function getAttendanceTone(percentage) {
  const value = Number(percentage || 0);

  if (value >= 75) {
    return {
      badgeClassName: 'badge-success',
      iconClassName: 'student-stat-icon student-stat-icon--success',
      progressClassName: 'student-progress-fill student-progress-fill--success',
    };
  }

  if (value >= 60) {
    return {
      badgeClassName: 'badge-warning',
      iconClassName: 'student-stat-icon student-stat-icon--warning',
      progressClassName: 'student-progress-fill student-progress-fill--warning',
    };
  }

  return {
    badgeClassName: 'badge-danger',
    iconClassName: 'student-stat-icon student-stat-icon--warning',
    progressClassName: 'student-progress-fill bg-gradient-to-r from-rose-500 via-red-500 to-orange-400',
  };
}

function buildSemesterWiseAttendance(data, preview) {
  if (preview) {
    return ATTENDANCE_PREVIEW_DATA;
  }

  if (Array.isArray(data?.semesterWiseAttendance) && data.semesterWiseAttendance.length) {
    return data.semesterWiseAttendance;
  }

  const groupedBySemester = new Map();
  const subjectAttendance = Array.isArray(data?.subjectAttendance) ? data.subjectAttendance : [];

  subjectAttendance.forEach((record) => {
    const semesterEntries = Array.isArray(record.semesters) && record.semesters.length
      ? record.semesters
      : [{
        semester: record.subject?.semester,
        academicYear: record.academicYear,
        percentage: record.percentage,
      }];

    semesterEntries.forEach((entry) => {
      const semesterNumber = Number(entry.semester || record.subject?.semester || 0);
      if (!semesterNumber) {
        return;
      }

      const key = `Semester ${semesterNumber}`;
      const bucket = groupedBySemester.get(key) || {
        semester: key,
        semesterNumber,
        academicYear: entry.academicYear || '',
        subjects: [],
      };

      bucket.subjects.push({
        name: record.subject?.name || 'Unknown Subject',
        code: record.subject?.code || '',
        attendance: Number(entry.percentage ?? record.percentage ?? 0),
      });

      if (!bucket.academicYear && entry.academicYear) {
        bucket.academicYear = entry.academicYear;
      }

      groupedBySemester.set(key, bucket);
    });
  });

  return [...groupedBySemester.values()]
    .sort((left, right) => left.semesterNumber - right.semesterNumber)
    .map(({ semesterNumber, ...semester }) => semester);
}

function StatTile({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
  const iconTone =
    tone === 'warning'
      ? 'student-stat-icon student-stat-icon--warning'
      : tone === 'success'
        ? 'student-stat-icon student-stat-icon--success'
        : tone === 'info'
          ? 'student-stat-icon student-stat-icon--info'
          : 'student-stat-icon student-stat-icon--brand';

  const progressTone =
    tone === 'warning'
      ? 'student-progress-fill student-progress-fill--warning'
      : tone === 'success'
        ? 'student-progress-fill student-progress-fill--success'
        : 'student-progress-fill student-progress-fill--brand';

  return (
    <div className="student-stat-card">
      <div className="student-stat-content space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className={iconTone}>
            <Icon size={19} />
          </div>
          <span className="student-glow-badge badge badge-info">{label}</span>
        </div>
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(10, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

function SubjectRow({ subject }) {
  const tone = getAttendanceTone(subject.attendance);

  return (
    <div className="student-shell-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content-primary sm:text-base">{subject.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-content-muted">
            {subject.code || 'Attendance record'}
          </p>
        </div>
        <span className={`badge student-glow-badge ${tone.badgeClassName}`}>
          {formatNumber(subject.attendance)}%
        </span>
      </div>

      <div className="mt-4">
        <div className="student-progress-track">
          <div
            className={tone.progressClassName}
            style={{ width: `${Math.max(8, Math.min(100, Number(subject.attendance || 0)))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SemesterAttendanceCard({ semester }) {
  const subjects = Array.isArray(semester.subjects) ? semester.subjects : [];
  const averageAttendance = subjects.length
    ? subjects.reduce((sum, subject) => sum + Number(subject.attendance || 0), 0) / subjects.length
    : 0;
  const tone = getAttendanceTone(averageAttendance);

  return (
    <article className="student-list-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="metric-label">{semester.academicYear || 'Semester Attendance'}</p>
          <h4 className="mt-2 text-xl font-semibold text-content-primary">{semester.semester}</h4>
          <p className="mt-2 text-sm text-content-secondary">
            {subjects.length} subjects tracked for this semester.
          </p>
        </div>
        <div className={`${tone.iconClassName} h-12 w-12`}>
          <GraduationCap size={18} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="metric-label">Average Attendance</p>
          <p className="mt-2 text-lg font-semibold text-content-primary">{formatNumber(averageAttendance)}%</p>
        </div>
        <span className={`badge student-glow-badge ${tone.badgeClassName}`}>
          {subjects.length ? 'Active semester' : 'No records'}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {subjects.length === 0 ? (
          <div className="empty-state min-h-[10rem]">No data available for this semester.</div>
        ) : (
          subjects.map((subject) => (
            <SubjectRow key={`${semester.semester}-${subject.code || subject.name}`} subject={subject} />
          ))
        )}
      </div>
    </article>
  );
}

function SemesterAttendanceEmptyState() {
  return (
    <div className="empty-state min-h-[16rem]">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="student-stat-icon student-stat-icon--brand h-14 w-14">
          <BookOpenCheck size={22} />
        </div>
        <div>
          <p className="text-base font-semibold text-content-primary">No semester-wise attendance data available</p>
          <p className="mt-2 text-sm leading-6 text-content-muted">
            Subject attendance will appear here semester by semester once the latest records are published.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceAnalytics({
  data,
  loading,
  showHeader = true,
  preview = false,
}) {
  const overall = preview
    ? {
      percentage: 79.67,
      attendedClasses: 1910,
      totalClasses: 2397,
    }
    : (data?.overall || {});

  const semesterWiseAttendance = useMemo(
    () => buildSemesterWiseAttendance(data, preview),
    [data, preview]
  );

  const totalSubjects = semesterWiseAttendance.reduce(
    (sum, semester) => sum + (semester.subjects?.length || 0),
    0
  );

  return (
    <section className="student-shell flex h-full flex-col gap-6 p-6 sm:p-7">
      {showHeader ? (
        <div className="section-header">
          <div>
            <p className="eyebrow">Attendance Analytics</p>
            <h3 className="mt-1 text-2xl font-semibold text-content-primary">Semester-wise subject attendance</h3>
            <p className="section-subtitle mt-2 max-w-2xl">
              Review subject attendance semester by semester in a cleaner dashboard layout with progress visibility for every course.
            </p>
          </div>
          <div className="badge student-glow-badge badge-info">
            {semesterWiseAttendance.length} semesters tracked
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <StatTile
          label="Overall Attendance"
          value={loading ? '--' : `${formatNumber(overall.percentage)}%`}
          note="Average attendance across the published records"
          icon={BarChart3}
          tone="info"
          progress={overall.percentage}
        />
        <StatTile
          label="Attended Classes"
          value={loading ? '--' : overall.attendedClasses || 0}
          note={`${overall.totalClasses || 0} total classes recorded`}
          icon={CalendarClock}
          tone="brand"
          progress={overall.totalClasses ? (Number(overall.attendedClasses || 0) / Number(overall.totalClasses || 1)) * 100 : 0}
        />
        <StatTile
          label="Subjects Tracked"
          value={loading ? '--' : totalSubjects}
          note={`${semesterWiseAttendance.length} semester views available`}
          icon={Sparkles}
          tone="success"
          progress={semesterWiseAttendance.length ? Math.min(100, totalSubjects * 8) : 10}
        />
      </div>

      <div className="student-shell-muted p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="metric-label">Semester-wise Subject Attendance</p>
            <p className="mt-2 text-sm text-content-secondary">
              Each semester lists subjects, attendance percentage, and a color-coded progress bar for quick review.
            </p>
          </div>
          <div className="student-stat-icon student-stat-icon--brand h-10 w-10">
            <BookOpenCheck size={16} />
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="skeleton h-[24rem] rounded-[28px]" />
              <div className="skeleton h-[24rem] rounded-[28px]" />
            </div>
          ) : semesterWiseAttendance.length === 0 ? (
            <SemesterAttendanceEmptyState />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              {semesterWiseAttendance.map((semester) => (
                <SemesterAttendanceCard key={semester.semester} semester={semester} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
