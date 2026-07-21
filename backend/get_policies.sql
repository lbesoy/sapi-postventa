CREATE OR REPLACE FUNCTION get_pg_policies()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(p)) INTO result FROM pg_policies p WHERE schemaname = 'public';
  return result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
