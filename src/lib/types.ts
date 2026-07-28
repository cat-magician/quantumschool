export interface Instructor {
  id: string;
  name: string;
  title: string;
  bio: string;
  image_url: string;
  specialization: string;
  specializations: string[];
  role: 'lecturer' | 'seminar';
  sort_order: number;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  image_url: string;
  instructor_id: string;
  features: string[];
  created_at: string;
  is_active: boolean;
  instructor?: Instructor;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar_url: string;
  rating: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  grade?: string;
  course_id?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  privacy_consent: boolean;
  privacy_consent_at?: string;
  privacy_policy_version?: string;
  parental_confirm: boolean;
  created_at: string;
}

export type UserRole = 'superadmin' | 'admin' | 'student';
export type StageStatus = 'pending' | 'submitted' | 'passed' | 'failed';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string;
  enrolled_course_id: string | null;
  bio: string;
  role: UserRole;
  is_enrolled: boolean;
  stage1_status: StageStatus;
  stage2_status: StageStatus;
  stage1_score: number | null;
  stage2_score: number | null;
  email: string | null;
  privacy_consent_at: string | null;
  privacy_policy_version: string | null;
  teacher_application?: boolean;
  teacher_application_rejected?: boolean;
  stage1_submitted_at?: string | null;
  stage2_submitted_at?: string | null;
  stage1_viewed_at?: string | null;
  stage2_viewed_at?: string | null;
  questionnaire_submitted_at?: string | null;
  selection_rejected?: boolean;
  city?: string | null;
  school?: string | null;
  grade?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupTeacher {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  group_type: 'enrolled' | 'teacher';
  teacher_id: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  event_type: 'lesson' | 'webinar' | 'homework' | 'exam' | 'consultation';
  status: 'upcoming' | 'completed' | 'missed' | 'cancelled';
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  created_at: string;
}

export type ScheduleEventType = 'lecture' | 'seminar' | 'webinar' | 'homework' | 'exam' | 'consultation';

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  event_type: ScheduleEventType;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  group?: Pick<Group, 'id' | 'name'> | null;
}

export type HomeworkSubmissionStatus = 'draft' | 'submitted' | 'graded';

export interface HomeworkAssignment {
  id: string;
  title: string;
  lesson_summary: string;
  materials: string;
  tasks: string;
  external_url: string;
  due_at: string | null;
  schedule_event_id: string | null;
  group_id: string | null;
  created_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  schedule_event?: Pick<ScheduleEvent, 'id' | 'title' | 'scheduled_at'> | null;
  group?: Pick<Group, 'id' | 'name'> | null;
}

export interface HomeworkSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  answer_text: string;
  status: HomeworkSubmissionStatus;
  score: number | null;
  feedback: string;
  graded_by: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  assignment?: HomeworkAssignment;
  student?: Pick<UserProfile, 'id' | 'display_name' | 'email' | 'avatar_url'>;
}

export interface CourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  module_title: string;
  module_index: number;
  completed: boolean;
  score: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
}

export interface SelectionStageConfig {
  id: number;
  essay_form_id: string;
  essay_published: boolean;
  questionnaire_form_id: string;
  questionnaire_published: boolean;
  contest_url: string;
  contest_published: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface LandingConfig {
  id: number;
  hero_badge_text: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface CommunityConfig {
  id: number;
  telegram_invite_url: string;
  telegram_invite_message: string;
  updated_at: string | null;
  updated_by: string | null;
}

export type LessonPageType = 'lecture' | 'seminar';

export type LessonBlockType = 'recording' | 'text' | 'materials' | 'homework_link';

export type LessonBlockContent = {
  url?: string;
  body?: string;
  label?: string;
  pdf_url?: string;
  pdf_title?: string;
};

export interface LessonPageBlock {
  id: string;
  page_id: string;
  block_type: LessonBlockType;
  sort_order: number;
  content: LessonBlockContent;
  created_at: string;
}

export interface LessonPage {
  id: string;
  title: string;
  lesson_type: LessonPageType;
  lesson_date: string;
  cover_url: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  blocks?: LessonPageBlock[];
}

export type HomeworkBlockType = 'text' | 'image' | 'video' | 'yandex_form' | 'contest';

export type HomeworkBlockContent = {
  body?: string;
  url?: string;
  caption?: string;
  form_id?: string;
};

export interface HomeworkPageBlock {
  id: string;
  page_id: string;
  block_type: HomeworkBlockType;
  sort_order: number;
  content: HomeworkBlockContent;
  created_at: string;
}

export interface HomeworkPage {
  id: string;
  title: string;
  due_at: string | null;
  max_score: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  blocks?: HomeworkPageBlock[];
}

export interface HomeworkPageSubmission {
  id: string;
  page_id: string;
  user_id: string;
  answer_text: string;
  status: HomeworkSubmissionStatus;
  score: number | null;
  feedback: string;
  graded_by: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  page?: Pick<HomeworkPage, 'id' | 'title' | 'max_score'>;
  student?: Pick<UserProfile, 'id' | 'display_name' | 'email' | 'avatar_url'>;
}
