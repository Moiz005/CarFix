const express = require("express");
const path = require("path");
const db = require("./dataBase");
const appIndex = express();

appIndex.set("views", path.join(__dirname, "views"));
appIndex.set("view engine", "ejs");
appIndex.use(express.urlencoded({ extended: true }));
appIndex.use(express.static(path.join(__dirname, "..", "public")));

appIndex.get("/", (req, res) => {
  res.render("index");
});

appIndex.post("/create-appointment", (req, res) => {
  const { owner, brand, plate, date, time, issue } = req.body;
  const appointmentDateTime = `${date} ${time}`;

  // Insertinmg into customers table
  const customerQuery =
    "INSERT INTO customers (name, car_model, notes) VALUES (?, ?, ?)";
  db.query(customerQuery, [owner, brand, issue], (err, customerResult) => {
    if (err) {
      console.error("Error occurred:", err);
      return res.status(500).send("Error saving customer data");
    }
    const customerId = customerResult.insertId;
    const appointmentQuery =
      "INSERT INTO appointments (owner_name, car_brand, plate_number, appointment_date, customer_id, notes) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(
      appointmentQuery,
      [owner, brand, plate, appointmentDateTime, customerId, issue],
      (err, appointmentResult) => {
        if (err) {
          console.error("Error occurred:", err);
          return res.status(500).send("Error saving the appointment");
        }

        res.render("appointment-successful");
      }
    );
  });
});

appIndex.get("/booking", (req, res) => {
  res.render("index");
});

appIndex.listen(3000, () => {
  console.log("Index server running at http://localhost:3000");
});
