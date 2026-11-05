-- Day 6: school database (SQLite)
PRAGMA foreign_keys = ON;

-- ---------- Tables ----------

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    title     TEXT NOT NULL,
    credits   INTEGER NOT NULL
);

CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY,
    student_id   INTEGER NOT NULL,
    course_id    INTEGER NOT NULL,
    grade        TEXT,  -- stays NULL until a grade is given
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id),
    UNIQUE (student_id, course_id)  -- same student cannot enrol on the same course twice
);

-- ---------- Sample data ----------

INSERT INTO students (student_id, name, email) VALUES
    (1, 'Amina Okello',  'amina@example.com'),
    (2, 'Brian Mugisha', 'brian@example.com'),
    (3, 'Clara Nakato',  'clara@example.com'),
    (4, 'David Ssemwogerere', 'david@example.com');

INSERT INTO courses (course_id, title, credits) VALUES
    (1, 'Databases',        4),
    (2, 'Web Development',  3),
    (3, 'Mathematics',      3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'B'),
    (1, 2, 'A'),
    (2, 1, 'C'),
    (3, 1, NULL),
    (3, 3, 'B');

-- ---------- Queries ----------

-- 1. All courses for one student (by name)
SELECT c.title, e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.student_id
JOIN courses c    ON c.course_id  = e.course_id
WHERE s.name = 'Amina Okello';

-- 2. All students on one course
SELECT s.name, s.email
FROM courses c
JOIN enrolments e ON e.course_id  = c.course_id
JOIN students s   ON s.student_id = e.student_id
WHERE c.title = 'Databases';

-- 3. Number of students per course (courses with none show 0)
SELECT c.title, COUNT(e.enrolment_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.course_id
GROUP BY c.course_id, c.title;

-- 4. Students who have no enrolments
SELECT s.name, s.email
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- 5. Update one enrolment's grade (Clara's Databases grade)
UPDATE enrolments
SET grade = 'A'
WHERE student_id = (SELECT student_id FROM students WHERE name = 'Clara Nakato')
  AND course_id  = (SELECT course_id  FROM courses  WHERE title = 'Databases');

-- Check the update
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON s.student_id = e.student_id
JOIN courses c  ON c.course_id  = e.course_id
WHERE s.name = 'Clara Nakato';