const express = require("express");
const path = require("path");
const db = require("./dataBase");
const bcrypt = require("bcrypt");
const session = require("express-session"); // Add this for session management
const appLogin = express();

appLogin.set("views", path.join(__dirname, "views"));
appLogin.set("view engine", "ejs");
appLogin.use(express.urlencoded({ extended: true }));
appLogin.use(express.static(path.join(__dirname, "..", "public")));

// Session Middleware
appLogin.use(
  session({
    secret: "your-secret-key", // Replace with a strong, unique secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS in production
  })
);

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.userId && req.session.role) {
    return next();
  }
  res.redirect("/");
}

// Login Route
appLogin.post("/login", (req, res) => {
  const { email, password, role } = req.body;
  let query, redirectPath, idField;
  if (role === "admin") {
    query = "SELECT * FROM Admins WHERE email = ?";
    redirectPath = "/admin";
    idField = "admin_id";
  } else if (role === "user") {
    query = "SELECT * FROM Users WHERE email = ?";
    redirectPath = "/user-home";
    idField = "user_id";
  } else if (role === "mechanic") {
    query = "SELECT * FROM Mechanics WHERE email = ?";
    redirectPath = "/mechanic-home";
    idField = "mechanic_id";
  } else {
    res.status(401).send("Invalid role");
    return;
  }

  db.query(query, [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    if (results.length === 0) {
      res.status(401).send("Invalid email");
      return;
    }

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Password comparison error:", err);
        res.status(500).send("Internal Server Error");
        return;
      }
      if (isMatch) {
        req.session.userId = user[idField]; // Store user ID in session
        req.session.role = role; // Store role in session
        res.redirect(redirectPath);
      } else {
        res.status(401).send("Invalid password");
      }
    });
  });
});

// Register Routes
appLogin.get("/register", (req, res) => {
  res.render("register");
});

appLogin.post("/register", async (req, res) => {
  const {
    email,
    name,
    phone_number,
    password,
    confirmPassword,
    role,
    make,
    model,
    year,
  } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  if (role === "admin") {
    const query = "INSERT INTO Admins (email, password, name) VALUES (?, ?, ?)";
    db.query(query, [email, hashedPassword, name], (err) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/");
    });
  } else if (role === "user") {
    db.beginTransaction(async (err) => {
      if (err) {
        console.error("Transaction error:", err);
        return res.status(500).send("Internal Server Error");
      }

      try {
        const userQuery =
          "INSERT INTO Users (email, password, name, phone_number) VALUES (?, ?, ?, ?)";
        const userResult = await new Promise((resolve, reject) => {
          db.query(
            userQuery,
            [email, hashedPassword, name, phone_number],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });

        const userId = userResult.insertId;

        const carQuery =
          "INSERT INTO Cars (user_id, make, model, year) VALUES (?, ?, ?, ?)";
        await new Promise((resolve, reject) => {
          if (year !== "") {
            db.query(carQuery, [userId, make, model, year], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          } else {
            db.query(carQuery, [userId, make, model, 0], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          }
        });

        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              console.error("Commit error:", err);
              res.status(500).send("Internal Server Error");
            });
          }
          res.redirect("/");
        });
      } catch (error) {
        db.rollback(() => {
          console.error("Transaction error:", error);
          res.status(500).send("Internal Server Error");
        });
      }
    });
  } else {
    return res.status(400).send("Invalid role");
  }
});

// Mechanic Home (Protected)
appLogin.get("/mechanic-home", isAuthenticated, (req, res) => {
  if (req.session.role !== "mechanic") {
    return res.status(403).send("Forbidden");
  }
  res.render("mechanic-home");
});

