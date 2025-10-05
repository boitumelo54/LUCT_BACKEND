// backend/server-sqlite.js
const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const bodyParser = require("body-parser")
const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const app = express()
app.use(cors())
app.use(bodyParser.json())

// SQLite database setup
const dbPath = path.join(__dirname, "database.sqlite")
const db = new sqlite3.Database(dbPath)

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON")

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS faculties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `)

    // Updated programs table with program_code
    db.run(`
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_code TEXT UNIQUE NOT NULL,
        program_name TEXT NOT NULL,
        faculty_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role_id INTEGER,
        faculty_id INTEGER,
        program_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (faculty_id) REFERENCES faculties(id),
        FOREIGN KEY (program_id) REFERENCES programs(id)
      )
    `)

    // Updated: classes table renamed to modules
    db.run(`
      CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        program_id INTEGER,
        faculty_id INTEGER,
        total_registered_students INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (program_id) REFERENCES programs(id),
        FOREIGN KEY (faculty_id) REFERENCES faculties(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    // Updated: class_assignments table renamed to lecture_assignments
    db.run(`
      CREATE TABLE IF NOT EXISTS lecture_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        program_id INTEGER NOT NULL,
        lecturer_id INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES modules(id),
        FOREIGN KEY (program_id) REFERENCES programs(id),
        FOREIGN KEY (lecturer_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )
    `)

    // Updated lecture_reports table to use module_id and program_id
    db.run(`
      CREATE TABLE IF NOT EXISTS lecture_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        faculty_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        program_id INTEGER NOT NULL,
        week_of_reporting TEXT NOT NULL,
        date_of_lecture DATE NOT NULL,
        lecturer_id INTEGER NOT NULL,
        actual_students_present INTEGER NOT NULL,
        total_registered_students INTEGER NOT NULL,
        venue TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        topic_taught TEXT NOT NULL,
        learning_outcomes TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        student_name TEXT,
        student_number TEXT,
        principal_feedback TEXT,
        status TEXT DEFAULT 'submitted',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id),
        FOREIGN KEY (module_id) REFERENCES modules(id),
        FOREIGN KEY (program_id) REFERENCES programs(id),
        FOREIGN KEY (lecturer_id) REFERENCES users(id)
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER,
        rated_by INTEGER,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES lecture_reports(id),
        FOREIGN KEY (rated_by) REFERENCES users(id)
      )
    `)

    // Challenges table
    db.run(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lecturer_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        program_id INTEGER NOT NULL,
        faculty_id INTEGER,
        challenge_type TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        proposed_solution TEXT,
        status TEXT DEFAULT 'pending',
        admin_feedback TEXT,
        submitted_date DATE NOT NULL,
        resolved_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lecturer_id) REFERENCES users(id),
        FOREIGN KEY (module_id) REFERENCES modules(id),
        FOREIGN KEY (program_id) REFERENCES programs(id),
        FOREIGN KEY (faculty_id) REFERENCES faculties(id)
      )
    `)

    // Student challenges table
    db.run(`
      CREATE TABLE IF NOT EXISTS student_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (module_id) REFERENCES modules(id)
      )
    `)

    // Module ratings table
    db.run(`
      CREATE TABLE IF NOT EXISTS module_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (module_id) REFERENCES modules(id),
        UNIQUE(student_id, module_id)
      )
    `)

    // Seed data - use separate INSERT statements to avoid issues
    // Roles
    db.run(`INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'Lecturer')`)
    db.run(`INSERT OR IGNORE INTO roles (id, name) VALUES (2, 'Program Leader')`)
    db.run(`INSERT OR IGNORE INTO roles (id, name) VALUES (3, 'Principal Lecturer')`)
    db.run(`INSERT OR IGNORE INTO roles (id, name) VALUES (4, 'Student')`)

    // Faculties
    db.run(`INSERT OR IGNORE INTO faculties (id, name) VALUES (1, 'Business')`)
    db.run(`INSERT OR IGNORE INTO faculties (id, name) VALUES (2, 'Computer')`)
    db.run(`INSERT OR IGNORE INTO faculties (id, name) VALUES (3, 'Design')`)
    db.run(`INSERT OR IGNORE INTO faculties (id, name) VALUES (4, 'Tourism')`)

    // Updated programs with program_code
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (1, 'SE101', 'Software Engineering', 2)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (2, 'BIT102', 'BSc in IT', 2)`,
    )
    db.run(`INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (3, 'IT103', 'IT', 2)`)
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (4, 'GD201', 'Graphics Design', 3)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (5, 'ARCH202', 'Architecture', 3)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (6, 'IB301', 'International Business', 1)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (7, 'BM302', 'Business Management', 1)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (8, 'HM401', 'Hotel Management', 4)`,
    )
    db.run(
      `INSERT OR IGNORE INTO programs (id, program_code, program_name, faculty_id) VALUES (9, 'TM402', 'Tourism Management', 4)`,
    )

    // Create default users with hashed passwords
    const defaultPassword = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" // 'password'

    db.run(
      `
      INSERT OR IGNORE INTO users (name, email, password, role_id, faculty_id, program_id) 
      SELECT 'John Lecturer', 'lecturer@luct.com', ?, 1, 2, 1
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'lecturer@luct.com')
    `,
      [defaultPassword],
    )

    db.run(
      `
      INSERT OR IGNORE INTO users (name, email, password, role_id, faculty_id, program_id) 
      SELECT 'Alice Program Leader', 'programleader@luct.com', ?, 2, 2, 1
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'programleader@luct.com')
    `,
      [defaultPassword],
    )

    db.run(
      `
      INSERT OR IGNORE INTO users (name, email, password, role_id, faculty_id, program_id) 
      SELECT 'Bob Principal Lecturer', 'principal@luct.com', ?, 3, 2, 1
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'principal@luct.com')
    `,
      [defaultPassword],
    )

    db.run(
      `
      INSERT OR IGNORE INTO users (name, email, password, role_id, faculty_id, program_id) 
      SELECT 'Student One', 'student@luct.com', ?, 4, 2, 1
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'student@luct.com')
    `,
      [defaultPassword],
    )

    console.log("✅ SQLite database initialized successfully")
  })
}

// Initialize the database
initializeDatabase()

// JWT secret
const SECRET_KEY = "your-secret-key-for-development"

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// ====================== AUTH ======================

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    console.log("📝 Signup request:", req.body)
    const { name, email, password, role_id, faculty_id, program_id } = req.body

    // Validate required fields
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ error: "Name, email, password, and role are required" })
    }

    // Check if user already exists
    db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
      if (err) {
        console.error("❌ Database error:", err)
        return res.status(500).json({ error: "Database error" })
      }

      if (row) {
        return res.status(400).json({ error: "User already exists with this email" })
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10)

        // For students, faculty_id and program_id are required
        if (role_id == 4 && (!faculty_id || !program_id)) {
          return res.status(400).json({ error: "Faculty and Program are required for students" })
        }

        // Insert user - handle null values for non-students
        const query = `
          INSERT INTO users (name, email, password, role_id, faculty_id, program_id) 
          VALUES (?, ?, ?, ?, ?, ?)
        `

        db.run(
          query,
          [
            name,
            email,
            hashedPassword,
            Number.parseInt(role_id),
            faculty_id ? Number.parseInt(faculty_id) : null,
            program_id ? Number.parseInt(program_id) : null,
          ],
          function (err) {
            if (err) {
              console.error("❌ Insert user error:", err)
              console.error("❌ Error details:", err.message)
              return res.status(500).json({ error: "Registration failed: " + err.message })
            }

            console.log("✅ User registered with ID:", this.lastID)

            // Get role name for response
            db.get("SELECT name FROM roles WHERE id = ?", [Number.parseInt(role_id)], (err, roleRow) => {
              if (err) {
                console.error("❌ Get role error:", err)
                // Still return success but without role name
                return res.json({
                  success: true,
                  user: {
                    id: this.lastID,
                    name,
                    email,
                    role: "Unknown",
                    role_id: Number.parseInt(role_id),
                    faculty_id: faculty_id ? Number.parseInt(faculty_id) : null,
                    program_id: program_id ? Number.parseInt(program_id) : null,
                  },
                  message: "Registration successful",
                })
              }

              res.json({
                success: true,
                user: {
                  id: this.lastID,
                  name,
                  email,
                  role: roleRow.name,
                  role_id: Number.parseInt(role_id),
                  faculty_id: faculty_id ? Number.parseInt(faculty_id) : null,
                  program_id: program_id ? Number.parseInt(program_id) : null,
                },
                message: "Registration successful",
              })
            })
          },
        )
      } catch (error) {
        console.error("❌ Password hash error:", error)
        res.status(500).json({ error: "Registration failed" })
      }
    })
  } catch (error) {
    console.error("❌ Signup error:", error.message)
    res.status(500).json({ error: "Signup failed: " + error.message })
  }
})

// Login
app.post("/api/login", async (req, res) => {
  try {
    console.log("🔐 Login request:", req.body)
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    db.get(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email],
      async (err, user) => {
        if (err) {
          console.error("❌ Database error:", err)
          return res.status(500).json({ error: "Database error" })
        }

        if (!user) {
          return res.status(400).json({ error: "User not found" })
        }

        try {
          const isValid = await bcrypt.compare(password, user.password)

          if (!isValid) {
            return res.status(401).json({ error: "Invalid password" })
          }

          const token = jwt.sign({ id: user.id, role: user.role_name }, SECRET_KEY, { expiresIn: "1h" })

          console.log("✅ User logged in:", user.email)
          res.json({
            success: true,
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role_name,
              faculty_id: user.faculty_id,
              program_id: user.program_id,
            },
          })
        } catch (error) {
          console.error("❌ Password compare error:", error)
          res.status(500).json({ error: "Login failed" })
        }
      },
    )
  } catch (error) {
    console.error("❌ Login error:", error.message)
    res.status(500).json({ error: "Login failed" })
  }
})

// Middleware: Verify token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "No token provided" })
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error("❌ Token verification error:", err)
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// ====================== FACULTIES ======================

// Get all faculties
app.get("/api/faculties", (req, res) => {
  try {
    console.log("📚 Fetching faculties...")
    db.all("SELECT * FROM faculties ORDER BY name", (err, rows) => {
      if (err) {
        console.error("❌ Get faculties error:", err)
        return res.status(500).json({ error: "Failed to fetch faculties" })
      }
      console.log("✅ Faculties found:", rows.length)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get faculties error:", error.message)
    res.status(500).json({ error: "Failed to fetch faculties" })
  }
})

// ====================== PROGRAMS ======================

// Get all programs
app.get("/api/programs", (req, res) => {
  try {
    console.log("📚 Fetching all programs...")
    const query = `
      SELECT p.*, f.name as faculty_name, u.name as created_by_name
      FROM programs p
      LEFT JOIN faculties f ON p.faculty_id = f.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.program_name
    `

    db.all(query, (err, rows) => {
      if (err) {
        console.error("❌ Get programs error:", err)
        return res.status(500).json({ error: "Failed to fetch programs" })
      }
      console.log("✅ Programs found:", rows.length)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get programs error:", error.message)
    res.status(500).json({ error: "Failed to fetch programs" })
  }
})

// Get programs by faculty
app.get("/api/programs/:facultyId", (req, res) => {
  try {
    const { facultyId } = req.params
    console.log("📖 Fetching programs for faculty:", facultyId)

    if (!facultyId) {
      return res.status(400).json({ error: "Faculty ID is required" })
    }

    db.all(
      `SELECT p.*, f.name as faculty_name 
       FROM programs p 
       LEFT JOIN faculties f ON p.faculty_id = f.id 
       WHERE p.faculty_id = ? 
       ORDER BY p.program_name`,
      [Number.parseInt(facultyId)],
      (err, rows) => {
        if (err) {
          console.error("❌ Get programs error:", err)
          return res.status(500).json({ error: "Failed to fetch programs" })
        }
        console.log("✅ Programs found:", rows.length)
        res.json(rows)
      },
    )
  } catch (error) {
    console.error("❌ Get programs error:", error.message)
    res.status(500).json({ error: "Failed to fetch programs" })
  }
})

// Create new program
app.post("/api/programs", authenticateToken, (req, res) => {
  try {
    const { program_code, program_name, faculty_id } = req.body

    if (!program_code || !program_name) {
      return res.status(400).json({ error: "Program code and name are required" })
    }

    db.run(
      `INSERT INTO programs (program_code, program_name, faculty_id, created_by) 
       VALUES (?, ?, ?, ?)`,
      [program_code, program_name, faculty_id, req.user.id],
      function (err) {
        if (err) {
          console.error("❌ Create program error:", err)
          return res.status(500).json({ error: "Failed to create program: " + err.message })
        }
        res.json({ success: true, id: this.lastID, message: "Program created successfully" })
      },
    )
  } catch (error) {
    console.error("❌ Create program error:", error.message)
    res.status(500).json({ error: "Failed to create program" })
  }
})

// Update program
app.put("/api/programs/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { program_code, program_name, faculty_id } = req.body

    console.log(`📝 Updating program ID: ${id}`, req.body)

    if (!program_code || !program_name) {
      return res.status(400).json({ error: "Program code and name are required" })
    }

    // Check if program exists
    db.get("SELECT id FROM programs WHERE id = ?", [id], (err, program) => {
      if (err) {
        console.error("❌ Check program error:", err)
        return res.status(500).json({ error: "Failed to validate program" })
      }

      if (!program) {
        return res.status(404).json({ error: "Program not found" })
      }

      // Check for duplicate program code
      db.get(
        "SELECT id FROM programs WHERE program_code = ? AND id != ?",
        [program_code, id],
        (err, duplicateProgram) => {
          if (err) {
            console.error("❌ Check duplicate program error:", err)
            return res.status(500).json({ error: "Failed to check for duplicates" })
          }

          if (duplicateProgram) {
            return res.status(400).json({ error: "A program with this code already exists" })
          }

          // Update the program
          db.run(
            `UPDATE programs 
             SET program_code = ?, program_name = ?, faculty_id = ?
             WHERE id = ?`,
            [program_code, program_name, faculty_id, Number.parseInt(id)],
            function (err) {
              if (err) {
                console.error("❌ Update program error:", err)
                return res.status(500).json({ error: "Failed to update program: " + err.message })
              }

              if (this.changes === 0) {
                return res.status(404).json({ error: "Program not found" })
              }

              console.log(`✅ Program updated: ${id}`)
              res.json({ success: true, message: "Program updated successfully" })
            },
          )
        },
      )
    })
  } catch (error) {
    console.error("❌ Update program error:", error.message)
    res.status(500).json({ error: "Failed to update program" })
  }
})

// Delete program
app.delete("/api/programs/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    console.log(`🗑️ Deleting program ID: ${id}`)

    // Check if program exists and has dependencies
    db.get(
      `
      SELECT p.*,
             (SELECT COUNT(*) FROM modules WHERE program_id = ?) as module_count,
             (SELECT COUNT(*) FROM lecture_assignments WHERE program_id = ?) as assignment_count,
             (SELECT COUNT(*) FROM lecture_reports WHERE program_id = ?) as report_count,
             (SELECT COUNT(*) FROM users WHERE program_id = ?) as user_count
      FROM programs p
      WHERE p.id = ?
    `,
      [id, id, id, id, id],
      (err, program) => {
        if (err) {
          console.error("❌ Check program dependencies error:", err)
          return res.status(500).json({ error: "Failed to check program dependencies" })
        }

        if (!program) {
          return res.status(404).json({ error: "Program not found" })
        }

        // Check if program has dependencies
        if (program.module_count > 0 || program.assignment_count > 0 || program.report_count > 0 || program.user_count > 0) {
          return res.status(400).json({
            error: "Cannot delete program. It has existing modules, assignments, reports, or users. Please remove them first.",
          })
        }

        // Delete the program
        db.run("DELETE FROM programs WHERE id = ?", [id], function (err) {
          if (err) {
            console.error("❌ Delete program error:", err)
            return res.status(500).json({ error: "Failed to delete program: " + err.message })
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Program not found" })
          }

          console.log(`✅ Program deleted: ${id}`)
          res.json({ success: true, message: "Program deleted successfully" })
        })
      },
    )
  } catch (error) {
    console.error("❌ Delete program error:", error.message)
    res.status(500).json({ error: "Failed to delete program" })
  }
})

// ====================== MODULES ======================

app.get("/api/modules", authenticateToken, (req, res) => {
  try {
    console.log("📚 Fetching all modules...")

    const query = `
      SELECT 
        m.*, 
        p.program_code, 
        p.program_name, 
        f.name as faculty_name, 
        u.name as created_by_name,
        COUNT(DISTINCT la.id) as assignment_count,
        COUNT(DISTINCT lr.id) as report_count
      FROM modules m
      LEFT JOIN programs p ON m.program_id = p.id
      LEFT JOIN faculties f ON m.faculty_id = f.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN lecture_assignments la ON m.id = la.module_id
      LEFT JOIN lecture_reports lr ON m.id = lr.module_id
      GROUP BY m.id
      ORDER BY p.program_name, m.module_name
    `

    db.all(query, (err, rows) => {
      if (err) {
        console.error("❌ Get modules error:", err)
        return res.status(500).json({ error: "Failed to fetch modules" })
      }

      console.log(`✅ Found ${rows.length} modules`)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get modules error:", error.message)
    res.status(500).json({ error: "Failed to fetch modules" })
  }
})

// Get modules by program ID
app.get("/api/modules/program/:programId", authenticateToken, (req, res) => {
  try {
    const { programId } = req.params
    console.log(`📚 Fetching modules for program ID: ${programId}`)

    if (!programId) {
      return res.status(400).json({ error: "Program ID is required" })
    }

    const query = `
      SELECT 
        m.*, 
        p.program_code, 
        p.program_name, 
        f.name as faculty_name,
        COUNT(DISTINCT la.id) as assignment_count
      FROM modules m
      LEFT JOIN programs p ON m.program_id = p.id
      LEFT JOIN faculties f ON m.faculty_id = f.id
      LEFT JOIN lecture_assignments la ON m.id = la.module_id
      WHERE m.program_id = ?
      GROUP BY m.id
      ORDER BY m.module_name
    `

    db.all(query, [Number.parseInt(programId)], (err, rows) => {
      if (err) {
        console.error("❌ Get modules by program error:", err)
        return res.status(500).json({ error: "Failed to fetch modules" })
      }

      console.log(`✅ Found ${rows.length} modules for program ${programId}`)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get modules by program error:", error.message)
    res.status(500).json({ error: "Failed to fetch modules" })
  }
})

// Get single module by ID
app.get("/api/modules/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    console.log(`📚 Fetching module ID: ${id}`)

    const query = `
      SELECT 
        m.*, 
        p.program_code, 
        p.program_name, 
        f.name as faculty_name, 
        u.name as created_by_name
      FROM modules m
      LEFT JOIN programs p ON m.program_id = p.id
      LEFT JOIN faculties f ON m.faculty_id = f.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = ?
    `

    db.get(query, [Number.parseInt(id)], (err, row) => {
      if (err) {
        console.error("❌ Get module error:", err)
        return res.status(500).json({ error: "Failed to fetch module" })
      }

      if (!row) {
        return res.status(404).json({ error: "Module not found" })
      }

      console.log(`✅ Found module: ${row.module_name}`)
      res.json(row)
    })
  } catch (error) {
    console.error("❌ Get module error:", error.message)
    res.status(500).json({ error: "Failed to fetch module" })
  }
})

app.post("/api/modules", authenticateToken, (req, res) => {
  try {
    const { module_name, program_id, faculty_id, total_registered_students } = req.body

    console.log("📝 Creating new module:", {
      module_name,
      program_id,
      faculty_id,
      total_registered_students,
      created_by: req.user.id,
    })

    // Validate required fields
    if (!module_name || !module_name.trim()) {
      return res.status(400).json({ error: "Module name is required" })
    }

    if (!program_id) {
      return res.status(400).json({ error: "Program is required" })
    }

    if (!total_registered_students || total_registered_students < 1) {
      return res.status(400).json({ error: "Total registered students must be at least 1" })
    }

    // Check if program exists
    db.get("SELECT id FROM programs WHERE id = ?", [program_id], (err, program) => {
      if (err) {
        console.error("❌ Check program error:", err)
        return res.status(500).json({ error: "Failed to validate program" })
      }

      if (!program) {
        return res.status(400).json({ error: "Selected program does not exist" })
      }

      // Check if module with same name already exists in this program
      db.get(
        "SELECT id FROM modules WHERE module_name = ? AND program_id = ?",
        [module_name.trim(), program_id],
        (err, existingModule) => {
          if (err) {
            console.error("❌ Check existing module error:", err)
            return res.status(500).json({ error: "Failed to check existing modules" })
          }

          if (existingModule) {
            return res.status(400).json({ error: "A module with this name already exists in the selected program" })
          }

          // Create the module
          db.run(
            `INSERT INTO modules (module_name, program_id, faculty_id, total_registered_students, created_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              module_name.trim(),
              Number.parseInt(program_id),
              faculty_id ? Number.parseInt(faculty_id) : null,
              Number.parseInt(total_registered_students),
              req.user.id,
            ],
            function (err) {
              if (err) {
                console.error("❌ Create module error:", err)
                return res.status(500).json({ error: "Failed to create module: " + err.message })
              }

              console.log(`✅ Module created with ID: ${this.lastID}`)

              // Return the created module with full details
              db.get(
                `
                SELECT m.*, p.program_code, p.program_name, f.name as faculty_name, u.name as created_by_name
                FROM modules m
                LEFT JOIN programs p ON m.program_id = p.id
                LEFT JOIN faculties f ON m.faculty_id = f.id
                LEFT JOIN users u ON m.created_by = u.id
                WHERE m.id = ?
              `,
                [this.lastID],
                (err, newModule) => {
                  if (err) {
                    console.error("❌ Fetch created module error:", err)
                    // Still return success but without full details
                    return res.json({
                      success: true,
                      id: this.lastID,
                      message: "Module created successfully",
                    })
                  }

                  res.json({
                    success: true,
                    module: newModule,
                    message: "Module created successfully",
                  })
                },
              )
            },
          )
        },
      )
    })
  } catch (error) {
    console.error("❌ Create module error:", error.message)
    res.status(500).json({ error: "Failed to create module" })
  }
})

