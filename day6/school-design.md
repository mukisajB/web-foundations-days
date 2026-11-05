# School Database Design

## Tables

### students
- Holds one row per student: `student_id` (primary key), `name` and `email`.
- `name` and `email` are `NOT NULL`, and `email` is `UNIQUE` so two students cannot share an address.

### courses
- Holds one row per course: `course_id` (primary key), `title` and `credits`.
- A course exists whether or not anyone is enrolled on it.

### enrolments
- Holds one row per enrolment, meaning the fact that one student is on one course.
- Columns: `enrolment_id` (primary key), `student_id` and `course_id` (both foreign keys, both `NOT NULL`), and `grade`.
- `grade` can be `NULL` because a grade is not known when a student first enrols.
- `UNIQUE (student_id, course_id)` stops the same student enrolling on the same course twice.

## Relationships

- **students to enrolments: one-to-many.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses to enrolments: one-to-many.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **students to courses: many-to-many.** A student can take many courses, and a course has many students.

A relational table cannot store a many-to-many relationship directly. Putting a list of course ids inside a student row would break the one-value-per-column rule and make queries and updates messy. The `enrolments` join table solves this by turning the many-to-many relationship into two one-to-many relationships. It is also the natural place for data that belongs to the pairing itself, such as the grade, which is not a property of the student alone or the course alone.

## Index

I would add an index on `enrolments (course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

The `UNIQUE (student_id, course_id)` constraint already creates an index that helps lookups by student. Nothing helps lookups that start from the course, such as "all students on one course" or "number of students per course". Without this index, SQLite has to scan the whole enrolments table for those queries, which gets slow as the table grows to thousands of rows.

## SQL or NoSQL?

I would choose SQL for this system. The data is structured and has clear relationships between students, courses and enrolments, and the rules matter: emails must be unique, a student cannot enrol twice, and an enrolment must point to a real student and a real course. A relational database enforces these rules itself through keys and constraints, so bad data is rejected at the database level instead of relying on application code. Questions like "which students have no enrolments" or "how many students are on each course" are also natural in SQL with joins and `GROUP BY`. A NoSQL document database could suit data with a flexible or changing shape, or very large scale with simple lookups, but a school's records are small, consistent and heavily related, so SQL is the better fit.