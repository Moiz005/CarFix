const mysql = require("mysql2");

// Database connection configuration
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "mechanic",
  authPlugin: "mysql_native_password", // Specify the authentication plugin
};

// Create a MySQL connection
const connection = mysql.createConnection(dbConfig);

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database: " + err.stack);
    return;
  }
  console.log("Connected to database with ID " + connection.threadId);
});

module.exports = connection;
