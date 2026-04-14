-- Supplier contacts dataset: create DB, load CSV, and normalize key fields.
CREATE DATABASE supplier_contacts;

\c supplier_contacts

CREATE TABLE suppliers_raw (
    supplier_id TEXT,
    supplier_name TEXT,
    commercial_contact TEXT,
    email TEXT,
    phone TEXT,
    outstanding_balance_raw TEXT,
    last_purchase_date_raw TEXT,
    ignored_column TEXT
);

COPY suppliers_raw
FROM '/data/supplier-contacts.csv'
WITH (
    FORMAT CSV,
    HEADER,
    NULL ''
);

CREATE TABLE suppliers (
    supplier_id VARCHAR(10) PRIMARY KEY,
    supplier_name TEXT,
    commercial_contact TEXT,
    email TEXT,
    phone TEXT,
    outstanding_balance_eur NUMERIC(12, 2),
    last_purchase_date DATE
);

INSERT INTO suppliers (
    supplier_id,
    supplier_name,
    commercial_contact,
    email,
    phone,
    outstanding_balance_eur,
    last_purchase_date
)
SELECT
    NULLIF(BTRIM(supplier_id), ''),
    NULLIF(BTRIM(supplier_name), ''),
    NULLIF(BTRIM(commercial_contact), ''),
    NULLIF(BTRIM(email), ''),
    NULLIF(BTRIM(phone), ''),
    CASE
        WHEN NULLIF(BTRIM(outstanding_balance_raw), '') IS NULL THEN NULL
        ELSE REPLACE(
            REGEXP_REPLACE(BTRIM(outstanding_balance_raw), '[^0-9,.\-]', '', 'g'),
            ',',
            ''
        )::NUMERIC(12, 2)
    END,
    CASE
        WHEN NULLIF(BTRIM(last_purchase_date_raw), '') IS NULL THEN NULL
        ELSE TO_DATE(BTRIM(last_purchase_date_raw), 'DD/MM/YYYY')
    END
FROM suppliers_raw;

DROP TABLE suppliers_raw;

CREATE INDEX idx_suppliers_name ON suppliers (supplier_name);
CREATE INDEX idx_suppliers_email ON suppliers (email);
CREATE INDEX idx_suppliers_last_purchase_date ON suppliers (last_purchase_date);
