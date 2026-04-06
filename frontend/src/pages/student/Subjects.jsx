import SubjectsPerformance from '../../components/student/SubjectsPerformance';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

export default function Subjects() {
  const { profile, loadingProfile } = useStudentWorkspace();

  return (
    <div className="page-transition">
      <SubjectsPerformance
        currentSemester={profile?.currentSemester}
        loading={loadingProfile}
      />
    </div>
  );
}
