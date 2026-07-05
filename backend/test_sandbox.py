"""
backend/test_sandbox.py

Unit test script to verify query auditing, column sanitization, 
and pandas-to-postgres schema parsing logic without needing live DB secrets.
"""

import unittest
import pandas as pd
from io import BytesIO

# Import the core logic directly from main.py
from main import (
    sanitize_column_name,
    deduplicate_columns,
    audit_table_references,
)

class TestTextToSQLSandbox(unittest.TestCase):

    def test_column_sanitization(self):
        """Verify that column names are properly cleaned and lowercased."""
        self.assertEqual(sanitize_column_name("First Name"), "first_name")
        self.assertEqual(sanitize_column_name("Salary ($)"), "salary____")
        self.assertEqual(sanitize_column_name("123_count"), "col_123_count")
        self.assertEqual(sanitize_column_name("   Spaces   "), "spaces")
        self.assertEqual(sanitize_column_name("A" * 100), "a" * 63)  # Trim to 63 chars

    def test_column_deduplication(self):
        """Verify that duplicate columns are suffixed with incremental counters."""
        cols = ["name", "age", "name", "salary", "name"]
        deduped = deduplicate_columns(cols)
        self.assertEqual(deduped, ["name", "age", "name_1", "salary", "name_2"])

    def test_audit_table_references_allowed(self):
        """Verify that standard SELECT queries on allowed tables succeed."""
        allowed = ["upload_sales123", "upload_regions456"]
        
        # Simple select
        self.assertTrue(audit_table_references('SELECT * FROM csv_data."upload_sales123"', allowed))
        # Case insensitive check
        self.assertTrue(audit_table_references('select * from csv_data."upload_sales123"', allowed))
        # CTE queries
        cte_query = """
        WITH regional_sales AS (
            SELECT region_id, sum(revenue) as total FROM csv_data."upload_sales123" GROUP BY region_id
        )
        SELECT r.name, s.total 
        FROM regional_sales s 
        JOIN csv_data."upload_regions456" r ON r.id = s.region_id;
        """
        self.assertTrue(audit_table_references(cte_query, allowed))

    def test_audit_table_references_blocked(self):
        """Verify that mutations, schema manipulation, and unauthorized tables are blocked."""
        allowed = ["upload_sales123"]
        
        # Mutation check
        self.assertFalse(audit_table_references('INSERT INTO csv_data."upload_sales123" VALUES (1)', allowed))
        self.assertFalse(audit_table_references('DELETE FROM csv_data."upload_sales123"', allowed))
        self.assertFalse(audit_table_references('DROP TABLE csv_data."upload_sales123"', allowed))
        
        # Attempt to access metadata table
        self.assertFalse(audit_table_references('SELECT * FROM public.db_connections', allowed))
        self.assertFalse(audit_table_references('SELECT * FROM query_logs', allowed))
        
        # Attempt to access pg_catalog/information_schema
        self.assertFalse(audit_table_references('SELECT * FROM pg_catalog.pg_tables', allowed))
        self.assertFalse(audit_table_references('SELECT * FROM information_schema.tables', allowed))
        
        # Non-allowed tables
        self.assertFalse(audit_table_references('SELECT * FROM csv_data."some_other_table"', allowed))

    def test_pandas_casting_nulls(self):
        """Verify that NaN values are correctly converted to None, and integers preserved."""
        csv_data = b"id,name,value\n1,Alice,10.0\n2,Bob,\n3,Charlie,25.5"
        df = pd.read_csv(BytesIO(csv_data))
        
        # Verify initial types
        self.assertTrue(pd.api.types.is_float_dtype(df["value"]))
        
        # Apply casting as done in main.py
        for col in df.columns:
            if df[col].dtype == "float64" and df[col].dropna().apply(float.is_integer).all():
                df[col] = df[col].astype("Int64")
        
        df = df.where(df.notna(), other=None)
        
        records = [
            tuple(None if pd.isna(v) or v is pd.NA else v for v in row)
            for row in df.values.tolist()
        ]
        
        self.assertEqual(records[0], (1, "Alice", 10.0))
        self.assertEqual(records[1], (2, "Bob", None))
        self.assertEqual(records[2], (3, "Charlie", 25.5))

if __name__ == "__main__":
    unittest.main()
