/*
  # Add INSERT policy for user registration

  1. Security Changes
    - Add policy to allow authenticated users to insert their own profile during registration
    - This enables the registration process to work properly while maintaining security

  The policy ensures users can only create a profile for themselves (where id matches auth.uid())
*/

-- Add policy to allow users to insert their own profile during registration
CREATE POLICY "Users can create own profile"
  ON fw_users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());