// Update module
app.put("/api/modules/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { module_name, program_id, faculty_id, total_registered_students } = req.body

    console.log(`📝 Updating module ID: ${id}`, req.body)

    if (!module_name || !module_name.trim()) {
      return res.status(400).json({ error: "Module name is required" })
    }

    if (!program_id) {
      return res.status(400).json({ error: "Program is required" })
    }

    if (!total_registered_students || total_registered_students < 1) {
      return res.status(400).json({ error: "Total registered students must be at least 1" })
    }

    // Check if module exists
    db.get("SELECT id FROM modules WHERE id = ?", [id], (err, module) => {
      if (err) {
        console.error("❌ Check module error:", err)
        return res.status(500).json({ error: "Failed to validate module" })
      }

      if (!module) {
        return res.status(404).json({ error: "Module not found" })
      }

      // Check for duplicate module name in the same program
      db.get(
        "SELECT id FROM modules WHERE module_name = ? AND program_id = ? AND id != ?",
        [module_name.trim(), program_id, id],
        (err, duplicateModule) => {
          if (err) {
            console.error("❌ Check duplicate module error:", err)
            return res.status(500).json({ error: "Failed to check for duplicates" })
          }

          if (duplicateModule) {
            return res.status(400).json({ error: "A module with this name already exists in the selected program" })
          }

          // Update the module
          db.run(
            `UPDATE modules 
             SET module_name = ?, program_id = ?, faculty_id = ?, total_registered_students = ?
             WHERE id = ?`,
            [
              module_name.trim(),
              Number.parseInt(program_id),
              faculty_id ? Number.parseInt(faculty_id) : null,
              Number.parseInt(total_registered_students),
              Number.parseInt(id),
            ],
            function (err) {
              if (err) {
                console.error("❌ Update module error:", err)
                return res.status(500).json({ error: "Failed to update module: " + err.message })
              }

              if (this.changes === 0) {
                return res.status(404).json({ error: "Module not found" })
              }

              console.log(`✅ Module updated: ${id}`)
              res.json({ success: true, message: "Module updated successfully" })
            },
          )
        },
      )
    })
  } catch (error) {
    console.error("❌ Update module error:", error.message)
    res.status(500).json({ error: "Failed to update module" })
  }
})

