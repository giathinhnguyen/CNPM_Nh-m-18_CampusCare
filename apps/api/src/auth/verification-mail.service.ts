import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class VerificationMailService {
  async sendCode(email: string, code: string, purpose: 'registration' | 'password-setup' = 'registration') {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    const port = Number(process.env.SMTP_PORT || 465);
    if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException('Chức năng gửi email xác minh chưa được cấu hình. Vui lòng thử lại sau.');
    }
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      const action = purpose === 'password-setup' ? 'đặt mật khẩu BrewLite' : 'đăng ký BrewLite';
      const result = await transport.sendMail({
        from, to: email,
        subject: `Mã xác minh ${action}`,
        text: `Mã xác minh ${action} của bạn là: ${code}\n\nMã có hiệu lực trong 5 phút và chỉ dùng một lần. Không chia sẻ mã này.\nNếu bạn không yêu cầu ${action}, hãy bỏ qua email này.`,
      });
      if (!result.accepted.length || result.rejected.length) throw new Error('Recipient rejected');
    } catch {
      // Do not expose SMTP credentials, provider errors or the code in logs/API.
      throw new ServiceUnavailableException('Không gửi được email xác minh. Vui lòng thử lại sau.');
    } finally {
      transport.close();
    }
  }
}
