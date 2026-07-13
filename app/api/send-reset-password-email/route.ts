import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // สร้าง password reset link ด้วย Firebase Admin
    const resetLink = await getAdminAuth().generatePasswordResetLink(email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/action`,
    });

    // ส่ง HTML email สวยงามผ่าน Resend
    const { error } = await resend.emails.send({
      from: "หอพักหยาหยี๋ <onboarding@resend.dev>",
      to: email,
      subject: "🔒 รีเซ็ตรหัสผ่านของคุณ — หอพักหยาหยี๋",
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>รีเซ็ตรหัสผ่าน</title>
</head>
<body style="margin:0;padding:0;background-color:#f5efe6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5efe6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c8a45e 0%,#8b6914 100%);padding:36px 32px;text-align:center;">
              <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:32px;">🔐</span>
              </div>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">หอพักหยาหยี๋ออนไลน์</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Yayee Dormitory Management</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 8px;color:#4a3728;font-size:15px;font-weight:600;">สวัสดี 👋</p>
              <p style="margin:0 0 24px;color:#6b5744;font-size:14px;line-height:1.7;">
                เราได้รับคำขอให้รีเซ็ตรหัสผ่านบัญชีของคุณ<br/>
                กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${resetLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#c8a45e 0%,#8b6914 100%);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(139,105,20,0.3);">
                  🔒 รีเซ็ตรหัสผ่านของฉัน
                </a>
              </div>

              <p style="margin:0 0 6px;color:#9e8875;font-size:12px;text-align:center;">
                หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่านนี้ สามารถเพิกเฉยต่ออีเมลนี้ได้
              </p>
              <p style="margin:0;color:#9e8875;font-size:12px;text-align:center;">
                หากปุ่มด้านบนใช้งานไม่ได้ ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์
              </p>

              <!-- Fallback link -->
              <div style="margin-top:12px;padding:12px 16px;background:#faf6f0;border-radius:10px;border:1px solid #e8d5b7;word-break:break-all;">
                <a href="${resetLink}" style="color:#c8a45e;font-size:11px;text-decoration:none;">${resetLink}</a>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #f0e6d3;margin:0;"/>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;">
              <p style="margin:0;color:#c8b8a8;font-size:11px;">
                © 2025 Yayee Dormitory Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email", detail: error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Send reset password email error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