// Delete module
app.delete("/api/modules/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    console.log(`🗑️ Deleting module ID: ${id}`)

    // Check if module exists and has dependencies
    db.get(
      `
      SELECT m.*,
             (SELECT COUNT(*) FROM lecture_assignments WHERE module_id = ?) as assignment_count,
             (SELECT COUNT(*) FROM lecture_reports WHERE module_id = ?) as report_count
      FROM modules m
      WHERE m.id = ?
    `,
      [id, id, id],
      (err, module) => {
        if (err) {
          console.error("❌ Check module dependencies error:", err)
          return res.status(500).json({ error: "Failed to check module dependencies" })
        }

        if (!module) {
          return res.status(404).json({ error: "Module not found" })
        }

        // Check if module has dependencies
        if (module.assignment_count > 0 || module.report_count > 0) {
          return res.status(400).json({
            error: "Cannot delete module. It has existing lecture assignments or reports. Please remove them first.",
          })
        }

        // Delete the module
        db.run("DELETE FROM modules WHERE id = ?", [id], function (err) {
          if (err) {
            console.error("❌ Delete module error:", err)
            return res.status(500).json({ error: "Failed to delete module: " + err.message })
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Module not found" })
          }

          console.log(`✅ Module deleted: ${id}`)
          res.json({ success: true, message: "Module deleted successfully" })
        })
      },
    )
  } catch (error) {
    console.error("❌ Delete module error:", error.message)
    res.status(500).json({ error: "Failed to delete module" })
  }
})

