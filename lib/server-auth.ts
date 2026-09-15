import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

/**
 * Verify that the incoming request has a valid Firebase Auth ID Token.
 * Returns the decoded token if valid, or null if missing/invalid.
 */
export async function verifyAuthToken(request: Request | NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) return null;

    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded as AuthenticatedUser;
  } catch (error) {
    console.warn('Auth token verification failed:', error);
    return null;
  }
}

/**
 * Verify that the incoming request is made by an authenticated admin user.
 * Checks the 'users' collection in Firestore using Firebase Admin SDK.
 */
export async function verifyAdminToken(request: Request | NextRequest): Promise<AuthenticatedUser | null> {
  const user = await verifyAuthToken(request);
  if (!user) return null;

  try {
    const userDoc = await getAdminDb().collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return null;
    }
    return { ...user, role: 'admin' };
  } catch (error) {
    console.error('Error checking admin role:', error);
    return null;
  }
}
