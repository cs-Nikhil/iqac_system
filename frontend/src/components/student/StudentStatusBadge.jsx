export default function StudentStatusBadge({ label = 'Active student', className = 'badge-success' }) {
  return <span className={`badge student-glow-badge ${className}`}>{label}</span>;
}