// ====================== LECTURE ASSIGNMENTS ======================

app.get("/api/lecture-assignments", authenticateToken, (req, res) => {
  try {
    const query = `
      SELECT la.*, 
             m.module_name,
             p.program_code, p.program_name,
             u.name as lecturer_name,
             u2.name as assigned_by_name
      FROM lecture_assignments la
      LEFT JOIN modules m ON la.module_id = m.id
      LEFT JOIN programs p ON la.program_id = p.id
      LEFT JOIN users u ON la.lecturer_id = u.id
      LEFT JOIN users u2 ON la.assigned_by = u2.id
    `

    db.all(query, (err, rows) => {
      if (err) {
        console.error("❌ Get lecture assignments error:", err)
        return res.status(500).json({ error: "Failed to fetch lecture assignments" })
      }
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get lecture assignments error:", error.message)
    res.status(500).json({ error: "Failed to fetch lecture assignments" })
  }
})

app.post("/api/lecture-assignments", authenticateToken, (req, res) => {
  try {
    const { module_id, program_id, lecturer_id } = req.body

    if (!module_id || !program_id || !lecturer_id) {
      return res.status(400).json({ error: "Module, program, and lecturer are required" })
    }

    // Check if assignment already exists
    db.get(
      `SELECT id FROM lecture_assignments WHERE module_id = ? AND program_id = ? AND lecturer_id = ?`,
      [module_id, program_id, lecturer_id],
      (err, row) => {
        if (err) {
          console.error("❌ Check assignment error:", err)
          return res.status(500).json({ error: "Failed to check assignment" })
        }

        if (row) {
          return res.status(400).json({ error: "This assignment already exists" })
        }

        // Create new assignment
        db.run(
          `INSERT INTO lecture_assignments (module_id, program_id, lecturer_id, assigned_by) 
           VALUES (?, ?, ?, ?)`,
          [module_id, program_id, lecturer_id, req.user.id],
          function (err) {
            if (err) {
              console.error("❌ Create assignment error:", err)
              return res.status(500).json({ error: "Failed to create assignment: " + err.message })
            }
            res.json({ success: true, id: this.lastID, message: "Lecture assigned successfully" })
          },
        )
      },
    )
  } catch (error) {
    console.error("❌ Create assignment error:", error.message)
    res.status(500).json({ error: "Failed to create assignment" })
  }
})

// Update lecture assignment
app.put("/api/lecture-assignments/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { module_id, program_id, lecturer_id } = req.body

    console.log(`📝 Updating assignment ID: ${id}`, req.body)

    if (!module_id || !program_id || !lecturer_id) {
      return res.status(400).json({ error: "Module, program, and lecturer are required" })
    }

    // Check if assignment exists
    db.get("SELECT id FROM lecture_assignments WHERE id = ?", [id], (err, assignment) => {
      if (err) {
        console.error("❌ Check assignment error:", err)
        return res.status(500).json({ error: "Failed to validate assignment" })
      }

      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" })
      }

      // Check for duplicate assignment
      db.get(
        "SELECT id FROM lecture_assignments WHERE module_id = ? AND program_id = ? AND lecturer_id = ? AND id != ?",
        [module_id, program_id, lecturer_id, id],
        (err, duplicateAssignment) => {
          if (err) {
            console.error("❌ Check duplicate assignment error:", err)
            return res.status(500).json({ error: "Failed to check for duplicates" })
          }

          if (duplicateAssignment) {
            return res.status(400).json({ error: "This assignment already exists" })
          }

          // Update the assignment
          db.run(
            `UPDATE lecture_assignments 
             SET module_id = ?, program_id = ?, lecturer_id = ?
             WHERE id = ?`,
            [module_id, program_id, lecturer_id, Number.parseInt(id)],
            function (err) {
              if (err) {
                console.error("❌ Update assignment error:", err)
                return res.status(500).json({ error: "Failed to update assignment: " + err.message })
              }

              if (this.changes === 0) {
                return res.status(404).json({ error: "Assignment not found" })
              }

              console.log(`✅ Assignment updated: ${id}`)
              res.json({ success: true, message: "Assignment updated successfully" })
            },
          )
        },
      )
    })
  } catch (error) {
    console.error("❌ Update assignment error:", error.message)
    res.status(500).json({ error: "Failed to update assignment" })
  }
})

