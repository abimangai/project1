const express = require("express");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql");
const cors = require("cors");
const app = express();
const port = 2403;

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use("/uploads", express.static("uploads"));
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (_request, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Check for common image MIME types
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
  fileFilter: fileFilter,
});
// Parse JSON requests
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// MySQL connection configuration
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "DSA",
  database: "productsdb",
  port: "3307"
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL as id " + db.threadId);
});

// API endpoint to create a new product with file upload
app.post("/product", upload.single("photo_url"), async (req, res, _next) => {
  console.log("Received request:", req);

  // Add these log statements for debugging

  const {
    title,
    description,
    price,
    category,
    phone_number,
    price_negotiation,
  } = req.body;

  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

  console.log("Extracted values:", {
    title,
    description,
    price,
    category,
    phone_number,
    photo_url,
    price_negotiation,
  });

  const insertQuery = `
    INSERT INTO products
    (title, description, price, category, phone_number, photo_url, price_negotiation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertQuery,
    [
      title,
      description,
      price,
      category,
      phone_number,
      photo_url,
      price_negotiation,
    ],
    (err, result) => {
      if (err) {
        console.error("Error inserting product: " + err.message);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      console.log("Product inserted successfully:", result);
      res.redirect("/FRONTEND/HTML_Pages/products.html");
      // res.status(201).json({
      //   message: "Product created successfully",
      //   productId: result.insertId,
      // });
    }
  );
});
app.get("/products", (req, res) => {
  // Fetch and return products from the database
  const fetchProductsQuery = `
      SELECT id,title, description, price, category, phone_number, photo_url, price_negotiation FROM products;
    `;

  db.query(fetchProductsQuery, (err, results) => {
    if (err) {
      console.error("Error fetching products: " + err.message);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    res.json(results);
    console.log(results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/FRONTEND/HTML_Pages/index.html");
});
app.get("/sell", (req, res) => {
  res.sendFile(__dirname + "/FRONTEND/HTML_Pages/sell.html");
});

app.get("/products", (req, res) => {
  res.sendFile(__dirname + "/FRONTEND/HTML_Pages/products.html");
});
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/FRONTEND/HTML_Pages/login.html");
});
app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/FRONTEND/HTML_Pages/register.html");
});

//login & reg
app.use(bodyParser.urlencoded({ extended: true }));
db.query(
  `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  );
`,
  (err) => {
    if (err) {
      console.error("Error creating users table: " + err.message);
    } else {
      console.log("Users table created successfully");
    }
  }
);
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert user into the database
  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err, result) => {
      if (err) {
        console.error("Error registering user: " + err.message);
        res.status(500).send("Internal Server Error");
        return;
      }

      console.log("User registered successfully...");
      res.redirect("/FRONTEND/HTML_Pages/login.html");
      // Fetch the registered user information
      db.query(
        "SELECT id, email FROM users WHERE id = ?",
        [result.insertId],
        (err, userDetails) => {
          if (err) {
            console.error("Error fetching user details: " + err.message);
            res.status(500).send("Internal Server Error");
            return;
          }

          // Send user information as JSON response
          const user = userDetails[0];
          //if disable the comment it will redirect the account page from register
          //res.redirect("/FRONTEND/HTML_Pages/account.html");
          // res.redirect(
          //   `/FRONTEND/HTML_Pages/account.html?email=${encodeURIComponent(
          //     user.email
          //   )}`
          // );
        }
      );
    }
  );
});

// Login endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Retrieve user from the database
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Error retrieving user: " + err.message);
        res.status(500).send("Internal Server Error");
        return;
      }

      if (results.length > 0) {
        // User found, compare hashed password
        const match = await bcrypt.compare(password, results[0].password);

        if (match) {
          console.log("User logged in successfully");
          // Store user information in session
          req.session.user = {
            userId: results[0].id,
            email: results[0].email,
          };

          // res.send("Login successful!");
          res.redirect("/FRONTEND/HTML_Pages/products.html");
        } else {
          console.log("Incorrect password");
          res.status(401).send("Incorrect password");
        }
      } else {
        console.log("User not found");
        res.status(404).send("User not found");
      }
    }
  );
});

app.get("/account", (req, res) => {
  // Retrieve user information from session
  const user = req.session.user;

  if (user) {
    //res.send(`<h1>User Account Information</h1><p>Email: ${user.email}</p>`);
    res.json({
      email: user.email,
    });
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.get("/products/:id", (req, res) => {
  const productId = req.params.id;

  // Assuming you have a MySQL database connection named `db`
  db.query(
    "SELECT * FROM products WHERE id = ?",
    [productId],
    (err, results) => {
      if (err) {
        console.error("Error fetching product details:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (results.length === 0) {
        // Product with the specified id not found
        res.status(404).json({ error: "Product not found" });
        return;
      }

      // Product details found, send them as JSON
      const productDetails = results[0];
      res.json(productDetails);
    }
  );
});
