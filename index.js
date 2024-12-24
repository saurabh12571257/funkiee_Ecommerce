import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

dotenv.config();
const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres1",
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser()); // Use cookie-parser middleware

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Function to generate JWT token
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "1h", // Token expires in 1 hour
  });
}

let currentUserId = null;

async function checkVisited() {
  if (!currentUserId) return [];
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.cookies.authToken || req.headers["authorization"];
  if (!token) {
    return res.redirect("/login");
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.redirect("/login");
    }

    req.user = decoded;
    currentUserId = decoded.id;  // Set the current user ID from the token
    next();
  });
}

// Home page route (requires JWT authentication)
app.get("/", verifyToken, async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: [],
    color: currentUser ? currentUser.color : "white",
  });
});

app.get("/register", (req, res) => {
  res.render("register.ejs"); // This will render the register.ejs page
});

// Registration route
app.post("/register", async (req, res) => {
  const { name, email, password, color } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, color) VALUES ($1, $2, $3, $4);",
      [name, email, hashedPassword, color]
    );

    const userResult = await db.query("SELECT * FROM users WHERE email = $1;", [email]);
    const user = userResult.rows[0];
    const token = generateToken(user);

    res.cookie("authToken", token, { httpOnly: true });

    res.render("login.ejs", { error: "" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Server error.");
  }
});

// Serve the login page when the user accesses the /login route
app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});


// Login route with JWT authentication
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1;", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.render("login.ejs", { error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("login.ejs", { error: "Invalid email or password." });
    }

    const token = generateToken(user);

    res.cookie("authToken", token, { httpOnly: true });

    currentUserId = user.id;
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error.");
  }
});

// Logout route (clear JWT token)
app.get("/logout", (req, res) => {
  res.clearCookie("authToken"); // Clear the JWT token cookie
  res.redirect("/login");
});

// Access page to verify token and access the protected content
app.get("/access", verifyToken, (req, res) => {
  res.send("You are authenticated and can access this page!");
});

// Function to get the current user
async function getCurrentUser() {
  if (!currentUserId) return null;
  const result = await db.query("SELECT * FROM users WHERE id = $1;", [
    currentUserId,
  ]);
  return result.rows[0];
}


app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE to_tsvector(country_name) @@ to_tsquery($1);",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