// Delete lecture assignment
app.delete("/api/lecture-assignments/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    console.log(`🗑️ Deleting assignment ID: ${id}`)

    // Check if assignment exists
    db.get("SELECT id FROM lecture_assignments WHERE id = ?", [id], (err, assignment) => {
      if (err) {
        console.error("❌ Check assignment error:", err)
        return res.status(500).json({ error: "Failed to check assignment" })
      }

      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" })
      }

      // Delete the assignment
      db.run("DELETE FROM lecture_assignments WHERE id = ?", [id], function (err) {
        if (err) {
          console.error("❌ Delete assignment error:", err)
          return res.status(500).json({ error: "Failed to delete assignment: " + err.message })
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Assignment not found" })
        }

        console.log(`✅ Assignment deleted: ${id}`)
        res.json({ success: true, message: "Assignment deleted successfully" })
      })
    })
  } catch (error) {
    console.error("❌ Delete assignment error:", error.message)
    res.status(500).json({ error: "Failed to delete assignment" })
  }
})

// ====================== USERS ======================

// Get all students
app.get("/api/students", authenticateToken, (req, res) => {
  try {
    db.all(
      `SELECT u.id, u.name, u.email, f.name as faculty_name, p.program_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN faculties f ON u.faculty_id = f.id
       LEFT JOIN programs p ON u.program_id = p.id
       WHERE r.name = 'Student'`,
      (err, rows) => {
        if (err) {
          console.error("❌ Get students error:", err)
          return res.status(500).json({ error: "Failed to fetch students" })
        }
        res.json(rows)
      },
    )
  } catch (error) {
    console.error("❌ Get students error:", error.message)
    res.status(500).json({ error: "Failed to fetch students" })
  }
})

// Get lecturers for assignment
app.get("/api/lecturers", authenticateToken, (req, res) => {
  try {
    db.all(
      `SELECT u.id, u.name, u.email, r.name as role, f.name as faculty_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN faculties f ON u.faculty_id = f.id
       WHERE r.name = 'Lecturer'`,
      (err, rows) => {
        if (err) {
          console.error("❌ Get lecturers error:", err)
          return res.status(500).json({ error: "Failed to fetch lecturers" })
        }
        res.json(rows)
      },
    )
  } catch (error) {
    console.error("❌ Get lecturers error:", error.message)
    res.status(500).json({ error: "Failed to fetch lecturers" })
  }
})

// ====================== REPORTS ======================

app.get("/api/reports", authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT lr.*, 
             f.name as faculty_name,
             m.module_name,
             p.program_code, p.program_name,
             u.name as lecturer_name
      FROM lecture_reports lr
      LEFT JOIN faculties f ON lr.faculty_id = f.id
      LEFT JOIN modules m ON lr.module_id = m.id
      LEFT JOIN programs p ON lr.program_id = p.id
      LEFT JOIN users u ON lr.lecturer_id = u.id
    `

    // Filter reports based on user role
    if (req.user.role === "Lecturer") {
      query += ` WHERE lr.lecturer_id = ?`
      db.all(query, [req.user.id], (err, rows) => {
        if (err) {
          console.error("❌ Get reports error:", err)
          return res.status(500).json({ error: "Failed to fetch reports" })
        }
        res.json(rows)
      })
    } else {
      db.all(query, (err, rows) => {
        if (err) {
          console.error("❌ Get reports error:", err)
          return res.status(500).json({ error: "Failed to fetch reports" })
        }
        res.json(rows)
      })
    }
  } catch (error) {
    console.error("❌ Get reports error:", error.message)
    res.status(500).json({ error: "Failed to fetch reports" })
  }
})

app.post("/api/reports", authenticateToken, (req, res) => {
  try {
    const {
      faculty_id,
      module_id,
      program_id,
      week_of_reporting,
      date_of_lecture,
      actual_students_present,
      total_registered_students,
      venue,
      scheduled_time,
      topic_taught,
      learning_outcomes,
      recommendations,
      student_name,
      student_number,
    } = req.body

    // Validate required fields
    const requiredFields = [
      "faculty_id",
      "module_id",
      "program_id",
      "week_of_reporting",
      "date_of_lecture",
      "actual_students_present",
      "total_registered_students",
      "venue",
      "scheduled_time",
      "topic_taught",
      "learning_outcomes",
      "recommendations",
    ]

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `${field.replace(/_/g, " ")} is required` })
      }
    }

    db.run(
      `INSERT INTO lecture_reports (
        faculty_id, module_id, program_id, week_of_reporting, date_of_lecture, lecturer_id,
        actual_students_present, total_registered_students, venue, scheduled_time,
        topic_taught, learning_outcomes, recommendations, student_name, student_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        faculty_id,
        module_id,
        program_id,
        week_of_reporting,
        date_of_lecture,
        req.user.id,
        actual_students_present,
        total_registered_students,
        venue,
        scheduled_time,
        topic_taught,
        learning_outcomes,
        recommendations,
        student_name || null,
        student_number || null,
      ],
      function (err) {
        if (err) {
          console.error("❌ Create report error:", err)
          return res.status(500).json({ error: "Failed to create report: " + err.message })
        }
        res.json({ success: true, id: this.lastID, message: "Report submitted successfully" })
      },
    )
  } catch (error) {
    console.error("❌ Create report error:", error.message)
    res.status(500).json({ error: "Failed to create report" })
  }
})

app.put("/api/reports/:id/feedback", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { principal_feedback } = req.body

    if (!principal_feedback) {
      return res.status(400).json({ error: "Feedback is required" })
    }

    db.run(
      `UPDATE lecture_reports SET principal_feedback = ?, status = 'reviewed' WHERE id = ?`,
      [principal_feedback, id],
      function (err) {
        if (err) {
          console.error("❌ Update report feedback error:", err)
          return res.status(500).json({ error: "Failed to update feedback: " + err.message })
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Report not found" })
        }
        res.json({ success: true, message: "Feedback submitted successfully" })
      },
    )
  } catch (error) {
    console.error("❌ Update report feedback error:", error.message)
    res.status(500).json({ error: "Failed to update feedback" })
  }
})

app.put("/api/reports/:id/sign-attendance", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { student_name, student_number } = req.body

    if (!student_name || !student_number) {
      return res.status(400).json({ error: "Student name and number are required" })
    }

    db.run(
      `UPDATE lecture_reports SET student_name = ?, student_number = ? WHERE id = ?`,
      [student_name, student_number, id],
      function (err) {
        if (err) {
          console.error("❌ Sign attendance error:", err)
          return res.status(500).json({ error: "Failed to sign attendance: " + err.message })
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Report not found" })
        }
        res.json({ success: true, message: "Attendance signed successfully" })
      },
    )
  } catch (error) {
    console.error("❌ Sign attendance error:", error.message)
    res.status(500).json({ error: "Failed to sign attendance" })
  }
})

// ====================== CHALLENGES ======================

