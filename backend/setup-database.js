// setup-database.js
const { Client } = require("pg")
require("dotenv").config()

async function setupDatabase() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: "postgres", // Connect to default database first
  })

  try {
    await client.connect()
    console.log("✅ Connected to PostgreSQL")

    // Check if database exists
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'reporting_app'")

    if (dbCheck.rows.length === 0) {
      console.log("📦 Creating database...")
      await client.query("CREATE DATABASE reporting_app")
      console.log("✅ Database created")
    } else {
      console.log("✅ Database already exists")
    }

    await client.end()

    // Now connect to the new database and create tables
    const dbClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      database: "reporting_app",
    })

    await dbClient.connect()
    console.log("✅ Connected to reporting_app database")

    // Create tables
    console.log("📊 Creating tables...")

    await dbClient.query(`
      -- Roles
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `)

    await dbClient.query(`
      -- Faculties
      CREATE TABLE IF NOT EXISTS faculties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      );
    `)

    await dbClient.query(`
      -- Programs
      CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY,
        faculty_id INT REFERENCES faculties(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL
      );
    `)

    await dbClient.query(`
      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_id INT REFERENCES roles(id),
        faculty_id INT REFERENCES faculties(id),
        program_id INT REFERENCES programs(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Modules
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        module_name VARCHAR(200) NOT NULL,
        program_id INT REFERENCES programs(id),
        faculty_id INT REFERENCES faculties(id),
        total_registered_students INT DEFAULT 0,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Lecture Reports
      CREATE TABLE IF NOT EXISTS lecture_reports (
        id SERIAL PRIMARY KEY,
        faculty_id INT NOT NULL REFERENCES faculties(id),
        module_id INT NOT NULL REFERENCES modules(id),
        program_id INT NOT NULL REFERENCES programs(id),
        week_of_reporting VARCHAR(50) NOT NULL,
        date_of_lecture DATE NOT NULL,
        lecturer_id INT NOT NULL REFERENCES users(id),
        actual_students_present INT NOT NULL,
        total_registered_students INT NOT NULL,
        venue VARCHAR(100) NOT NULL,
        scheduled_time VARCHAR(50) NOT NULL,
        topic_taught TEXT NOT NULL,
        learning_outcomes TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        principal_feedback TEXT,
        status VARCHAR(50) DEFAULT 'submitted',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Ratings (for lecture reports)
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        report_id INT REFERENCES lecture_reports(id),
        rated_by INT REFERENCES users(id),
        rating INT CHECK (rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Lecture Assignments
      CREATE TABLE IF NOT EXISTS lecture_assignments (
        id SERIAL PRIMARY KEY,
        module_id INT NOT NULL REFERENCES modules(id),
        program_id INT NOT NULL REFERENCES programs(id),
        lecturer_id INT NOT NULL REFERENCES users(id),
        assigned_by INT NOT NULL REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Challenges (Lecturer challenges)
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        lecturer_id INT NOT NULL REFERENCES users(id),
        module_id INT NOT NULL REFERENCES modules(id),
        program_id INT NOT NULL REFERENCES programs(id),
        faculty_id INT REFERENCES faculties(id),
        challenge_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        proposed_solution TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        admin_feedback TEXT,
        submitted_date DATE NOT NULL,
        resolved_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // NEW TABLES FOR STUDENT FUNCTIONALITY
    await dbClient.query(`
      -- Student Challenges
      CREATE TABLE IF NOT EXISTS student_challenges (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id),
        module_id INT NOT NULL REFERENCES modules(id),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
        feedback TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await dbClient.query(`
      -- Module Ratings (Student ratings for modules)
      CREATE TABLE IF NOT EXISTS module_ratings (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id),
        module_id INT NOT NULL REFERENCES modules(id),
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, module_id) -- One rating per student per module
      );
    `)

    console.log("✅ Tables created")

    // Seed data
    console.log("🌱 Seeding data...")

    // Insert roles
    await dbClient.query(`
      INSERT INTO roles (name) VALUES 
      ('Lecturer'), ('Program Leader'), ('Principal Lecturer'), ('Student')
      ON CONFLICT (name) DO NOTHING;
    `)

    // Insert faculties
    await dbClient.query(`
      INSERT INTO faculties (name) VALUES 
      ('Business'), ('Computer'), ('Design'), ('Tourism')
      ON CONFLICT (name) DO NOTHING;
    `)

    // Insert programs
    await dbClient.query(`
      INSERT INTO programs (faculty_id, name) VALUES
      (2, 'Software Engineering'), (2, 'BSc in IT'), (2, 'IT'),
      (3, 'Graphics Design'), (3, 'Architecture'),
      (1, 'International Business'), (1, 'Business Management'),
      (4, 'Hotel Management'), (4, 'Tourism Management')
      ON CONFLICT DO NOTHING;
    `)

    // Create default users with hashed passwords (password: 'password')
    const defaultPassword = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"

    await dbClient.query(
      `
      INSERT INTO users (name, email, password, role_id, faculty_id, program_id) 
      VALUES 
        ('John Lecturer', 'lecturer@luct.com', $1, 1, 2, 1),
        ('Alice Program Leader', 'programleader@luct.com', $1, 2, 2, 1),
        ('Bob Principal Lecturer', 'principal@luct.com', $1, 3, 2, 1),
        ('Student One', 'student@luct.com', $1, 4, 2, 1)
      ON CONFLICT (email) DO NOTHING;
    `,
      [defaultPassword],
    )

    // Insert some sample modules
    await dbClient.query(`
      INSERT INTO modules (module_name, program_id, faculty_id, total_registered_students, created_by) 
      VALUES 
        ('Introduction to Programming', 1, 2, 45, 1),
        ('Database Systems', 1, 2, 40, 1),
        ('Web Development', 1, 2, 35, 1),
        ('Software Engineering Principles', 1, 2, 30, 1)
      ON CONFLICT DO NOTHING;
    `)

    console.log("✅ Data seeded")

    await dbClient.end()
    console.log("🎉 Database setup completed successfully!")
  } catch (error) {
    console.error("❌ Setup error:", error.message)
  }
}

setupDatabase()