// User Home (Protected)
// User Home (Protected)
appLogin.get("/user-home", isAuthenticated, (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }
  const userId = req.session.userId;

  const currentQuery = `
    SELECT COUNT(*) as count 
    FROM Bookings 
    WHERE user_id = ? AND status IN ('pending', 'confirmed')
  `;
  const historyQuery = `
    SELECT b.booking_date_time, b.status, m.name as mechanic_name, s.service_name 
    FROM Bookings b
    LEFT JOIN Mechanics m ON b.mechanic_id = m.mechanic_id
    LEFT JOIN Services s ON b.service_id = s.service_id
    WHERE b.user_id = ? AND b.status IN ('completed', 'canceled')
    ORDER BY b.booking_date_time DESC
    LIMIT 5
  `;

  db.query(currentQuery, [userId], (err, currentResult) => {
    if (err) {
      console.error("Database error (current):", err);
      return res.status(500).send("Internal Server Error");
    }

    const currentAppointments = currentResult[0].count;

    db.query(historyQuery, [userId], (err, historyResult) => {
      if (err) {
        console.error("Database error (history):", err);
        return res.status(500).send("Internal Server Error");
      }

      res.render("user-home", {
        currentAppointments: currentAppointments,
        appointmentHistory: historyResult,
      });
    });
  });
});

appLogin.get("/view-mechanics", (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }

  const query = "SELECT * FROM Mechanics";
  db.query(query, (err, mechanics) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Internal Server Error");
    }
    // Ensure mechanics is an array
    const mechanicsArray = Array.isArray(mechanics) ? mechanics : [];
    res.render("view-mechanics", { mechanics: mechanicsArray });
  });
});

// Mechanic Orders (Protected)
appLogin.get("/mechanic-orders", isAuthenticated, (req, res) => {
  if (req.session.role !== "mechanic") {
    return res.status(403).send("Forbidden");
  }
  const mechanicId = req.session.userId;
  const query = "SELECT * FROM Bookings WHERE mechanic_id = ?";
  db.query(query, [mechanicId], (err, bookings) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("mechanic-orders", { orders: bookings });
    }
  });
});

// Search Appointments (Protected)
appLogin.get("/search-appointments", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const mechanicId = req.query.mechanic_id;
  const query = "SELECT * FROM Bookings WHERE mechanic_id = ?";
  db.query(query, [mechanicId], (err, bookings) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).send("Internal Server Error");
    } else {
      db.query(
        "SELECT mechanic_id, name FROM Mechanics WHERE status = 'approved'",
        (err, mechanics) => {
          if (err) {
            console.error("Database error for mechanics:", err);
            res.status(500).send("Internal Server Error");
          } else {
            res.render("mechanic-orders", { orders: bookings, mechanics });
          }
        }
      );
    }
  });
});

// Root Route
appLogin.get("/", (req, res) => {
  if (req.session.userId) {
    if (req.session.role === "admin") return res.redirect("/admin");
    if (req.session.role === "user") return res.redirect("/user-home");
    if (req.session.role === "mechanic") return res.redirect("/mechanic-home");
  }
  res.render("login");
});

// Admin Route (Protected)
appLogin.get("/admin", (req, res) => {
  // Fetch statistics
  const statsQueries = {
    totalCustomers: "SELECT COUNT(*) as count FROM Users",
    totalMechanics:
      "SELECT COUNT(*) as count FROM Mechanics WHERE status = 'approved'",
    pendingAppointments:
      "SELECT COUNT(*) as count FROM Bookings WHERE status = 'pending'",
    totalServices: "SELECT COUNT(*) as count FROM Services",
  };

  const recentAppointmentsQuery = `
    SELECT 
      b.booking_id, 
      u.name AS customer_name, 
      m.name AS mechanic_name, 
      b.booking_date_time, 
      b.status 
    FROM Bookings b
    LEFT JOIN Users u ON b.user_id = u.user_id
    LEFT JOIN Mechanics m ON b.mechanic_id = m.mechanic_id
    ORDER BY b.booking_date_time DESC
    LIMIT 5
  `;

  // Execute stats queries
  Promise.all(
    Object.entries(statsQueries).map(
      ([key, query]) =>
        new Promise((resolve, reject) => {
          db.query(query, (err, result) => {
            if (err) reject(err);
            else resolve({ [key]: result[0].count });
          });
        })
    )
  )
    .then((statsResults) => {
      const stats = Object.assign({}, ...statsResults);

      // Fetch recent appointments
      db.query(recentAppointmentsQuery, (err, recentAppointments) => {
        if (err) {
          console.error("Database error (recent appointments):", err);
          return res.status(500).send("Internal Server Error");
        }

        res.render("admin", {
          stats,
          recentAppointments,
        });
      });
    })
    .catch((err) => {
      console.error("Database error (stats):", err);
      res.status(500).send("Internal Server Error");
    });
});