// Get all challenges
app.get("/api/challenges", authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT c.*, 
             m.module_name,
             p.program_code, p.program_name,
             f.name as faculty_name,
             u.name as lecturer_name
      FROM challenges c
      LEFT JOIN modules m ON c.module_id = m.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN faculties f ON c.faculty_id = f.id
      LEFT JOIN users u ON c.lecturer_id = u.id
    `

    // Filter challenges based on user role
    if (req.user.role === "Lecturer") {
      query += ` WHERE c.lecturer_id = ?`
      db.all(query, [req.user.id], (err, rows) => {
        if (err) {
          console.error("❌ Get challenges error:", err)
          return res.status(500).json({ error: "Failed to fetch challenges" })
        }
        res.json(rows)
      })
    } else {
      db.all(query, (err, rows) => {
        if (err) {
          console.error("❌ Get challenges error:", err)
          return res.status(500).json({ error: "Failed to fetch challenges" })
        }
        res.json(rows)
      })
    }
  } catch (error) {
    console.error("❌ Get challenges error:", error.message)
    res.status(500).json({ error: "Failed to fetch challenges" })
  }
})

// Get single challenge by ID
app.get("/api/challenges/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params

    const query = `
      SELECT c.*, 
             m.module_name,
             p.program_code, p.program_name,
             f.name as faculty_name,
             u.name as lecturer_name
      FROM challenges c
      LEFT JOIN modules m ON c.module_id = m.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN faculties f ON c.faculty_id = f.id
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE c.id = ?
    `

    db.get(query, [Number.parseInt(id)], (err, row) => {
      if (err) {
        console.error("❌ Get challenge error:", err)
        return res.status(500).json({ error: "Failed to fetch challenge" })
      }

      if (!row) {
        return res.status(404).json({ error: "Challenge not found" })
      }

      // Check if user has permission to view this challenge
      if (req.user.role === "Lecturer" && row.lecturer_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" })
      }

      res.json(row)
    })
  } catch (error) {
    console.error("❌ Get challenge error:", error.message)
    res.status(500).json({ error: "Failed to fetch challenge" })
  }
})

// Create new challenge
app.post("/api/challenges", authenticateToken, (req, res) => {
  try {
    const { module_id, program_id, faculty_id, challenge_type, description, impact, proposed_solution, status } =
      req.body

    console.log("📝 Creating challenge:", {
      module_id,
      program_id,
      faculty_id,
      challenge_type,
      lecturer_id: req.user.id,
    })

    // Validate required fields
    const requiredFields = ["module_id", "program_id", "challenge_type", "description", "impact"]

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `${field.replace(/_/g, " ")} is required` })
      }
    }

    // Validate challenge type
    const validChallengeTypes = [
      "attendance",
      "resources",
      "technical",
      "student_engagement",
      "content_coverage",
      "time_management",
      "other",
    ]

    if (!validChallengeTypes.includes(challenge_type)) {
      return res.status(400).json({ error: "Invalid challenge type" })
    }

    // Validate that referenced entities exist
    const validateEntity = (table, id, fieldName) => {
      return new Promise((resolve, reject) => {
        if (!id) {
          resolve(true) // Skip validation if ID is not provided (for optional fields)
          return
        }

        db.get(`SELECT id FROM ${table} WHERE id = ?`, [Number.parseInt(id)], (err, row) => {
          if (err) {
            reject(`Database error checking ${fieldName}`)
          } else if (!row) {
            reject(`${fieldName} with ID ${id} does not exist`)
          } else {
            resolve(true)
          }
        })
      })
    }

    // Validate all referenced entities
    Promise.all([
      validateEntity("modules", module_id, "Module"),
      validateEntity("programs", program_id, "Program"),
      validateEntity("faculties", faculty_id, "Faculty"),
      validateEntity("users", req.user.id, "Lecturer"),
    ])
      .then(() => {
        // All validations passed, create the challenge
        db.run(
          `INSERT INTO challenges (
          lecturer_id, module_id, program_id, faculty_id, challenge_type,
          description, impact, proposed_solution, status, submitted_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            Number.parseInt(module_id),
            Number.parseInt(program_id),
            faculty_id ? Number.parseInt(faculty_id) : null,
            challenge_type,
            description,
            impact,
            proposed_solution || "",
            status || "pending",
            new Date().toISOString().split("T")[0],
          ],
          function (err) {
            if (err) {
              console.error("❌ Create challenge error:", err)
              console.error("❌ Error details:", err.message)
              if (err.code === "SQLITE_CONSTRAINT") {
                return res.status(400).json({ error: "Invalid reference data provided" })
              }
              return res.status(500).json({ error: "Failed to create challenge: " + err.message })
            }

            console.log("✅ Challenge created with ID:", this.lastID)

            // Return the created challenge with full details
            db.get(
              `
            SELECT c.*, 
                   m.module_name,
                   p.program_code, p.program_name,
                   f.name as faculty_name,
                   u.name as lecturer_name
            FROM challenges c
            LEFT JOIN modules m ON c.module_id = m.id
            LEFT JOIN programs p ON c.program_id = p.id
            LEFT JOIN faculties f ON c.faculty_id = f.id
            LEFT JOIN users u ON c.lecturer_id = u.id
            WHERE c.id = ?
          `,
              [this.lastID],
              (err, newChallenge) => {
                if (err) {
                  console.error("❌ Fetch created challenge error:", err)
                  // Still return success but without full details
                  return res.json({
                    success: true,
                    id: this.lastID,
                    message: "Challenge submitted successfully",
                  })
                }

                res.json({
                  success: true,
                  challenge: newChallenge,
                  message: "Challenge submitted successfully",
                })
              },
            )
          },
        )
      })
      .catch((validationError) => {
        console.error("❌ Validation error:", validationError)
        return res.status(400).json({ error: validationError })
      })
  } catch (error) {
    console.error("❌ Create challenge error:", error.message)
    res.status(500).json({ error: "Failed to create challenge" })
  }
})

// Update challenge (admin feedback, status, etc.)
app.put("/api/challenges/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { admin_feedback, status } = req.body

    // Only allow Program Leaders and Principal Lecturers to update challenges
    if (!["Program Leader", "Principal Lecturer"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Only administrators can update challenges." })
    }

    // Build update query dynamically based on provided fields
    const updateFields = []
    const updateValues = []

    if (admin_feedback !== undefined) {
      updateFields.push("admin_feedback = ?")
      updateValues.push(admin_feedback)
    }

    if (status !== undefined) {
      updateFields.push("status = ?")
      updateValues.push(status)

      // If status is being set to 'resolved', set resolved_date
      if (status === "resolved") {
        updateFields.push("resolved_date = ?")
        updateValues.push(new Date().toISOString().split("T")[0])
      } else if (status !== "resolved") {
        updateFields.push("resolved_date = NULL")
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" })
    }

    updateValues.push(Number.parseInt(id))

    const query = `UPDATE challenges SET ${updateFields.join(", ")} WHERE id = ?`

    db.run(query, updateValues, function (err) {
      if (err) {
        console.error("❌ Update challenge error:", err)
        return res.status(500).json({ error: "Failed to update challenge: " + err.message })
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Challenge not found" })
      }

      res.json({ success: true, message: "Challenge updated successfully" })
    })
  } catch (error) {
    console.error("❌ Update challenge error:", error.message)
    res.status(500).json({ error: "Failed to update challenge" })
  }
})

// Delete challenge (only by the lecturer who created it or admin)
app.delete("/api/challenges/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params

    // Check if challenge exists and get details
    db.get("SELECT lecturer_id FROM challenges WHERE id = ?", [id], (err, challenge) => {
      if (err) {
        console.error("❌ Check challenge error:", err)
        return res.status(500).json({ error: "Failed to check challenge" })
      }

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" })
      }

      // Check permissions: only the creator or admin can delete
      const isAdmin = ["Program Leader", "Principal Lecturer"].includes(req.user.role)
      const isCreator = challenge.lecturer_id === req.user.id

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ error: "Access denied" })
      }

      // Delete the challenge
      db.run("DELETE FROM challenges WHERE id = ?", [id], function (err) {
        if (err) {
          console.error("❌ Delete challenge error:", err)
          return res.status(500).json({ error: "Failed to delete challenge: " + err.message })
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Challenge not found" })
        }

        res.json({ success: true, message: "Challenge deleted successfully" })
      })
    })
  } catch (error) {
    console.error("❌ Delete challenge error:", error.message)
    res.status(500).json({ error: "Failed to delete challenge" })
  }
})

