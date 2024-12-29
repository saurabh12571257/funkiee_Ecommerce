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
app.use(cookieParser());

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).redirect('/login');
  }
};

// Routes
app.get("/", async (req, res) => {
  try {
    const products = await db.query("SELECT * FROM products LIMIT 8");
    res.render("index.ejs", { 
      products: products.rows,
      categories: [],
      user: req.user || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching data");
  }
});

// Product routes
app.get("/products", async (req, res) => {
  try {
    const products = await db.query("SELECT * FROM products");
    res.render("products.ejs", { 
      products: products.rows,
      user: req.user || null
    });
  } catch (error) {
    res.status(500).send("Error fetching products");
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = await db.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    res.render("product-detail.ejs", { 
      product: product.rows[0],
      user: req.user || null
    });
  } catch (error) {
    res.status(500).send("Error fetching product");
  }
});

// Cart routes
app.post("/cart/add", verifyToken, async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    await db.query(
      "INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)",
      [req.user.id, productId, quantity]
    );
    res.redirect("/cart");
  } catch (error) {
    res.status(500).send("Error adding to cart");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
