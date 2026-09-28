import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
      try {
              const { email } = await req.json()
              if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

        const user = await prisma.user.findFirst({
                  where: { email: { equals: email, mode: 'insensitive' } },
        })

        // Always return success to prevent email enumeration
        if (!user) return NextResponse.json({ success: true })

        const token = crypto.randomBytes(32).toString('hex')
              const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

        await prisma.user.update({
                  where: { id: user.id },
                  data: { resetToken: token, resetTokenExpiry: expiry },
        })

        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

        await resend.emails.send({
                  from: 'FR0ST <onboarding@resend.dev>',
                  to: user.email,
                  subject: 'Reset your FR0ST password',
                  html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h2 style="color:#f59e0b;margin-bottom:8px;">FR0ST</h2><p>Hi ${user.name},</p><p>Click the link below to reset your password. It expires in <strong>1 hour</strong>.</p><a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f59e0b;color:#000;text-decoration:none;border-radius:6px;font-weight:600;">Reset Password</a><p style="color:#888;font-size:13px;">If you did not request this, you can safely ignore this email.</p></div>`,
        })

        return NextResponse.json({ success: true })
      } catch (err) {
              console.error('[forgot-password]', err)
              return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
      }
}
