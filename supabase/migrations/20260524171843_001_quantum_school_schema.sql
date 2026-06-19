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

-- Insert sample instructors
INSERT INTO instructors (name, title, bio, image_url, specialization) VALUES
  ('Dr. Елена Волкова', 'Профессор квантовой физики', 
   'Ведущий исследователь в области квантовых вычислений с 15-летним опытом. Автор более 50 научных публикаций.',
   'https://images.pexels.com/photos/3769045/pexels-photo-3769045.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовые алгоритмы'),
  ('Dr. Андрей Стрельцов', 'Старший научный сотрудник', 
   'Специалист по квантовой криптографии и квантовой коммуникации. Работал в ведущих лабораториях мира.',
   'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовая криптография'),
  ('Dr. Мария Петрова', 'PhD по квантовой информатике', 
   'Эксперт по квантовой оптике и квантовым сетям. Разработчик образовательных программ нового поколения.',
   'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовые сети');

-- Insert sample courses
INSERT INTO courses (title, description, duration, level, price, image_url, instructor_id, features) VALUES
  ('Основы квантовых вычислений', 
   'Введение в мир квантовых вычислений. Изучите основы кубитов, квантовых вентилей и принципов суперпозиции.',
   '8 недель', 'Beginner', 29990.00,
   'https://images.pexels.com/photos/838944/pexels-photo-838944.jpeg?auto=compress&cs=tinysrgb&w=800',
   (SELECT id FROM instructors WHERE name = 'Dr. Елена Волкова'),
   '["Теория квантовых битов", "Практика на квантовых симуляторах", "Введение в Qiskit", "Базовые квантовые алгоритмы"]'::jsonb),
  
  ('Квантовая криптография', 
   'Погружение в методы защиты информации с использованием квантовых технологий. Практические навыки QKD.',
   '10 недель', 'Intermediate', 44990.00,
   'https://images.pexels.com/photos/6050437/pexels-photo-6050437.jpeg?auto=compress&cs=tinysrgb&w=800',
   (SELECT id FROM instructors WHERE name = 'Dr. Андрей Стрельцов'),
   '["Протоколы QKD", "Квантовая случайность", "Практические лаборатории", "Анализ безопасности"]'::jsonb),
  
  ('Квантовые алгоритмы и приложения', 
   'Продвинутый курс по разработке и оптимизации квантовых алгоритмов для реальных задач бизнеса.',
   '12 недель', 'Advanced', 59990.00,
   'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800',
   (SELECT id FROM instructors WHERE name = 'Dr. Елена Волкова'),
   '["Алгоритм Шора", "Алгоритм Гровера", "Оптимизация портфелей", "Квантовое машинное обучение"]'::jsonb),
  
  ('Квантовые сети будущего', 
   'Изучение архитектуры и принципов построения квантовых сетей. Подготовка к эре квантового интернета.',
   '6 недель', 'Intermediate', 34990.00,
   'https://images.pexels.com/photos/1145434/pexels-photo-1145434.jpeg?auto=compress&cs=tinysrgb&w=800',
   (SELECT id FROM instructors WHERE name = 'Dr. Мария Петрова'),
   '["Квантовые повторители", "Распределенные системы", "QKD сети", "Протоколы маршрутизации"]'::jsonb);

-- Insert sample testimonials
INSERT INTO testimonials (name, role, content, avatar_url, rating) VALUES
  ('Алексей Козлов', 'Разработчик, Яндекс', 
   'Курс по квантовым вычислениям полностью изменил мой подход к решению сложных задач. Теперь я вижу потенциал квантовых технологий в нашей индустрии.',
   'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
   5),
  ('Анна Соколова', 'Data Scientist, Сбербанк', 
   'Превосходная программа! Полученные знания помогают мне разрабатывать новые решения для финансового сектора с использованием квантовых алгоритмов.',
   'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
   5),
  ('Дмитрий Николаев', 'Криптоаналитик, Касперский', 
   'Курс по квантовой криптографии дал уникальные практические навыки. Теперь я готов к постквантовой эре информационной безопасности.',
   'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
   5),
  ('Елена Морозова', 'PhD студент, МГУ', 
   'Отличная теоретическая база и практические задания помогли мне в моей диссертационной работе по квантовой информатике.',
   'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
   5);
