import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface User {
  id: string;
  email: string;
  organization_id?: string;
}

/**
 * Get user from request headers or authentication
 * This is a placeholder implementation
 */
export async function getUser(request: NextRequest): Promise<User | null> {
  try {
    // For now, return a mock user for development
    // In production, this should validate JWT tokens or session cookies
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return null;
    }

    // Mock user for development
    return {
      id: 'dev-user-id',
      email: 'dev@example.com',
      organization_id: '24e4bb55-c32f-4e38-9bee-b18472fa9f88'
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Validate if user has access to organization
 */
export async function validateUserAccess(userId: string, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('owner_id', userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error validating user access:', error);
    return false;
  }
}