// Add Mechanic (Protected)
appLogin.get("/add-mechanic", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  res.render("addmechanic");
});

appLogin.post("/add-mechanic", async (req, res) => {
  const { name, email, phone_number, location, experience_years, password } =
    req.body;

  // Validate inputs (basic example)
  if (
    !name ||
    !email ||
    !phone_number ||
    !location ||
    !experience_years ||
    !password
  ) {
    return res.status(400).send("All fields are required");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query =
      "INSERT INTO Mechanics (name, email, phone_number, location, experience_years, password, status) VALUES (?, ?, ?, ?, ?, ?, 'approved')";
    db.query(
      query,
      [name, email, phone_number, location, experience_years, hashedPassword],
      (err, result) => {
        if (err) {
          console.error("Error adding mechanic:", err);
          return res.status(500).send("Error occurred while adding mechanic");
        }
        res.redirect("/mechanic"); // Redirect to admin mechanics list
      }
    );
  } catch (err) {
    console.error("Password hashing error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Services Routes (Protected)
appLogin.get("/Service", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const query = "SELECT * FROM Services";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error retrieving services:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("Service", { services: results });
    }
  });
});

appLogin.post("/Service", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const { service_name, service_type, estimated_cost } = req.body;
  const query =
    "INSERT INTO Services (service_name, service_type, estimated_cost) VALUES (?, ?, ?, ?)";
  db.query(query, [service_name, service_type, estimated_cost], (err) => {
    if (err) {
      console.error("Error adding service:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.redirect("/Service");
    }
  });
});

// Customers (Users) (Protected)
appLogin.get("/customers", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const query = "SELECT * FROM Users";
  db.query(query, (err, users) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("customers", { customers: users });
    }
  });
});

// Mechanics List (Protected)
appLogin.get("/mechanic", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const query = "SELECT * FROM Mechanics";
  db.query(query, (err, mechanics) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Internal Server Error");
    }
    db.query("Select * FROM services", (err, services) => {
      if (err) {
        console.error("Database error (Services):", err);
        return res.status(500).send("Internal Server Error");
      }
      // console.log("Services data:", services);
      res.render("mechanic", { mechanic: mechanics, services: services });
    });
  });
});

// Orders (Bookings) (Protected)
appLogin.get("/orders", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const queryBookings =
    "SELECT booking_id, user_id, booking_date_time FROM Bookings";
  const queryMechanics =
    "SELECT mechanic_id, name FROM Mechanics WHERE status = 'approved'";
  db.query(queryBookings, (err, bookings) => {
    if (err) {
      console.error("Database error for bookings:", err);
      res.status(500).send("Internal Server Error");
    } else {
      db.query(queryMechanics, (err, mechanics) => {
        if (err) {
          console.error("Database error for mechanics:", err);
          res.status(500).send("Internal Server Error");
        } else {
          res.render("orders", { orders: bookings, mechanics });
        }
      });
    }
  });
});

