const express = require('express');
const app = express();
const { Client } = require('pg');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

// Database connection
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'ecom',
  password: '1234',
  port: 5432,
});
client.connect();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public'))); 

// Session setup
app.use(session({
  secret: 'your_secret_key', 
  resave: false,
  saveUninitialized: true,
}));

// View engine setup
app.set('view engine', 'ejs');

// Route for home or root page
app.get('/', (req, res) => {
  if (req.session.user) {
    // If logged in, redirect to products page
    res.redirect('/products');
  } else {
    // If not logged in, redirect to signup page first
    res.redirect('/signup');
  }
});

// Route to render signup page
app.get('/signup', (req, res) => {
  res.render('signup'); // Render signup form
});

// Route to handle signup form submission
app.post('/signup', (req, res) => {
  const { username, password } = req.body;

  // Insert new user into the database
  const query = 'INSERT INTO users (username, password) VALUES ($1, $2)';
  client.query(query, [username, password], (err) => {
    if (err) {
      console.error('Error inserting user:', err);
      res.send('Error: Could not sign up. Try a different username.');
    } else {
      console.log('User registered successfully!');
      res.redirect('/login'); // Redirect to login page after successful signup
    }
  });
});

// Route for the login page
app.get('/login', (req, res) => {
  res.render('login'); // Render login form
});

// Login authentication logic
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Query to check if the user exists with the provided credentials
  client.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.send('An error occurred, please try again.');
    }

    if (result.rows.length > 0) {
      // If user exists, store user information in session and redirect to products page
      req.session.user = result.rows[0]; // Store user in session
      res.redirect('/products');
    } else {
      // If credentials are incorrect, show error message
      res.send('Invalid credentials, please try again!');
    }
  });
});

// Route for the products page (only accessible after login)
app.get('/products', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // If not logged in, redirect to login page
  }

  // Query to fetch products from the database
  client.query('SELECT * FROM products', (err, result) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.send('Error fetching products.');
    }
    res.render('index', { products: result.rows }); // Render products page
  });
});

// Route to handle adding items to the cart
app.post('/add-to-cart', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect to login if not logged in
  }

  const userId = req.session.user.id; // Assuming user ID is stored in session
  const productId = req.body.product_id;

  // Check if the product is already in the cart
  const checkQuery = 'SELECT * FROM cart WHERE user_id = $1 AND product_id = $2';
  client.query(checkQuery, [userId, productId], (err, result) => {
    if (err) {
      console.error('Error checking cart:', err);
      return res.send('Error adding to cart.');
    }

    console.log('Cart check result:', result.rows); // Log the cart check result for debugging

    if (result.rows.length > 0) {
      // If product exists in cart, update the quantity
      const updateQuery = 'UPDATE cart SET quantity = quantity + 1 WHERE user_id = $1 AND product_id = $2';
      client.query(updateQuery, [userId, productId], (err) => {
        if (err) {
          console.error('Error updating cart:', err);
          return res.send('Error updating cart.');
        }
        res.redirect('/products'); 
      });
    } else {
      // If product does not exist in cart, insert it
      const insertQuery = 'INSERT INTO cart (user_id, product_id) VALUES ($1, $2)';
      client.query(insertQuery, [userId, productId], (err) => {
        if (err) {
          console.error('Error inserting into cart:', err);
          return res.send('Error adding to cart.');
        }
        res.redirect('/products'); 
      });
    }
  });
});

// Route to view cart
app.get('/cart', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); 
  }

  const userId = req.session.user.id;
  const query = 'SELECT * FROM cart JOIN products ON cart.product_id = products.id WHERE cart.user_id = $1';

  client.query(query, [userId], (err, result) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.send('Error fetching cart.');
    }
    res.render('cart', { cartItems: result.rows }); 
  });
});

// Route to handle logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.send('Error logging out');
    }
    res.redirect('/login'); 
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
