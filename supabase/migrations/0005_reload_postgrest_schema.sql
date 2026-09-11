-- Make newly added RPC signatures immediately visible through the Data API.
notify pgrst, 'reload schema';