// Assign Mechanic (Protected)
appLogin.post("/assign-mechanic", isAuthenticated, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  const { order_id: booking_id, mechanic_id } = req.body;
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction error:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    const updateBookingQuery =
      "UPDATE Bookings SET mechanic_id = ? WHERE booking_id = ?";
    db.query(updateBookingQuery, [mechanic_id, booking_id], (err) => {
      if (err) {
        return db.rollback(() => {
          console.error("Error updating booking:", err);
          res.status(500).send("Internal Server Error");
        });
      }
      db.commit((err) => {
        if (err) {
          return db.rollback(() => {
            console.error("Error committing transaction:", err);
            res.status(500).send("Internal Server Error");
          });
        }
        res.redirect("/orders");
      });
    });
  });
});

// Book Appointments (Protected)
appLogin.get("/book-appointments", isAuthenticated, (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }
  // Fetch services, cars, and mechanics
  db.query("SELECT * FROM Services", (err, services) => {
    if (err) {
      console.error("Database error (services):", err);
      return res.status(500).send("Internal Server Error");
    }
    db.query(
      "SELECT car_id, make, model, year FROM Cars WHERE user_id = ?",
      [req.session.userId],
      (err, cars) => {
        if (err) {
          console.error("Database error (cars):", err);
          return res.status(500).send("Internal Server Error");
        }
        db.query(
          "SELECT mechanic_id, name, location FROM Mechanics WHERE status = 'approved'",
          (err, mechanics) => {
            if (err) {
              console.error("Database error (mechanics):", err);
              return res.status(500).send("Internal Server Error");
            }
            res.render("book-appointments", { services, cars, mechanics });
          }
        );
      }
    );
  });
});