// Get challenge statistics (for dashboard)
app.get("/api/challenges/stats", authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM challenges
    `

    const params = []

    // Filter by lecturer if user is a lecturer
    if (req.user.role === "Lecturer") {
      query += ` WHERE lecturer_id = ?`
      params.push(req.user.id)
    }

    query += ` GROUP BY status`

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("❌ Get challenge stats error:", err)
        return res.status(500).json({ error: "Failed to fetch challenge statistics" })
      }

      // Initialize all possible statuses
      const stats = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
      }

      // Update with actual counts
      rows.forEach((row) => {
        stats[row.status] = row.count
      })

      res.json(stats)
    })
  } catch (error) {
    console.error("❌ Get challenge stats error:", error.message)
    res.status(500).json({ error: "Failed to fetch challenge statistics" })
  }
})

// ====================== STUDENT CHALLENGES ======================

// Get all challenges for the logged-in student
app.get("/api/student/challenges", authenticateToken, (req, res) => {
  try {
    console.log("🎯 Fetching student challenges for user:", req.user.id)

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    const query = `
      SELECT 
        sc.*,
        m.module_name,
        p.program_name,
        p.program_code
      FROM student_challenges sc
      LEFT JOIN modules m ON sc.module_id = m.id
      LEFT JOIN programs p ON m.program_id = p.id
      WHERE sc.student_id = ?
      ORDER BY 
        CASE sc.priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        sc.created_at DESC
    `

    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error("❌ Get student challenges error:", err)
        return res.status(500).json({ error: "Failed to fetch challenges" })
      }

      console.log(`✅ Found ${rows.length} challenges for student`)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get student challenges error:", error.message)
    res.status(500).json({ error: "Failed to fetch challenges" })
  }
})

// Create new student challenge
app.post("/api/student/challenges", authenticateToken, (req, res) => {
  try {
    const { module_id, title, description, priority } = req.body

    console.log("📝 Creating student challenge:", {
      student_id: req.user.id,
      module_id,
      title,
      priority,
    })

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    // Validate required fields
    if (!module_id || !title || !description) {
      return res.status(400).json({ error: "Module, title, and description are required" })
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high"]
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority value" })
    }

    // Check if module exists and student has access to it
    const moduleCheckQuery = `
      SELECT m.id 
      FROM modules m
      LEFT JOIN users u ON m.program_id = u.program_id
      WHERE m.id = ? AND u.id = ?
    `

    db.get(moduleCheckQuery, [module_id, req.user.id], (err, row) => {
      if (err) {
        console.error("❌ Module check error:", err)
        return res.status(500).json({ error: "Failed to validate module" })
      }

      if (!row) {
        return res.status(400).json({ error: "Module not found or access denied" })
      }

      // Create the challenge
      db.run(
        `INSERT INTO student_challenges (student_id, module_id, title, description, priority)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, Number.parseInt(module_id), title.trim(), description.trim(), priority || "medium"],
        function (err) {
          if (err) {
            console.error("❌ Create student challenge error:", err)
            return res.status(500).json({ error: "Failed to create challenge: " + err.message })
          }

          console.log("✅ Student challenge created with ID:", this.lastID)

          // Return the created challenge with full details
          db.get(
            `
            SELECT 
              sc.*,
              m.module_name,
              p.program_name,
              p.program_code
            FROM student_challenges sc
            LEFT JOIN modules m ON sc.module_id = m.id
            LEFT JOIN programs p ON m.program_id = p.id
            WHERE sc.id = ?
          `,
            [this.lastID],
            (err, newChallenge) => {
              if (err) {
                console.error("❌ Fetch created challenge error:", err)
                return res.json({
                  success: true,
                  id: this.lastID,
                  message: "Challenge submitted successfully",
                })
              }

              res.json({
                success: true,
                challenge: newChallenge,
                message: "Challenge submitted successfully",
              })
            },
          )
        },
      )
    })
  } catch (error) {
    console.error("❌ Create student challenge error:", error.message)
    res.status(500).json({ error: "Failed to create challenge" })
  }
})

