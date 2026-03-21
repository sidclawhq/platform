CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price DECIMAL);
CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, email TEXT, ssn TEXT);
CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INT, product_id INT, total DECIMAL);

INSERT INTO products VALUES (1, 'Widget A', 29.99), (2, 'Widget B', 49.99);
INSERT INTO customers VALUES (1, 'Alice Johnson', 'alice@example.com', '***-**-1234');
INSERT INTO orders VALUES (1, 1, 1, 29.99);
