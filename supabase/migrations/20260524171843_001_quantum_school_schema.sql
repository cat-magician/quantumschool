/*
  # Quantum School Database Schema

  1. New Tables
    - `courses` - Stores course information for quantum technology programs
      - `id` (uuid, primary key)
      - `title` (text) - Course name
      - `description` (text) - Course description
      - `duration` (text) - Course duration (e.g., "8 weeks")
      - `level` (text) - Difficulty level (Beginner, Intermediate, Advanced)
      - `price` (decimal) - Course price
      - `image_url` (text) - Course cover image from Pexels
      - `instructor_id` (uuid, foreign key) - Reference to instructor
      - `features` (jsonb) - List of course features
      - `created_at` (timestamp)
      - `is_active` (boolean) - Whether course is available
    
    - `instructors` - Stores instructor information
      - `id` (uuid, primary key)
      - `name` (text) - Instructor name
      - `title` (text) - Professional title
      - `bio` (text) - Short biography
      - `image_url` (text) - Profile photo from Pexels
      - `specialization` (text) - Area of expertise
      - `created_at` (timestamp)
    
    - `testimonials` - Stores student testimonials
      - `id` (uuid, primary key)
      - `name` (text) - Student name
      - `role` (text) - Student role/background
      - `content` (text) - Testimonial text
      - `avatar_url` (text) - Student photo from Pexels
      - `rating` (integer) - Star rating (1-5)
      - `created_at` (timestamp)
    
    - `enrollments` - Stores course enrollment requests
      - `id` (uuid, primary key)
      - `name` (text) - Student name
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `course_id` (uuid, foreign key) - Reference to course
      - `message` (text) - Optional message
      - `status` (text) - Enrollment status (pending, approved, rejected)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Public read access for courses, instructors, testimonials
    - Public insert access for enrollments (registration form)
    - No update/delete policies for public access

  3. Important Notes
    - All tables use UUID primary keys
    - Timestamps track creation time
    - RLS policies allow public access to display data
    - Enrollment submissions are public, status management requires authentication
*/

-- Create instructors table
CREATE TABLE IF NOT EXISTS instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  bio text NOT NULL,
  image_url text NOT NULL,
  specialization text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL,
  level text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  avatar_url text NOT NULL,
  rating integer DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructors (public read only)
CREATE POLICY "Public can view instructors"
  ON instructors FOR SELECT
  TO public
  USING (true);

-- RLS Policies for courses (public read only for active courses)
CREATE POLICY "Public can view active courses"
  ON courses FOR SELECT
  TO public
  USING (is_active = true);

-- RLS Policies for testimonials (public read only)
CREATE POLICY "Public can view testimonials"
  ON testimonials FOR SELECT
  TO public
  USING (true);

-- RLS Policies for enrollments (public insert, no read/update/delete for public)
CREATE POLICY "Public can submit enrollments"
  ON enrollments FOR INSERT
  TO public
  WITH CHECK (true);

-- Преподавателей и контент главной добавляют через админку (SiteContentTab), не через schema.sql.