// Update student challenge status
app.put("/api/student/challenges/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    console.log(`🔄 Updating challenge ${id} status to:`, status)

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    // Validate status
    const validStatuses = ["pending", "in_progress", "resolved"]
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Valid status is required" })
    }

    // Check if challenge exists and belongs to student
    db.get("SELECT id FROM student_challenges WHERE id = ? AND student_id = ?", [id, req.user.id], (err, row) => {
      if (err) {
        console.error("❌ Check challenge error:", err)
        return res.status(500).json({ error: "Failed to check challenge" })
      }

      if (!row) {
        return res.status(404).json({ error: "Challenge not found" })
      }

      // Update the challenge
      db.run(
        `UPDATE student_challenges 
           SET status = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
        [status, id],
        function (err) {
          if (err) {
            console.error("❌ Update challenge error:", err)
            return res.status(500).json({ error: "Failed to update challenge: " + err.message })
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Challenge not found" })
          }

          res.json({
            success: true,
            message: "Challenge updated successfully",
          })
        },
      )
    })
  } catch (error) {
    console.error("❌ Update student challenge error:", error.message)
    res.status(500).json({ error: "Failed to update challenge" })
  }
})

// ====================== MODULE RATINGS ======================

// Submit module rating
app.post("/api/module-ratings", authenticateToken, (req, res) => {
  try {
    const { module_id, rating, comments } = req.body

    console.log("⭐ Submitting module rating:", {
      student_id: req.user.id,
      module_id,
      rating,
    })

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    // Validate required fields
    if (!module_id || !rating) {
      return res.status(400).json({ error: "Module and rating are required" })
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" })
    }

    // Check if module exists and student has access to it
    const moduleCheckQuery = `
      SELECT m.id 
      FROM modules m
      LEFT JOIN users u ON m.program_id = u.program_id
      WHERE m.id = ? AND u.id = ?
    `

    db.get(moduleCheckQuery, [module_id, req.user.id], (err, row) => {
      if (err) {
        console.error("❌ Module check error:", err)
        return res.status(500).json({ error: "Failed to validate module" })
      }

      if (!row) {
        return res.status(400).json({ error: "Module not found or access denied" })
      }

      // Check if student already rated this module
      db.get(
        "SELECT id FROM module_ratings WHERE student_id = ? AND module_id = ?",
        [req.user.id, module_id],
        (err, existingRating) => {
          if (err) {
            console.error("❌ Check existing rating error:", err)
            return res.status(500).json({ error: "Failed to check existing ratings" })
          }

          let query, params

          if (existingRating) {
            // Update existing rating
            query = `
              UPDATE module_ratings 
              SET rating = ?, comments = ?, created_at = CURRENT_TIMESTAMP 
              WHERE student_id = ? AND module_id = ?
            `
            params = [rating, comments || "", req.user.id, module_id]
          } else {
            // Create new rating
            query = `
              INSERT INTO module_ratings (student_id, module_id, rating, comments)
              VALUES (?, ?, ?, ?)
            `
            params = [req.user.id, module_id, rating, comments || ""]
          }

          db.run(query, params, (err) => {
            if (err) {
              console.error("❌ Submit module rating error:", err)
              return res.status(500).json({ error: "Failed to submit rating: " + err.message })
            }

            const action = existingRating ? "updated" : "submitted"
            console.log(`✅ Module rating ${action} for module ${module_id}`)

            res.json({
              success: true,
              message: `Rating ${action} successfully`,
            })
          })
        },
      )
    })
  } catch (error) {
    console.error("❌ Submit module rating error:", error.message)
    res.status(500).json({ error: "Failed to submit rating" })
  }
})

// Get module ratings for a student
app.get("/api/student/module-ratings", authenticateToken, (req, res) => {
  try {
    console.log("⭐ Fetching module ratings for student:", req.user.id)

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    const query = `
      SELECT 
        mr.*,
        m.module_name,
        p.program_name,
        p.program_code
      FROM module_ratings mr
      LEFT JOIN modules m ON mr.module_id = m.id
      LEFT JOIN programs p ON m.program_id = p.id
      WHERE mr.student_id = ?
      ORDER BY mr.created_at DESC
    `

    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error("❌ Get module ratings error:", err)
        return res.status(500).json({ error: "Failed to fetch ratings" })
      }

      console.log(`✅ Found ${rows.length} module ratings for student`)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get module ratings error:", error.message)
    res.status(500).json({ error: "Failed to fetch ratings" })
  }
})

// ====================== STUDENT MODULES ======================

// Get modules for the logged-in student
app.get("/api/student/modules", authenticateToken, (req, res) => {
  try {
    console.log("📚 Fetching student modules for user:", req.user.id)

    if (req.user.role !== "Student") {
      return res.status(403).json({ error: "Access denied. Student access only." })
    }

    // Get user with program info
    db.get(
      `
      SELECT u.*, p.program_name, f.name as faculty_name 
      FROM users u
      LEFT JOIN programs p ON u.program_id = p.id
      LEFT JOIN faculties f ON u.faculty_id = f.id
      WHERE u.id = ?
    `,
      [req.user.id],
      (err, user) => {
        if (err) {
          console.error("❌ Get user error:", err)
          return res.status(500).json({ error: "Failed to fetch user data" })
        }

        if (!user) {
          return res.status(404).json({ error: "User not found" })
        }

        console.log("👤 Student data:", user)

        // Check if student has a program assigned
        if (!user.program_id) {
          console.log("❌ Student has no program_id assigned")
          return res.status(200).json({
            modules: [],
            message: "You are not enrolled in any program. Please contact your program leader.",
            hasProgram: false,
          })
        }

        // Get modules for student's program
        db.all(
          `
        SELECT m.*, p.program_code, p.program_name, f.name as faculty_name
        FROM modules m
        LEFT JOIN programs p ON m.program_id = p.id
        LEFT JOIN faculties f ON m.faculty_id = f.id
        WHERE m.program_id = ?
        ORDER BY m.module_name
      `,
          [user.program_id],
          (err, rows) => {
            if (err) {
              console.error("❌ Get student modules error:", err)
              return res.status(500).json({ error: "Failed to fetch student modules" })
            }

            console.log("✅ Student modules found:", rows.length)
            res.json({
              modules: rows,
              hasProgram: true,
              programName: user.program_name,
            })
          },
        )
      },
    )
  } catch (error) {
    console.error("❌ Get student modules error:", error.message)
    res.status(500).json({ error: "Failed to fetch student modules" })
  }
})

// ====================== RATINGS ======================

// Get all module ratings (for Principal Lecturer dashboard)
app.get("/api/ratings", authenticateToken, (req, res) => {
  try {
    console.log("⭐ Fetching all module ratings...")

    const query = `
      SELECT 
        mr.*,
        m.module_name,
        p.program_name,
        p.program_code,
        u.name as rated_by_name
      FROM module_ratings mr
      LEFT JOIN modules m ON mr.module_id = m.id
      LEFT JOIN programs p ON m.program_id = p.id
      LEFT JOIN users u ON mr.student_id = u.id
      ORDER BY mr.created_at DESC
    `

    db.all(query, (err, rows) => {
      if (err) {
        console.error("❌ Get module ratings error:", err)
        return res.status(500).json({ error: "Failed to fetch module ratings" })
      }

      console.log(`✅ Found ${rows.length} module ratings`)
      res.json(rows)
    })
  } catch (error) {
    console.error("❌ Get module ratings error:", error.message)
    res.status(500).json({ error: "Failed to fetch module ratings" })
  }
})

// Legacy lecture report ratings endpoints
app.post("/api/ratings", authenticateToken, (req, res) => {
  try {
    const { report_id, rating, comments } = req.body

    if (!report_id || !rating) {
      return res.status(400).json({ error: "Report ID and rating are required" })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" })
    }

    db.run(
      `INSERT INTO ratings (report_id, rated_by, rating, comments) VALUES (?, ?, ?, ?)`,
      [report_id, req.user.id, rating, comments || ""],
      function (err) {
        if (err) {
          console.error("❌ Create rating error:", err)
          return res.status(500).json({ error: "Failed to create rating: " + err.message })
        }
        res.json({ success: true, id: this.lastID, message: "Rating submitted successfully" })
      },
    )
  } catch (error) {
    console.error("❌ Create rating error:", error.message)
    res.status(500).json({ error: "Failed to create rating" })
  }
})

app.get("/api/ratings/:reportId", authenticateToken, (req, res) => {
  try {
    const { reportId } = req.params

    db.all(
      `SELECT r.*, u.name as rated_by_name FROM ratings r 
       JOIN users u ON r.rated_by = u.id 
       WHERE r.report_id = ?`,
      [reportId],
      (err, rows) => {
        if (err) {
          console.error("❌ Get ratings error:", err)
          return res.status(500).json({ error: "Failed to fetch ratings" })
        }
        res.json(rows)
      },
    )
  } catch (error) {
    console.error("❌ Get ratings error:", error.message)
    res.status(500).json({ error: "Failed to fetch ratings" })
  }
})

// ====================== API ROUTES ======================

// Student Page
app.get("/api/student", authenticateToken, (req, res) => {
  if (req.user.role !== "Student") return res.status(403).json({ error: "Access denied" })
  res.json({ message: "Welcome Student Page" })
})

// Lecturer Page
app.get("/api/lecturer", authenticateToken, (req, res) => {
  if (req.user.role !== "Lecturer") return res.status(403).json({ error: "Access denied" })
  res.json({ message: "Welcome Lecturer Page" })
})

// Principal Lecturer Page
app.get("/api/principal-lecturer", authenticateToken, (req, res) => {
  if (req.user.role !== "Principal Lecturer") return res.status(403).json({ error: "Access denied" })
  res.json({ message: "Welcome Principal Lecturer Page" })
})

// Program Leader Page
app.get("/api/program-leader", authenticateToken, (req, res) => {
  if (req.user.role !== "Program Leader") return res.status(403).json({ error: "Access denied" })
  res.json({ message: "Welcome Program Leader Page" })
})

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working with SQLite!",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/signup",
      "/api/login",
      "/api/faculties",
      "/api/programs",
      "/api/programs/:facultyId",
      "/api/modules",
      "/api/reports",
      "/api/lecture-assignments",
      "/api/lecturers",
      "/api/students",
    ],
  })
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  db.get("SELECT 1 as test", (err, row) => {
    if (err) {
      return res.status(500).json({ status: "error", database: "unhealthy", error: err.message })
    }
    res.json({
      status: "ok",
      database: "healthy",
      timestamp: new Date().toISOString(),
    })
  })
})

// Handle undefined routes
app.use((req, res) => {
  console.log("❌ Route not found:", req.method, req.originalUrl)
  res.status(404).json({ error: "Route not found" })
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("🚨 Unhandled error:", error)
  res.status(500).json({ error: "Internal server error" })
})

// ====================== START SERVER ======================
const PORT = 5000
app.listen(PORT, () => {
  console.log(`\n🎓 LUCT Reporting System Server`)
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`\n📚 Available Endpoints:`)
  console.log(`   🔐 Auth: http://localhost:${PORT}/api/signup`)
  console.log(`   🔐 Auth: http://localhost:${PORT}/api/login`)
  console.log(`   📊 Test: http://localhost:${PORT}/api/test`)
  console.log(`   ❤️  Health: http://localhost:${PORT}/api/health`)
  console.log(`   🏫 Faculties: http://localhost:${PORT}/api/faculties`)
  console.log(`   📚 Programs: http://localhost:${PORT}/api/programs`)
  console.log(`   🏫 Modules: http://localhost:${PORT}/api/modules`)
  console.log(`   👨‍🏫 Assignments: http://localhost:${PORT}/api/lecture-assignments`)
  console.log(`\n👤 Test Users (password: 'password'):`)
  console.log(`   👨‍🏫 Lecturer: lecturer@luct.com`)
  console.log(`   👨‍💼 Program Leader: programleader@luct.com`)
  console.log(`   👨‍🎓 Student: student@luct.com`)
  console.log(`   👨‍💻 Principal Lecturer: principal@luct.com`)
  console.log(`\n💾 Database file: ${dbPath}`)
})