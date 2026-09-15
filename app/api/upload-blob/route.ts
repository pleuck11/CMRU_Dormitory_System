import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server-auth';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await verifyAuthToken(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: กรุณาเข้าสู่ระบบก่อนทำรายการ' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return NextResponse.json(
      { error: 'Filename is required' },
      { status: 400 }
    );
  }

  try {
    const blob = await put(filename, request.body as ReadableStream, {
      access: 'public',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
