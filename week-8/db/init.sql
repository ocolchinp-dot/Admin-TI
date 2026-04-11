-- Online Retail dataset: create DB, load CSV (DD/MM/YY UK date format)
CREATE DATABASE online_retail;

\c online_retail

SET datestyle = 'ISO, DMY';

-- Column names match CSV headers for COPY ... WITH (HEADER)
CREATE TABLE transactions (
    "InvoiceNo"   VARCHAR(10),
    "StockCode"   VARCHAR(20),
    "Description" TEXT,
    "Quantity"    INTEGER,
    "InvoiceDate" TIMESTAMP,
    "UnitPrice"   NUMERIC(10, 2),
    "CustomerID"  VARCHAR(10),
    "Country"     VARCHAR(50)
);

COPY transactions
FROM '/data/online-retail.csv'
WITH (
    FORMAT CSV,
    HEADER,
    NULL ''
);

CREATE INDEX idx_transactions_invoice_no ON transactions ("InvoiceNo");
CREATE INDEX idx_transactions_customer_id ON transactions ("CustomerID");
CREATE INDEX idx_transactions_country ON transactions ("Country");
CREATE INDEX idx_transactions_invoice_date ON transactions ("InvoiceDate");
