-- Rename company_name to company in jobs table for consistency
-- The code references company_name everywhere, but the DB column is 'company'
-- Quick fix: just rename the code to use 'company' which matches the DB

-- For now, add a view/mapping so both work
-- Actually the simplest fix: add a company_name generated column
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_name TEXT GENERATED ALWAYS AS (company) STORED;
