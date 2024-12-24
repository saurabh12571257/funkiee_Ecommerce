import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from 'dotenv';
import bcrypt from "bcryptjs";

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

let currentUserId = null;


async function checkVisited() {
  if (!currentUserId) return [];
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}


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

    currentUserId = user.id;
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error.");
  }
});

app.post("/register", async (req, res) => {
  const { name, email, password, color } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, color) VALUES ($1, $2, $3, $4);",
      [name, email, hashedPassword, color]
    );
    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Server error.");
  }
});

async function getCurrentUser() {
  if (!currentUserId) return null;
  const result = await db.query("SELECT * FROM users WHERE id = $1;", [
    currentUserId,
  ]);
  return result.rows[0];
}

app.get("/", async (req, res) => {
  if (!currentUserId) {
    return res.redirect("/login");
  }
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: [],
    color: currentUser ? currentUser.color : "white",
  });
});

app.get("/register", async(req,res) => {
  res.render("register.ejs");
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