appLogin.post("/book-appointments", isAuthenticated, (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }
  const { mechanic_id, service_id, car_id, booking_date_time } = req.body;
  const userId = req.session.userId;

  // Check mechanic availability (no overlapping bookings)
  const availabilityQuery = `
    SELECT COUNT(*) as count 
    FROM Bookings 
    WHERE mechanic_id = ? 
    AND booking_date_time = ? 
    AND status NOT IN ('canceled')
  `;
  db.query(
    availabilityQuery,
    [mechanic_id, booking_date_time],
    (err, result) => {
      if (err) {
        console.error("Database error (availability):", err);
        return res.status(500).send("Internal Server Error");
      }
      if (result[0].count > 0) {
        return res
          .status(400)
          .send("This time slot is already booked for the selected mechanic.");
      }

      // Insert the booking
      const insertQuery = `
      INSERT INTO Bookings (user_id, mechanic_id, car_id, service_id, booking_date_time, status) 
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;
      db.query(
        insertQuery,
        [userId, mechanic_id, car_id, service_id, booking_date_time],
        (err) => {
          if (err) {
            console.error("Database error (insert):", err);
            return res.status(500).send("Internal Server Error");
          }
          res.redirect("/user-home");
        }
      );
    }
  );
});

// Logout Route
appLogin.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.redirect("/");
  });
});

appLogin.get("/view-mechanic", (req, res) => {
  const query = `
    SELECT m.mechanic_id, m.name, m.location, m.experience_years,
           GROUP_CONCAT(ms.service_id) as skills,
           AVG(r.rating) as rating
    FROM Mechanics m
    LEFT JOIN Mechanic_Services ms ON m.mechanic_id = ms.mechanic_id
    LEFT JOIN Reviews r ON m.mechanic_id = r.mechanic_id
    WHERE m.status = 'approved'
    GROUP BY m.mechanic_id, m.name, m.location, m.experience_years
  `;
  db.query(query, (err, mechanics) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).send("Internal Server Error");
    } else {
      // Convert skills to a readable string (you might want to join with Services table for names)
      mechanics.forEach((mechanic) => {
        mechanic.skills = mechanic.skills
          ? mechanic.skills.split(",").join(", ")
          : "General Repairs";
        mechanic.rating = mechanic.rating
          ? Math.round(mechanic.rating * 10) / 10
          : 0;
      });
      res.render("view-mechanic", { mechanics });
    }
  });
});

appLogin.get("/view-mechanic/:id", (req, res) => {
  const mechanicId = req.params.id;

  const mechanicQuery = `
    SELECT m.mechanic_id, m.name, m.location, m.experience_years,
           GROUP_CONCAT(ms.service_id) as skills,
           AVG(r.rating) as rating
    FROM Mechanics m
    LEFT JOIN Mechanic_Services ms ON m.mechanic_id = ms.mechanic_id
    LEFT JOIN Reviews r ON m.mechanic_id = r.mechanic_id
    WHERE m.mechanic_id = ? AND m.status = 'approved'
    GROUP BY m.mechanic_id, m.name, m.location, m.experience_years
  `;

  const certQuery =
    "SELECT * FROM Mechanic_Certifications WHERE mechanic_id = ?";
  const reviewQuery =
    "SELECT review_text, created_at FROM Reviews WHERE mechanic_id = ?";

  db.query(mechanicQuery, [mechanicId], (err, mechanicResult) => {
    if (err || mechanicResult.length === 0) {
      console.error("Database error or mechanic not found:", err);
      return res.status(404).send("Mechanic not found");
    }

    const mechanic = mechanicResult[0];
    mechanic.skills = mechanic.skills
      ? mechanic.skills.split(",").join(", ")
      : "General Repairs";
    mechanic.rating = mechanic.rating
      ? Math.round(mechanic.rating * 10) / 10
      : 0;

    db.query(certQuery, [mechanicId], (err, certifications) => {
      if (err) {
        console.error("Database error (certifications):", err);
        return res.status(500).send("Internal Server Error");
      }

      db.query(reviewQuery, [mechanicId], (err, reviews) => {
        if (err) {
          console.error("Database error (reviews):", err);
          return res.status(500).send("Internal Server Error");
        }

        res.render("mechanic-profile", { mechanic, certifications, reviews });
      });
    });
  });
});

appLogin.get("/user-profile", isAuthenticated, (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }
  const userId = req.session.userId;

  const query = "SELECT user_id, email, name, phone_number FROM Users WHERE user_id = ?";
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error fetching user profile:", err);
      return res.status(500).send("Internal Server Error");
    }
    if (results.length === 0) {
      // Should not happen if session is valid, but good practice
      console.error("User not found for profile view:", userId);
      req.session.destroy(); // Log out inconsistent user
      return res.redirect("/");
    }
    res.render("user-profile", { user: results[0], message: req.query.message }); // Pass user data and optional message
  });
});

appLogin.post("/user-profile/update", isAuthenticated, (req, res) => {
  if (req.session.role !== "user") {
    return res.status(403).send("Forbidden");
  }
  const userId = req.session.userId;
  const { name, email, phone_number } = req.body;

  // Basic validation
  if (!name || !email || !phone_number) {
    // More robust validation (e.g., email format) could be added here
    return res.redirect("/user-profile?message=All fields are required.");
  }

  const query = "UPDATE Users SET name = ?, email = ?, phone_number = ? WHERE user_id = ?";
  db.query(query, [name, email, phone_number, userId], (err, result) => {
    if (err) {
      console.error("Database error updating user profile:", err);
      // Check for duplicate email error (MySQL error code 1062)
      if (err.code === 'ER_DUP_ENTRY') {
        return res.redirect("/user-profile?message=Email already in use.");
      }
      return res.redirect("/user-profile?message=Error updating profile.");
    }

    if (result.affectedRows === 0) {
      console.error("User not found for profile update:", userId);
      return res.redirect("/user-profile?message=User not found.");
    }

    console.log(`User profile updated for user_id: ${userId}`);
    res.redirect("/user-profile?message=Profile updated successfully!"); // Redirect back with success message
  });
});

appLogin.listen(3001, () => {
  console.log("Login server running at http://localhost:3001");
});
